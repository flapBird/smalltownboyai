import type { Bindings } from "./env";
import { signature, validSignature } from "./media";

// Keep published versions immutable. If a source changes, add a new version and
// retain the previous mapping for audit history instead of overwriting its object.
export const TEMPLATES = [
  {
    id: "living-room",
    version: 1,
    name: "Living room",
    description: "An indoor double act.",
    duration: 14,
    objectKey: "templates/living-room-14s.mp4",
    etag: "af51e010201fd8a5e5a4e1b3c174e7b3",
  },
  {
    id: "red-fence",
    version: 1,
    name: "Red fence",
    description: "Take the dance outside.",
    duration: 14,
    objectKey: "templates/red-fence-14s.mp4",
    etag: "58925c24c9628718332124c27136c680",
  },
] as const;
export type DanceTemplate = (typeof TEMPLATES)[number];
export type PublicTemplate = Pick<
  DanceTemplate,
  "id" | "version" | "name" | "description" | "duration"
> & {
  available: boolean;
  previewUrl: string | null;
};
export function getTemplate(id: string) {
  return TEMPLATES.find((t) => t.id === id);
}
export function verifiedTemplates(e: Pick<Bindings, "VERIFIED_TEMPLATES">) {
  const ids = (e.VERIFIED_TEMPLATES || "").split(",").map((id) => id.trim());
  return TEMPLATES.filter((t) => ids.includes(t.id));
}
export function publicTemplates(e: Bindings, mock: boolean): PublicTemplate[] {
  const verified = verifiedTemplates(e);
  return TEMPLATES.map(({ id, version, name, description, duration }) => ({
    id,
    version,
    name,
    description,
    duration,
    available: mock || verified.some((t) => t.id === id),
    previewUrl:
      mock || e.REFERENCE_LICENSE_CONFIRMED === "true"
        ? `/api/templates/${id}/preview`
        : null,
  }));
}
function scope(t: DanceTemplate) {
  return `template:${t.id}:${t.version}:${t.etag}`;
}
export async function signedTemplateURL(
  origin: string,
  t: DanceTemplate,
  secret: string,
) {
  const expires = Date.now() + 30 * 60 * 1000;
  const sig = await signature(secret, `${scope(t)}:${expires}`);
  return `${origin}/api/templates/${t.id}/source?version=${t.version}&expires=${expires}&signature=${sig}`;
}
export async function validTemplateSignature(
  secret: string,
  t: DanceTemplate,
  url: URL,
) {
  return (
    url.searchParams.get("version") === String(t.version) &&
    validSignature(
      secret,
      scope(t),
      url.searchParams.get("expires") || "",
      url.searchParams.get("signature") || "",
    )
  );
}
