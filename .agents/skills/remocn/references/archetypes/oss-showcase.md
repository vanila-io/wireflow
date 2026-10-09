# oss-showcase

**Family:** D. Developer/OSS · **Default duration:** ~13s (390f @30fps, scales with contributor count N) · **Format:** 16:9 · **Vibe:** tech

An OSS repo announcement: establish the repo name, count up stars and forks, reveal the contributor community, show the install command, close on a GitHub CTA. The traction numbers are the story spine — they must land with satisfying momentum, not slide by as decoration.
Read `../anatomy.md` first; pick components from `https://remocn.dev/llms-components.txt`.

## Beats

Five-beat structure: Positioning (repo name) → Proof (stars/forks) → Proof (contributors) → Product reveal (install) → CTA. The contributors scene scales with N: `clamp(90, 90 + N×4, 180)` frames; default N≈48 → 90f. Total default: ~390f minus transition overlaps (~72f combined) ≈ 390f net.

**Long variant — Q&A cadence (avoid over-long slop):** For repos with a richer story, replace the RepoTitle beat with a question→answer rhythm: "Open source?" → "Yes." / "Battle-tested?" → "Yes." / "Free forever?" → "Yes." — three quick `kinetic-center-build` + `per-word-crossfade` swaps before the stars beat. Avoids the enumeration trap. Reference `good_06` (shadcn-sidebar, ~117s) demonstrates this cadence at scale.

| Frames (default) | Beat | What happens |
|---|---|---|
| 0–90f | **RepoTitle** | `owner/repo` name large centered via `per-character-rise` (stagger 2f/char); one-line tagline `soft-blur-in` at 12f delay; scene exits via `micro-scale-fade` |
| 90–195f | **StarsTraction** | `github-stars` entrance: star icon `spring-scale-in`, count rolls up to value; forks and issues `rolling-number` cascade 8f apart; `shimmer-sweep` sweeps the star count at peak |
| 195–285f | **Contributors** | `contributors-grid` (build new) waves in avatar tiles staggered by index; "N contributors" heading via `rolling-number` |
| 285–360f | **InstallLine** | `terminal-simulator` types install command char by char; output line enters via `staggered-fade-up`; green checkmark `spring-scale-in` |
| 360–390f | **CTA** | "Star it on GitHub" text `tracking-in`; repo URL and button `micro-scale-fade` |

Transitions: RepoTitle→Stars `fade()` from `@remotion/transitions/fade` (spring, 20f); Stars→Contributors `whip-pan` left (linear, 18f); Contributors→Install `focus-pull` (24f); Install→CTA `push-through` (spring, ~15f).

## Beat → slots

| Beat | Catalog components | New component needed |
|---|---|---|
| RepoTitle | `per-character-rise` (repo name), `soft-blur-in` (tagline), `micro-scale-fade` (exit), `shader-dot-orbit` (bg) | — |
| StarsTraction | `github-stars` (stargazer fly-through + odometer), `rolling-number` (forks, issues cascade), `shimmer-sweep` (count emphasis at peak) | — |
| Contributors | `rolling-number` (contributor count heading) | **`contributors-grid`** — wave of avatar tiles; `avatars: {avatarUrl: string; login?: string}[]`, `columns?: number` (auto), `stagger?: number` (3f default), `shape?: 'circle' \| 'rounded'` (default circle), `maxVisible?: number` (overflow folded into "+N" chip); each tile spring scale+opacity, stagger by index; seek-safe, no side-effect clocks (anatomy §1) |
| InstallLine | `terminal-simulator` (typed command + output lines), `staggered-fade-up` (output text), `spring-scale-in` (checkmark icon) | — |
| CTA | `tracking-in` (headline), `micro-scale-fade` (URL + button), `shader-dot-orbit` (base bg) | **`cta-scene`** — reusable CTA wrapper (label + URL chip + button slot); not in catalog, build as lightweight transparent component (anatomy §1) |

For the long Q&A variant: `kinetic-center-build` (question line), `per-word-crossfade` (question→answer swap) — both catalog; no new component needed.

## Content contract (infer → ask → placeholder)

| Field | Required | Notes |
|---|---|---|
| `repo` | yes | `owner/repo` — infer from `package.json` `"repository"` or current git remote |
| `tagline` | yes | one-line description — infer from GitHub API `description` or `package.json` `"description"` |
| `stars` | yes | infer from `GET /repos/{owner}/{repo}`; animate from 0 to value |
| `forks` | no | infer from same API response; omit if zero |
| `issues` | no | open issue count from API; omit if repo disables issues |
| `contributors[]` | yes | `{avatarUrl: string; login?: string}[]` — infer from `GET /repos/{owner}/{repo}/contributors?per_page=24`; fold remainder into "+N" chip |
| `installCmd` | yes | infer from `package.json` `"name"` → `npm install <name>`; use `npx shadcn add @<scope>/<name>` for shadcn-registry repos |
| `ctaLabel` | no | default `"Star it on GitHub"` |
| `ctaUrl` | yes | full GitHub repo URL |
| `accent` | no | one color; default `#FFD23F`; applied to star count, terminal checkmark, CTA button — nowhere else |
| `font` | no | default `Geist Mono`; monospace reinforces the dev context |

## Notes

- **One accent only.** The accent touches exactly three elements: the peak star count, the terminal checkmark, and the CTA button. Tagline, contributor heading, and output lines stay neutral.
- **Background: a slow muted shader throughout.** A low-opacity `shader-dot-orbit` (~0.06) or a slow, muted shader (`shader-neuro-noise`, `shader-mesh-gradient`) at low `speed` — kept low so it never competes with content.
- **Star count is the number payoff.** `github-stars` exists for exactly this beat — it provides the stargazer fly-through plus the odometer. A bare `rolling-number` on its own misses the moment.
- **Contributors must feel like people arriving, not a grid being filled.** The diagonal wave entrance (stagger by index) creates a sense of community assembling. Cap visible tiles at 24; fold the rest into a "+N" chip rather than shrinking avatar size.
- **Terminal output: 2–3 lines max.** Command line, one confirmation output (`✓ added 1 package in 2s`), and the checkmark. A wall of npm install output is slop — `terminal-simulator` can render more, but don't.
- **`contributors-grid` must be seek-safe.** Compute each tile's animation purely from `frame` and index; no `useState`, `useEffect`, or real-time clocks. See anatomy §1.
- **`cta-scene` is not in the catalog.** Build it as a lightweight transparent wrapper (label `string`, url `string`, buttonLabel `string`) consistent with anatomy §1. Reusable across all D-family archetypes.
