import {
  WaffoPancake,
  verifyWebhook,
  type WebhookEvent,
  type WebhookEventData,
} from "@waffo/pancake-ts";
import type { Bindings } from "./env";
import { AppError } from "./auth";
import { applyPayment, type OrderRow } from "./credits";
import { PACKAGES } from "./catalog";
export function cents(value: string | undefined) {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value))
    throw new AppError(422, "Missing or invalid payment amount.");
  const [a, b = ""] = value.split(".");
  const result = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(result))
    throw new AppError(422, "Payment amount out of range.");
  return result;
}
export async function createCheckout(
  e: Bindings,
  u: { id: string; email: string },
  packageId: string,
  mock: boolean,
) {
  const p = PACKAGES.find((v) => v.id === packageId);
  if (!p) throw new AppError(400, "Unknown credit package.");
  if (!mock && e.PAYMENTS_ENABLED !== "true")
    throw new AppError(
      503,
      "Purchases are not available yet. Please check back after launch.",
    );
  if (!mock && e.WAFFO_ENVIRONMENT === "prod" && e.MERCHANT_APPROVED !== "true")
    throw new AppError(503, "Live payments have not been approved.");
  const productId = mock
    ? "mock-" + p.id
    : {
        lite: e.WAFFO_PRODUCT_LITE,
        standard: e.WAFFO_PRODUCT_STANDARD,
        pro: e.WAFFO_PRODUCT_PRO,
      }[p.id];
  if (!productId) throw new AppError(503, "Payment product is not configured.");
  const id = crypto.randomUUID();
  await e.DB.prepare(
    "INSERT INTO payment_orders (id,user_id,package_id,product_id,cents,credits,tier,mode,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
  )
    .bind(
      id,
      u.id,
      p.id,
      productId,
      p.cents,
      p.credits,
      p.tier,
      mock ? "mock" : e.WAFFO_ENVIRONMENT || "test",
      Date.now(),
    )
    .run();
  if (mock) return { url: "/checkout?order=" + id };
  if (!e.WAFFO_MERCHANT_ID || !e.WAFFO_PRIVATE_KEY)
    throw new AppError(503, "Payment credentials are not configured.");
  const client = new WaffoPancake({
    merchantId: e.WAFFO_MERCHANT_ID,
    privateKey: e.WAFFO_PRIVATE_KEY,
  });
  const result = await client.checkout.authenticated.create(
    {
      productId,
      currency: "USD",
      buyerIdentity: u.id,
      buyerEmail: u.email,
      orderMerchantExternalId: id,
      metadata: { packageId: p.id, productId },
      successUrl: e.APP_ORIGIN + "/dashboard/billing",
    },
    { idempotencyKey: id },
  );
  await e.DB.prepare("UPDATE payment_orders SET checkout_url=? WHERE id=?")
    .bind(result.checkoutUrl, id)
    .run();
  return { url: result.checkoutUrl };
}
export function verifyPaymentEvent(
  raw: string,
  header: string | null,
  environment: "test" | "prod",
  publicKey?: string,
) {
  return verifyWebhook<WebhookEventData>(raw, header, {
    environment,
    ...(publicKey ? { publicKey } : {}),
  });
}
export async function processPaymentEvent(
  db: D1Database,
  event: WebhookEvent<WebhookEventData>,
  expectedMode: string,
) {
  if (event.mode !== expectedMode)
    throw new AppError(400, "Payment environment mismatch.");
  if (
    !["order.completed", "refund.succeeded", "refund.failed"].includes(
      event.eventType,
    )
  )
    return;
  const prior = await db
    .prepare("SELECT order_id,type FROM payment_events WHERE id=?")
    .bind(event.id)
    .first<{ order_id: string; type: string }>();
  if (prior) {
    if (
      prior.order_id !== event.data.orderMerchantExternalId ||
      prior.type !== event.eventType
    )
      throw new AppError(409, "Webhook event ID conflict.");
    return;
  }
  const d = event.data;
  if (!event.id || !event.eventId || !d.orderId || !d.orderMerchantExternalId)
    throw new AppError(422, "Missing payment identifiers.");
  const order = await db
    .prepare("SELECT * FROM payment_orders WHERE id=?")
    .bind(d.orderMerchantExternalId)
    .first<OrderRow>();
  if (!order || order.mode !== expectedMode)
    throw new AppError(422, "Unknown order.");
  if (order.provider_id && order.provider_id !== d.orderId)
    throw new AppError(422, "Provider order mismatch.");
  if (
    d.currency !== order.currency ||
    d.merchantProvidedBuyerIdentity !== order.user_id
  )
    throw new AppError(422, "Order ownership or currency mismatch.");
  if (event.eventType === "refund.failed") {
    await db
      .prepare("INSERT OR IGNORE INTO payment_events VALUES (?,?,?,?)")
      .bind(event.id, order.id, event.eventType, Date.now())
      .run();
    return;
  }
  if (event.eventType === "order.completed") {
    if (d.orderStatus !== "completed" || d.paymentStatus !== "succeeded")
      throw new AppError(422, "Payment not completed.");
    if (
      d.orderMetadata?.productId !== order.product_id ||
      d.productMetadata?.packageId !== order.package_id
    )
      throw new AppError(422, "Product mismatch.");
    const subtotal = cents(d.listPrice?.subtotal),
      tax = cents(d.listPrice?.taxAmount),
      total = cents(d.listPrice?.total);
    if (
      subtotal !== order.cents ||
      total !== subtotal + tax ||
      cents(d.chargedAmount) !== total
    )
      throw new AppError(422, "Payment amount mismatch.");
  } else {
    if (
      d.refundStatus !== "succeeded" ||
      !d.originalChargedAmount ||
      cents(d.refundedAmount) !== cents(d.originalChargedAmount)
    )
      throw new AppError(
        422,
        "Partial or unconfirmed refund requires manual reconciliation.",
      );
    const subtotal = cents(d.originalPayment?.subtotal);
    if (subtotal !== order.cents)
      throw new AppError(422, "Original payment mismatch.");
  }
  await applyPayment(db, order, {
    id: event.id,
    type: event.eventType as "order.completed" | "refund.succeeded",
    providerId: d.orderId,
  });
}
