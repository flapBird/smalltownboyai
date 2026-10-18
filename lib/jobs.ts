import type { Bindings } from "./env";
import { settleTask, type TaskRow } from "./credits";
import { WaveSpeed } from "./providers/wavespeed";
async function saveOutput(e: Bindings, t: TaskRow, url: string) {
  const u = new URL(url);
  const allowed = (e.OUTPUT_HOSTS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (
    u.protocol !== "https:" ||
    !allowed.includes(u.hostname) ||
    u.username ||
    u.password
  )
    throw new Error("OUTPUT_HOST_NOT_ALLOWED");
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok || !response.body) throw new Error("OUTPUT_DOWNLOAD_FAILED");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 50 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("OUTPUT_TOO_LARGE");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  if (size < 12 || new TextDecoder().decode(bytes.slice(4, 8)) !== "ftyp")
    throw new Error("INVALID_MP4");
  const key = "outputs/" + t.user_id + "/" + t.id + ".mp4";
  await e.MEDIA.put(key, bytes, { httpMetadata: { contentType: "video/mp4" } });
  await e.DB.prepare(
    "UPDATE video_tasks SET status='review',output_key=?,updated_at=?,error_code=NULL WHERE id=? AND status='processing'",
  )
    .bind(key, Date.now(), t.id)
    .run();
}
export async function reconcile(e: Bindings) {
  const rows = await e.DB.prepare(
    "SELECT * FROM video_tasks WHERE provider='wavespeed' AND status='processing' AND lease_until<? ORDER BY updated_at LIMIT 15",
  )
    .bind(Date.now())
    .all<TaskRow>();
  for (const t of rows.results) {
    const lease = await e.DB.prepare(
      "UPDATE video_tasks SET lease_until=? WHERE id=? AND lease_until<? AND status='processing' RETURNING id",
    )
      .bind(Date.now() + 90000, t.id, Date.now())
      .first();
    if (!lease) continue;
    try {
      if (!t.provider_task_id || !e.WAVESPEED_API_KEY) continue;
      const r = await new WaveSpeed(e.WAVESPEED_API_KEY).queryTask(
        t.provider_task_id,
      );
      if (r.status === "failed")
        await settleTask(e.DB, t.id, false, null, "PROVIDER_FAILED");
      else if (r.status === "completed" && r.url) await saveOutput(e, t, r.url);
      else if (Date.now() - t.created_at > 24 * 3600 * 1000)
        await e.DB.prepare(
          "UPDATE video_tasks SET status='unknown',error_code='PROVIDER_TIMEOUT',updated_at=? WHERE id=? AND status='processing'",
        )
          .bind(Date.now(), t.id)
          .run();
    } catch {
      await e.DB.prepare(
        "UPDATE video_tasks SET error_code='RECONCILIATION_RETRY',updated_at=? WHERE id=? AND status='processing'",
      )
        .bind(Date.now(), t.id)
        .run();
    }
  }
  const abandoned = await e.DB.prepare(
    "SELECT id FROM video_tasks WHERE status='queued' AND updated_at<?",
  )
    .bind(Date.now() - 120000)
    .all<{ id: string }>();
  for (const t of abandoned.results)
    await settleTask(e.DB, t.id, false, null, "QUEUED_TIMEOUT", "queued");
  await e.DB.prepare(
    "UPDATE video_tasks SET status='unknown',error_code='SUBMISSION_INTERRUPTED',updated_at=? WHERE status='submitting' AND updated_at<?",
  )
    .bind(Date.now(), Date.now() - 120000)
    .run();
  const stale = await e.DB.prepare(
    "SELECT id,object_key FROM media_assets WHERE created_at<? AND id NOT IN (SELECT asset_a FROM video_tasks WHERE deleted_at IS NULL UNION SELECT asset_b FROM video_tasks WHERE deleted_at IS NULL) LIMIT 50",
  )
    .bind(Date.now() - 24 * 3600 * 1000)
    .all<{ id: string; object_key: string }>();
  for (const a of stale.results) {
    await e.MEDIA.delete(a.object_key);
    await e.DB.prepare("DELETE FROM media_assets WHERE id=?").bind(a.id).run();
  }
  await e.DB.prepare("DELETE FROM mock_sessions WHERE expires_at<?")
    .bind(Date.now())
    .run();
}
