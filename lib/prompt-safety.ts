import { WaffoPancake, ScanSemanticMode } from "@waffo/pancake-ts";
import type { Bindings } from "./env";
import { AppError } from "./auth";
export async function screenPrompt(e: Bindings, prompt: string) {
  if (!e.WAFFO_MERCHANT_ID || !e.WAFFO_PRIVATE_KEY)
    throw new AppError(503, "Prompt safety checks are not configured.");
  let result;
  try {
    result = await new WaffoPancake({
      merchantId: e.WAFFO_MERCHANT_ID,
      privateKey: e.WAFFO_PRIVATE_KEY,
    }).contentSafety.scanPrompt({
      prompt,
      locale: "en",
      semantic: ScanSemanticMode.Enforce,
    });
  } catch {
    throw new AppError(
      503,
      "Prompt safety check unavailable. Retry later; no generation credits were charged.",
    );
  }
  if (result?.action !== "allow")
    throw new AppError(
      422,
      "Prompt safety check did not approve this request. Contact support.",
    );
}
