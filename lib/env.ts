import { env } from "cloudflare:workers";
export interface Bindings {
  DB: D1Database;
  MEDIA: R2Bucket;
  APP_ORIGIN: string;
  APP_MODE: string;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GENERATION_ENABLED?: string;
  PAYMENTS_ENABLED?: string;
  WAVESPEED_API_KEY?: string;
  WAFFO_MERCHANT_ID?: string;
  WAFFO_PRIVATE_KEY?: string;
  WAFFO_ENVIRONMENT?: "test" | "prod";
  WAFFO_PRODUCT_LITE?: string;
  WAFFO_PRODUCT_STANDARD?: string;
  WAFFO_PRODUCT_PRO?: string;
  MERCHANT_APPROVED?: string;
  REFERENCE_VIDEO_URL?: string;
  REFERENCE_LICENSE_CONFIRMED?: string;
  VERIFIED_RESOLUTIONS?: string;
  MEDIA_SIGNING_SECRET?: string;
  OUTPUT_HOSTS?: string;
}
export function bindings() {
  return env as unknown as Bindings;
}
export function localMock(e: Bindings, request: Request) {
  const host = new URL(request.url).hostname;
  return (
    e.APP_MODE === "mock" && ["localhost", "127.0.0.1", "[::1]"].includes(host)
  );
}

export function liveResolutions(e: Bindings): string[] {
  if (
    e.GENERATION_ENABLED !== "true" ||
    !e.WAVESPEED_API_KEY ||
    !e.MEDIA_SIGNING_SECRET ||
    !e.REFERENCE_VIDEO_URL ||
    e.REFERENCE_LICENSE_CONFIRMED !== "true"
  )
    return [];
  return (e.VERIFIED_RESOLUTIONS || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ["480p", "720p", "1080p"].includes(s));
}
