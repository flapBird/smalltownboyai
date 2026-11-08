import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { generateKeyPairSync, createSign } from "node:crypto";
import {
  reserveTask,
  settleTask,
  applyPayment,
  type OrderRow,
} from "../lib/credits";
import {
  verifyPaymentEvent,
  processPaymentEvent,
  cents,
  createCheckout,
} from "../lib/payments";
import { PACKAGES } from "../lib/catalog";
import {
  TEMPLATES,
  signedTemplateURL,
  validTemplateSignature,
} from "../lib/templates";
import { WaveSpeed } from "../lib/providers/wavespeed";
import { handle } from "../lib/api";
import { reconcile } from "../lib/jobs";
import { type Bindings } from "../lib/env";
import { imageInfo, signature, validSignature } from "../lib/media";
let mf: Miniflare, db: D1Database, e: Bindings;
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("test")}}',
      d1Databases: ["DB"],
      r2Buckets: ["MEDIA"],
      compatibilityDate: "2026-10-01",
    }),
  );
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  e = {
    DB: db,
    MEDIA: (await mf.getR2Bucket("MEDIA")) as unknown as R2Bucket,
    APP_ORIGIN: "http://localhost",
    APP_MODE: "mock",
  };
  for (const f of readdirSync("db/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync("db/migrations/" + f, "utf8");
    if (!f.includes("invariants")) {
      for (const part of sql.split("--> statement-breakpoint"))
        await db.prepare(part.trim()).run();
    } else {
      const statements =
        sql
          .replace(/--[^\n]*\n/g, "")
          .match(
            /CREATE TRIGGER[\s\S]*?\nEND;|CREATE TRIGGER[^\n]+END;|INSERT INTO[^;]+;/g,
          ) || [];
      for (const statement of statements) await db.prepare(statement).run();
    }
  }
});
afterAll(async () => {
  await mf?.dispose();
});
async function user(balance = 600, tier = 3) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO user (id,name,email,created_at,updated_at) VALUES (?,?,?,0,0)",
    )
    .bind(id, "Test", id + "@test.invalid")
    .run();
  await db
    .prepare("UPDATE user_wallets SET balance=?,tier=? WHERE user_id=?")
    .bind(balance, tier, id)
    .run();
  const assets = [crypto.randomUUID(), crypto.randomUUID()];
  for (const a of assets)
    await db
      .prepare(
        "INSERT INTO media_assets VALUES (?,?,?,'image/png',100,512,512,'approved',0)",
      )
      .bind(a, id, "uploads/" + a)
      .run();
  return { id, assets };
}
const input = (
  assets: string[],
  resolution: "480p" | "768p" | "1080p" = "480p",
) => ({
  templateId: "living-room",
  assetA: assets[0],
  assetB: assets[1],
  resolution,
  requestKey: crypto.randomUUID(),
});
const wallet = (id: string) =>
  db
    .prepare("SELECT * FROM user_wallets WHERE user_id=?")
    .bind(id)
    .first<{ balance: number; reserved: number; tier: number }>();
async function order(uid: string, pack = "lite", credits = 100, tier = 1) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO payment_orders (id,user_id,package_id,product_id,cents,credits,tier,mode,created_at) VALUES (?,?,?,?,890,?,?,'test',0)",
    )
    .bind(id, uid, pack, "prod-" + pack, credits, tier)
    .run();
  return (await db
    .prepare("SELECT * FROM payment_orders WHERE id=?")
    .bind(id)
    .first<OrderRow>())!;
}
describe("D1 money and task invariants", () => {
  it("new users have an actual zero-credit wallet", async () => {
    const u = await user(0, 0);
    expect(await wallet(u.id)).toMatchObject({
      balance: 0,
      reserved: 0,
      tier: 0,
    });
  });
  it("concurrent requests cannot overspend", async () => {
    const u = await user(100, 1);
    const outcomes = await Promise.allSettled([
      reserveTask(db, u.id, input(u.assets), true),
      reserveTask(db, u.id, input(u.assets), true),
    ]);
    expect(outcomes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await wallet(u.id)).toMatchObject({ balance: 0, reserved: 100 });
  });
  it("same request creates one task and one hold", async () => {
    const u = await user();
    const i = input(u.assets);
    const [a, b] = await Promise.all([
      reserveTask(db, u.id, i, true),
      reserveTask(db, u.id, i, true),
    ]);
    expect(a.task.id).toBe(b.task.id);
    expect(await wallet(u.id)).toMatchObject({ balance: 500, reserved: 100 });
  });
  it("rejects higher resolution for Lite even with enough credits", async () => {
    const u = await user(1000, 1);
    await expect(
      reserveTask(db, u.id, input(u.assets, "768p"), true),
    ).rejects.toThrow();
    expect((await wallet(u.id))?.balance).toBe(1000);
  });
  it("prevents another user from referencing private media", async () => {
    const u = await user();
    const other = await user();
    await expect(
      reserveTask(db, other.id, input(u.assets), true),
    ).rejects.toThrow();
  });
  it("rejects unapproved media", async () => {
    const u = await user();
    await db
      .prepare("UPDATE media_assets SET moderation='pending' WHERE id=?")
      .bind(u.assets[0])
      .run();
    await expect(
      reserveTask(db, u.id, input(u.assets), false),
    ).rejects.toThrow();
  });
  it("failed task compensation is idempotent under concurrent delivery", async () => {
    const u = await user();
    const { task } = await reserveTask(db, u.id, input(u.assets), true);
    await Promise.all([
      settleTask(db, task.id, false),
      settleTask(db, task.id, false),
    ]);
    expect(await wallet(u.id)).toMatchObject({ balance: 600, reserved: 0 });
  });
  it("terminal success cannot later refund due to a stale failure event", async () => {
    const u = await user();
    const { task } = await reserveTask(db, u.id, input(u.assets), true);
    await settleTask(db, task.id, true, "out.mp4");
    await settleTask(db, task.id, false);
    expect(await wallet(u.id)).toMatchObject({ balance: 500, reserved: 0 });
  });
  it("two active tasks maximum", async () => {
    const u = await user(1000);
    await reserveTask(db, u.id, input(u.assets), true);
    await reserveTask(db, u.id, input(u.assets), true);
    await expect(
      reserveTask(db, u.id, input(u.assets), true),
    ).rejects.toThrow();
  });
  it("duplicate order notifications cannot grant twice", async () => {
    const u = await user(0, 0),
      o = await order(u.id);
    await Promise.all([
      applyPayment(db, o, {
        id: "e1" + o.id,
        type: "order.completed",
        providerId: "p" + o.id,
      }),
      applyPayment(db, o, {
        id: "e2" + o.id,
        type: "order.completed",
        providerId: "p" + o.id,
      }),
    ]);
    expect(await wallet(u.id)).toMatchObject({ balance: 100, tier: 1 });
  });
  it("refund reclaims spent credits and recalculates tier without duplicate debit", async () => {
    const u = await user(0, 0),
      o = await order(u.id);
    await applyPayment(db, o, {
      id: "p" + o.id,
      type: "order.completed",
      providerId: o.id,
    });
    const { task } = await reserveTask(db, u.id, input(u.assets), true);
    await settleTask(db, task.id, true, "out.mp4");
    await applyPayment(db, o, {
      id: "r" + o.id,
      type: "refund.succeeded",
      providerId: o.id,
    });
    await applyPayment(db, o, {
      id: "r2" + o.id,
      type: "refund.succeeded",
      providerId: o.id,
    });
    expect(await wallet(u.id)).toMatchObject({ balance: -100, tier: 0 });
  });
  it("refund-before-completion cannot mint new credits", async () => {
    const u = await user(0, 0),
      o = await order(u.id);
    await applyPayment(db, o, {
      id: "r" + o.id,
      type: "refund.succeeded",
      providerId: o.id,
    });
    await applyPayment(db, o, {
      id: "p" + o.id,
      type: "order.completed",
      providerId: o.id,
    });
    expect(await wallet(u.id)).toMatchObject({ balance: 0, tier: 0 });
  });
  it("lower pack does not downgrade a paid Pro purchase", async () => {
    const u = await user(0, 0),
      pro = await order(u.id, "pro", 600, 3),
      lite = await order(u.id);
    await applyPayment(db, pro, {
      id: pro.id,
      type: "order.completed",
      providerId: pro.id,
    });
    await applyPayment(db, lite, {
      id: lite.id,
      type: "order.completed",
      providerId: lite.id,
    });
    expect(await wallet(u.id)).toMatchObject({ balance: 700, tier: 3 });
  });
});
describe("signed webhooks and provider contract", () => {
  const keys = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  function signed(raw: string, t = Date.now()) {
    const sig = createSign("RSA-SHA256")
      .update(`${t}.${raw}`)
      .sign(keys.privateKey, "base64");
    return `t=${t},v1=${sig}`;
  }
  it("verifies actual SDK RSA signatures and rejects changed payloads", () => {
    const raw = JSON.stringify({
      id: "event",
      mode: "test",
      eventType: "order.completed",
      data: {},
    });
    expect(
      verifyPaymentEvent(raw, signed(raw), "test", keys.publicKey).id,
    ).toBe("event");
    expect(() =>
      verifyPaymentEvent(raw + " ", signed(raw), "test", keys.publicKey),
    ).toThrow();
  });
  it("rejects stale or missing signatures", () => {
    const raw = "{}";
    expect(() =>
      verifyPaymentEvent(
        raw,
        signed(raw, Date.now() - 3600000),
        "test",
        keys.publicKey,
      ),
    ).toThrow();
    expect(() =>
      verifyPaymentEvent(raw, null, "test", keys.publicKey),
    ).toThrow();
  });
  it("rejects mismatched amount, product, currency and environment before crediting", async () => {
    const u = await user(0, 0),
      o = await order(u.id);
    const base = {
      id: "bad-" + o.id,
      eventId: "payment",
      timestamp: new Date().toISOString(),
      storeId: "store",
      storeName: "store",
      mode: "test" as const,
      eventType: "order.completed",
      data: {
        orderId: "provider",
        orderMerchantExternalId: o.id,
        merchantProvidedBuyerIdentity: u.id,
        buyerEmail: "x",
        currency: "USD",
        productName: "Lite",
        amount: "8.90",
        taxAmount: "0.00",
        orderStatus: "completed",
        paymentStatus: "succeeded",
        orderMetadata: { productId: o.product_id },
        productMetadata: { packageId: "lite" },
        chargedAmount: "8.90",
        listPrice: { subtotal: "8.90", taxAmount: "0.00", total: "8.90" },
      },
    };
    for (const patch of [
      { currency: "EUR" },
      { chargedAmount: "0.01" },
      { productMetadata: { packageId: "pro" } },
    ])
      await expect(
        processPaymentEvent(
          db,
          { ...base, data: { ...base.data, ...patch } },
          "test",
        ),
      ).rejects.toThrow();
    await expect(
      processPaymentEvent(db, { ...base, mode: "prod" }, "test"),
    ).rejects.toThrow();
    expect((await wallet(u.id))?.balance).toBe(0);
    await processPaymentEvent(db, base, "test");
    expect((await wallet(u.id))?.balance).toBe(100);
  });
  it("uses integer cents with no rounding tolerance", () => {
    expect(cents("8.90")).toBe(890);
    expect(() => cents("8.901")).toThrow();
  });
  it("WaveSpeed adapter submits correct references once and normalizes polling", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: { id: "real-shape-id" } }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            id: "real-shape-id",
            status: "completed",
            outputs: ["https://cdn.example/out.mp4"],
          },
        }),
      );
    const p = new WaveSpeed("test-key", transport);
    const i = {
      video: "https://example.com/silent.mp4",
      images: ["https://example.com/a.png", "https://example.com/b.png"] as [
        string,
        string,
      ],
      resolution: "480p" as const,
      inputDuration: 14,
    };
    expect(p.calculateCost(i)).toBe(144);
    expect(await p.submitTask(i)).toBe("real-shape-id");
    expect(JSON.parse(transport.mock.calls[0][1].body)).toMatchObject({
      generate_audio: false,
      duration: 14,
      aspect_ratio: "9:16",
      resolution: "480p",
      reference_images: i.images,
    });
    expect(transport.mock.calls[0][0]).toBe(
      "https://api.wavespeed.ai/api/v3/wavespeed-ai/minimax-h3/video-edit",
    );
    expect(await p.queryTask("real-shape-id")).toMatchObject({
      status: "completed",
      url: "https://cdn.example/out.mp4",
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
describe("route access and upload validation", () => {
  it("local test login cannot run on production hostname", async () => {
    const r = await handle(
      new Request("https://smalltownboyai.one/api/mock/signin", {
        method: "POST",
        headers: { origin: "https://smalltownboyai.one" },
        body: "{}",
      }),
      { ...e, APP_MODE: "mock" },
    );
    expect(r.status).toBe(404);
  });
  it("requires authentication on all private pages data", async () => {
    expect(
      (await handle(new Request("http://localhost/api/tasks"), e)).status,
    ).toBe(401);
  });
  it("does not permit one account to read another video or use admin", async () => {
    const owner = await user(),
      other = await user();
    const { task } = await reserveTask(db, owner.id, input(owner.assets), true);
    await db
      .prepare("INSERT INTO mock_sessions VALUES (?,?,?)")
      .bind("other-token", other.id, Date.now() + 60000)
      .run();
    const headers = { cookie: "mock_session=other-token" };
    expect(
      (
        await handle(
          new Request("http://localhost/api/tasks/" + task.id, { headers }),
          e,
        )
      ).status,
    ).toBe(404);
    expect(
      (await handle(new Request("http://localhost/api/admin", { headers }), e))
        .status,
    ).toBe(403);
  });
  it("blocks cross-origin mutation", async () => {
    expect(
      (
        await handle(
          new Request("http://localhost/api/mock/signin", {
            method: "POST",
            headers: { origin: "https://evil.example" },
            body: "{}",
          }),
          e,
        )
      ).status,
    ).toBe(403);
  });
  it("rejects executable content masquerading as an image", () => {
    expect(() =>
      imageInfo(
        new TextEncoder().encode(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ),
      ),
    ).toThrow();
  });
  it("accepts actual image header and enforces signed URL expiry", async () => {
    const b = new Uint8Array(readFileSync("public/images/character-a.png"));
    expect(imageInfo(b).mime).toBe("image/png");
    const expiry = String(Date.now() + 10000);
    const sig = await signature("secret", "asset:" + expiry);
    expect(await validSignature("secret", "asset", expiry, sig)).toBe(true);
    expect(await validSignature("secret", "other", expiry, sig)).toBe(false);
    expect(await validSignature("secret", "asset", "1", sig)).toBe(false);
  });
});

async function authenticated(uid: string) {
  const token = crypto.randomUUID();
  await db
    .prepare("INSERT INTO mock_sessions VALUES (?,?,?)")
    .bind(token, uid, Date.now() + 60000)
    .run();
  const admins = await db
    .prepare("SELECT email FROM user WHERE role='admin'")
    .all<{ email: string }>();
  e.ADMIN_EMAILS = admins.results.map((u) => u.email).join(",");
  e.ADMIN_PASSWORD = "test-admin-password";
  const { unlockAdmin } = await import("../lib/admin-access");
  const access = await unlockAdmin(e, uid, e.ADMIN_PASSWORD);
  return {
    cookie: "mock_session=" + token + "; admin_access=" + access,
    origin: "http://localhost",
    "Content-Type": "application/json",
  };
}
describe("recovery and deletion regressions", () => {
  it("finishes Mock tasks from history and serves the actual MP4", async () => {
    const u = await user();
    const headers = await authenticated(u.id);
    const { task } = await reserveTask(db, u.id, input(u.assets), true);
    await db
      .prepare(
        "UPDATE video_tasks SET status='processing',created_at=? WHERE id=?",
      )
      .bind(Date.now() - 10000, task.id)
      .run();
    const clip = readFileSync("public/fixtures/mock.mp4");
    await e.MEDIA.put("fixtures/mock.mp4", clip, {
      httpMetadata: { contentType: "video/mp4" },
    });
    const rows = (await (
      await handle(new Request("http://localhost/api/tasks", { headers }), e)
    ).json()) as any[];
    expect(rows[0].status).toBe("completed");
    const download = await handle(
      new Request(
        "http://localhost/api/tasks/" + task.id + "/video?download=1",
        { headers },
      ),
      e,
    );
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toContain("attachment");
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(
      new Uint8Array(clip),
    );
    expect(await wallet(u.id)).toMatchObject({ balance: 500, reserved: 0 });
  });
  it("deletion hides content but retains its idempotency tombstone", async () => {
    const u = await user();
    const headers = await authenticated(u.id);
    const b = input(u.assets);
    const { task } = await reserveTask(db, u.id, b, true);
    await settleTask(db, task.id, true, "test-output");
    await e.MEDIA.put("test-output", "test");
    expect(
      (
        await handle(
          new Request("http://localhost/api/tasks/" + task.id, {
            method: "DELETE",
            headers,
          }),
          e,
        )
      ).status,
    ).toBe(200);
    expect(await e.MEDIA.get("test-output")).toBeNull();
    expect(
      (
        await handle(
          new Request("http://localhost/api/tasks/" + task.id, { headers }),
          e,
        )
      ).status,
    ).toBe(404);
    await expect(reserveTask(db, u.id, b, true)).rejects.toThrow("deleted");
    expect(await wallet(u.id)).toMatchObject({ balance: 500, reserved: 0 });
  });
  it("releases an abandoned queue reservation exactly once", async () => {
    const u = await user();
    const { task } = await reserveTask(db, u.id, input(u.assets), true);
    await db
      .prepare("UPDATE video_tasks SET updated_at=? WHERE id=?")
      .bind(Date.now() - 180000, task.id)
      .run();
    await reconcile(e);
    await reconcile(e);
    expect(await wallet(u.id)).toMatchObject({ balance: 600, reserved: 0 });
    expect(
      await db
        .prepare("SELECT status,error_code FROM video_tasks WHERE id=?")
        .bind(task.id)
        .first(),
    ).toMatchObject({ status: "failed", error_code: "QUEUED_TIMEOUT" });
  });
  it("stale queue cleanup cannot refund a task already being submitted", async () => {
    const u = await user();
    const { task } = await reserveTask(db, u.id, input(u.assets), false);
    await db
      .prepare("UPDATE video_tasks SET status='submitting' WHERE id=?")
      .bind(task.id)
      .run();
    await settleTask(db, task.id, false, null, "QUEUED_TIMEOUT", "queued");
    expect(await wallet(u.id)).toMatchObject({ balance: 500, reserved: 100 });
  });
  it("retains uncertain submission credits until explicit reconciliation", async () => {
    const u = await user();
    const { task } = await reserveTask(db, u.id, input(u.assets), false);
    await db
      .prepare(
        "UPDATE video_tasks SET status='submitting',updated_at=? WHERE id=?",
      )
      .bind(Date.now() - 180000, task.id)
      .run();
    await reconcile(e);
    expect(
      await db
        .prepare("SELECT status FROM video_tasks WHERE id=?")
        .bind(task.id)
        .first(),
    ).toMatchObject({ status: "unknown" });
    expect(await wallet(u.id)).toMatchObject({ balance: 500, reserved: 100 });
  });
  it("exposes only configured live resolutions", async () => {
    const conf = {
      ...e,
      APP_MODE: "production",
      GENERATION_ENABLED: "true",
      WAVESPEED_API_KEY: "test",
      SEEAPI_API_KEY: "test",
      MEDIA_SIGNING_SECRET: "test",
      VERIFIED_TEMPLATES: "living-room",
      REFERENCE_LICENSE_CONFIRMED: "true",
      VERIFIED_RESOLUTIONS: "480p, 768p,720p,bogus",
    };
    const read = async (env: Bindings) =>
      (await handle(new Request("http://localhost/api/config"), env)).json();
    expect(await read(conf)).toMatchObject({
      generation: true,
      resolutions: ["480p", "768p"],
    });
    expect(await read({ ...conf, WAVESPEED_API_KEY: undefined })).toMatchObject(
      { generation: false, resolutions: [] },
    );
  });
  it("records admin compensation once with an audit trail", async () => {
    const admin = await user();
    const u = await user(0, 0);
    await db
      .prepare("UPDATE user SET role='admin' WHERE id=?")
      .bind(admin.id)
      .run();
    const headers = await authenticated(admin.id);
    const body = JSON.stringify({
      action: "compensate",
      target: u.id,
      credits: 50,
      reason: "Local compensation regression",
      key: crypto.randomUUID(),
    });
    for (let i = 0; i < 2; i++)
      expect(
        (
          await handle(
            new Request("http://localhost/api/admin/action", {
              method: "POST",
              headers,
              body,
            }),
            e,
          )
        ).status,
      ).toBe(200);
    expect(await wallet(u.id)).toMatchObject({ balance: 50, reserved: 0 });
    expect(
      await db
        .prepare("SELECT COUNT(*) AS n FROM admin_audit_logs WHERE target=?")
        .bind(u.id)
        .first(),
    ).toMatchObject({ n: 1 });
  });
});

describe("H3 templates, prices and private source access", () => {
  it("charges 100/200/400 credits and snapshots H3 base costs with both images", async () => {
    for (const [resolution, credits, cost] of [
      ["480p", 100, 144],
      ["768p", 200, 284],
      ["1080p", 400, 564],
    ] as const) {
      const u = await user();
      const { task } = await reserveTask(
        db,
        u.id,
        { ...input(u.assets, resolution), templateId: "red-fence" },
        false,
      );
      expect(task).toMatchObject({
        credits,
        estimated_cost: cost,
        input_duration: 14,
        template_id: "red-fence",
        template_version: 1,
        model: "wavespeed-ai/minimax-h3/video-edit",
      });
      expect(await wallet(u.id)).toMatchObject({
        balance: 600 - credits,
        reserved: credits,
      });
      await settleTask(db, task.id, false);
      expect(await wallet(u.id)).toMatchObject({ balance: 600, reserved: 0 });
    }
  });
  it("rejects replay with a different template without another reservation", async () => {
    const u = await user();
    const i = input(u.assets);
    await reserveTask(db, u.id, i, true);
    await expect(
      reserveTask(db, u.id, { ...i, templateId: "red-fence" }, true),
    ).rejects.toThrow("different task");
    await expect(
      reserveTask(
        db,
        u.id,
        { ...input(u.assets), templateId: "../../uploads/private" },
        true,
      ),
    ).rejects.toThrow("Unknown dance template");
    expect(await wallet(u.id)).toMatchObject({ balance: 500, reserved: 100 });
  });
  it("snapshots new package amounts and preserves existing order amounts", async () => {
    const u = await user(0, 0);
    const legacy = await order(u.id);
    for (const p of PACKAGES) {
      const result = await createCheckout(
        e,
        { id: u.id, email: "test@example.invalid" },
        p.id,
        true,
      );
      const id = new URL(result.url, "http://localhost").searchParams.get(
        "order",
      );
      expect(
        await db
          .prepare("SELECT cents,credits,tier FROM payment_orders WHERE id=?")
          .bind(id)
          .first(),
      ).toEqual({ cents: p.cents, credits: p.credits, tier: p.tier });
      expect(
        await db
          .prepare("SELECT cents,credits,tier FROM credit_packages WHERE id=?")
          .bind(p.id)
          .first(),
      ).toEqual({ cents: p.cents, credits: p.credits, tier: p.tier });
    }
    expect(
      await db
        .prepare("SELECT cents FROM payment_orders WHERE id=?")
        .bind(legacy.id)
        .first(),
    ).toEqual({ cents: 890 });
  });
  it("rejects unsupported H3 duration and resolution before any paid request", async () => {
    const transport = vi.fn();
    const p = new WaveSpeed("key", transport);
    const i = {
      video: "https://example.invalid/v.mp4",
      images: ["https://example.invalid/a", "https://example.invalid/b"] as [
        string,
        string,
      ],
      resolution: "480p" as const,
      inputDuration: 14,
    };
    for (const inputDuration of [2, 16, 21, NaN, 14.2])
      await expect(p.submitTask({ ...i, inputDuration })).rejects.toThrow(
        "Unsupported",
      );
    await expect(
      p.submitTask({ ...i, resolution: "720p" as "480p" }),
    ).rejects.toThrow("Unsupported");
    expect(transport).not.toHaveBeenCalled();
  });
  it("binds source signatures to template, version, object identity and expiration", async () => {
    const t = TEMPLATES[0];
    const url = new URL(
      await signedTemplateURL("https://example.invalid", t, "secret"),
    );
    expect(await validTemplateSignature("secret", t, url)).toBe(true);
    expect(await validTemplateSignature("secret", TEMPLATES[1], url)).toBe(
      false,
    );
    expect(
      await validSignature(
        "secret",
        t.id,
        url.searchParams.get("expires")!,
        url.searchParams.get("signature")!,
      ),
    ).toBe(false);
    url.searchParams.set("version", "2");
    expect(await validTemplateSignature("secret", t, url)).toBe(false);
    url.searchParams.set("version", "1");
    url.searchParams.set("expires", "1");
    expect(await validTemplateSignature("secret", t, url)).toBe(false);
  });
  it("does not expose template objects without valid source signatures or preview clearance", async () => {
    const conf = {
      ...e,
      APP_MODE: "production",
      MEDIA_SIGNING_SECRET: "secret",
      VERIFIED_TEMPLATES: "living-room",
    };
    for (const path of [
      "living-room/source",
      "living-room/preview",
      "unknown/source",
    ])
      expect(
        (
          await handle(
            new Request("http://localhost/api/templates/" + path),
            conf,
          )
        ).status,
      ).toBe(404);
    const url = await signedTemplateURL(
      "http://localhost",
      TEMPLATES[0],
      "secret",
    );
    const approved = { ...conf, REFERENCE_LICENSE_CONFIRMED: "true" };
    await e.MEDIA.put(TEMPLATES[0].objectKey, new Uint8Array([1, 2, 3]));
    expect((await handle(new Request(url), approved)).status).toBe(409);
    expect(
      (await handle(new Request(url), { ...approved, VERIFIED_TEMPLATES: "" }))
        .status,
    ).toBe(404);
  });
  it("streams local template previews with range support and no arbitrary object access", async () => {
    const clip = readFileSync("public/fixtures/mock.mp4");
    await e.MEDIA.put("fixtures/mock.mp4", clip, {
      httpMetadata: { contentType: "video/mp4" },
    });
    const r = await handle(
      new Request("http://localhost/api/templates/red-fence/preview", {
        headers: { range: "bytes=0-31" },
      }),
      e,
    );
    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toBe(`bytes 0-31/${clip.length}`);
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(
      new Uint8Array(clip.subarray(0, 32)),
    );
    const config = (await (
      await handle(new Request("http://localhost/api/config"), e)
    ).json()) as { templates: unknown[] };
    expect(config.templates).toHaveLength(2);
    expect(JSON.stringify(config)).not.toContain("objectKey");
    expect(JSON.stringify(config)).not.toContain("etag");
  });
  it("accepts the chosen template through the API and rejects old 720p", async () => {
    const u = await user();
    const headers = await authenticated(u.id);
    const b = {
      ...input(u.assets, "768p"),
      templateId: "red-fence",
      consent: true,
    };
    const send = (body: unknown) =>
      handle(
        new Request("http://localhost/api/tasks", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }),
        e,
      );
    const r = await send(b);
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({
      template_id: "red-fence",
      template_version: 1,
      resolution: "768p",
      credits: 200,
    });
    expect((await send({ ...b, resolution: "720p" })).status).toBe(400);
    expect(await wallet(u.id)).toMatchObject({ balance: 400, reserved: 200 });
  });
});

describe("Google OAuth configuration and start flow", () => {
  it("returns a clear unavailable state when any Google credential is missing", async () => {
    const configured = {
      ...e,
      APP_MODE: "production",
      BETTER_AUTH_SECRET: "test-only-secret-at-least-thirty-two-characters",
      GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "test-only-google-secret",
    };
    for (const name of [
      "BETTER_AUTH_SECRET",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
    ] as const) {
      const env = { ...configured, [name]: undefined };
      const cfg = await handle(new Request("http://localhost/api/config"), env);
      expect(await cfg.json()).toMatchObject({ google: false });
      expect(
        (await handle(new Request("http://localhost/api/me"), env)).status,
      ).toBe(401);
      const start = await handle(
        new Request("http://localhost/api/auth/sign-in/social", {
          method: "POST",
          headers: {
            origin: "http://localhost",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: "google",
            callbackURL: "http://localhost/",
          }),
        }),
        env,
      );
      expect(start.status).toBe(503);
    }
  });
  it("creates a real Better Auth Google authorization URL and handles cancellation", async () => {
    const env = {
      ...e,
      APP_MODE: "production",
      BETTER_AUTH_SECRET: "test-only-secret-at-least-thirty-two-characters",
      GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "test-only-google-secret",
    };
    const r = await handle(
      new Request("http://localhost/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "http://localhost/#create",
          errorCallbackURL: "http://localhost/login?next=%2F%23create",
        }),
      }),
      env,
    );
    expect(r.status).toBe(200);
    const body = (await r.json()) as { url: string };
    const authorization = new URL(body.url);
    expect(authorization.hostname).toBe("accounts.google.com");
    expect(authorization.searchParams.get("client_id")).toBe(
      env.GOOGLE_CLIENT_ID,
    );
    expect(authorization.searchParams.get("redirect_uri")).toBe(
      "http://localhost/api/auth/callback/google",
    );
    expect(authorization.searchParams.get("scope")).toContain("openid");
    expect(authorization.searchParams.get("state")).toBeTruthy();
    const cookie = r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
    const callback = new URL("http://localhost/api/auth/callback/google");
    callback.searchParams.set(
      "state",
      authorization.searchParams.get("state")!,
    );
    callback.searchParams.set("error", "access_denied");
    const cancelled = await handle(
      new Request(callback, { headers: { cookie } }),
      env,
    );
    expect(cancelled.status).toBe(302);
    expect(cancelled.headers.get("location")).toContain("/login?");
    expect(cancelled.headers.get("location")).toContain("error=access_denied");
  });
});

describe("Public template preview configuration", () => {
  it("allows preview metadata independently of paid generation while preserving source protection", async () => {
    const env = {
      ...e,
      APP_MODE: "production",
      TEMPLATE_PREVIEWS_ENABLED: "true",
      GENERATION_ENABLED: "false",
      REFERENCE_LICENSE_CONFIRMED: "false",
    };
    const config = await handle(
      new Request("http://localhost/api/config"),
      env,
    );
    expect(await config.json()).toMatchObject({
      generation: false,
      templates: [
        {
          previewUrl: "/api/templates/living-room/preview",
          previewKind: "template",
        },
        {
          previewUrl: "/api/templates/red-fence/preview",
          previewKind: "template",
        },
      ],
    });
    expect(
      (
        await handle(
          new Request("http://localhost/api/templates/living-room/source"),
          env,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handle(
          new Request("http://localhost/api/templates/not-allowed/preview"),
          env,
        )
      ).status,
    ).toBe(404);
    await e.MEDIA.put(TEMPLATES[0].objectKey, new Uint8Array([1, 2, 3]));
    expect(
      (
        await handle(
          new Request("http://localhost/api/templates/living-room/preview"),
          env,
        )
      ).status,
    ).toBe(409);
  });
});

describe("durable safety gates", () => {
  const safetyEnv = () => ({
    ...e,
    APP_ORIGIN: "https://smalltownboyai.one",
    SEEAPI_API_KEY: "fake-test-key",
    MEDIA_SIGNING_SECRET: "test-only",
  });
  it("persists identical body/key after a lost POST, then polls the saved ID", async () => {
    const { ensureCheck, runCheck } = await import("../lib/moderation");
    const owner = crypto.randomUUID(),
      env = safetyEnv();
    const check = await ensureCheck(env, owner, "prompt", "h3", "text", {
      text: "Two pets dance",
    });
    const requests: RequestInit[] = [];
    const lost = vi.fn(async (_url: unknown, init?: RequestInit) => {
      requests.push(init!);
      throw new Error("lost response");
    });
    expect((await runCheck(env, check.id, lost as typeof fetch)).state).toBe(
      "pending",
    );
    await db
      .prepare("UPDATE moderation_checks SET next_at=0 WHERE id=?")
      .bind(check.id)
      .run();
    const accepted = vi.fn(async (_url: unknown, init?: RequestInit) => {
      requests.push(init!);
      return Response.json({
        id: "persisted-id",
        object: "inference",
        provider: "seeapi",
        model: check.model,
        endpoint: check.endpoint,
        status: "processing",
        error: null,
        result: null,
      });
    });
    await Promise.all([
      runCheck(env, check.id, accepted as typeof fetch),
      runCheck(env, check.id, accepted as typeof fetch),
    ]);
    expect(accepted).toHaveBeenCalledTimes(1);
    expect(requests[0].body).toBe(requests[1].body);
    expect(requests[0].headers).toEqual(requests[1].headers);
    await db
      .prepare("UPDATE moderation_checks SET next_at=0 WHERE id=?")
      .bind(check.id)
      .run();
    const poll = vi.fn(
      async (_url: unknown, _init?: RequestInit) =>
        new Response("", { status: 429, headers: { "Retry-After": "120" } }),
    );
    const pending = await runCheck(env, check.id, poll as typeof fetch);
    expect(poll.mock.calls[0][0]).toContain("/persisted-id");
    expect(poll.mock.calls[0][1]).toMatchObject({ method: "GET" });
    expect(pending.next_at).toBeGreaterThan(Date.now() + 110000);
    expect(pending.state).toBe("pending");
  });
  it("enforces quota atomically and closes missing-key and deadline paths", async () => {
    const { ensureCheck, runCheck } = await import("../lib/moderation");
    const env = safetyEnv(),
      owner = crypto.randomUUID();
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        ensureCheck(env, owner, "prompt", String(i), "text", {
          text: "pet " + i,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(4);
    const check = (
      results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<
        Awaited<ReturnType<typeof ensureCheck>>
      >
    ).value;
    const transport = vi.fn();
    expect(
      (
        await runCheck(
          { ...env, SEEAPI_API_KEY: undefined },
          check.id,
          transport,
        )
      ).state,
    ).toBe("pending");
    expect(transport).not.toHaveBeenCalled();
    await db
      .prepare("UPDATE moderation_checks SET deadline=0 WHERE id=?")
      .bind(check.id)
      .run();
    expect((await runCheck(env, check.id, transport)).state).toBe(
      "unavailable",
    );
    expect(transport).not.toHaveBeenCalled();
  });
  it("never authorizes replaced output bytes and does not spend for insufficient balance", async () => {
    const { ensureCheck, approvedOutputEtag, moderateInputs } =
      await import("../lib/moderation");
    const env = safetyEnv(),
      u = await user(0),
      key = "outputs/" + u.id + "/safe.mp4";
    await expect(moderateInputs(env, u.id, input(u.assets))).rejects.toThrow(
      "credit balance",
    );
    const count = await db
      .prepare("SELECT COUNT(*) n FROM moderation_checks WHERE owner=?")
      .bind(u.id)
      .first<{ n: number }>();
    expect(count?.n).toBe(0);
    const bytes = new Uint8Array(36),
      v = new DataView(bytes.buffer);
    v.setUint32(0, 36);
    bytes.set(new TextEncoder().encode("moov"), 4);
    v.setUint32(8, 28);
    bytes.set(new TextEncoder().encode("mvhd"), 12);
    v.setUint32(28, 1000);
    v.setUint32(32, 14000);
    const obj = await e.MEDIA.put(key, bytes);
    const c = await ensureCheck(env, u.id, "output", "job", "video", {
      key,
      etag: obj!.etag,
    });
    const t = {
      id: "job",
      user_id: u.id,
      output_key: key,
    } as import("../lib/credits").TaskRow;
    await expect(approvedOutputEtag(env, t)).rejects.toThrow();
    await db
      .prepare("UPDATE moderation_checks SET state='passed' WHERE id=?")
      .bind(c.id)
      .run();
    expect(await approvedOutputEtag(env, t)).toBe(obj!.etag);
    bytes[35] = 1;
    await e.MEDIA.put(key, bytes);
    await expect(approvedOutputEtag(env, t)).rejects.toThrow();
  });
  it("migrates current package prices without changing credits", async () => {
    const rows = await db
      .prepare("SELECT * FROM credit_packages ORDER BY cents")
      .all();
    expect(rows.results).toEqual(
      PACKAGES.map((p) => ({
        id: p.id,
        cents: p.cents,
        credits: p.credits,
        tier: p.tier,
      })),
    );
  });
});

it("blocks output downloads and administrator approval without safety approval", async () => {
  const u = await user(),
    headers = await authenticated(u.id);
  const { task } = await reserveTask(db, u.id, input(u.assets), false);
  const key = "outputs/" + u.id + "/test.mp4";
  await e.MEDIA.put(key, readFileSync("public/fixtures/mock.mp4"));
  await db
    .prepare("UPDATE video_tasks SET status='review', output_key=? WHERE id=?")
    .bind(key, task.id)
    .run();
  expect(
    (
      await handle(
        new Request("http://localhost/api/tasks/" + task.id + "/video", {
          headers,
        }),
        e,
      )
    ).status,
  ).toBe(404);
  await db.prepare("UPDATE user SET role='admin' WHERE id=?").bind(u.id).run();
  Object.assign(headers, await authenticated(u.id));
  const approve = await handle(
    new Request("http://localhost/api/admin/action", {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "approve-output",
        target: task.id,
        key: crypto.randomUUID(),
        reason: "Test review",
      }),
    }),
    e,
  );
  expect(approve.status).toBe(503);
  expect(await wallet(u.id)).toMatchObject({ balance: 500, reserved: 100 });
  await db
    .prepare("UPDATE video_tasks SET status='completed' WHERE id=?")
    .bind(task.id)
    .run();
  expect(
    (
      await handle(
        new Request("http://localhost/api/tasks/" + task.id + "/video", {
          headers,
        }),
        e,
      )
    ).status,
  ).toBe(404);
});

describe("payment webhook fulfillment and refund regression", () => {
  function event(o: OrderRow, type = "order.completed") {
    return {
      id: crypto.randomUUID(),
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      storeId: "expected-store",
      storeName: "Test",
      mode: "test" as const,
      eventType: type,
      data: {
        orderId: "provider-" + o.id,
        orderMerchantExternalId: o.id,
        merchantProvidedBuyerIdentity: o.user_id,
        buyerEmail: "test@example.com",
        currency: "USD",
        productName: "Lite",
        orderStatus: "completed",
        paymentStatus: "succeeded",
        orderMetadata: { productId: o.product_id },
        productMetadata: { packageId: o.package_id },
        amount: "9.79",
        taxAmount: "0.89",
        chargedAmount: "9.79",
        listPrice: { subtotal: "8.90", taxAmount: "0.89", total: "9.79" },
        refundStatus: type === "refund.failed" ? "failed" : "succeeded",
        refundedAmount: "9.79",
        originalChargedAmount: "9.79",
        originalPayment: { subtotal: "8.90", taxAmount: "0.89", total: "9.79" },
      },
    };
  }
  it("fulfills once, keeps failed refunds unchanged, reverses successful refunds once", async () => {
    const u = await user(0, 0),
      o = await order(u.id),
      paid = event(o);
    await expect(
      processPaymentEvent(db, paid, "test", "other-store"),
    ).rejects.toThrow("store");
    await Promise.all([
      processPaymentEvent(db, paid, "test", "expected-store"),
      processPaymentEvent(
        db,
        { ...paid, id: crypto.randomUUID() },
        "test",
        "expected-store",
      ),
    ]);
    expect(await wallet(u.id)).toMatchObject({ balance: 100, tier: 1 });
    await processPaymentEvent(
      db,
      event(o, "refund.failed"),
      "test",
      "expected-store",
    );
    expect(await wallet(u.id)).toMatchObject({ balance: 100, tier: 1 });
    const refund = event(o, "refund.succeeded");
    await Promise.all([
      processPaymentEvent(db, refund, "test", "expected-store"),
      processPaymentEvent(
        db,
        { ...refund, id: crypto.randomUUID() },
        "test",
        "expected-store",
      ),
    ]);
    await processPaymentEvent(
      db,
      { ...paid, id: crypto.randomUUID() },
      "test",
      "expected-store",
    );
    expect(await wallet(u.id)).toMatchObject({ balance: 0, tier: 0 });
    const rows = await db
      .prepare(
        "SELECT kind FROM credit_transactions WHERE user_id=? ORDER BY created_at",
      )
      .bind(u.id)
      .all();
    expect(rows.results.map((r) => r.kind)).toEqual(["purchase", "refund"]);
  });
  it("handles refund-before-payment and rejects partial or inconsistent refund amounts", async () => {
    const u = await user(0, 0),
      o = await order(u.id),
      refund = event(o, "refund.succeeded");
    for (const data of [
      { refundedAmount: "1.00" },
      { originalChargedAmount: "1.00", refundedAmount: "1.00" },
      {
        originalPayment: { subtotal: "8.90", taxAmount: "0.00", total: "9.79" },
      },
    ]) {
      await expect(
        processPaymentEvent(
          db,
          { ...refund, data: { ...refund.data, ...data } },
          "test",
          "expected-store",
        ),
      ).rejects.toThrow();
    }
    await processPaymentEvent(db, refund, "test", "expected-store");
    await processPaymentEvent(db, event(o), "test", "expected-store");
    expect(await wallet(u.id)).toMatchObject({ balance: 0, tier: 0 });
  });
  it("rolls back competing event and provider bindings atomically", async () => {
    const u = await user(0, 0),
      a = await order(u.id),
      b = await order(u.id),
      id = crypto.randomUUID();
    const results = await Promise.allSettled([
      applyPayment(db, a, {
        id,
        type: "order.completed",
        providerId: "a-" + a.id,
      }),
      applyPayment(db, b, {
        id,
        type: "order.completed",
        providerId: "b-" + b.id,
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await wallet(u.id))?.balance).toBe(100);
    const accepted = results[0].status === "fulfilled" ? a : b;
    await expect(
      applyPayment(db, accepted, {
        id: crypto.randomUUID(),
        type: "refund.succeeded",
        providerId: "wrong-provider",
      }),
    ).rejects.toThrow();
    expect((await wallet(u.id))?.balance).toBe(100);
  });
});

describe("administrator email credit grants", () => {
  async function admin() {
    const u = await user(0, 0);
    await db
      .prepare("UPDATE user SET role='admin' WHERE id=?")
      .bind(u.id)
      .run();
    return u;
  }
  const grant = (u: { id: string }) => ({
    email: u.id.toUpperCase() + "@TEST.INVALID",
    credits: 600,
    tier: 3,
    reason: "Internal generation testing",
    key: crypto.randomUUID(),
  });
  it("grants credits and quality atomically without payment records and deduplicates retries", async () => {
    const { grantCredits } = await import("../lib/admin-credits");
    const a = await admin(),
      u = await user(0, 0),
      b = grant(u);
    await Promise.all([grantCredits(db, a.id, b), grantCredits(db, a.id, b)]);
    expect(await wallet(u.id)).toMatchObject({
      balance: 600,
      reserved: 0,
      tier: 3,
    });
    const ledger = await db
      .prepare("SELECT kind,delta FROM credit_transactions WHERE user_id=?")
      .bind(u.id)
      .all();
    expect(ledger.results).toEqual([{ kind: "admin_grant", delta: 600 }]);
    const orders = await db
      .prepare("SELECT COUNT(*) n FROM payment_orders WHERE user_id=?")
      .bind(u.id)
      .first<{ n: number }>();
    expect(orders?.n).toBe(0);
    const log = await db
      .prepare("SELECT admin_id,target,reason FROM admin_audit_logs WHERE id=?")
      .bind("grant:" + b.key)
      .first();
    expect(log).toEqual({ admin_id: a.id, target: u.id, reason: b.reason });
    await expect(
      grantCredits(db, a.id, { ...b, credits: 900 }),
    ).rejects.toThrow("different credit grant");
    expect((await wallet(u.id))?.balance).toBe(600);
  });
  it("requires an administrator and an existing recipient, and bounds grant values", async () => {
    const { grantCredits } = await import("../lib/admin-credits");
    const a = await admin(),
      u = await user(0, 0),
      b = grant(u);
    await expect(grantCredits(db, u.id, b)).rejects.toThrow("Administrator");
    await expect(
      grantCredits(db, a.id, { ...b, email: "missing@test.invalid" }),
    ).rejects.toThrow("sign in first");
    for (const patch of [
      { credits: 0 },
      { credits: 10001 },
      { credits: 1.5 },
      { tier: 4 },
      { reason: "" },
    ])
      await expect(
        grantCredits(db, a.id, { ...b, ...patch }),
      ).rejects.toThrow();
    expect((await wallet(u.id))?.balance).toBe(0);
    const response = await handle(
      new Request("http://localhost/api/admin/credits", {
        method: "POST",
        headers: await authenticated(u.id),
        body: JSON.stringify(b),
      }),
      e,
    );
    expect(response.status).toBe(403);
  });
  it("preserves granted resolution when a paid order is refunded and permits testing generation", async () => {
    const { grantCredits } = await import("../lib/admin-credits");
    const a = await admin(),
      u = await user(0, 0);
    const response = await handle(
      new Request("http://localhost/api/admin/credits", {
        method: "POST",
        headers: await authenticated(a.id),
        body: JSON.stringify(grant(u)),
      }),
      e,
    );
    expect(response.status).toBe(200);
    const o = await order(u.id);
    await applyPayment(db, o, {
      id: crypto.randomUUID(),
      type: "order.completed",
      providerId: o.id,
    });
    await applyPayment(db, o, {
      id: crypto.randomUUID(),
      type: "refund.succeeded",
      providerId: o.id,
    });
    expect(await wallet(u.id)).toMatchObject({ balance: 600, tier: 3 });
    await reserveTask(db, u.id, input(u.assets, "1080p"), true);
    expect(await wallet(u.id)).toMatchObject({
      balance: 200,
      reserved: 400,
      tier: 3,
    });
  });
});

it("requires configured admin email and password session even for an admin role", async () => {
  const u = await user();
  await db.prepare("UPDATE user SET role='admin' WHERE id=?").bind(u.id).run();
  const headers = await authenticated(u.id);
  const send = (env: Bindings, h = headers) =>
    handle(new Request("http://localhost/api/admin", { headers: h }), env);
  expect(
    (await send({ ...e, ADMIN_EMAILS: "someone-else@example.com" })).status,
  ).toBe(403);
  expect((await send({ ...e, ADMIN_PASSWORD: undefined })).status).toBe(403);
  expect(
    (await send(e, { ...headers, cookie: headers.cookie.split(";")[0] }))
      .status,
  ).toBe(403);
  expect((await send(e)).status).toBe(200);
  const { unlockAdmin } = await import("../lib/admin-access");
  await expect(unlockAdmin(e, u.id, "wrong")).rejects.toThrow("Incorrect");
});
