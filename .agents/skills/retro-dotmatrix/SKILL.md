---
name: retro-dotmatrix
description: Build websites, dashboards, and apps in the retro skeuomorphic dot-matrix style (dark two-tone scene, brushed-silver panels, Doto font, speaker-grille textures, orange accent). Use when the user says "retro", "dot matrix", "skeuomorphic", "hardware/device aesthetic", "like a player/recorder/gadget", or shows a reference image of a physical device — for new sites, landing pages, dashboards, or restyling existing ones.
---

# retro-dotmatrix — Retro Skeuomorphic Dot-Matrix Design System

Build entire websites, dashboards, and apps in the retro-futuristic hardware-device style: dark two-tone scenes, brushed-silver panels, dot-matrix type, speaker-grille textures, and a single hot orange accent. Everything here was built and screenshot-verified on a live Next.js 16 + Tailwind v4 app, so the values are exact — copy them, don't reinvent them.

## 1. When to reach for this style

Product/marketing sites, dashboards, and app UIs that should feel like a physical instrument: audio gear, lab equipment, terminals, control panels. Signs it fits: the user says "retro", "dot matrix", "skeuomorphic", "like a device/player/recorder", "hardware aesthetic", or shows a reference image of a gadget.

## 2. Core palette (exact values)

Use these; do not drift. One accent only.

| Role | Value |
|---|---|
| Wall dark A (main bg) | `#1e2023` |
| Wall dark B (deeper shadow bg) | `#17181b` |
| Screen black | `#0a0a0c` (screen gradient: `radial-gradient(120% 90% at 50% 20%, #131316 0%, #0a0a0c 55%, #060607 100%)`) |
| Panel light (scene accent panel) | `#b9c0c6` |
| Body silver gradient | `linear-gradient(160deg, #f2f1ec 0%, #e4e2dc 40%, #d3d1ca 100%)` |
| Inset area / key well | `#dedcd5` |
| Pill / tab background | `#c6c8c4`–`#c9c7c0` |
| Accent orange (the ONLY saturated color) | `#f4581c` (highlight `#ff8a4d`, deep `#d13f0e`) |
| Screen text | `#d3d6d3` with glow `0 0 6px rgba(207,210,207,0.35)` |
| Label grey (on silver) | `#8b8d85` |
| Dark label / gear chip | bg `#55574e`, text `#d9d7d0` |
| Status dots | rec `#f4581c`, active `#8fd18f`, idle `#5a5c55` |

Rule: orange appears ONLY as the attention state (record, live, active, alert). Everything else is grayscale silver-on-dark. This restraint is what makes the style.

## 3. Typography — dot-matrix font

- Font: **Doto** (Google Font) via `next/font/google`, weights 400–900, CSS var `--font-doto`.
- Utility: `.font-doto { font-family: var(--font-doto), monospace; }`
- Doto IS the identity of the style. Use it for EVERYTHING on screen text, labels, numbers, headings. No second font is needed; if a body-text fallback is required for long reading, use a plain sans but keep all chrome/labels/headings in Doto.
- Labels: `letter-spacing: 0.25–0.35em`, weight 600, size tiny relative to container. Trailing `paddingLeft: 0.35em` so tracking doesn't off-center the label.
- Screen text: weight 600, `letter-spacing: 0.05em`, `lineHeight: 1.4`, with the soft glow above.

## 4. Signature textures (CSS recipes)

### 4a. Speaker-grille dot texture (any panel background)
```css
.grille {
  background-image: radial-gradient(circle, #3a3c34 1.3px, rgba(0,0,0,0) 1.6px);
  background-size: 9px 9px;
  background-position: center;
}
```
On a `#dedcd5` inset with `box-shadow: inset 0 1px 3px rgba(0,0,0,0.18)`. Tune dot size/spacing up for large hero panels (e.g. 2px/12px).

### 4b. Scratched glass (over dark screens)
```css
.scratches {
  background-image:
    repeating-linear-gradient(112deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 14px),
    repeating-linear-gradient(68deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 22px);
}
```

### 4c. Glass reflection sheen
`linear-gradient(115deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 30%, transparent 50%)` as a `pointer-events-none absolute inset-0` overlay on the screen.

### 4d. Silver body (skeuomorphic card/panel)
```css
background: linear-gradient(160deg, #f2f1ec 0%, #e4e2dc 40%, #d3d1ca 100%);
box-shadow:
  0 40px 80px rgba(0,0,0,0.65),   /* scene drop */
  0 8px 24px rgba(0,0,0,0.5),
  inset 0 2px 3px rgba(255,255,255,0.9),   /* top bevel light */
  inset 0 -3px 6px rgba(0,0,0,0.12);       /* bottom bevel shade */
```
Plus a hairline ring: an absolute overlay with `inset 0 0 0 1px rgba(0,0,0,0.18)`, border-radius inherited.

### 4e. Raised round key (any button)
```css
background: linear-gradient(160deg, #efede8 0%, #e6e4de 50%, #d8d6cf 100%);
box-shadow:
  0 6px 12px rgba(0,0,0,0.28), 0 2px 4px rgba(0,0,0,0.2),
  inset 0 2px 2px rgba(255,255,255,0.95), inset 0 -3px 5px rgba(0,0,0,0.1);
/* press: */ transform: scale(0.95); /* transition 100ms */
```

### 4f. Screen bezel (dark screen inside a light panel)
Bezel: `linear-gradient(180deg, #2a2b2d, #161719)`, padding ~1.9% of panel width, `box-shadow: inset 0 2px 6px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.7)`.

### 4g. Orange under-glow (scene lighting)
```css
background: radial-gradient(55% 60% at 50% 100%, rgba(244,88,28,0.4), transparent 65%);
```
Radial, never a hard-edged line — a linear gradient stop that ends abruptly reads as a glitch.

## 5. Scene composition (full-viewport layouts)

- Background split: dark wall left ~70%, light panel right ~30% (a full-height `#b9c0c6` block with a subtle left-edge shadow), dark floor strip at the bottom (~18vh) in `#141518`.
- Subject sits on the floor line, `items-end`, `paddingBottom: ~15vh`.
- Vignette over everything: `radial-gradient(120% 100% at 50% 30%, transparent 55%, rgba(0,0,0,0.5) 100%)`.
- Orange glow at the wall/floor junction behind the subject.
- For dashboards/sites, the "device" becomes the main card/panel: dark scene behind, one or a few silver panels carrying the content. Never put content directly on the dark background — it always lives in a silver panel or a dark "screen" inset.

## 6. Scaling technique — one variable drives everything

Define `--dw` on the top-level container and size EVERY internal value off it:
```tsx
style={{ ["--dw" as string]: "min(88vw, 40vh)" }}
width: "var(--dw)"
borderRadius: "calc(var(--dw) * 0.095)"
fontSize: "calc(var(--dw) * 0.056)"
```
Rule of thumb for the coefficient: radius 0.095, screen aspect ~13/16, screen text 0.056, labels 0.023–0.026, button column height 0.29, inner key 0.16, key glyph 0.032. This makes the whole design scale perfectly from mobile (88vw) to desktop (capped by vh) with zero breakpoints. Cap on desktop ≈ 40vh so the scene keeps its dark breathing room; on mobile let it fill 88vw.

## 7. Screen content pattern (the "display" area)

Structure a dark screen top-to-bottom, all in Doto:
1. Title tab: light `#c6c8c4` chip, dark text `#23241f`, tiny, centered, `borderRadius` small, inset highlight.
2. Text block: dot-matrix glow text, 4–5 short lines max, uppercase voice.
3. (Optional) Visualizer — see §8.
4. Status row pinned at bottom: left a status dot + label ("Mic capture" / "● REC capture"), right a value ("WAV"). Dot sizes ~0.012 of --dw; rec dot gets `box-shadow: 0 0 6px rgba(244,88,28,0.8)` and blinks.

Screen voice: short, sentence-cased-but-displayed-uppercase lines, friendly-machine tone ("WELCOME, I PROMISE I'M USUALLY FRIENDLIER :)").

## 8. Dot-matrix canvas visualizer (charts, audio levels, live data)

For any live/analog data (audio, metrics, activity), draw a dot-grid on `<canvas>` instead of bars — it's the style's signature chart:
- Grid: column step 9px, dot radius 1.7px (lit) / 0.95 (unlit). Lit color `rgba(215,218,215,0.95)`, unlit `rgba(215,218,215,0.08)`.
- Bottom-aligned columns (dots fill from the bottom up), height = value × rows.
- Motion: per-column layered sines, `target = intensity * (0.18 + 0.82 * |sin(t*(0.5 + (c%7)*0.11) + c*0.9) * (0.55 + 0.45*sin(t*1.9 + c*0.4))|)`, then `lv[c] += (target - lv[c]) * 0.25` each frame for smooth easing.
- Scale with devicePixelRatio (cap 2), observe resize with ResizeObserver, `requestAnimationFrame` loop, cancel on unmount.
- Intensity by state: idle/paused 0.1–0.3 (barely alive dots), active 0.75, alert/rec 1.0.
- For dashboards: use this for the hero "live" chart; use plain numbers in Doto for secondary stats. Bars/lines from chart libs will look wrong here — keep charts dot-matrix.

## 9. Controls & chrome vocabulary

- Transport-style buttons: 3-across grid of square-ish wells (`#dedcd5`) with hairline separators (`1px #b9b7b0`, inset from edges), each holding a raised round key (§4e) with a minimal glyph (triangles, pause bars, orange dot). Icons drawn with CSS borders/spans, not icon fonts.
- Pills: small rounded-full chips (`#c9c7c0`, dark text) for tiny controls/badges — "HQ", ">>".
- Section labels: grey Doto, wide tracking, centered between flanking controls — "DISPLAY", "SPEAKERS", "KEYPAD".
- Dark chip with a symbol (`#55574e` bg) as a settings/menu affordance.
- Status dots: green = active, orange = rec/alert, grey = idle. Blink rec via `@keyframes blink { 0%,49% {opacity:1} 50%,100% {opacity:0} }` at 1s steps(1).

## 10. Motion (restrained, mechanical)

- Typing effect for headline text: reveal characters at ~70ms; after completion hold ~3.2s, then advance to the next message. Cursor: blinking underscore on the last line.
- Blink: steps(1) hard blink, 1s — never fade, it's an LED not a ghost.
- Rec pulse: pulsing `box-shadow` glow on the accent dot, 1.6s ease-in-out infinite.
- Button press: scale 0.95, 100ms. No easing curves longer than 200ms anywhere — this hardware responds instantly.
- Pause everything when "paused": visualizer idles low, typing halts (but never mid-glyph — check `chars` before animating on).

## 11. Adapting to full websites & dashboards

- **Landing pages**: hero = the device/panel on the dark scene (§5). Sections below on `#17181b`; alternate a light `#b9c0c6` section for rhythm. Headings in large Doto with glow on dark screens only (never glow on light backgrounds).
- **Dashboards**: dark canvas bg; one silver "console" card OR dark-screen cards with Doto numbers. Metric tiles = dark screen insets with glowing Doto numerals, label underneath in wide-tracked grey. Live charts = §8 dot-grid canvas. Nav/chrome = silver bars with pill buttons and section labels.
- **Forms**: inputs as dark screen insets (`#0a0a0c`, Doto text, glowing caret); submit = raised key with orange dot accent. Validation states use the status-dot colors.
- **Buttons/actions**: one primary action per view gets the orange accent (record-style); everything else stays silver.
- **Do**: uppercase + wide tracking for all labels; generous dark space; content inside panels; hairline 1px separators; monochrome + single accent.
- **Don't**: no second saturated color, no rounded-friendly SaaS look (radius stays small/structural: 0.055–0.095 of panel width), no drop shadows on text, no gradients on the dark bg, no light-on-light or dark-on-dark text, never place glowing text on silver, never use emoji where a CSS glyph will do.

## 12. Gotchas learned the hard way

- `--dw` via inline style in TSX: cast `["--dw" as string]: ...` and cast the whole object `as React.CSSProperties`.
- Turndown from CSS vars to vw-only breakpoints breaks proportions — resist media queries; one `min()` on `--dw` is the whole responsive story.
- Hard-edged linear glow (a line that stops dead) looks broken — always radial with a transparent falloff (§4g).
- Grille dots too small vanish at typical DPR (0.9px dots are invisible); 1.3px at 9px spacing is the floor for legibility.
- Canvas visualizer: without the ResizeObserver remeasure, a flex-sized canvas draws at 0×0 or stale size.
- In a flex-column screen, the visualizer needs `min-h-0 flex-1`; text rows need `shrink-0` or typing overflows the screen.
