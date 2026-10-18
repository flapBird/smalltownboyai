import { z } from "zod";
import { auth, identity, requireUser, sameOrigin, AppError } from "./auth";
import { type Bindings, localMock, liveResolutions } from "./env";
import {
  reserveTask,
  settleTask,
  rateLimit,
  applyPayment,
  type TaskRow,
  type OrderRow,
} from "./credits";
import {
  createCheckout,
  verifyPaymentEvent,
  processPaymentEvent,
} from "./payments";
import { imageInfo, validSignature, signedMediaURL } from "./media";
import { WaveSpeed } from "./providers/wavespeed";
const json = (
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      ...extra,
    },
  });
async function body(r: Request) {
  const raw = await r.text();
  if (raw.length > 16000) throw new AppError(413, "Request too large.");
  return JSON.parse(raw);
}
async function ownedTask(e: Bindings, r: Request, id: string) {
  const u = await requireUser(e, r);
  const task = await e.DB.prepare(
    "SELECT * FROM video_tasks WHERE id=? AND user_id=? AND deleted_at IS NULL",
  )
    .bind(id, u.id)
    .first<TaskRow>();
  if (!task) throw new AppError(404, "Video not found.");
  return task;
}
async function objectResponse(
  e: Bindings,
  key: string,
  download = false,
  range?: string | null,
) {
  const object = await e.MEDIA.get(
    key,
    range ? { range: new Headers({ range }) } : {},
  );
  if (!object) throw new AppError(404, "File not found.");
  const headers = new Headers({
    "Content-Type":
      object.httpMetadata?.contentType || "application/octet-stream",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
    "Accept-Ranges": "bytes",
  });
  if (download)
    headers.set(
      "Content-Disposition",
      'attachment; filename="smalltown-boy.mp4"',
    );
  let status = 200;
  if (range && object.range && "offset" in object.range) {
    const start = object.range.offset ?? 0,
      end = start + (object.range.length ?? object.size) - 1;
    headers.set("Content-Range", `bytes ${start}-${end}/${object.size}`);
    headers.set("Content-Length", String(end - start + 1));
    status = 206;
  } else headers.set("Content-Length", String(object.size));
  return new Response(object.body, { status, headers });
}
async function advanceMock(e: Bindings, t: TaskRow) {
  if (
    t.provider !== "mock" ||
    t.status !== "processing" ||
    Date.now() - t.created_at <= 6000
  )
    return;
  const fixture = await e.MEDIA.get("fixtures/mock.mp4");
  if (!fixture)
    throw new AppError(503, "Run npm run mock:seed to install the test clip.");
  const key = "outputs/" + t.user_id + "/" + t.id + ".mp4";
  await e.MEDIA.put(key, fixture.body, {
    httpMetadata: { contentType: "video/mp4" },
  });
  await settleTask(e.DB, t.id, true, key);
  await e.DB.prepare(
    "UPDATE video_tasks SET output_duration=3,actual_cost=0 WHERE id=?",
  )
    .bind(t.id)
    .run();
}
export async function handle(r: Request, e: Bindings): Promise<Response> {
  try {
    const url = new URL(r.url);
    const parts = url.pathname.replace(/^\/api\/?/, "").split("/");
    const path = parts.join("/");
    const mock = localMock(e, r);
    if (parts[0] === "auth") {
      if (!e.GOOGLE_CLIENT_ID || !e.BETTER_AUTH_SECRET)
        return json({ error: "Google sign-in is not configured yet." }, 503);
      return auth(e).handler(r);
    }
    if (r.method === "POST" && path === "webhooks/waffo") {
      if (!e.WAFFO_MERCHANT_ID)
        return json({ error: "Payment service is not configured." }, 503);
      const raw = await r.text();
      if (raw.length > 65536) throw new AppError(413, "Webhook too large.");
      let event;
      try {
        event = verifyPaymentEvent(
          raw,
          r.headers.get("x-waffo-signature"),
          e.WAFFO_ENVIRONMENT === "prod" ? "prod" : "test",
        );
      } catch {
        throw new AppError(400, "Invalid webhook signature.");
      }
      await processPaymentEvent(e.DB, event, e.WAFFO_ENVIRONMENT || "test");
      return json({ received: true });
    }
    if (r.method === "GET" && path === "config")
      return json({
        mock,
        generation: liveResolutions(e).length > 0,
        resolutions: liveResolutions(e),
        google: !!(
          e.GOOGLE_CLIENT_ID &&
          e.GOOGLE_CLIENT_SECRET &&
          e.BETTER_AUTH_SECRET
        ),
        payments: e.PAYMENTS_ENABLED === "true",
      });
    if (!["GET", "HEAD"].includes(r.method)) sameOrigin(e, r);
    if (r.method === "POST" && path === "mock/signin") {
      if (!mock) throw new AppError(404, "Not found.");
      const b = await body(r);
      const admin = b.admin === true;
      const id = crypto.randomUUID(),
        token = crypto.randomUUID() + crypto.randomUUID(),
        now = Date.now();
      await e.DB.batch([
        e.DB.prepare(
          "INSERT INTO user (id,name,email,email_verified,created_at,updated_at,role) VALUES (?,?,?,1,?,?,?)",
        ).bind(
          id,
          admin ? "Demo Admin" : "Pet Person",
          "demo-" + id + "@localhost",
          now,
          now,
          admin ? "admin" : "user",
        ),
        e.DB.prepare("INSERT INTO mock_sessions VALUES (?,?,?)").bind(
          token,
          id,
          now + 86400000,
        ),
      ]);
      return json({ ok: true }, 200, {
        "Set-Cookie": `mock_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`,
      });
    }
    if (r.method === "POST" && path === "logout") {
      if (mock) {
        const token = r.headers
          .get("cookie")
          ?.match(/(?:^|; )mock_session=([^;]+)/)?.[1];
        if (token)
          await e.DB.prepare("DELETE FROM mock_sessions WHERE token=?")
            .bind(token)
            .run();
        return json({ ok: true }, 200, {
          "Set-Cookie":
            "mock_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        });
      }
      return auth(e).api.signOut({ headers: r.headers, asResponse: true });
    }
    if (r.method === "GET" && parts[0] === "media" && parts[1]) {
      const asset = await e.DB.prepare("SELECT * FROM media_assets WHERE id=?")
        .bind(parts[1])
        .first<{ user_id: string; object_key: string }>();
      if (!asset) throw new AppError(404, "File not found.");
      const signed =
        e.MEDIA_SIGNING_SECRET &&
        (await validSignature(
          e.MEDIA_SIGNING_SECRET,
          parts[1],
          url.searchParams.get("expires") || "",
          url.searchParams.get("signature") || "",
        ));
      const u = signed ? null : await identity(e, r);
      if (!signed && u?.id !== asset.user_id && u?.role !== "admin")
        throw new AppError(404, "File not found.");
      return objectResponse(e, asset.object_key);
    }
    const u = await requireUser(e, r);
    if (r.method === "GET" && path === "me") {
      const wallet = await e.DB.prepare(
        "SELECT * FROM user_wallets WHERE user_id=?",
      )
        .bind(u.id)
        .first();
      return json({ ...u, wallet });
    }
    if (r.method === "POST" && path === "checkout") {
      await rateLimit(e.DB, "checkout:" + u.id, 5, 60);
      const b = z
        .object({ packageId: z.enum(["lite", "standard", "pro"]) })
        .parse(await body(r));
      return json(await createCheckout(e, u, b.packageId, mock));
    }
    if (r.method === "GET" && parts[0] === "orders" && parts[1]) {
      const o = await e.DB.prepare(
        "SELECT id,package_id,cents,credits,status,mode FROM payment_orders WHERE id=? AND user_id=?",
      )
        .bind(parts[1], u.id)
        .first();
      if (!o) throw new AppError(404, "Order not found.");
      return json(o);
    }
    if (r.method === "POST" && path === "mock/pay") {
      if (!mock) throw new AppError(404, "Not found.");
      const b = z.object({ orderId: z.string().uuid() }).parse(await body(r));
      const o = await e.DB.prepare(
        "SELECT * FROM payment_orders WHERE id=? AND user_id=? AND mode='mock'",
      )
        .bind(b.orderId, u.id)
        .first<OrderRow>();
      if (!o) throw new AppError(404, "Order not found.");
      await applyPayment(e.DB, o, {
        id: "mock-event:" + o.id,
        type: "order.completed",
        providerId: "mock-order:" + o.id,
      });
      return json({ ok: true });
    }
    if (r.method === "GET" && path === "billing") {
      const [orders, transactions] = await Promise.all([
        e.DB.prepare(
          "SELECT id,package_id,cents,credits,status,mode,created_at FROM payment_orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
        )
          .bind(u.id)
          .all(),
        e.DB.prepare(
          "SELECT * FROM credit_transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 200",
        )
          .bind(u.id)
          .all(),
      ]);
      return json({
        orders: orders.results,
        transactions: transactions.results,
      });
    }
    if (r.method === "POST" && path === "uploads") {
      await rateLimit(e.DB, "upload:" + u.id, 15, 60);
      const max = 8 * 1024 * 1024;
      const reader = r.body?.getReader();
      if (!reader) throw new AppError(400, "Choose an image.");
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        size += item.value.length;
        if (size > max + 65536) {
          await reader.cancel();
          throw new AppError(413, "Image must be under 8 MB.");
        }
        chunks.push(item.value);
      }
      const blob = new Blob(chunks as BlobPart[]);
      const form = await new Response(blob, {
        headers: { "Content-Type": r.headers.get("content-type") || "" },
      }).formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.size > max)
        throw new AppError(400, "Choose an image under 8 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const info = imageInfo(bytes);
      if (
        info.mime !== file.type ||
        info.width < 256 ||
        info.height < 256 ||
        info.width > 4096 ||
        info.height > 4096
      )
        throw new AppError(
          400,
          "Use a valid JPG, PNG or WebP, 256–4096 pixels per side.",
        );
      const id = crypto.randomUUID(),
        key = "uploads/" + u.id + "/" + id;
      await e.MEDIA.put(key, bytes, {
        httpMetadata: { contentType: info.mime },
      });
      try {
        await e.DB.prepare(
          "INSERT INTO media_assets VALUES (?,?,?,?,?,?,?,?,?)",
        )
          .bind(
            id,
            u.id,
            key,
            info.mime,
            file.size,
            info.width,
            info.height,
            mock ? "approved" : "pending",
            Date.now(),
          )
          .run();
      } catch (error) {
        await e.MEDIA.delete(key);
        throw error;
      }
      return json({ id, moderation: mock ? "approved" : "pending" }, 201);
    }
    if (r.method === "DELETE" && parts[0] === "media") {
      const a = await e.DB.prepare(
        "SELECT * FROM media_assets WHERE id=? AND user_id=?",
      )
        .bind(parts[1], u.id)
        .first<{ object_key: string }>();
      if (!a) throw new AppError(404, "File not found.");
      const used = await e.DB.prepare(
        "SELECT id FROM video_tasks WHERE (asset_a=? OR asset_b=?) AND deleted_at IS NULL LIMIT 1",
      )
        .bind(parts[1], parts[1])
        .first();
      if (used) throw new AppError(409, "Delete associated videos first.");
      await e.MEDIA.delete(a.object_key);
      await e.DB.prepare("DELETE FROM media_assets WHERE id=? AND user_id=?")
        .bind(parts[1], u.id)
        .run();
      return json({ ok: true });
    }
    if (r.method === "POST" && path === "tasks") {
      await rateLimit(e.DB, "task:" + u.id, 5, 60);
      const b = z
        .object({
          assetA: z.string().uuid(),
          assetB: z.string().uuid(),
          resolution: z.enum(["480p", "720p", "1080p"]),
          requestKey: z.string().uuid(),
          consent: z.literal(true),
        })
        .parse(await body(r));
      if (!mock && !liveResolutions(e).includes(b.resolution))
        throw new AppError(
          503,
          "Live generation is awaiting model and reference-video validation.",
        );
      const result = await reserveTask(e.DB, u.id, b, mock);
      if (result.created) {
        if (mock) {
          await e.DB.prepare(
            "UPDATE video_tasks SET status='processing',provider_task_id=? WHERE id=?",
          )
            .bind("mock-" + result.task.id, result.task.id)
            .run();
        } else {
          const claimed = await e.DB.prepare(
            "UPDATE video_tasks SET status='submitting',updated_at=? WHERE id=? AND status='queued' RETURNING id",
          )
            .bind(Date.now(), result.task.id)
            .first();
          if (!claimed) return json(await ownedTask(e, r, result.task.id));
          try {
            const urls = await Promise.all(
              [b.assetA, b.assetB].map((id) =>
                signedMediaURL(e.APP_ORIGIN, id, e.MEDIA_SIGNING_SECRET!),
              ),
            );
            const providerId = await new WaveSpeed(
              e.WAVESPEED_API_KEY!,
            ).submitTask({
              video: e.REFERENCE_VIDEO_URL!,
              images: urls as [string, string],
              resolution: b.resolution,
              inputDuration: 21,
            });
            await e.DB.prepare(
              "UPDATE video_tasks SET status='processing',provider_task_id=?,updated_at=? WHERE id=?",
            )
              .bind(providerId, Date.now(), result.task.id)
              .run();
          } catch {
            await e.DB.prepare(
              "UPDATE video_tasks SET status='unknown',error_code='SUBMISSION_UNCERTAIN',updated_at=? WHERE id=?",
            )
              .bind(Date.now(), result.task.id)
              .run();
          }
        }
      }
      return json(await ownedTask(e, r, result.task.id), 201);
    }
    if (r.method === "GET" && path === "tasks") {
      const rows = await e.DB.prepare(
        "SELECT * FROM video_tasks WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100",
      )
        .bind(u.id)
        .all<TaskRow>();
      if (mock) for (const t of rows.results) await advanceMock(e, t);
      return json(
        (
          await e.DB.prepare(
            "SELECT * FROM video_tasks WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100",
          )
            .bind(u.id)
            .all()
        ).results,
      );
    }
    if (parts[0] === "tasks" && parts[1]) {
      let t = await ownedTask(e, r, parts[1]);
      if (r.method === "DELETE") {
        if (!["completed", "failed"].includes(t.status))
          throw new AppError(409, "Active tasks cannot be deleted.");
        if (t.output_key) await e.MEDIA.delete(t.output_key);
        await e.DB.prepare(
          "UPDATE video_tasks SET deleted_at=?,output_key=NULL WHERE id=? AND user_id=?",
        )
          .bind(Date.now(), t.id, u.id)
          .run();
        return json({ ok: true });
      }
      if (r.method === "GET" && parts[2] === "video") {
        if (t.status !== "completed" || !t.output_key)
          throw new AppError(404, "Video not available.");
        return objectResponse(
          e,
          t.output_key,
          url.searchParams.get("download") === "1",
          r.headers.get("range"),
        );
      }
      if (r.method === "GET" && parts.length === 2) {
        if (mock) {
          await advanceMock(e, t);
          t = await ownedTask(e, r, t.id);
        }
        return json(t);
      }
    }
    if (parts[0] === "admin") {
      if (u.role !== "admin")
        throw new AppError(403, "Administrator access required.");
      if (r.method === "GET" && path === "admin") {
        const tables = [
          "user",
          "payment_orders",
          "credit_transactions",
          "video_tasks",
          "media_assets",
          "admin_audit_logs",
        ];
        const data: Record<string, unknown> = {};
        for (const table of tables)
          data[table] = (
            await e.DB.prepare(
              `SELECT * FROM ${table} ORDER BY ${table === "user" ? "created_at" : "created_at"} DESC LIMIT 100`,
            ).all()
          ).results;
        data.settings = (
          await e.DB.prepare("SELECT * FROM settings").all()
        ).results;
        data.costs = await e.DB.prepare(
          "SELECT COUNT(*) AS tasks,COALESCE(SUM(estimated_cost),0) AS estimated_cents,SUM(actual_cost) AS actual_cents,SUM(CASE WHEN actual_cost IS NULL THEN 1 ELSE 0 END) AS unknown_cost_tasks FROM video_tasks WHERE provider='wavespeed'",
        ).first();
        return json(data);
      }
      if (r.method === "GET" && parts[1] === "video" && parts[2]) {
        const t = await e.DB.prepare(
          "SELECT output_key FROM video_tasks WHERE id=?",
        )
          .bind(parts[2])
          .first<{ output_key: string }>();
        if (!t?.output_key) throw new AppError(404, "No video.");
        return objectResponse(e, t.output_key);
      }
      if (r.method === "POST" && path === "admin/action") {
        const b = z
          .object({
            action: z.enum([
              "pause",
              "resume",
              "compensate",
              "approve-input",
              "reject-input",
              "approve-output",
              "reject-output",
              "release-unknown",
              "reverse-order",
              "record-cost",
            ]),
            target: z.string().min(1).max(100),
            reason: z.string().min(5).max(500),
            credits: z.number().int().min(1).max(10000).optional(),
            actualCost: z.number().int().min(0).max(100000).optional(),
            outputDuration: z.number().positive().max(60).optional(),
            key: z.string().uuid(),
          })
          .parse(await body(r));
        if (b.action === "pause" || b.action === "resume") {
          await e.DB.batch([
            e.DB.prepare(
              "UPDATE settings SET value=? WHERE key='generation_paused'",
            ).bind(b.action === "pause" ? "true" : "false"),
            e.DB.prepare(
              "INSERT OR IGNORE INTO admin_audit_logs VALUES (?,?,?,?,?,?)",
            ).bind(b.key, u.id, b.action, b.target, b.reason, Date.now()),
          ]);
        } else if (b.action === "compensate") {
          if (!b.credits) throw new AppError(400, "Credits required.");
          await e.DB.batch([
            e.DB.prepare(
              "INSERT OR IGNORE INTO credit_transactions VALUES (?,?,?,'compensation',?,0,?)",
            ).bind(
              crypto.randomUUID(),
              b.target,
              "admin:" + b.key,
              b.credits,
              Date.now(),
            ),
            e.DB.prepare(
              "INSERT OR IGNORE INTO admin_audit_logs VALUES (?,?,?,?,?,?)",
            ).bind(b.key, u.id, b.action, b.target, b.reason, Date.now()),
          ]);
        } else if (b.action === "reverse-order") {
          const order = await e.DB.prepare(
            "SELECT * FROM payment_orders WHERE id=?",
          )
            .bind(b.target)
            .first<OrderRow>();
          if (!order) throw new AppError(404, "Order not found.");
          await e.DB.prepare(
            "INSERT OR IGNORE INTO admin_audit_logs VALUES (?,?,?,?,?,?)",
          )
            .bind(b.key, u.id, b.action, b.target, b.reason, Date.now())
            .run();
          await applyPayment(e.DB, order, {
            id: "admin-reversal:" + b.key,
            type: "refund.succeeded",
            providerId: order.provider_id || "manual:" + order.id,
          });
        } else if (b.action === "record-cost") {
          if (b.actualCost === undefined)
            throw new AppError(400, "Actual cost in cents is required.");
          await e.DB.batch([
            e.DB.prepare(
              "UPDATE video_tasks SET actual_cost=?,output_duration=COALESCE(?,output_duration) WHERE id=?",
            ).bind(b.actualCost, b.outputDuration ?? null, b.target),
            e.DB.prepare(
              "INSERT OR IGNORE INTO admin_audit_logs VALUES (?,?,?,?,?,?)",
            ).bind(b.key, u.id, b.action, b.target, b.reason, Date.now()),
          ]);
        } else if (b.action.endsWith("input")) {
          await e.DB.batch([
            e.DB.prepare(
              "UPDATE media_assets SET moderation=? WHERE id=?",
            ).bind(
              b.action === "approve-input" ? "approved" : "rejected",
              b.target,
            ),
            e.DB.prepare(
              "INSERT OR IGNORE INTO admin_audit_logs VALUES (?,?,?,?,?,?)",
            ).bind(b.key, u.id, b.action, b.target, b.reason, Date.now()),
          ]);
        } else {
          const t = await e.DB.prepare("SELECT * FROM video_tasks WHERE id=?")
            .bind(b.target)
            .first<TaskRow>();
          if (!t) throw new AppError(404, "Task not found.");
          if (b.action === "release-unknown" && t.status !== "unknown")
            throw new AppError(
              409,
              "Only uncertain submissions can be reconciled.",
            );
          if (b.action !== "release-unknown" && t.status !== "review")
            throw new AppError(409, "Task is not awaiting review.");
          if (b.action === "approve-output" && !t.output_key)
            throw new AppError(409, "Missing output.");
          await e.DB.prepare(
            "INSERT OR IGNORE INTO admin_audit_logs VALUES (?,?,?,?,?,?)",
          )
            .bind(b.key, u.id, b.action, b.target, b.reason, Date.now())
            .run();
          await settleTask(
            e.DB,
            t.id,
            b.action === "approve-output",
            t.output_key,
            b.action === "approve-output" ? null : "ADMIN_RECONCILED",
          );
        }
        return json({ ok: true });
      }
    }
    throw new AppError(404, "Not found.");
  } catch (error) {
    if (error instanceof AppError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json({ error: "Invalid request. Please check your inputs." }, 400);
    console.error("Request failed", {
      path: new URL(r.url).pathname,
      error: error instanceof Error ? error.name : "Unknown",
    });
    return json(
      {
        error: "The service could not complete this request. Please try again.",
      },
      500,
    );
  }
}
