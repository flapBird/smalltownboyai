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
    cents: 1690,
    credits: 200,
    tier: 2,
    resolution: "720p",
    description: "Give your favorite duo their moment.",
  },
  {
    id: "pro",
    name: "Pro",
    cents: 4990,
    credits: 600,
    tier: 3,
    resolution: "1080p",
    description: "More detail. More room to create.",
  },
] as const;
export const SPECS = {
  "480p": { credits: 100, tier: 1, rate: 0.11 },
  "720p": { credits: 200, tier: 2, rate: 0.22 },
  "1080p": { credits: 500, tier: 3, rate: 0.55 },
} as const;
export type Resolution = keyof typeof SPECS;
export const TIER_NAMES = ["Free", "Lite", "Standard", "Pro"];
export const FAQ = [
  [
    "What is Smalltown Boy AI?",
    "A focused pet-video project inspired by the two-character Smalltown Boy dance format. Upload one photo for each character to create an expressive, vertical AI dance clip. The service is currently in preview; paid generation is not available yet.",
  ],
  [
    "How do I make a Smalltown Boy AI video?",
    "Choose two clear pet photos, one per character. Select a supported resolution, sign in with Google and review the credit cost before generating. In this local preview, you can explore the full flow with test credits without paying.",
  ],
  [
    "Can I use my own cat or other pet photos?",
    "Yes. Use JPG, PNG or WebP images you own or have permission to use. Each image must be under 8 MB and between 256 and 4096 pixels per side. This version is for pets and fictional nonhuman characters only.",
  ],
  [
    "How long is the video, and which resolutions are supported?",
    "Our target is a 21-second vertical MP4 in 480p, 720p or 1080p. Final availability depends on a licensed reference clip and real API validation. These specifications are not yet offered as a live service.",
  ],
  [
    "How many credits will a video cost?",
    "Planned costs are 100 credits for 480p, 200 for 720p and 500 for 1080p. Credits do not expire. Resolution access depends on your highest eligible purchase, separately from your current balance.",
  ],
  [
    "How long does generation take?",
    "AI generation is asynchronous. Actual processing times are still being measured; we do not promise a completion time. You can leave the page and check the task in My Videos.",
  ],
  [
    "Can I download the result, and is music included?",
    "Completed videos are intended to be downloadable as private MP4 files. The local preview provides a clearly marked test animation. No commercial soundtrack is included or licensed by this service.",
  ],
  [
    "What happens if generation fails?",
    "A confirmed failed task releases its reserved credits once. A submission with an uncertain provider outcome is held for reconciliation rather than submitted again, preventing duplicate paid calls. Contact support with your task ID if you need help.",
  ],
] as const;
