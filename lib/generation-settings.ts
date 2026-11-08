import { z } from "zod";
import type { Bindings } from "./env";
import { TEMPLATES } from "./templates";
import { AppError } from "./auth";
export const generationSettingsSchema = z
  .object({
    resolutions: z.array(z.enum(["480p", "768p", "1080p"])).max(3),
    templates: z
      .array(
        z.object({
          id: z.enum(["living-room", "red-fence"]),
          version: z.number().int(),
          enabled: z.boolean(),
          licensed: z.boolean(),
        }),
      )
      .length(TEMPLATES.length),
    reason: z.string().trim().min(5).max(500),
  })
  .superRefine((s, c) => {
    if (
      new Set(s.templates.map((t) => t.id)).size !== TEMPLATES.length ||
      s.templates.some(
        (t) => !TEMPLATES.some((k) => k.id === t.id && k.version === t.version),
      )
    )
      c.addIssue({
        code: "custom",
        message: "Template versions changed. Reload settings.",
      });
  });
export type GenerationSettings = z.infer<typeof generationSettingsSchema>;
export async function readGenerationSettings(
  e: Bindings,
): Promise<GenerationSettings> {
  const row = await e.DB.prepare(
    "SELECT value FROM settings WHERE key='generation_config'",
  ).first<{ value: string }>();
  if (row) return generationSettingsSchema.parse(JSON.parse(row.value));
  // One-time transition: existing installations retain their old configuration until saved in admin.
  return {
    resolutions: (e.VERIFIED_RESOLUTIONS || "")
      .split(",")
      .map((v) => v.trim())
      .filter((v): v is "480p" | "768p" | "1080p" =>
        ["480p", "768p", "1080p"].includes(v),
      ),
    templates: TEMPLATES.map((t) => ({
      id: t.id,
      version: t.version,
      enabled: (e.VERIFIED_TEMPLATES || "")
        .split(",")
        .map((v) => v.trim())
        .includes(t.id),
      licensed: e.REFERENCE_LICENSE_CONFIRMED === "true",
    })),
    reason: "Initial settings",
  };
}
export async function runtimeGenerationSettings(
  e: Bindings,
): Promise<Bindings> {
  const s = await readGenerationSettings(e);
  const enabled = s.templates.filter(
    (t) =>
      t.enabled &&
      t.licensed &&
      TEMPLATES.some((v) => v.id === t.id && v.version === t.version),
  );
  return {
    ...e,
    VERIFIED_TEMPLATES: enabled.map((t) => t.id).join(","),
    VERIFIED_RESOLUTIONS: s.resolutions.join(","),
    REFERENCE_LICENSE_CONFIRMED: enabled.length ? "true" : "false",
  };
}
export async function saveGenerationSettings(
  e: Bindings,
  admin: string,
  input: unknown,
) {
  const s = generationSettingsSchema.parse(input);
  if (s.templates.some((t) => t.enabled && !t.licensed))
    throw new AppError(
      400,
      "Confirm rights for each template before enabling it.",
    );
  const value = JSON.stringify(s);
  await e.DB.batch([
    e.DB.prepare(
      "INSERT INTO settings (key,value) VALUES ('generation_config',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    ).bind(value),
    e.DB.prepare("INSERT INTO admin_audit_logs VALUES (?,?,?,?,?,?)").bind(
      crypto.randomUUID(),
      admin,
      "generation-settings",
      "service",
      value,
      Date.now(),
    ),
  ]);
  return s;
}
