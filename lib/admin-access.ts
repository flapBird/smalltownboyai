import { AppError } from "./auth";
import type { Bindings } from "./env";
import { signature, validSignature } from "./media";
export function allowedAdmin(e: Bindings, u: { email: string; role: string }) {
  if (
    u.role !== "admin" ||
    !e.ADMIN_PASSWORD ||
    !(e.ADMIN_EMAILS || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .includes(u.email.toLowerCase())
  )
    throw new AppError(
      403,
      "This account is not configured for administrator access.",
    );
}
export async function unlockAdmin(e: Bindings, id: string, password: string) {
  const hash = async (v: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)),
    );
  const a = await hash(password),
    b = await hash(e.ADMIN_PASSWORD!);
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  if (different) throw new AppError(403, "Incorrect administrator password.");
  const expires = String(Date.now() + 30 * 60000);
  return (
    expires +
    "." +
    (await signature(e.ADMIN_PASSWORD!, `admin:${id}:${expires}`))
  );
}
export async function requireAdminSession(e: Bindings, r: Request, id: string) {
  const value =
    (r.headers.get("cookie") || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("admin_access="))
      ?.slice(13) || "";
  const [expires, sig] = value.split(".");
  if (
    !(await validSignature(
      e.ADMIN_PASSWORD!,
      "admin:" + id,
      expires || "",
      sig || "",
    ))
  )
    throw new AppError(403, "Unlock administrator access with your password.");
}
