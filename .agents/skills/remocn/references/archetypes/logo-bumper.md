# logo-bumper

**Family:** H. Brand & Identity · **Default duration:** ~4.5s (135f @30fps, ±15f with wordmark length) · **Format:** 16:9 · **Vibe:** premium

A brand insert: the wordmark assembles, the mark draws or scales in, the lockup holds. Used as a standalone intro sting, a series opener (with corner brackets and a tagline), or a closing brand card. One mark, one accent, total restraint — this archetype is where over-decoration is most tempting and most wrong.
Read `../anatomy.md` first; pick components from `https://remocn.dev/llms-components.txt`.

## Beats

Three-beat structure: wordmark builds progressively, mark enters while the wordmark tail is still settling (overlap keeps energy without rushing), then the full lockup holds static.
Frame math: `60 (wordmark) + 45 (mark, −15 overlap with wordmark) + 45 (hold) = 135f`. Scale the hold window up if the bumper will be reused across many cuts.

| Frames | Beat | What happens |
|---|---|---|
| 0–60f | **Wordmark build** | brand name assembles — word by word or character by character, reads as "O → Open → OpenAI" |
| 45–105f | **Mark reveal** | the brand mark draws, scales, or assembles in, overlapping the wordmark tail; settles at full opacity |
| 90–135f | **Hold** | complete lockup holds static — 30–45f of no motion for clean editor trim |

Transitions: none internal — the bumper is atomic. Connect to surrounding content externally (`push-through` from the host composition).

## Beat → slots

| Beat | Catalog components | New component needed |
|---|---|---|
| Wordmark build | `kinetic-center-build` (word-by-word from center, premium feel), `per-character-rise` (crisp even stagger, clean), `tracking-in` (all letters as one focusing unit, premium) | — |
| Mark reveal | — | **`logo-sting`** — single mark; `logo-enter` is a multi-chip partner cluster and cannot represent one mark |
| Hold + optional exit | `blur-out-up` (graceful exit before the next scene), a muted shader backdrop or solid `backdrop` (static bg) | — |
| Bumper variant: bracket frame + tagline | — | **`bumper-frame`** — corner brackets (strokeDashoffset draw, 4f stagger per corner) + tagline/CTA rows + `mode: 'intro' \| 'outro'` that mirrors choreography |
| Accent pop (launch bumper only) | `confetti` — one burst on a product-launch sting; skip entirely on a standard brand insert | — |

`logo-enter` ([`logo-enter`](https://remocn.dev/docs/social/logo-enter.md)) renders a brand or partner **chip cluster** ("works with Stripe, GitHub, Vercel"). A single product mark always needs the new `logo-sting` component.

The two new components are reusable across the entire H family: `logo-sting` is the atomic mark primitive that H1/H3/H4 all share; `bumper-frame` wraps it for series openers and closers.

## Content contract (infer → ask → placeholder)

| Field | Required | Notes |
|---|---|---|
| `wordmark` | yes | brand name as displayed; infer from `package.json` name or project root |
| `logoSrc` | yes | path to the SVG mark (e.g. `/brand/mark.svg`); `draw` preset requires a `<path>` outline for `strokeDashoffset` |
| `accent` | yes | one color only; every other value stays neutral (white / near-black) |
| `preset` | yes | `'draw' \| 'assemble' \| 'impact'` — controls mark choreography inside `logo-sting` |
| `tagline` | no | bumper variant (intro mode) only; short phrase under the wordmark |
| `cta` | no | bumper variant (outro mode) only; e.g. `"Subscribe · Next episode"` |
| `hold` | no | frames of static finale appended to the sting; default 30 |

## Notes

- **One accent, mono otherwise.** The accent touches the active character or the mark outline only — never the whole wordmark, never the background. Gradient text is slop.
- **No glow halo.** No radial-gradient blobs, no blur clouds behind the mark, no drop-shadow rings. The mark earns attention through motion alone.
- **`logo-enter` is wrong here.** The catalog `logo-enter` renders a multi-chip cluster of brand logos arriving together. A single product mark needs the new `logo-sting`.
- **Background can move — keep it restrained.** A slow, muted shader (`shader-mesh-gradient`, `shader-warp`) at low `speed`, a low-opacity `shader-dot-orbit` (≈0.05), or a solid `backdrop` color. If it moves, keep it muted and gentle so it never competes with the mark reveal.
- **Hold generously.** 30–45f of static lockup lets the editor cut cleanly. If the bumper will be dropped into many different videos, lean toward 45f.
- **Brackets only for series bumpers.** Add `bumper-frame` for YouTube series, courses, or weekly update intros/outros. A one-off product sting uses `logo-sting` alone — no frame chrome.
- **Outro mirrors intro.** In `bumper-frame` `mode='outro'`: wordmark enters with `mask-reveal-up` instead of `kinetic-center-build`; CTA line uses `short-slide-down`; brackets hold throughout as the brand signature rather than animating in fresh.
- **`confetti` is a hard exception.** Use it only on an explicit product-launch or milestone bumper, never as default decoration. When in doubt, omit it.
