import { SPECS, type Resolution } from "../catalog";
export const WAN_MODEL = "alibaba/wan-3.0/video-edit";
export type SubjectMode = "human" | "pet";

export function generationPrompt(mode: SubjectMode = "pet") {
  const subjects = mode === "human" ? "two consenting adults" : "two pets";
  const identity =
    mode === "human"
      ? "Preserve each person's facial features, hairstyle, identity, and gender presentation. Use natural human bodies."
      : "Preserve each pet's face, species, coat, and markings. Keep both characters nonhuman.";
  return [
    `Edit Video 1 by replacing its two main characters with the ${subjects} in Image 1 and Image 2.`,
    "Character A is the subject in Image 1. Replace the character who gives the exaggerated reaction in the foreground close-up at the start with A.",
    "Character B is the subject in Image 2. Replace the character dancing in the background at the start with B.",
    `Track each original character's motion throughout Video 1. Keep A on A's track and B on B's track, even when they trade places, the shot cuts, one blocks the other, or both approach the camera. ${identity}`,
    "Preserve the choreography, hands-on-head reaction, position changes, interaction, rhythm, camera movement, edit order, and background. Change only the two characters' appearances.",
    "Keep both identities distinct and consistent from first frame to last. Do not mix faces, swap identities, merge characters, change gender, or add a third character.",
    "Keep the original duration, vertical 9:16 framing, action timing, and audio. No subtitles, watermark, or added dialogue.",
  ].join("\n\n");
}
export function estimateCost(inputDuration: number, resolution: Resolution) {
  // Wan bills the rounded input duration plus the requested output duration.
  return Math.round(
    Math.ceil(inputDuration) * 2 * SPECS[resolution].rate * 100,
  );
}
export interface GenerationInput {
  subjectMode?: SubjectMode;
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
      i.inputDuration < 2 ||
      i.inputDuration > 15 ||
      !Object.hasOwn(SPECS, i.resolution)
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
    const r = await this.transport.call(
      globalThis,
      "https://api.wavespeed.ai/api/v3/" + WAN_MODEL,
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
          enable_prompt_expansion: false,
          generate_audio: false,
          prompt: generationPrompt(i.subjectMode),
        }),
      },
    );
    if (!r.ok) throw new Error("Provider submission uncertain: " + r.status);
    const body = (await r.json()) as { data?: { id?: string } };
    if (!body.data?.id) throw new Error("Provider returned no task ID.");
    return body.data.id;
  }
  async queryTask(id: string) {
    const r = await this.transport.call(
      globalThis,
      "https://api.wavespeed.ai/api/v3/predictions/" +
        encodeURIComponent(id) +
        "/result",
      {
        headers: { Authorization: "Bearer " + this.key },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!r.ok) throw new Error("PROVIDER_QUERY_HTTP_" + r.status);
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
          : ["failed", "cancelled", "timeout", "deleted"].includes(d.status)
            ? "failed"
            : "processing",
      url: d.outputs?.[0],
      error: d.error,
    };
  }
}
