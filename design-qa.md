# Design QA — video studio update, 2026-11-07

final result: passed

## Target and scope

The four competitor screenshots supplied by the user are the target for structure: large headline with live video, paired uploads with a right settings panel, a preview-and-select template dialog, and portrait video cards. This is an adaptation to the existing lime/charcoal brand, two available pet templates and 480p / 768p / 1080p pricing. It does not add unimplemented human mode, 24 trends, or claim competitor footage is our generated output.

The provided references are cropped 2048px-wide screenshots with unknown CSS viewport/DPR. Implementation captures use a 1440 × 1000 CSS viewport, DPR 1. Combined comparison images scale each section proportionally to 1000px width and pad with black; these support structural comparison, not pixel-error claims. Original full-resolution captures were also inspected for readable controls.

## Browser evidence and comparison loop

Local preview: http://127.0.0.1:3000. The built-in browser timed out; the user explicitly approved local Playwright. The existing development server remains running.

- [Hero comparison](docs/screenshots/studio/studio-compare-hero.jpg): large uppercase headline, restrained description and CTA next to actual portrait video; lime emphasis retains the existing brand.
- [Workbench comparison](docs/screenshots/studio/studio-compare-workbench.jpg): two equal large upload cards, separate foreground/background labels, right settings panel, three quality choices and one primary action. Credits and available modes come from current implementation.
- [Dialog before](docs/screenshots/studio/studio-compare-dialog.jpg): P2 found — the portrait preview was too narrow and its sound label wrapped.
- Fix: give the dialog preview a full-width 4:3 stage with `object-fit: contain`, keep the portrait video intact and controls on one line.
- [Dialog after](docs/screenshots/studio/studio-compare-dialog-final.jpg): re-captured and jointly inspected against the same reference. Preview controls fit, selection and apply button are clear. P2 resolved.
- [Showcase comparison](docs/screenshots/studio/studio-compare-showcase.jpg): two actual source-template videos with controls and honest labels, rather than four fabricated generated examples.
- [Mobile workbench](docs/screenshots/studio/studio-mobile.png), [mobile dialog](docs/screenshots/studio/studio-dialog-390.png), [login](docs/screenshots/studio/studio-login.png): 390px layout inspected; controls and text remain readable. Additional 768px viewport checked with no horizontal overflow.

## Functional verification

- All source previews loaded with duration 14 seconds. Play/pause and sound toggles work; enabling one preview mutes the previous preview.
- Escape closes the dialog and returns focus to its trigger; body scrolling is restored. Candidate selection applies correctly. Mobile and tablet dialog content has no horizontal overflow.
- Mock flow: choose Red fence and 768p, select two sample photos, sign in with a test account, restore photos/template/quality, simulate Standard checkout, submit a 200-credit task, finish with 100 credits available and zero reserved, download the 8470-byte test MP4.
- No page script errors in screenshot, interaction or full-flow sessions.
- Missing Google configuration disables the real sign-in button with an accurate message. Cancellation query shows a retry message. Real Google account authorization is still pending user-created credentials and domain setup.

## Limits and remaining findings

No actionable P0/P1/P2 findings remain in the authorized local UI scope. System fonts and existing lime palette intentionally differ from the competitor. Only two source templates are available; reviewed generated examples have not been produced. Public previews remain license-gated; local screenshots use the uploaded source videos copied into local R2. Mock results are explicitly test clips, not evidence of H3 quality. Real OAuth, payment and model output have not been certified by these UI checks.
