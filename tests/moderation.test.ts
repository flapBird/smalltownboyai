import { describe, it, expect } from "vitest";
import { verdict, TEXT_CATEGORIES, mp4Duration } from "../lib/moderation";
const expected = {
  provider_id: "check-1",
  model: "text-nsfw-filter",
  endpoint: "text-moderation",
};
const text = () => ({
  id: "check-1",
  object: "inference",
  provider: "seeapi",
  model: expected.model,
  endpoint: expected.endpoint,
  status: "succeeded",
  error: null,
  result: {
    type: "json",
    data: {
      flagged: false,
      threshold: 0.3,
      categories: Object.fromEntries(
        TEXT_CATEGORIES.map((c) => [c, { score: 0, flagged: false }]),
      ),
    },
  },
});
describe("strict moderation verdicts", () => {
  it("preserves terminal provider codes without exposing messages or URLs", () => {
    const failed = {
      ...text(),
      status: "failed",
      result: null,
      error: { code: "image_download_failed", message: "private signed URL" },
    };
    expect(verdict(failed, expected)).toMatchObject({
      state: "unavailable",
      error: "PROVIDER_image_download_failed",
    });
    expect(JSON.stringify(verdict(failed, expected))).not.toContain(
      "private signed URL",
    );
    expect(
      verdict(
        {
          ...failed,
          error: { code: "https://private.invalid/?signature=secret" },
        },
        expected,
      ).error,
    ).toBe("PROVIDER_FAILED");
  });
  it("accepts a complete clean text and rejects missing categories and mismatched identity", () => {
    expect(verdict(text(), expected).state).toBe("passed");
    const missing = text();
    delete missing.result.data.categories.sexual_minors;
    expect(() => verdict(missing, expected)).toThrow();
    for (const change of [
      { id: "other" },
      { provider: "other" },
      { model: "other" },
      { result: null },
      { error: {} },
    ]) {
      let state = "invalid";
      try {
        state = verdict({ ...text(), ...change }, expected).state;
      } catch {}
      expect(state).not.toBe("passed");
    }
  });
  it("rejects contradictory and blocked images", () => {
    const e = {
      ...expected,
      model: "nsfw-filter-2",
      endpoint: "image-moderation",
    };
    const r = {
      ...text(),
      ...e,
      result: {
        type: "json",
        data: { flagged: false, categories: { nsfw: [], special_care: [] } },
      },
    };
    expect(verdict(r, e).state).toBe("passed");
    expect(() =>
      verdict(
        {
          ...r,
          result: {
            type: "json",
            data: {
              flagged: false,
              categories: { nsfw: ["nudity"], special_care: [] },
            },
          },
        },
        e,
      ),
    ).toThrow();
    expect(
      verdict(
        {
          ...r,
          result: {
            type: "json",
            data: {
              flagged: true,
              categories: { nsfw: [], special_care: ["sexual_minors"] },
            },
          },
        },
        e,
      ).state,
    ).toBe("blocked");
  });
  it("requires complete unique video sampling and honors provider policy blocks", () => {
    const e = {
      ...expected,
      model: "video-nsfw-filter",
      endpoint: "video-moderation",
    };
    const output = {
      nsfw_detected: false,
      scope: "sampled_frames",
      sampling_complete: true,
      checked_frames: 16,
      timestamp_source: "metadata",
      output_layout: "named-files-v1",
      report_schema_version: 5,
      flagged_frame_count: 0,
      frames: Array.from({ length: 16 }, (_, i) => ({
        frame_number: i,
        timestamp_seconds: i * 0.8,
        nsfw_detected: false,
        nsfw: [],
      })),
    };
    const r = {
      ...text(),
      ...e,
      result: { type: "json", data: { flagged: false, output } },
    };
    expect(verdict(r, e).state).toBe("passed");
    for (const bad of [
      { sampling_complete: false },
      { checked_frames: 8 },
      { report_schema_version: 6 },
      { frames: Array(16).fill(output.frames[0]) },
    ])
      expect(() =>
        verdict(
          {
            ...r,
            result: {
              type: "json",
              data: { flagged: false, output: { ...output, ...bad } },
            },
          },
          e,
        ),
      ).toThrow();
    expect(
      verdict(
        {
          ...r,
          result: {
            type: "json",
            data: {
              flagged: true,
              reason: "content_policy_blocked",
              output: null,
            },
          },
        },
        e,
      ).state,
    ).toBe("blocked");
  });
  it("rejects missing or excessive MP4 durations", () => {
    expect(() => mp4Duration(new Uint8Array(12))).toThrow();
    const bytes = new Uint8Array(36),
      v = new DataView(bytes.buffer);
    v.setUint32(0, 36);
    bytes.set(new TextEncoder().encode("moov"), 4);
    v.setUint32(8, 28);
    bytes.set(new TextEncoder().encode("mvhd"), 12);
    v.setUint32(28, 1000);
    v.setUint32(32, 14000);
    expect(mp4Duration(bytes)).toBe(14);
    v.setUint32(32, 31000);
    expect(() => mp4Duration(bytes)).toThrow();
  });
});
