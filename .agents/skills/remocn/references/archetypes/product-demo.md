# product-demo

**Family:** A. Product & Launch · **Default duration:** ~45s standard (1356f @30fps) · **Format:** 16:9

The flagship archetype, fully worked. A product demo tells one story: *"X has problem Y; here's the
product solving it; here's proof; here's how to get it."* Built as a raw `<TransitionSeries>` stitching
catalog components, one beat per sequence. Grounded in real demos (CrowdReply, Flowith, HeyGen, monid).
Read `../anatomy.md` first.

## Step 1 — gather content (infer → ask → placeholder)

Fill this contract. **Infer** from the repo first (`README`, landing copy, `package.json`), then **ask**
the user only for what's missing, then fall back to honest English placeholders. Never block on missing data.

| Field | Required | Notes |
|---|---|---|
| `product.name` | yes | wordmark for positioning + outro |
| `product.oneLiner` | yes | the positioning line ("AI-Powered Work Operating System") |
| `hook` | yes | the problem/bold line ("Your team has tasks everywhere"); can derive from oneLiner |
| `features[]` | yes (2–4) | `{ title, sub }` each — one concrete capability per item |
| `productSurface` | no | which UI to show: `chat` \| `terminal` \| `dashboard` \| `planning` \| free description → fallback `terminal-simulator` or a new `ui-frame` |
| `proof` | no | `{ metric: {label, value} }` and/or `{ testimonials: {quote,name,role}[] }` and/or `{ integration }` |
| `cta` | no | `{ line, domain }` or `{ line, command }` |
| `brand` | no | `{ accentColor, vibe }` → default neutral + one accent; pick `vibe` to match (`tech`/`premium`/`clean`/`data`/`social`) |

## Step 2 — pick the duration variant

| Variant | Length | Frames @30fps | Beats | Reference |
|---|---|---|---|---|
| **Short** | ~18s | ~540 | Hook → Product reveal → Positioning/CTA | monid (good, 18s) |
| **Standard** | ~45s | ~1356 | all 6 | CrowdReply / Flowith / HeyGen (good, 42–45s) |
| **Long** | 90s+ | — | many features | only with a strong repeating rhythm (Q&A cadence); else split into several videos. A flat 100s feature-list drags — that is the slop trap. |
| **Bumper** | ~4–5s | ~135 | Positioning → lockup only | a logo sting; see `logo-bumper.md`. Not a full demo — a brand insert. |

## Step 3 — map beats to component slots

Pick one slot per beat from these candidates (full props at `https://remocn.dev/docs/<section>/<name>.md`, linked from the index):

| Beat | Slot candidates | Notes |
|---|---|---|
| **Hook** | `kinetic-center-build`, `blur-out-up`, `per-word-crossfade`, `tracking-in`, `staggered-fade-up` over a slow muted shader (`shader-mesh-gradient` / `shader-warp`) or solid | emphasize ONE word with the accent, sentence case |
| **Positioning** | `per-character-rise` / `focus-blur-resolve` / `kinetic-center-build` for the line and wordmark; `logo-enter` for a brand/partner logo cluster (not a single lockup) | resolve text into the brand mark; a single styled lockup may be a small new component |
| **Product reveal** | `terminal-simulator`, `glass-code-block`; AI surfaces `chat-gpt`/`claude-chat`/`claude-code`/`v0`/`opencode`; add `cursor` / `simulated-cursor` | if the catalog lacks the exact surface, build a new lightweight `ui-frame` (see `../anatomy.md` §1) |
| **Features** | `check-list` (checklist), `animated-bar-chart` / `animated-line-chart`, `per-word-crossfade` for a "designed to ___" swap, `marker-highlight` / `inline-highlight` for emphasis | one concrete moment per feature, 2–4 total |
| **Proof** | `rolling-number` / `number-wheel` / `slot-machine-roll` for a score; `animated-bar-chart`; `github-stars` / `x-followers-overview` for social counts; a testimonial card (compose or build new) | land one number with the accent |
| **CTA** | `per-word-crossfade` / `kinetic-center-build` closer, `terminal-simulator` for a run-this command, `spring-scale-in` for a pill, `logo-enter`, `confetti` (one accent pop) | one ask + where to go |
| **Transitions** | `push-through` (going deeper), `focus-pull` (refined shift), `whip-pan` (energy), or plain `fade()` from `@remotion/transitions/fade` (neutral cut) | pass to `TransitionSeries.Transition` as `presentation`; text-swap components (`fade-through`, `shared-axis-*`) mount inside a scene instead |

Budget each `<TransitionSeries.Sequence durationInFrames>` around the component's natural length
(`Length` in `https://remocn.dev/llms-components.txt`). Standard ~45s split: Hook 165 · Positioning 120 · Product reveal
150 · Features 450 (across 2–4) · Proof 300 · CTA 171.

## Step 4 — assemble (raw `<TransitionSeries>`)

Standard variant skeleton. Swap the slot components and content for the gathered contract. Install each
picked component first (`shadcn add @remocn/<name>`); deps auto-install.

```tsx
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { KineticCenterBuild } from "@/components/remocn/kinetic-center-build";
import { PerCharacterRise } from "@/components/remocn/per-character-rise";
import { CheckList } from "@/components/remocn/check-list";
import { RollingNumber } from "@/components/remocn/rolling-number";

const ACCENT = "#F2D200";

export const ProductDemo = () => (
  <AbsoluteFill style={{ background: "#FAF8EC" }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={165}>
        <KineticCenterBuild text="Your team has tasks everywhere" accent={ACCENT} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={springTiming({ durationInFrames: 18 })} />

      <TransitionSeries.Sequence durationInFrames={120}>
        <PerCharacterRise text="AI-Powered Work Operating System" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={springTiming({ durationInFrames: 18 })} />

      <TransitionSeries.Sequence durationInFrames={150}>
        <KineticCenterBuild text="Flowith" accent={ACCENT} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={springTiming({ durationInFrames: 18 })} />

      <TransitionSeries.Sequence durationInFrames={450}>
        <CheckList items={["AI Workflow Setup", "Product Metrics Audit", "Content Calendar Prep"]} width={900} tickColor={ACCENT} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={springTiming({ durationInFrames: 18 })} />

      <TransitionSeries.Sequence durationInFrames={300}>
        <RollingNumber from={0} to={12000} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={springTiming({ durationInFrames: 18 })} />

      <TransitionSeries.Sequence durationInFrames={171}>
        <KineticCenterBuild text="Flowith" accent={ACCENT} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
```

Background stays on the outer `AbsoluteFill` (one accent on a neutral canvas); components render
transparent. For a moving background, layer a slow, muted shader backdrop (e.g. `ShaderMeshGradient`
at low `speed`) behind the series instead of the solid fill — keep it muted so it
never fights the foreground. The product-reveal beat above is folded into the features checklist for
brevity — for a richer surface, add a `terminal-simulator` / chat sim / new `ui-frame` sequence
before the features beat.

## Step 5 — check against the bar

Before delivering, run the good/slop checklist in `../anatomy.md` §3: one accent, sentence-case kinetic
type, real content (no `Scene A` lorem), no glow halos, no feature-list enumeration,
legible text, story not catalog. Budget frames so nothing clips and there's no dead air.
