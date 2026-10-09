---
name: remocn
description: Build Remotion videos with remocn — copy-paste animation components and timeline-driven UI primitives from a shadcn registry. Use when composing a video or scene in a Remotion project, adding a single animation, transition, background, or UI-block sim, or reaching for a video-ready UI primitive (button, dialog, command menu). Activate for polished Remotion video work even when remocn isn't named.
---

# remocn

Copy-paste components for Remotion videos. Components install via `shadcn` and land in
`components/remocn/` — you own the code.

## The catalog lives at remocn.dev

This skill does not carry a copy of the component catalog. There are ~240 components and they
change; a bundled copy goes stale silently. Read the live docs instead.

**Start every component search here:**

```
https://remocn.dev/llms-components.txt
```

One table per category, every installable component, each row carrying `Use for` / `Avoid for`,
natural length, vibe, tier, dependencies, and a link to its full page. Scan it, shortlist, then
fetch only the pages you shortlisted.

**One component's full reference** — props with descriptions, worked examples, all use / don't-use
notes — is the docs URL with `.md` appended:

```
https://remocn.dev/docs/typography/blur-out-up.md
https://remocn.dev/docs/transitions/whip-pan.md
https://remocn.dev/docs/ui/components/dialog.md
```

The index gives you the exact URL per component — don't guess the section from the name, several
components live somewhere non-obvious.

Fetch with whatever your environment provides (a web-fetch tool, `curl`, `WebFetch`). If the
network is unavailable, say so and stop — do not invent props, defaults, or durations from memory,
and do not substitute a component you have not read. A wrong prop name fails at build; an invented
duration silently clips the animation.

## Installation

Prerequisites: a Remotion project (`npx create-video@latest`).

```bash
shadcn add @remocn/blur-out-up
```

`@remocn/<name>` is the canonical namespaced form (configured under `registries` in
`components.json`). The plain registry URL `https://remocn.dev/r/<name>.json` also works.

### Dependencies install automatically

Many components pull others via `registryDependencies` — `shadcn` installs them transitively.
For example, `shadcn add @remocn/typewriter` also pulls `@remocn/remocn-ui` and `@remocn/caret`.

- **`@remocn/remocn-ui`** is the shared core lib (timeline-fold hook, theme context, color math).
  Most UI Primitives depend on it. You rarely install it directly.

## Two tiers

remocn has two kinds of components — they have **different APIs**:

- **Animation tier** (`remocn`) — text animations, transitions, backgrounds, UI-block sims,
  brand/social cards, full compositions. Frame-driven. Shared props: `speed` (time multiplier),
  and for text: `fontSize`, `color`, `fontWeight`.
- **UI Primitives** (`remocn-ui`) — timeline-driven shadcn-style primitives (button, dialog,
  select, command-menu, tooltip…). State-based props (`state`, `style`, `variant`, `theme`).
  **No `speed` prop.** Built on `@remocn/remocn-ui`.

The index's `Tier` column tells you which one you are looking at before you open the page.

## Component patterns

Conventions differ by tier — don't assume animation-tier props on a primitive.

### Animation tier (`remocn`)

- Named `Props` interface per component (e.g. `BlurOutUpProps`).
- `speed?: number` — global time multiplier (default `1`), applied as `frame * speed`.
- Text components: `fontSize`, `color`, `fontWeight`.
- Transitions: lowercase factories (e.g. `whipPan(props)`) returning a `TransitionPresentation` — pass to `TransitionSeries.Transition` via `presentation`, pace with `linearTiming` / `springTiming`.
- `className?: string` on the root.

Not everything filed under transitions is a presentation: `slide-swap` and `spring-settle` are scene
sequencers that take a `scenes` array and own the whole timeline. The page says which one you have.

### UI Primitives (`remocn-ui`)

- State-based, **not** `speed`-based: `state` (e.g. `"open"` / `"closed"`), `style`, `variant`,
  `size`, `theme?: Partial<RemocnTheme>`.
- The opened/closed/active state is a pure function of the timeline (keyframed presets).
- Compose modal-layer primitives (dialog, alert-dialog, drawer) with a trigger element — see
  each component's example.

### Animation API

```tsx
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
const scale = spring({ fps, frame, config: { damping: 12, mass: 1, stiffness: 100 } });

// Deterministic randomness (NEVER Math.random())
import { random } from "@remotion/random";
const jitter = random(`seed-${frame}`);
```

### Composition structure

```tsx
import { Sequence, Series } from "remotion";

<Sequence from={30} durationInFrames={60}>
  <Typewriter text="npm install remocn" />
</Sequence>

<Series>
  <Series.Sequence durationInFrames={60}><SceneA /></Series.Sequence>
  <Series.Sequence durationInFrames={60}><SceneB /></Series.Sequence>
</Series>
```

### Canvas & timing

- **Canvas standard:** `1280×720 @ 30fps`. Components are laid out for it.
- **`Length` is the component's own motion, not the whole beat.** For a transition it is the value
  to pass to `linearTiming` / `springTiming`; for everything else it is the frame the animation
  finishes on. Treat it as the floor for the `Sequence` and add hold time when the element should
  stay on screen after it settles. `state-driven` means the component renders from its `state` prop
  and has no duration of its own.
- **Tone matching:** each entry carries a `vibe` tag (`tech`/`premium`/`data`/`clean`/`playful`/
  `social`/`paper`) — pick components whose vibe fits the brand. `paper` is the stop-motion kit: a
  quantized ~10-poses-per-second clock, handwriting and ink. Those components read as one world, so
  mix them with each other rather than with the smooth tiers.

## Design defaults — avoid AI-slop

Your **own** additions (text, scene chrome, cards — not the prebuilt components) stay restrained:
default tracking, sentence case, solid text color, subtle 1px elevation — no decorative
letter-spacing, ALL-CAPS, gradient text-fills, or glow shadows. Never strip these traits from a
component whose essence *is* the effect (`tracking-in`, social-card gradients, designed elevation).

Full do/avoid examples, design tokens, motion principles and the anti-pattern list live in the
Craft section:

```
https://remocn.dev/docs/craft/design-defaults.md
https://remocn.dev/docs/craft/motion-principles.md
https://remocn.dev/docs/craft/anti-patterns.md
```

## Gotchas (remocn-specific)

- **Terminal scroll is instant** — step-function `translateY`, never spring/ease the scroll.
- **`overflow: hidden` on split layouts** — prevents content breakage during width animations.
- **Cursor blink is deterministic** — `Math.floor(frame / 15) % 2 === 0`, not intervals.
- **Static files go in `public/`** — load via `staticFile('cursor.svg')`, not imports.
- **Social cards render offline** — `avatarUrl=""` / `coverUrl=""` fall back to gradients; no fetch.

General Remotion rules (no `Math.random()`, no `setInterval`, animate `transform` not `top`/`left`,
load fonts before render) live in the `remotion-best-practices` skill.

## Composing a video

Don't dump components — compose one story. When asked to build a full video ("make a product demo",
"changelog video", "intro for my landing"):

1. **Decide the strategy** — ready template vs compose from components vs build a new component. See
   `references/anatomy.md` §1.
2. **Follow the beats** — a product demo is Hook → Positioning → Product reveal → Features → Proof →
   CTA (last two optional). See `references/anatomy.md` §2.
3. **Use the recipe** — `references/archetypes/index.md` routes to per-archetype builds: content contract
   (infer → ask → placeholder), duration variants, beat→component slots, and a worked
   `<TransitionSeries>` skeleton.
4. **Pick each beat's component** from `https://remocn.dev/llms-components.txt`; match the `vibe` tag
   to the brand and budget its `Sequence` per Canvas & timing above.
5. **Check the quality bar** — one accent, sentence-case kinetic type, real content, no glow halos, no
   feature-list enumeration. See `references/anatomy.md` §3.

## Reference

Bundled with this skill — the judgment that does not change per component:

- `references/anatomy.md` — composing a full video: strategy (template/compose/new), the product-demo beats, and the good-vs-slop quality bar.
- `references/archetypes/index.md` — router to per-archetype build recipes (product-demo flagship + changelog, feature-announcement, oss-showcase, cli-tool-demo, testimonial-reel, year-in-review, pricing-reveal, logo-bumper): content contract, duration variants, beat→slot map.

Fetched from remocn.dev — everything that tracks the components:

- `https://remocn.dev/llms-components.txt` — the component index. Always start here.
- `https://remocn.dev/docs/<section>/<name>.md` — one component's full reference.
- `https://remocn.dev/docs/craft/design-defaults.md` — anti-slop defaults and design tokens.
- `https://remocn.dev/docs/craft/motion-principles.md` — motion principles adapted to remocn.
- `https://remocn.dev/docs/craft/anti-patterns.md` — common generation mistakes and their fixes.
- `https://remocn.dev/llms.txt` — index of the whole documentation, if you need something else.
