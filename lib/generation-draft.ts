import { z } from "zod";
import { RESOLUTIONS } from "./catalog";
export const PENDING_GENERATION_KEY = "smalltown-pending-generation";
const schema = z.object({
  owner: z.string().min(1),
  startedAt: z.number().finite(),
  payload: z.object({
    subjectMode: z.enum(["human", "pet"]).optional(),
    assetA: z.string().uuid(),
    assetB: z.string().uuid(),
    resolution: z
      .enum([...RESOLUTIONS, "768p"])
      .transform((value) => (value === "768p" ? ("720p" as const) : value)),
    templateId: z.enum(["living-room", "red-fence"]),
    requestKey: z.string().uuid(),
    consent: z.literal(true),
  }),
});
export type PendingGeneration = z.infer<typeof schema>;
export function readPendingGeneration(
  raw: string | null,
  owner: string,
  now = Date.now(),
): PendingGeneration | null {
  try {
    const d = schema.parse(JSON.parse(raw || "null"));
    return d.owner === owner &&
      d.startedAt <= now &&
      now - d.startedAt < 24 * 60 * 60 * 1000
      ? d
      : null;
  } catch {
    return null;
  }
}
