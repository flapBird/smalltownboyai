import { it, expect, vi } from "vitest";
const scan = vi.hoisted(() => vi.fn());
vi.mock("@waffo/pancake-ts", () => ({
  ScanSemanticMode: { Enforce: "enforce" },
  WaffoPancake: class {
    contentSafety = { scanPrompt: scan };
  },
}));
import { screenPrompt } from "../lib/prompt-safety";
import type { Bindings } from "../lib/env";
it("only Waffo allow passes and failures stay closed", async () => {
  const e = {
    WAFFO_MERCHANT_ID: "test",
    WAFFO_PRIVATE_KEY: "test",
  } as Bindings;
  scan.mockResolvedValue({ action: "allow" });
  await screenPrompt(e, "actual generation prompt");
  expect(scan).toHaveBeenCalledWith({
    prompt: "actual generation prompt",
    locale: "en",
    semantic: "enforce",
  });
  for (const result of [{ action: "block" }, { action: "review" }, {}, null]) {
    scan.mockResolvedValue(result);
    await expect(screenPrompt(e, "prompt")).rejects.toThrow();
  }
  scan.mockRejectedValue(new Error("timeout"));
  await expect(screenPrompt(e, "prompt")).rejects.toThrow("unavailable");
  await expect(screenPrompt({} as Bindings, "prompt")).rejects.toThrow(
    "configured",
  );
});
