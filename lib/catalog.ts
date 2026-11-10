export const ACTIVE_TASK_LIMIT = 2;

export const SITE = {
  name: "Smalltown Boy AI",
  origin: "https://smalltownboyai.one",
  support: "support@smalltownboyai.one",
};
export const PACKAGES = [
  {
    id: "lite",
    name: "Lite",
    cents: 890,
    credits: 100,
    tier: 1,
    resolution: "480p",
    description: "For a little main-character energy.",
  },
  {
    id: "standard",
    name: "Standard",
    cents: 1990,
    credits: 300,
    tier: 2,
    resolution: "720p",
    description: "Give your favorite duo their moment.",
  },
  {
    id: "pro",
    name: "Pro",
    cents: 3990,
    credits: 600,
    tier: 3,
    resolution: "1080p",
    description: "More detail. More room to create.",
  },
] as const;
export const SPECS = {
  "480p": { credits: 100, tier: 1, rate: 0.05 },
  "720p": { credits: 200, tier: 2, rate: 0.1 },
  "1080p": { credits: 400, tier: 3, rate: 0.2 },
} as const;
export const RESOLUTIONS = ["480p", "720p", "1080p"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

// Existing settings and unfinished browser requests used 768p for the middle tier.
export function currentResolution(value: string) {
  return value === "768p" ? "720p" : value;
}
export function configuredResolutions(values: string[]) {
  return [...new Set(values.map(currentResolution))].filter(
    (value): value is Resolution => RESOLUTIONS.some((r) => r === value),
  );
}
export const TIER_NAMES = ["Free", "Lite", "Standard", "Pro"];
export const FAQ = [
  [
    "What is Smalltown Boy AI?",
    "A two-photo dance video project inspired by the two-character Smalltown Boy dance format. Upload one photo for each character to create an expressive, vertical AI dance clip.",
  ],
  [
    "How do I make a Smalltown Boy AI video?",
    "Choose a dance template and two clear photos of consenting adults or pets, one per character. Select a supported resolution, sign in with Google and review the credit cost before generating. Select Human duo for people or Pet duo for pets.",
  ],
  [
    "Can I use photos of myself, friends or pets?",
    "Yes. Use JPG or PNG images you own or have permission to use. Each image must be under 8 MB and between 256 and 4096 pixels per side, with at least 78,400 pixels in total. Choose Human duo for two consenting adults (18+), or Pet duo for two pets. Do not use anyone’s photo without their permission.",
  ],
  [
    "How long is the video, and which resolutions are supported?",
    "The generator requests a 14-second vertical MP4 in 480p, 720p or 1080p. The studio shows the templates and resolutions currently enabled for your account.",
  ],
  [
    "How many credits will a video cost?",
    "Generation costs are 100 credits for 480p, 200 for 720p and 400 for 1080p. Credits do not expire. Resolution access depends on your highest eligible purchase, separately from your current balance.",
  ],
  [
    "How long does generation take?",
    "AI generation is asynchronous. Actual processing times are still being measured; we do not promise a completion time. You can have two active videos at once, start another after submission, and check progress in the studio or My Videos.",
  ],
  [
    "Can I download the result, and is music included?",
    "Videos are downloadable after generation and private storage complete as private MP4 files. The local preview provides a clearly marked test animation. Live results preserve the selected template’s cleared audio. The original song is not promised; no separate music rights are granted.",
  ],
  [
    "What happens if generation fails?",
    "A confirmed failed task releases its reserved credits once. A submission with an uncertain provider outcome is held for reconciliation rather than submitted again, preventing duplicate paid calls. Contact support with your task ID if you need help.",
  ],
] as const;
