# pricing-reveal

**Family:** I. Sales & Conversion · **Default duration:** ~12s (360f @30fps) · **Format:** 16:9 · **Vibe:** premium

A sales scene that walks viewers through pricing tiers, elevates the recommended plan, and closes on a CTA. The recommended tier is the single focal point — every other element frames it. Restrained by design: one accent color, one highlighted column, one ask.
Read `../anatomy.md` first; pick components from `https://remocn.dev/llms-components.txt`.

## Beats

A 5-beat specialization of the anatomy (Positioning → Features → CTA), compressed into a single unbroken scene followed by a CTA cut.

| Frames | Beat | What happens |
|---|---|---|
| 0–55f | **Lead** | "Simple pricing" headline resolves; a kicker line fades up beneath it |
| 55–150f | **ColumnsEnter** | Three tier cards rise from below with a left-to-right stagger |
| 150–250f | **RecommendFocus** | Recommended column lifts and scales up; flanking columns dim; feature checks draw in; "Popular" badge springs in |
| 250–320f | **PriceLand** | Recommended price rolls in with `$` prefix and lands; `/mo` gets a brief inline highlight |
| 320–360f | **CTA** | CTA headline builds word by word; button springs in and takes a single shimmer sweep |

Transitions: Lead→ColumnsEnter `slide({ direction: "from-bottom" })` from `@remotion/transitions/slide` (spring, 16f); grid→CTA `push-through` (linearTiming, 20f).

## Beat → slots

| Beat | Catalog components | New component needed |
|---|---|---|
| Lead | `soft-blur-in` (title, blur 14→0 over 20f), `staggered-fade-up` (kicker), `shader-grain-gradient` (bg, dark, low `speed`) | — |
| ColumnsEnter | `staggered-fade-up` (column group, 8f stagger, spring `damping:18`) | **`pricing-column`** — tier card atom |
| RecommendFocus | `micro-scale-fade` (recommended lift + scale 1→1.05), `spring-scale-in` ("Popular" badge), `check-list` (features drawing in, 6f stagger) | orchestrated by **`plan-table`** |
| PriceLand | `slot-machine-roll` (price with `$` prefix + suffix `/mo`), `inline-highlight` (/mo emphasis) | — |
| CTA | `kinetic-center-build` (CTA headline, word-by-word), `spring-scale-in` (button entrance, `damping:8`), `shimmer-sweep` (single sweep on button) | — |

`pricing-column` and `plan-table` are not in the catalog — build both:

- **`pricing-column`** (build new) — atomic tier card: name, price slot (passed as a rendered node so `slot-machine-roll` lives inside), period, feature list, `recommended` flag. When `recommended` is true, renders an accent border and exposes a lifted position for the parent orchestrator. Transparent background. Props: `{ name: string; price: number; period?: string; features: string[]; recommended?: boolean }`.
- **`plan-table`** (build new) — orchestrator: lays out a `pricing-column[]` row, sequences the ColumnsEnter → RecommendFocus → PriceLand phases by splitting total frames into thirds. Props: `{ columns: PricingColumn[]; durationInFrames: number }`. Transparent; caller supplies the backdrop.

## Content contract (infer → ask → placeholder)

| Field | Required | Notes |
|---|---|---|
| `tiers[]` | yes | `{ name: string; price: number; period?: string; features: string[]; recommended?: boolean }` — exactly one tier should have `recommended: true` |
| `headline` | yes | Short, 2–4 words — "Simple pricing", "Plans that scale" |
| `kicker` | no | One line beneath the headline — "No hidden fees", "Cancel anytime" |
| `cta.headline` | yes | 3–5 words — "Start your free trial" |
| `cta.label` | yes | Button label — "Get started", "Start free trial" |
| `brand` | no | `{ accent }` → one accent color applied to the recommended column border, badge, and shimmer; everything else neutral |

Use real plan names and real feature copy. Never use "Plan A / Feature 1" filler. If the user's product has no pricing yet, use the sample data below unchanged — it is honest placeholder, not lorem.

Sample data:

```ts
columns: [
  { name: "Hobby", price: 0, period: "mo", features: ["3 projects", "720p export", "Community support"] },
  { name: "Pro", price: 19, period: "mo", features: ["Unlimited projects", "4K export", "Priority render", "Custom domain"], recommended: true },
  { name: "Team", price: 49, period: "mo", features: ["Everything in Pro", "5 seats", "SSO", "Audit log"] },
]
```

## Notes

- **One accent only.** Apply the accent color to: the recommended column border, the "Popular" badge, the shimmer sweep on the CTA button. Secondary tiers stay neutral — dimming opacity (1→0.55) is the only treatment they receive.
- **Emphasis is structural, not a glow.** The recommended column reads through the lift, scale, and flanking dim during RecommendFocus. Do not add a radial gradient or blur halo behind the column.
- **`slot-machine-roll` for prices.** It handles the `$` prefix and `/mo` suffix natively — pass `prefix="$"` and `suffix="/mo"` rather than formatting the string by hand. Use `rolling-number` only for pure large integers with no currency symbol.
- **Three tiers is the canonical count.** If the user has two or four, adjust the stagger timing accordingly; do not force a third empty column.
- **Background stays dark.** A solid `#09090b` / `backdrop` theme `dark`, or a slow, muted shader (`shader-warp`, `shader-mesh-gradient`) at low `speed` all work — keep the canvas dark so the recommended-column emphasis reads. If the background moves, keep it muted and gentle; avoid light, colorful, or fast fills.
- **CTA is calm, not celebratory.** `shimmer-sweep` runs once — no loop, no bounce, no confetti. The energy peaks at PriceLand; the CTA is a composed close.
