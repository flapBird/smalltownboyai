import { SPECS, type Resolution } from "../catalog";
export const H3_PROMPT =
  "Replace the foreground character with the pet in the first reference image and the background character with the pet in the second reference image. Preserve each pet identity, the original camera rhythm, exaggerated reaction, background dance, playful interaction and final two-character dance. Nonhuman pets only. Preserve the source audio and its timing. Do not add text.";
export const H3_MODEL = "wavespeed-ai/minimax-h3/video-edit";
export function estimateCost(inputDuration: number, resolution: Resolution) {
  // Input rounds up; output is explicitly set to the same integer duration. Two images.
  return Math.round(
    (Math.ceil(inputDuration) * 2 * SPECS[resolution].rate + 0.04) * 100,
  );
}
export interface GenerationInput {
  video: string;
  images: [string, string];
  resolution: Resolution;
  inputDuration: number;
}
export interface ProviderResult {
  id: string;
  status: "processing" | "completed" | "failed";
  url?: string;
  error?: string;
}
export interface VideoGenerationProvider {
  submitTask(input: GenerationInput): Promise<string>;
  queryTask(id: string): Promise<ProviderResult>;
  calculateCost(input: GenerationInput): number;
  validateInput(input: GenerationInput): void;
  normalizeResult(data: unknown): ProviderResult;
}
export class WaveSpeed implements VideoGenerationProvider {
  constructor(
    private key: string,
    private transport: typeof fetch = fetch,
  ) {}
  validateInput(i: GenerationInput) {
    if (
      !Number.isInteger(i.inputDuration) ||
      i.inputDuration < 3 ||
      i.inputDuration > 15 ||
      !SPECS[i.resolution]
    )
      throw new Error("Unsupported video specification.");
    for (const u of [i.video, ...i.images])
      if (new URL(u).protocol !== "https:")
        throw new Error("Provider media must use HTTPS.");
  }
  calculateCost(i: GenerationInput) {
    this.validateInput(i);
    return estimateCost(i.inputDuration, i.resolution);
  }
  async submitTask(i: GenerationInput) {
    this.validateInput(i);
    const r = await this.transport(
      "https://api.wavespeed.ai/api/v3/" + H3_MODEL,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + this.key,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          video: i.video,
          reference_images: i.images,
          resolution: i.resolution,
          duration: i.inputDuration,
          aspect_ratio: "9:16",
          generate_audio: false,
          prompt: H3_PROMPT,
        }),
      },
    );
    if (!r.ok) throw new Error("Provider submission uncertain: " + r.status);
    const body = (await r.json()) as { data?: { id?: string } };
    if (!body.data?.id) throw new Error("Provider returned no task ID.");
    return body.data.id;
  }
  async queryTask(id: string) {
    const r = await this.transport(
      "https://api.wavespeed.ai/api/v3/predictions/" +
        encodeURIComponent(id) +
        "/result",
      {
        headers: { Authorization: "Bearer " + this.key },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!r.ok) throw new Error("Provider query failed.");
    return this.normalizeResult(await r.json());
  }
  normalizeResult(raw: unknown): ProviderResult {
    const d = (
      raw as {
        data: {
          id: string;
          status: string;
          outputs?: string[];
          error?: string;
        };
      }
    ).data;
    if (!d?.id) throw new Error("Invalid provider result.");
    return {
      id: d.id,
      status:
        d.status === "completed"
          ? "completed"
          : d.status === "failed"
            ? "failed"
            : "processing",
      url: d.outputs?.[0],
      error: d.error,
    };
  }
}
