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
} from "../lib/payments";
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
  resolution: "480p" | "720p" | "1080p" = "480p",
) => ({
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
      reserveTask(db, u.id, input(u.assets, "720p"), true),
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
      inputDuration: 21,
    };
    expect(p.calculateCost(i)).toBe(462);
    expect(await p.submitTask(i)).toBe("real-shape-id");
    expect(JSON.parse(transport.mock.calls[0][1].body)).toMatchObject({
      generate_audio: false,
      reference_images: i.images,
    });
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
  return {
    cookie: "mock_session=" + token,
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
      MEDIA_SIGNING_SECRET: "test",
      REFERENCE_VIDEO_URL: "https://example.invalid/reference.mp4",
      REFERENCE_LICENSE_CONFIRMED: "true",
      VERIFIED_RESOLUTIONS: "480p, 720p,bogus",
    };
    const read = async (env: Bindings) =>
      (await handle(new Request("http://localhost/api/config"), env)).json();
    expect(await read(conf)).toMatchObject({
      generation: true,
      resolutions: ["480p", "720p"],
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
