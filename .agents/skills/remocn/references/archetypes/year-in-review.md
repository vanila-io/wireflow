# year-in-review

**Family:** E. Data & Metrics · **Default duration:** ~20s (600f @30fps, N=4) · **Format:** 16:9 · **Vibe:** data / premium

A mounting sequence of headline numbers — one stat fills the full frame per beat — building urgency as entry stagger compresses, culminating in a RecapWall that shows every figure at once. The rhythm accelerates; the numbers do the talking.
Read `../anatomy.md` first; pick components from `https://remocn.dev/llms-components.txt`.

## Beats

Duration scales with N stats: `total = 90 (intro) + N×120 (stat-beats) − N×15 (overlap) + 90 (recap)`. N=4 → 600f (20s). N=6 → 810f (27s). Cap at N=8 (≈33s); above that, split into two videos.

| Frames (N=4) | Beat | What happens |
|---|---|---|
| 0–90 | **IntroTitle** | year kicker builds glyph-by-glyph via `kinetic-center-build` (per-glyph spring, damping 14, stagger 2f); "Year in review" subtitle enters via `soft-blur-in` (blur 12→0px, 24f); full beat exits via `blur-out-up` |
| 90–210 | **StatBeat #1** | `rolling-number` counts 0→target over 45f ease-out; label enters via `staggered-fade-up` (stagger 24f); number pulses `spring-scale-in` 1.0→1.06→1.0 (damping 8) at roll end; aligned left |
| 210–330 | **StatBeat #2** | same structure, aligned right; label stagger tightens to 16f |
| 330–450 | **StatBeat #3** | aligned left; label stagger 16f; optional `animated-line-chart` trend line below the number |
| 450–570 | **StatBeat #4** | aligned right; label stagger 10f; one `confetti` burst fires at roll end (accent only, finale stat) |
| 570–660 | **RecapWall** | all N stats enter via `staggered-fade-up` (stagger 8f) into a 2×⌈N/2⌉ grid; accent stat pulses `micro-scale-fade`; CTA line enters via `tracking-in` (letter-spacing 0.3em→0) |

Transitions: Intro → Beat #1 `slide({ direction: "from-bottom" })` from `@remotion/transitions/slide` (linearTiming, 18f). Between stat beats `fade()` from `@remotion/transitions/fade` (springTiming, config `{ damping: 200 }`, 15f). Beat #N → RecapWall `push-through` (linearTiming, 20f).

## Beat → slots

| Beat | Catalog components | New component needed |
|---|---|---|
| IntroTitle | `kinetic-center-build` (year glyph), `soft-blur-in` (subtitle), `blur-out-up` (exit), `shader-dot-orbit` (static bg, opacity 0.06) | — |
| StatBeat #1–N | `rolling-number` (plain large integer), `number-wheel` (integer ≤6 digits or countdown), `slot-machine-roll` (prefix/suffix: `$4.2M`, `98.4%`), `staggered-fade-up` (label), `spring-scale-in` (roll-end pulse), `blur-out-up` (exit); optionally `animated-bar-chart` or `animated-line-chart` as a secondary trend lane below the number | **`stat-beat`** — full-frame single-metric scene: large number component + label + optional delta badge; owns `align` prop (`"left"\|"center"\|"right"`); wraps the correct number component based on value shape; transparent bg |
| RecapWall | `staggered-fade-up` (grid entries), `micro-scale-fade` (accent stat pulse), `tracking-in` (CTA), `shader-dot-orbit` (same static bg, continuity) | **`stat-recap`** — 2×⌈N/2⌉ grid of stat cells with staggered entry and optional CTA row; transparent bg |

`stat-beat` and `stat-recap` are not in the catalog — build both as lightweight reusable components (anatomy §1, "build new"). `stat-beat` is the per-beat scene wrapper; `stat-recap` is the closing wall. They pair naturally across release, milestone, and wrap-up archetypes.

## Content contract (infer → ask → placeholder)

| Field | Required | Notes |
|---|---|---|
| `kicker` | yes | year or period string, e.g. `"2025"` |
| `title` | yes | e.g. `"Year in review"` |
| `stats[]` | yes | `{ label: string; value: number; format?: "plain"\|"compact"\|"currency"; prefix?: string; suffix?: string; delta?: { value: number; direction: "up"\|"down" } }` — min 2, max 8 |
| `accentStatIndex` | no | index of the stat that earns the `confetti` burst; defaults to last stat |
| `cta` | no | closing line in RecapWall, e.g. `"See the full report →"` |
| `brand` | no | `{ accent, background }` — one accent on a dark canvas |

`[N]` archetype: each stat occupies exactly one beat and the total runtime grows linearly with N. When N>8, group related metrics into a single `slot-machine-roll` beat or split the video into two parts — never shrink the type to fit more numbers on screen.

## Notes

- **One continuous background across every beat.** A single backdrop — a `shader-dot-orbit` at opacity 0.06, or a slow, muted shader (`shader-mesh-gradient`, `shader-neuro-noise`) at low `speed` — spans every beat including the RecapWall, giving continuity. If it moves, keep it muted and gentle so the stats stay the focus.
- **Alignment alternates left/right.** Left on odd beats, right on even. Compositional variety without introducing a new visual language per beat.
- **Each beat must advance.** Never repeat the same metric. If two stats are closely related (revenue + MRR), pick one or combine into a single `slot-machine-roll` beat.
- **Stagger compresses beat by beat.** 24f label stagger on Beat #1, tightening to 10f by the finale — the cadence accelerates, building urgency without changing any component.
- **One confetti accent.** On the finale stat beat only. Using confetti on every beat drains the payoff; reserve it as a single punctuation mark.
- **Number component selection.** `rolling-number` for plain large integers (1,284,000 requests); `number-wheel` for small integers or countdowns (42 customers, day 365); `slot-machine-roll` for values with a prefix or suffix ($4.2M ARR, 98.4% uptime).
- **Delta badge is optional.** Only show `delta` when a prior-year number is real and meaningful (e.g. +31% YoY). Skip if unavailable — a made-up delta is slop.
- **RecapWall grid sizing.** 2×⌈N/2⌉ grid. For N>6, reduce the per-cell font size proportionally so the wall reads at a glance. Never scroll or clip.
- **Trend charts are supporting, not lead.** An `animated-bar-chart` or `animated-line-chart` can appear below the rolling number on one beat to add context; it should be smaller than the number and not compete with it. Omit if the number speaks for itself.
- Real numbers, English labels. Never ship `Metric #1`, `Value`, or lorem as final copy.
