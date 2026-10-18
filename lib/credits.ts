import { SPECS, type Resolution } from "./catalog";
import { AppError } from "./auth";
export interface TaskRow {
  id: string;
  user_id: string;
  request_key: string;
  status: string;
  resolution: Resolution;
  credits: number;
  asset_a: string;
  asset_b: string;
  provider: string;
  model: string;
  provider_task_id: string | null;
  input_duration: number;
  output_duration: number | null;
  estimated_cost: number;
  actual_cost: number | null;
  output_key: string | null;
  deleted_at: number | null;
  error_code: string | null;
  created_at: number;
  updated_at: number;
  lease_until: number;
}
export async function reserveTask(
  db: D1Database,
  userId: string,
  input: {
    requestKey: string;
    assetA: string;
    assetB: string;
    resolution: Resolution;
  },
  mock: boolean,
) {
  const existing = await db
    .prepare("SELECT * FROM video_tasks WHERE user_id=? AND request_key=?")
    .bind(userId, input.requestKey)
    .first<TaskRow>();
  if (existing) {
    if (existing.deleted_at)
      throw new AppError(409, "This task was deleted. Start a new request.");
    if (
      existing.asset_a !== input.assetA ||
      existing.asset_b !== input.assetB ||
      existing.resolution !== input.resolution
    )
      throw new AppError(409, "This request key belongs to a different task.");
    return { task: existing, created: false };
  }
  const spec = SPECS[input.resolution];
  if (!spec) throw new AppError(400, "Unsupported resolution.");
  const id = crypto.randomUUID(),
    now = Date.now();
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO video_tasks (id,user_id,request_key,status,resolution,credits,asset_a,asset_b,provider,model,input_duration,estimated_cost,created_at,updated_at)
 SELECT ?,?,?,'queued',?,?,?,?,?,?,21,?,?,? FROM user_wallets w WHERE w.user_id=? AND w.balance>=? AND w.tier>=?
 AND (SELECT COUNT(*) FROM video_tasks WHERE user_id=? AND status NOT IN ('completed','failed'))<2
 AND (SELECT value FROM settings WHERE key='generation_paused')='false'
 AND EXISTS (SELECT 1 FROM media_assets WHERE id=? AND user_id=? AND moderation='approved')
 AND EXISTS (SELECT 1 FROM media_assets WHERE id=? AND user_id=? AND moderation='approved')`,
      )
      .bind(
        id,
        userId,
        input.requestKey,
        input.resolution,
        spec.credits,
        input.assetA,
        input.assetB,
        mock ? "mock" : "wavespeed",
        mock ? "local-test-animation" : "bytedance/seedance-2.5/video-edit",
        mock ? 0 : Math.round(42 * spec.rate * 100),
        now,
        now,
        userId,
        spec.credits,
        spec.tier,
        userId,
        input.assetA,
        userId,
        input.assetB,
        userId,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO credit_transactions SELECT ?,user_id,?,'reserve',-credits,credits,? FROM video_tasks WHERE id=?`,
      )
      .bind(crypto.randomUUID(), "reserve:" + id, now, id),
  ]);
  const task = await db
    .prepare("SELECT * FROM video_tasks WHERE user_id=? AND request_key=?")
    .bind(userId, input.requestKey)
    .first<TaskRow>();
  if (!task)
    throw new AppError(
      409,
      "Check your balance, resolution access, approved photos and active task limit.",
    );
  return { task, created: task.id === id };
}
export async function settleTask(
  db: D1Database,
  id: string,
  success: boolean,
  outputKey: string | null = null,
  errorCode: string | null = null,
  expectedStatus: string | null = null,
) {
  const status = success ? "completed" : "failed";
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `UPDATE video_tasks SET status=?,output_key=COALESCE(?,output_key),error_code=?,updated_at=? WHERE id=? AND status IN ('queued','processing','review','unknown','submitting') AND (? IS NULL OR status=?)`,
      )
      .bind(
        status,
        outputKey,
        errorCode,
        now,
        id,
        expectedStatus,
        expectedStatus,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO credit_transactions SELECT ?,user_id,? ,?,CASE WHEN ? THEN 0 ELSE credits END,-credits,? FROM video_tasks WHERE id=? AND status=?`,
      )
      .bind(
        crypto.randomUUID(),
        "settle:" + id,
        success ? "consume" : "release",
        success ? 1 : 0,
        now,
        id,
        status,
      ),
  ]);
}
export async function rateLimit(
  db: D1Database,
  key: string,
  max: number,
  seconds: number,
) {
  const window = Math.floor(Date.now() / (seconds * 1000));
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key,count,window) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count`,
    )
    .bind(key, window)
    .first<{ count: number }>();
  if ((row?.count ?? max + 1) > max)
    throw new AppError(429, "Please slow down and try again shortly.");
}
export interface OrderRow {
  id: string;
  user_id: string;
  package_id: string;
  product_id: string;
  cents: number;
  credits: number;
  tier: number;
  currency: string;
  status: string;
  provider_id: string | null;
  mode: string;
}
export async function applyPayment(
  db: D1Database,
  order: OrderRow,
  event: {
    id: string;
    type: "order.completed" | "refund.succeeded";
    providerId: string;
  },
) {
  const now = Date.now(),
    refund = event.type === "refund.succeeded";
  await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO payment_events VALUES (?,?,?,?)")
      .bind(event.id, order.id, event.type, now),
    db
      .prepare(
        refund
          ? `UPDATE payment_orders SET status='refunded',provider_id=COALESCE(provider_id,?) WHERE id=? AND status IN ('pending','paid')`
          : `UPDATE payment_orders SET status='paid',provider_id=COALESCE(provider_id,?) WHERE id=? AND status='pending'`,
      )
      .bind(event.providerId, order.id),
    db
      .prepare(
        refund
          ? `INSERT OR IGNORE INTO credit_transactions SELECT ?,user_id,?,'refund',-credits,0,? FROM payment_orders WHERE id=? AND status='refunded' AND EXISTS (SELECT 1 FROM credit_transactions WHERE business_key=?)`
          : `INSERT OR IGNORE INTO credit_transactions SELECT ?,user_id,?,'purchase',credits,0,? FROM payment_orders WHERE id=? AND status='paid'`,
      )
      .bind(
        ...(refund
          ? [
              crypto.randomUUID(),
              "refund:" + order.id,
              now,
              order.id,
              "purchase:" + order.id,
            ]
          : [crypto.randomUUID(), "purchase:" + order.id, now, order.id]),
      ),
    db
      .prepare(
        `UPDATE user_wallets SET tier=COALESCE((SELECT MAX(tier) FROM payment_orders WHERE user_id=? AND status='paid'),0) WHERE user_id=?`,
      )
      .bind(order.user_id, order.user_id),
  ]);
}
