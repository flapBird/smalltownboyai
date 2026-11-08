import { screenPrompt } from "./prompt-safety";
import { z } from "zod";
import type { Bindings } from "./env";
import { AppError } from "./auth";
import { imageInfo, signature, validSignature } from "./media";
import { H3_PROMPT } from "./providers/wavespeed";
import { SPECS, type Resolution } from "./catalog";
import { getTemplate } from "./templates";
import { settleTask, type TaskRow } from "./credits";

export const POLICY = "seeapi-strict-v1";
export const TEXT_CATEGORIES = [
  "sexual_explicit",
  "sexual_suggestive",
  "sexual_minors",
  "violence",
  "hate",
  "harassment",
  "self_harm",
];
const ENDPOINTS = {
  text: ["text-nsfw-filter", "text-moderation"],
  image: ["nsfw-filter-2", "image-moderation"],
  video: ["video-nsfw-filter", "video-moderation"],
} as const;
type Kind = keyof typeof ENDPOINTS;
export interface Check {
  id: string;
  owner: string;
  stage: string;
  asset_key: string | null;
  asset_etag: string | null;
  policy: string;
  model: string;
  endpoint: string;
  body: string;
  provider_id: string | null;
  state: string;
  attempts: number;
  next_at: number;
  lease_until: number;
  deadline: number;
  created_at: number;
  usage: number | null;
  error: string | null;
}
const envelope = z.object({
  id: z.string().min(1).max(255),
  object: z.literal("inference"),
  provider: z.literal("seeapi"),
  model: z.string(),
  endpoint: z.string(),
  status: z.enum([
    "queued",
    "processing",
    "succeeded",
    "failed",
    "canceled",
    "refunded",
    "expired",
  ]),
  error: z.unknown(),
  result: z.unknown(),
  consumed_credits: z.number().finite().nonnegative().optional(),
});
const labels = z.array(
  z.enum(["nudity", "sexual_activity", "sexual_suggestive"]),
);
const special = z.array(z.literal("sexual_minors"));
const videoFrame = z.object({
  frame_number: z.number().int().nonnegative(),
  timestamp_seconds: z.number().finite().nonnegative().max(30),
  nsfw_detected: z.boolean(),
  nsfw: labels,
  special: special.optional(),
});

// A valid execution envelope is not an approval. Missing/contradictory results fail closed.
export function verdict(
  raw: unknown,
  expected: Pick<Check, "provider_id" | "model" | "endpoint">,
): { id: string; state: string; usage?: number } {
  const e = envelope.parse(raw);
  if (
    (expected.provider_id && e.id !== expected.provider_id) ||
    e.model !== expected.model ||
    e.endpoint !== expected.endpoint
  )
    throw new Error("IDENTITY_MISMATCH");
  if (e.status === "queued" || e.status === "processing")
    return { id: e.id, state: "pending" };
  if (e.status !== "succeeded" || e.error !== null)
    return { id: e.id, state: "unavailable", usage: e.consumed_credits };
  const result = z
    .object({ type: z.literal("json"), data: z.unknown() })
    .parse(e.result);
  let flagged: boolean;
  if (e.endpoint === "text-moderation") {
    const d = z
      .object({
        flagged: z.boolean(),
        threshold: z.literal(0.3),
        categories: z.record(
          z.string(),
          z.object({
            score: z.number().finite().min(0).max(1),
            flagged: z.boolean(),
          }),
        ),
      })
      .parse(result.data);
    if (
      TEXT_CATEGORIES.some((c) => !d.categories[c]) ||
      d.flagged !== TEXT_CATEGORIES.some((c) => d.categories[c].flagged)
    )
      throw new Error("INCOMPLETE_TEXT");
    flagged = d.flagged;
  } else if (e.endpoint === "image-moderation") {
    const d = z
      .object({
        flagged: z.boolean(),
        categories: z.object({ nsfw: labels, special_care: special }),
      })
      .parse(result.data);
    if (
      d.flagged !==
      !!(d.categories.nsfw.length || d.categories.special_care.length)
    )
      throw new Error("CONTRADICTORY_IMAGE");
    flagged = d.flagged;
  } else {
    const d = z
      .object({
        flagged: z.boolean(),
        reason: z.string().optional(),
        output: z.unknown(),
      })
      .parse(result.data);
    if (d.flagged && d.reason === "content_policy_blocked" && d.output === null)
      return { id: e.id, state: "blocked", usage: e.consumed_credits };
    const o = z
      .object({
        nsfw_detected: z.boolean(),
        scope: z.literal("sampled_frames"),
        sampling_complete: z.literal(true),
        checked_frames: z.number().int().min(8).max(32),
        timestamp_source: z.string().min(1),
        output_layout: z.literal("named-files-v1"),
        report_schema_version: z.literal(5),
        flagged_frame_count: z.number().int().nonnegative(),
        frames: z.array(videoFrame),
      })
      .parse(d.output);
    const count = o.frames.filter((f) => f.nsfw_detected).length;
    if (
      o.frames.length !== o.checked_frames ||
      new Set(o.frames.map((f) => f.frame_number)).size !== o.checked_frames ||
      count !== o.flagged_frame_count ||
      o.nsfw_detected !== count > 0 ||
      d.flagged !== o.nsfw_detected ||
      o.frames.some(
        (f) => !f.nsfw_detected && (f.nsfw.length || f.special?.length),
      )
    )
      throw new Error("INCOMPLETE_VIDEO");
    flagged = d.flagged;
  }
  return {
    id: e.id,
    state: flagged ? "blocked" : "passed",
    usage: e.consumed_credits,
  };
}
export async function digest(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
function configured(e: Bindings) {
  if (
    !e.SEEAPI_API_KEY ||
    !e.MEDIA_SIGNING_SECRET ||
    !e.APP_ORIGIN.startsWith("https://")
  )
    throw new AppError(
      503,
      "Safety checks are unavailable. Please contact support; no generation credits were charged.",
    );
}
export async function mediaCheckURL(
  e: Bindings,
  id: string,
  expires = Date.now() + 30 * 60000,
) {
  const sig = await signature(
    e.MEDIA_SIGNING_SECRET!,
    `moderation:${id}:${expires}`,
  );
  return `${e.APP_ORIGIN}/api/moderation-media/${id}?expires=${expires}&signature=${sig}`;
}
export async function resolveModerationMedia(
  e: Bindings,
  id: string,
  url: URL,
) {
  if (
    !e.MEDIA_SIGNING_SECRET ||
    !(await validSignature(
      e.MEDIA_SIGNING_SECRET,
      "moderation:" + id,
      url.searchParams.get("expires") || "",
      url.searchParams.get("signature") || "",
    ))
  )
    throw new AppError(404, "Media unavailable.");
  const c = await e.DB.prepare(
    "SELECT * FROM moderation_checks WHERE id=? AND policy=?",
  )
    .bind(id, POLICY)
    .first<Check>();
  if (
    !c?.asset_key ||
    !c.asset_etag ||
    !["pending", "passed"].includes(c.state)
  )
    throw new AppError(404, "Media unavailable.");
  return c;
}
// Parse the actual movie-header duration, rather than trusting the requested output duration.
export function mp4Duration(bytes: Uint8Array): number {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const scan = (start: number, end: number): number | null => {
    for (let at = start; at + 8 <= end;) {
      let size = v.getUint32(at),
        header = 8;
      const type = String.fromCharCode(...bytes.slice(at + 4, at + 8));
      if (size === 1) {
        if (at + 16 > end) break;
        size = Number(v.getBigUint64(at + 8));
        header = 16;
      }
      if (size === 0) size = end - at;
      if (!Number.isSafeInteger(size) || size < header || at + size > end)
        break;
      const p = at + header;
      if (type === "moov") {
        const d = scan(p, at + size);
        if (d !== null) return d;
      }
      if (type === "mvhd") {
        const version = bytes[p];
        if (version === 0 && p + 20 <= at + size)
          return v.getUint32(p + 16) / v.getUint32(p + 12);
        if (version === 1 && p + 32 <= at + size)
          return Number(v.getBigUint64(p + 24)) / v.getUint32(p + 20);
      }
      at += size;
    }
    return null;
  };
  const seconds = scan(0, bytes.length);
  if (
    seconds === null ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    seconds > 30
  )
    throw new AppError(
      422,
      "Video safety checks require a valid MP4 up to 30 seconds.",
    );
  return seconds;
}
async function validateMedia(
  e: Bindings,
  source: { key: string; etag: string },
  kind: Kind,
) {
  const obj = await e.MEDIA.get(source.key, {
    onlyIf: { etagMatches: source.etag },
  });
  if (!obj || !("body" in obj))
    throw new AppError(409, "Media changed; upload again.");
  if (obj.size > 50 * 1024 * 1024)
    throw new AppError(413, "Media exceeds safety check limits.");
  const bytes = new Uint8Array(await new Response(obj.body).arrayBuffer());
  if (kind === "image") {
    const info = imageInfo(bytes);
    if (
      !["image/jpeg", "image/png"].includes(info.mime) ||
      bytes.length > 8 * 1024 * 1024 ||
      info.width < 256 ||
      info.height < 256 ||
      info.width > 4096 ||
      info.height > 4096 ||
      info.width * info.height < 78400
    )
      throw new AppError(
        422,
        "For safety checks, use JPG or PNG, 256–4096 pixels per side and at least 78,400 pixels in total.",
      );
  } else mp4Duration(bytes);
}
export async function ensureCheck(
  e: Bindings,
  owner: string,
  stage: string,
  item: string,
  kind: Kind,
  source: { text: string } | { key: string; etag: string },
): Promise<Check> {
  configured(e);
  const [model, endpoint] = ENDPOINTS[kind];
  const identity =
    "text" in source
      ? await digest(source.text)
      : source.key + ":" + source.etag;
  const id = await digest(
    JSON.stringify([owner, stage, item, identity, POLICY, model, endpoint]),
  );
  const existing = await e.DB.prepare(
    "SELECT * FROM moderation_checks WHERE id=?",
  )
    .bind(id)
    .first<Check>();
  if (existing) return existing;
  const now = Date.now();
  let input: Record<string, unknown>;
  if ("text" in source)
    input = { text: source.text, threshold: 0.3, categories: TEXT_CATEGORIES };
  else {
    await validateMedia(e, source, kind);
    if (kind === "image") {
      input = {
        image_url: await mediaCheckURL(e, id, now + 30 * 60000),
        threshold: 0.5,
        strict_special_care: true,
      };
    } else {
      input = {
        video_url: await mediaCheckURL(e, id, now + 30 * 60000),
        num_frames: 16,
        threshold_offset: 0.02,
        strict_special_care: true,
        return_frames: "none",
      };
    }
  }
  const body = JSON.stringify({ model, endpoint, provider: "seeapi", input });
  // Atomic admission: each logical inference consumes a slot, including rejected checks.
  const cap = Math.min(
    1000,
    Math.max(1, Number(e.SEEAPI_DAILY_CHECK_LIMIT) || 100),
  );
  const day = Math.floor(now / 86400000) * 86400000;
  await e.DB.prepare(
    `INSERT OR IGNORE INTO moderation_checks (id,owner,stage,asset_key,asset_etag,policy,model,endpoint,body,deadline,created_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM moderation_checks WHERE created_at>=?)<?
    AND (SELECT COUNT(*) FROM moderation_checks WHERE owner=? AND created_at>=?)<30
    AND (SELECT COUNT(*) FROM moderation_checks WHERE owner=? AND state='pending')<4`,
  )
    .bind(
      id,
      owner,
      stage,
      "key" in source ? source.key : null,
      "etag" in source ? source.etag : null,
      POLICY,
      model,
      endpoint,
      body,
      now + 20 * 60000,
      now,
      day,
      cap,
      owner,
      day,
      owner,
    )
    .run();
  const row = await e.DB.prepare("SELECT * FROM moderation_checks WHERE id=?")
    .bind(id)
    .first<Check>();
  if (!row)
    throw new AppError(
      429,
      "Safety check limit reached. Please try later; no generation credits were charged.",
    );
  return row;
}
async function boundedJson(r: Response) {
  const reader = r.body?.getReader();
  if (!reader) throw new Error("EMPTY_RESPONSE");
  let n = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > 1024 * 1024) {
      await reader.cancel();
      throw new Error("RESPONSE_TOO_LARGE");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(n);
  let i = 0;
  for (const c of chunks) {
    bytes.set(c, i);
    i += c.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function runCheck(
  e: Bindings,
  id: string,
  transport: typeof fetch = fetch,
): Promise<Check> {
  const now = Date.now(),
    lease = now + 60000;
  let row = await e.DB.prepare("SELECT * FROM moderation_checks WHERE id=?")
    .bind(id)
    .first<Check>();
  if (!row) throw new AppError(404, "Safety check not found.");
  if (row.state !== "pending") return row;
  if (row.deadline <= now || row.attempts >= 12) {
    await e.DB.prepare(
      "UPDATE moderation_checks SET state='unavailable',error='CHECK_DEADLINE' WHERE id=? AND state='pending' AND lease_until<?",
    )
      .bind(id, now)
      .run();
    return (await e.DB.prepare("SELECT * FROM moderation_checks WHERE id=?")
      .bind(id)
      .first<Check>())!;
  }
  if (!e.SEEAPI_API_KEY) return row;
  const claimed = await e.DB.prepare(
    "UPDATE moderation_checks SET lease_until=?,attempts=attempts+1 WHERE id=? AND state='pending' AND next_at<=? AND lease_until<? RETURNING *",
  )
    .bind(lease, id, now, now)
    .first<Check>();
  if (!claimed) return row;
  let state = "pending",
    error: string | null = null,
    provider = claimed.provider_id,
    usage: number | null = null;
  let delay = Math.min(180000, 15000 * 2 ** Math.min(claimed.attempts, 4));
  try {
    const r = await transport(
      "https://api.seeapi.com/v1/inferences" +
        (provider ? "/" + encodeURIComponent(provider) : ""),
      {
        method: provider ? "GET" : "POST",
        headers: {
          Authorization: "Bearer " + e.SEEAPI_API_KEY,
          "Content-Type": "application/json",
          ...(!provider ? { "Idempotency-Key": id } : {}),
        },
        ...(!provider ? { body: claimed.body } : {}),
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      },
    );
    const retry = r.headers.get("retry-after");
    if (retry) {
      const seconds = Number(retry);
      const ms = Number.isFinite(seconds)
        ? seconds * 1000
        : Date.parse(retry) - now;
      if (Number.isFinite(ms)) delay = Math.max(delay, Math.max(0, ms));
    }
    if (!r.ok) {
      error = "HTTP_" + r.status;
      if (![408, 409, 429].includes(r.status) && r.status < 500)
        state = "unavailable";
    } else {
      try {
        const v = verdict(await boundedJson(r), claimed);
        provider = v.id;
        state = v.state;
        usage = v.usage ?? null;
        if (state === "unavailable") error = "PROVIDER_TERMINAL";
      } catch {
        state = "unavailable";
        error = "INVALID_RESULT";
      }
    }
  } catch {
    error = "TRANSPORT_RETRY";
  }
  await e.DB.prepare(
    "UPDATE moderation_checks SET state=?,provider_id=?,usage=COALESCE(?,usage),error=?,next_at=?,lease_until=0 WHERE id=? AND lease_until=?",
  )
    .bind(state, provider, usage, error, Date.now() + delay, id, lease)
    .run();
  return (await e.DB.prepare("SELECT * FROM moderation_checks WHERE id=?")
    .bind(id)
    .first<Check>())!;
}
async function requirePass(e: Bindings, c: Check) {
  const done = await runCheck(e, c.id);
  if (done.state === "blocked")
    throw new AppError(
      422,
      "Safety check blocked this content. Choose different photos or contact support.",
      "SAFETY_BLOCKED",
    );
  if (done.state === "unavailable")
    throw new AppError(
      503,
      "Safety checks could not finish. Contact support; this is not a content rejection.",
      "SAFETY_UNAVAILABLE",
    );
  if (done.state !== "passed")
    throw new AppError(
      409,
      `${c.stage === "template" ? "Checking the dance template" : c.stage === "output" ? "Checking the generated video" : "Checking your photos"}. ${done.error === "TRANSPORT_RETRY" ? "The safety service connection is delayed; retrying automatically." : "Waiting for the safety service."} No new generation credits have been charged.`,
      "SAFETY_PENDING",
    );
  return done;
}
export async function moderateInputs(
  e: Bindings,
  owner: string,
  b: {
    assetA: string;
    assetB: string;
    resolution: Resolution;
    templateId: string;
  },
) {
  configured(e);
  const spec = SPECS[b.resolution];
  const wallet = await e.DB.prepare(
    "SELECT balance,tier FROM user_wallets WHERE user_id=?",
  )
    .bind(owner)
    .first<{ balance: number; tier: number }>();
  const active = await e.DB.prepare(
    "SELECT COUNT(*) n FROM video_tasks WHERE user_id=? AND status NOT IN ('completed','failed')",
  )
    .bind(owner)
    .first<{ n: number }>();
  const paused = await e.DB.prepare(
    "SELECT value FROM settings WHERE key='generation_paused'",
  ).first<{ value: string }>();
  if (
    !wallet ||
    wallet.balance < spec.credits ||
    wallet.tier < spec.tier ||
    (active?.n ?? 0) >= 2 ||
    paused?.value !== "false"
  )
    throw new AppError(
      409,
      "Check your credit balance, quality access and active tasks before safety checks.",
    );
  const assets = [];
  for (const id of [b.assetA, b.assetB]) {
    const asset = await e.DB.prepare(
      "SELECT object_key,moderation FROM media_assets WHERE id=? AND user_id=?",
    )
      .bind(id, owner)
      .first<{ object_key: string; moderation: string }>();
    if (!asset || asset.moderation === "rejected")
      throw new AppError(
        409,
        "This photo is unavailable or was rejected. Choose another photo or contact support.",
      );
    const head = await e.MEDIA.head(asset.object_key);
    if (!head) throw new AppError(404, "Photo missing.");
    assets.push({ id, key: asset.object_key, etag: head.etag });
  }
  const template = getTemplate(b.templateId)!;
  for (const asset of assets) await validateMedia(e, asset, "image");
  await validateMedia(
    e,
    { key: template.objectKey, etag: template.etag },
    "video",
  );
  await screenPrompt(e, H3_PROMPT);
  const checked = [];
  for (const a of assets)
    checked.push(
      await requirePass(
        e,
        await ensureCheck(e, owner, "input", a.id, "image", a),
      ),
    );
  await requirePass(
    e,
    await ensureCheck(
      e,
      owner,
      "template",
      `${template.id}:${template.version}`,
      "video",
      { key: template.objectKey, etag: template.etag },
    ),
  );
  // Recheck versions immediately before the credit reservation; generator URLs remain ETag-pinned.
  for (const c of checked)
    if ((await e.MEDIA.head(c.asset_key!))?.etag !== c.asset_etag)
      throw new AppError(409, "Photo changed; retry safety checks.");
  // Only automatic passes may promote pending uploads; never override an admin rejection.
  await e.DB.batch(
    assets.map((a) =>
      e.DB.prepare(
        "UPDATE media_assets SET moderation='approved' WHERE id=? AND user_id=? AND object_key=? AND moderation='pending'",
      ).bind(a.id, owner, a.key),
    ),
  );
  return Promise.all(checked.map((c) => mediaCheckURL(e, c.id))) as Promise<
    [string, string]
  >;
}
export async function moderateOutput(e: Bindings, t: TaskRow, poll = true) {
  if (!t.output_key) throw new AppError(404, "Output missing.");
  const head = await e.MEDIA.head(t.output_key);
  if (!head) throw new AppError(404, "Output missing.");
  const c = await ensureCheck(e, t.user_id, "output", t.id, "video", {
    key: t.output_key,
    etag: head.etag,
  });
  return poll ? requirePass(e, c) : c;
}
export async function approvedOutputEtag(e: Bindings, t: TaskRow) {
  if (!t.output_key) throw new AppError(404, "Output missing.");
  const head = await e.MEDIA.head(t.output_key);
  if (!head) throw new AppError(404, "Output missing.");
  const c = await e.DB.prepare(
    "SELECT * FROM moderation_checks WHERE owner=? AND stage='output' AND asset_key=? AND asset_etag=? AND policy=? AND state='passed'",
  )
    .bind(t.user_id, t.output_key, head.etag, POLICY)
    .first<Check>();
  if (!c) throw new AppError(404, "Video is awaiting safety checks.");
  return head.etag;
}
export async function reconcileModeration(e: Bindings) {
  const rows = await e.DB.prepare(
    "SELECT id FROM moderation_checks WHERE stage<>'prompt' AND state='pending' AND next_at<=? AND lease_until<? ORDER BY created_at LIMIT 10",
  )
    .bind(Date.now(), Date.now())
    .all<{ id: string }>();
  for (const r of rows.results) await runCheck(e, r.id);
  await e.DB.prepare(
    `UPDATE video_tasks SET error_code=(
    SELECT CASE c.state WHEN 'blocked' THEN 'SAFETY_BLOCKED' WHEN 'unavailable' THEN 'SAFETY_UNAVAILABLE' WHEN 'pending' THEN 'SAFETY_PENDING' ELSE NULL END
    FROM moderation_checks c WHERE c.owner=video_tasks.user_id AND c.asset_key=video_tasks.output_key AND c.stage='output' AND c.policy=? ORDER BY c.created_at DESC LIMIT 1
  ) WHERE provider='wavespeed' AND status='review'`,
  )
    .bind(POLICY)
    .run();
  if (!e.SEEAPI_API_KEY || !e.MEDIA_SIGNING_SECRET) return;
  const outputs = await e.DB.prepare(
    "SELECT * FROM video_tasks WHERE provider='wavespeed' AND status='review' AND output_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM moderation_checks c WHERE c.asset_key=video_tasks.output_key AND c.policy=? ) ORDER BY updated_at LIMIT 10",
  )
    .bind(POLICY)
    .all<TaskRow>();
  for (const t of outputs.results) {
    try {
      const c = await moderateOutput(e, t, false);
      await runCheck(e, c.id);
    } catch {
      /* Keep private for administrator review. No refund or regeneration on moderation errors. */
    }
  }
  const passed = await e.DB.prepare(
    "SELECT * FROM video_tasks WHERE provider='wavespeed' AND status='review' AND EXISTS (SELECT 1 FROM moderation_checks c WHERE c.owner=video_tasks.user_id AND c.stage='output' AND c.asset_key=video_tasks.output_key AND c.policy=? AND c.state='passed') ORDER BY updated_at LIMIT 10",
  )
    .bind(POLICY)
    .all<TaskRow>();
  for (const t of passed.results) {
    try {
      await approvedOutputEtag(e, t);
      await settleTask(e.DB, t.id, true, t.output_key, null, "review");
    } catch {
      // Changed or missing bytes stay private; a cached pass cannot release them.
    }
  }
}
