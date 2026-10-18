import { SPECS, type Resolution } from "../catalog";
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
    if (i.inputDuration < 4 || i.inputDuration > 30 || !SPECS[i.resolution])
      throw new Error("Unsupported video specification.");
    for (const u of [i.video, ...i.images])
      if (new URL(u).protocol !== "https:")
        throw new Error("Provider media must use HTTPS.");
  }
  calculateCost(i: GenerationInput) {
    return Math.round(i.inputDuration * 2 * SPECS[i.resolution].rate * 100);
  }
  async submitTask(i: GenerationInput) {
    this.validateInput(i);
    const r = await this.transport(
      "https://api.wavespeed.ai/api/v3/bytedance/seedance-2.5/video-edit",
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
          generate_audio: false,
          prompt:
            "Replace the foreground character with the pet in @Image 1 and the background character with the pet in @Image 2. Preserve each pet identity, the original camera rhythm, exaggerated reaction, background dance, playful interaction and final two-character dance. Nonhuman pets only. Do not add text or music.",
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
