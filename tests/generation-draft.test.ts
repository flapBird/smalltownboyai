import { describe, expect, it } from "vitest";
import { readPendingGeneration } from "../lib/generation-draft";
const saved = {
  owner: "account-a",
  startedAt: 1000,
  payload: {
    assetA: crypto.randomUUID(),
    assetB: crypto.randomUUID(),
    requestKey: crypto.randomUUID(),
    resolution: "480p",
    templateId: "living-room",
    consent: true,
  },
};
describe("generation refresh recovery", () => {
  it("restores the original upload IDs, consent and idempotency key without a new request", () => {
    const first = readPendingGeneration(
      JSON.stringify(saved),
      "account-a",
      2000,
    );
    const refreshed = readPendingGeneration(
      JSON.stringify(first),
      "account-a",
      3000,
    );
    expect(refreshed).toEqual(saved);
  });
  it("does not resume another account's request or corrupt/expired drafts", () => {
    expect(
      readPendingGeneration(JSON.stringify(saved), "account-b", 2000),
    ).toBeNull();
    expect(
      readPendingGeneration(JSON.stringify(saved), "account-a", 86402000),
    ).toBeNull();
    expect(readPendingGeneration("broken", "account-a")).toBeNull();
    expect(
      readPendingGeneration(
        JSON.stringify({
          ...saved,
          payload: { ...saved.payload, consent: false },
        }),
        "account-a",
        2000,
      ),
    ).toBeNull();
  });
});
