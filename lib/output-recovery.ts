import { settleTask, type TaskRow } from "./credits";
import type { Bindings } from "./env";

const legacyOutputErrors = new Set([
  null,
  "SAFETY_PENDING",
  "SAFETY_UNAVAILABLE",
  "SAFETY_BLOCKED",
]);

// Deliver an already archived result without changing its historical moderation record.
export async function recoverStoredOutput(e: Bindings, t: TaskRow) {
  if (
    t.provider !== "wavespeed" ||
    t.status !== "review" ||
    t.deleted_at !== null ||
    !legacyOutputErrors.has(t.error_code)
  )
    return false;
  const key = `outputs/${t.user_id}/${t.id}.mp4`;
  if (t.output_key !== key) return false;
  const object = await e.MEDIA.head(key);
  if (!object || object.size < 12) return false;
  await settleTask(e.DB, t.id, true, key, null, "review");
  return true;
}
