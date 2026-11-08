import { z } from "zod";
import { AppError } from "./auth";
export const grantInput = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  credits: z.number().int().min(1).max(10000),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  reason: z.string().trim().min(5).max(500),
  key: z.string().uuid(),
});
export async function grantCredits(
  db: D1Database,
  adminId: string,
  input: unknown,
) {
  const b = grantInput.parse(input);
  const admin = await db
    .prepare("SELECT role FROM user WHERE id=?")
    .bind(adminId)
    .first<{ role: string }>();
  if (admin?.role !== "admin")
    throw new AppError(403, "Administrator access required.");
  const users = await db
    .prepare("SELECT id,email FROM user WHERE lower(email)=? LIMIT 2")
    .bind(b.email)
    .all<{ id: string; email: string }>();
  if (users.results.length !== 1)
    throw new AppError(
      users.results.length ? 409 : 404,
      "A unique registered account is required. Ask the recipient to sign in first.",
    );
  const recipient = users.results[0];
  // Every mutation reads the persisted grant, so concurrent retries cannot switch the recipient or amount.
  await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO admin_credit_grants VALUES (?,?,?,?,?,?,?)",
      )
      .bind(
        b.key,
        adminId,
        recipient.id,
        b.credits,
        b.tier,
        b.reason,
        Date.now(),
      ),
    db
      .prepare(
        "INSERT OR IGNORE INTO credit_transactions SELECT ?,user_id,?,'admin_grant',credits,0,created_at FROM admin_credit_grants WHERE id=?",
      )
      .bind(crypto.randomUUID(), "grant:" + b.key, b.key),
    db
      .prepare(
        "UPDATE user_wallets SET tier=MAX(tier,(SELECT tier FROM admin_credit_grants WHERE id=?)) WHERE user_id=(SELECT user_id FROM admin_credit_grants WHERE id=?)",
      )
      .bind(b.key, b.key),
    db
      .prepare(
        "INSERT OR IGNORE INTO admin_audit_logs SELECT 'grant:'||id,admin_id,'grant-credits',user_id,reason,created_at FROM admin_credit_grants WHERE id=?",
      )
      .bind(b.key),
  ]);
  const saved = await db
    .prepare("SELECT * FROM admin_credit_grants WHERE id=?")
    .bind(b.key)
    .first<{
      admin_id: string;
      user_id: string;
      credits: number;
      tier: number;
      reason: string;
    }>();
  if (
    !saved ||
    saved.admin_id !== adminId ||
    saved.user_id !== recipient.id ||
    saved.credits !== b.credits ||
    saved.tier !== b.tier ||
    saved.reason !== b.reason
  )
    throw new AppError(
      409,
      "This request key already belongs to a different credit grant.",
    );
  const wallet = await db
    .prepare("SELECT balance,reserved,tier FROM user_wallets WHERE user_id=?")
    .bind(recipient.id)
    .first();
  return { id: b.key, email: recipient.email, credits: b.credits, wallet };
}
