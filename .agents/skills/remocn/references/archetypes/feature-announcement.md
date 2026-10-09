# feature-announcement

**Family:** A. Product & Launch · **Default duration:** ~12s (360f @30fps) · **Format:** 16:9 · **Vibe:** premium

A single-feature reveal: a quiet kicker sets expectation, the feature name arrives at full scale, then one benefit line lands with an accent highlight on the key word. Three beats, one idea — this is "Introducing X" for a tweet or changelog banner, not a feature list.
Read `../anatomy.md` first; pick components from `https://remocn.dev/llms-components.txt`.

## Beats

Fixed three-beat structure; runtime is 360f.

| Frames | Beat | What happens |
|---|---|---|
| 0–90 | **Kicker** | Small "Introducing" label slides down and holds; `tracking-in` keeps letterforms tight; no motion after entrance |
| 90–240 | **Feature name** | The feature name bursts in per-character from below; a scale pulse (1.0→1.04→1.0) lands as the last character settles |
| 240–360 | **Payoff** | A single benefit line builds line by line; one key word receives a growing accent bar via `inline-highlight`; the whole scene exits via `scale-down-fade` |

Transitions: kicker→name `fade()` from `@remotion/transitions/fade` (linear, 12f); name→payoff `slide({ direction: "from-top" })` from `@remotion/transitions/slide` (spring, ~18f).

## Beat → slots

| Beat | Catalog components | New component needed |
|---|---|---|
| Kicker | `short-slide-down` (label entrance, y −20→0 over 12f), `tracking-in` (letterforms focus in on hold), `shader-grain-gradient` (muted bg during kicker) | **`kicker-eyebrow`** — small superscript label above the feature name; sentence-case, no uppercase; props `text`, `align`, `delayInFrames` (build per `../anatomy.md` §1) |
| Feature name | `per-character-rise` (letters from below, spring damping 12, stagger 4f/char), `spring-scale-in` (scale pulse 1.0→1.04→1.0 on landing) | **`feature-name`** — short-phrase display frame; drives character entrance; props `name`, `entrance`, `emphasis?` |
| Payoff | `line-by-line-slide` (benefit line entrance), `inline-highlight` (accent bar grows over 10f on key word), `scale-down-fade` (full-scene exit) | — |

`feature-name` and `kicker-eyebrow` are absent from the catalog — both recur across announcement archetypes, so build them as lightweight components (anatomy §1, "build new"), not one-offs.

## Content contract (infer → ask → placeholder)

| Field | Required | Notes |
|---|---|---|
| `featureName` | yes | 1–3 words ("Smart Replies", "Instant Export", "Live Sync") — infer from PR title or release notes |
| `benefitLine` | yes | One plain-language sentence of value, e.g. "Draft ready before you hit send" — ask if not supplied |
| `highlightWord` | yes | The one word in `benefitLine` that carries the payoff; drives `inline-highlight` |
| `kickerLabel` | no | Default `"Introducing"`; override for re-runs ("Now in beta", "Coming to all plans") |
| `brand` | no | `{ accent, background }` — one accent on neutral |

## Notes

- **One feature only.** This archetype spotlights a single capability. For multiple features use changelog or a repeating per-feature series; enumeration is the primary slop failure mode here.
- **Background: a slow muted shader.** A slow, muted shader backdrop (`shader-warp`, `shader-mesh-gradient`) at low `speed` gives the scene ambient motion. Keep it restrained and muted so it never fights the type — still no glow blobs or radial halos behind text.
- **Accent on one word.** The `inline-highlight` on `highlightWord` is the sole accent touch; kicker and feature name stay in the neutral theme color.
- **Keep the feature name short.** `per-character-rise` at 4f stagger over more than ~12 characters runs long and loses energy. Names over three words should be shortened or split to two display lines.
- **All copy in English.** `benefitLine` and `kickerLabel` must be real English content, never lorem; `highlightWord` must be a genuine content word that repays the accent.
