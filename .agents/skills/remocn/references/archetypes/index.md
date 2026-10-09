# Archetype index

Router for video archetypes. **Pick the archetype that matches the user's ask, then open that
`<name>.md`** for its full recipe (beats → slots → contract). Read `../anatomy.md` first for the
strategy, the beat language, and the good-vs-slop bar; pick components from `https://remocn.dev/llms-components.txt`.
`product-demo` is the fully-worked flagship; the others are compact recipes.

| Archetype | Family | Use for | Duration |
|---|---|---|---|
| [`product-demo`](product-demo.md) *(flagship)* | Product & Launch | Show a product solving a problem, end to end | ~18–45s |
| [`feature-announcement`](feature-announcement.md) | Product & Launch | Spotlight one new capability | ~12–20s |
| [`changelog`](changelog.md) | Release & Updates | Version + human-readable change list | ~9s `[N]` |
| [`testimonial-reel`](testimonial-reel.md) | Growth & Social Proof | Cycle real testimonials/quotes | ~15–25s `[N]` |
| [`oss-showcase`](oss-showcase.md) | Developer / OSS | Show an OSS repo (stars, contributors, code) | ~20–35s |
| [`cli-tool-demo`](cli-tool-demo.md) | Developer / OSS | Demo a CLI / dev tool running | ~20–45s |
| [`year-in-review`](year-in-review.md) | Data & Metrics | Recap a year/period in numbers | ~20–35s `[N]` |
| [`logo-bumper`](logo-bumper.md) | Brand & Identity | Logo reveal / intro-outro bumper | ~4–6s |
| [`pricing-reveal`](pricing-reveal.md) | Sales & Conversion | Reveal pricing tiers | ~12–20s |

`[N]` = the main scene scales linearly with item count.

**Any other archetype** (launch teaser, tweet-wall, dashboard tour, tutorial, milestone,
sale promo, lower-third…) — compose it from `../anatomy.md`: the 6-beat anatomy generalizes.
Use the nearest ready recipe above as the format model.

**Adding an archetype:** write a compact recipe `<name>.md` using `changelog.md` as the format
model — Beats → Beat→slots → Content contract → Notes — grounded in real catalog components,
flagging any not-in-catalog visual as a "build new" component (anatomy §1). Then add its row here.
