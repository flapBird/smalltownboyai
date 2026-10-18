# Design QA — selected dark version 2

final result: passed

## Source and evidence

- Exact source: `/Users/admin/.codex/generated_images/01a14430-f84e-7f43-85c3-578e00475437/exec-6179af77-0434-4046-b43f-330ebc618c0b.png`; repository copy: `docs/screenshots/selected-design.png`.
- Source image: 1003 × 1568 px. Implementation CSS viewport: 1003 × 1568, DPR 1. IAB full-page capture exposes 988 px of content (15 px scrollbar excluded); first 1568 px saved as `docs/screenshots/desktop.png`. No image stretching or device frame. The initial viewport-only capture was clipped by the host window, so full-page capture was used instead.
- State: homepage, dark theme, two chosen cat images, 480p selected, no active result. Final comparison uses signed-out state like the source. The implementation explicitly labels local Mock mode; source controls are static placeholders, so disabled/available controls and balance wording are intentionally different.
- Full-view side-by-side evidence: `docs/screenshots/comparison-before.jpg`, `docs/screenshots/comparison-after.jpg`. Each contains the source and live screenshot in one image.
- Readable focused form comparison: `docs/screenshots/form-comparison.jpg` (unscaled crops).
- Mobile: CSS viewport 390 × 844, DPR 1; captured content width 375. `docs/screenshots/mobile.png`, `mobile-full.png`, `mobile-faq.png`.
- History evidence: `docs/screenshots/dashboard.png`.

## Comparison history

1. **P1 fixed — first-screen composition sat too low.** Initial header was 82 px and the added eyebrow plus hero spacing moved the form to roughly y=393, versus roughly y=292 in the target. Reduced desktop header to 56 px, removed the extra eyebrow from display, compacted hero padding and increased the heading to the reference's large two-line scale. After image shows the compact header, large title and aligned two-column form/preview.
2. **P2 fixed — left/right visual weighting.** Initial form and preview were too close in width. Changed desktop grid to 1.4:1 at the comparison width, kept narrow gutter, preserved portrait cards and full-width lime action. Focus comparison verifies readable labels, crop integrity, borders and button hierarchy.
3. **P2 fixed — mobile resolution choices wrapped awkwardly.** 1080p originally occupied a second row. Mobile settings now use one full-width resolution row with 44 px minimum targets and a two-column credit area below; consent text increased to 12 px. Recaptured mobile image shows all three choices and no clipped controls. Mobile menu opens, navigates and closes; FAQ expands correctly.

## Fidelity surfaces

- Typography: bold neutral sans, large two-line hero, restrained tracking, small supporting labels. No missing glyphs; exact mock font was not supplied, so system Arial/Helvetica is used.
- Spacing/layout: compact top navigation and hero, broad left generator, narrow vertical preview, paired portraits. Mobile stacks generator before preview. Core reading order and action hierarchy match.
- Colors: near-black charcoal background, subdued gray borders and copy, lime primary button/selected control, warm amber imagery. No unintended light surfaces.
- Imagery: individual generated raster assets in the selected visual direction; portraits remain recognizable without stretch. Preview illustration retains both cats. No fake playback controls on a still image.
- Copy/content: proper product/domain/email; clear illustrative and Mock labels; actual server prices and credits. Additional examples/how/features/FAQ/legal sections implement the written scope beyond the short selected mock. Consent and availability states add necessary form height. “Sign in to create” is truthful in the signed-out state.

## Interaction evidence

Browser verified sample selection, draft restoration after login, zero-credit test user, Lite test checkout, 100 credits granted, image upload, task submission, completion, synchronized zero remaining balance, player/download, dashboard history, sign out, mobile menu and FAQ. Downloaded MP4 independently inspected as H.264 480 × 854, 3 seconds.

Browser logs contained no application errors during this fresh session. A Next smooth-scroll warning was addressed by adding `data-scroll-behavior="smooth"` to the root HTML element. Final reload was checked separately. Test mode is local only; no real provider capability is inferred from these interactions.

## Remaining P3 / limits

Source imagery and fonts are recreated rather than pixel-identical. Pricing appears after requested explanatory sections, rather than immediately after the generator as in the shorter mock. No real public video, external OAuth, paid checkout or live AI output was available for visual testing. None is represented as verified production functionality.

No remaining actionable P0/P1/P2 visual findings within the authorized local MVP scope.
