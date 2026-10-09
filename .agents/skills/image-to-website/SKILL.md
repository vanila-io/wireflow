---
name: image-to-website
description: Recreate a website/app/design from an image, screenshot, or video as working code with pixel fidelity. Use when the user shares a screenshot/mockup/photo of a UI and asks to rebuild, clone, or recreate it as a site or app, or provides a video of a UI to reproduce with motion. Covers the structured token-sheet handoff (ratios not pixels), media detection (3D/video/charts), and the 8-point visual inspection pass.
---

# Image to Website — pixel-faithful UI recreation

Turn a screenshot, mockup, or video into working code that matches the source. The failure mode this skill exists to prevent: vision models fill missing details with training defaults (Inter, blue-500, 8px grid, rounded-2xl) and every recreation drifts into generic AI slop. The fix is never more process — it's forcing one structured handoff between perception and code, plus a named verification pass after.

## When to use
- User shares a screenshot/mockup/photo of an app or website and wants it recreated as code
- User shares a video of a UI and wants it rebuilt, including motion
- User says "recreate this design", "build this from the image", "clone this landing page"

## Core rules (non-negotiable)
1. FIDELITY OVER TASTE. The source is the single source of truth. Never improve, modernize, or restyle. If the original is ugly, dated, dense, or weird — reproduce that.
2. Ratios, not pixels. Vision models are good at relative perception ("2x the gap"), bad at absolute values (24px, #f3f4f6). Asking for pixels forces hallucination.
3. "Unsure" beats a default. Any value the model can't read must be marked, never guessed from a UI kit.
4. The image does not show hover, responsive, or animation — unless it's a video. Add only minimal standard states derived from extracted colors/type.
5. Inspect with named checks, not "review your work". Vague self-review gets skipped; a numbered checklist with verdicts doesn't.

## Procedure

### Step 1 — Classify the source
- STATIC UI (screenshot/mockup): proceed to Step 2.
- UI WITH EMBEDDED MEDIA (3D scene, video, canvas, map, chart, animation inside a flat page): identify each, name the technique (three.js/WebGL, canvas, <video>, chart lib, CSS animation). Never fake with a static div. One frame can't show motion → describe the frame, mark motion as INFERRED.
- VIDEO SOURCE: frames are states of one system. Static pass (layout + tokens from one clear frame), then a MOTION pass: what changes over time — transitions, reveals, parallax, element motion, timing (snap vs eased). Rebuild states AND the motion between them.

### Step 2 — Fill the token sheet BEFORE any code
Every value from the source, not from defaults. "Unsure" where unreadable.

- TEXT: transcribe ALL visible text exactly — labels, numbers, prices, microcopy. No paraphrasing. Unreadable → "[unreadable: best guess: ...]", never clean invented copy.
- COLORS: each distinct color as hex estimate + the element it appears on. Include backgrounds, borders, text at each level. Check CONTRAST as it actually is — transcribe low-contrast text as-is, don't normalize it to readable gray.
- TYPE: per text level — size relative to body text, weight, family guess. If unsure of the font, describe letterforms (stroke terminals, single-story g, x-height), don't name-drop.
- SPACING: gaps and padding as RATIOS to a reference element ("card padding ≈ 2x the gap between cards").
- LAYOUT: regions top to bottom / left to right, alignment, how elements in a row relate (space-between / centered / fixed gap).
- ELEMENTS: COUNT every repeated component (nav items, cards, rows). Do not drop any.
- MEDIA INVENTORY: every non-flat element (images, icons, 3D, video, charts, gradients, shadows) and the technique each needs.

### Step 3 — Build
Code uses ONLY values from the sheet. Any value not in the sheet must not appear in the code. Tokens as named CSS variables / theme tokens, not magic values scattered. Follow the target project's stack and conventions (skill index, template, existing globals).

### Step 4 — Visual inspection (mandatory, 8 named checks)
Region by region against the source, verdict per check ("OK" or the specific fix), apply every fix:
1. POSITION — right region, right order, right alignment
2. SIZE & SPACING — proportions match the extracted ratios
3. COLOR — every color matches, including backgrounds, borders, subtle differences between similar surfaces
4. TYPE — size, weight, casing of every text level
5. TEXT — every string present and identical, nothing dropped or rewritten
6. COUNT — no repeated element missing, none added
7. CONTRAST & DEPTH — shadows, borders, layering read the same
8. MEDIA — embedded 3D/video/chart/animation actually implemented, not a placeholder

Then list what could not be verified.

### Step 5 — Second-pass comparison (when the tool supports iteration)
Follow up: "Compare your output to the original image side by side, list every visual difference, fix them." This closes most of what remains and is worth more than any wording tweak in the generation prompt.

## Practical requirements
- Send the biggest, sharpest image available. For dense UIs, send 2-3 zoomed region crops alongside the full screenshot — small text and 1px borders die at low resolution. No prompt fixes a low-res source.
- If recreating inside a sandbox project: classify source first, write the inspection report as prose, commit at the milestone (scaffold + first renderable page early, then coherent feature sets).
- Do not invent interactions that aren't in the source; do not add libraries the design doesn't imply (a chart region needs a chart lib; a flat page does not need three.js).

## Failure points
- Low-res source: small text/thin borders unrecoverable — fix upstream with bigger or cropped images.
- Skipped sheet when the prompt is too long — keep the sheet compact; brevity is why it gets followed.
- Motion invented from one frame — always mark INFERRED rather than fabricating timing.
