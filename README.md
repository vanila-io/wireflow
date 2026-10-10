This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

# Wireflow

Wireflow is a free, open source tool for user flow prototypes: a landing page at `/` and the editor at `/app` (React Flow). This section covers what was added on top of the app above.

## Develop and test

```bash
npm ci
npm run dev            # http://localhost:3000
npm run lint
npm run typecheck
npm test               # Vitest unit tests (tests/unit)
npm run test:e2e       # Playwright (e2e/): builds, then runs against next start on port 4410
E2E_SERVER=preview npm run test:e2e   # the same suite against the OpenNext Worker in workerd
npm run preview        # OpenNext build + local Cloudflare Workers runtime (wrangler dev)
```

- `E2E_PORT` picks another port; `E2E_SKIP_BUILD=1` reuses the last build; `E2E_BASE_URL=http://host:port` runs the suite against a server that is already running (for example an older commit, to see a test fail without its fix).
- Every e2e test fails on a console error or an uncaught page error, so the suite also checks that the Content-Security-Policy blocks nothing the app needs.
- Live AI test (spends real money, about $0.003 per run with Claude Haiku 5.5): `AI_LIVE=1 npx vitest run tests/unit/ai-live.test.ts`. It reads `ANTHROPIC_API_KEY` from the environment or `.env` (`AI_ENV_FILE` names another file) and never prints it.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests and the Cloudflare build, then the e2e suite on Chromium against `next start` and against the Worker.

## Environment variables

All optional. They are read at build time (the pages are prerendered), so set them in the build environment, not only as Worker vars.

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 measurement id (`G-…`). Unset: no GA script. |
| `NEXT_PUBLIC_RYBBIT_SRC` | URL of the self-hosted Rybbit script (`https://…/api/script.js`). Unset: no Rybbit script. |
| `NEXT_PUBLIC_RYBBIT_SITE_ID` | Rybbit site id; required with `NEXT_PUBLIC_RYBBIT_SRC`. |
| `CLOUDFLARE_WEB_ANALYTICS` | `1` if the Cloudflare zone injects its Web Analytics beacon, so the CSP allows it. |
| `BLOG_ORIGIN` | Origin of the Ghost blog. Set only if this app should proxy `/blog` and `/blog/*` there; production routes `/blog/*` to Ghost outside the app. |
| `NEXT_PUBLIC_OFFLINE` | `off` builds a worker that removes the offline editor from browsers that installed it (rollback, see Offline). |

A malformed analytics value fails the build instead of reaching the page. Rybbit's API key (`data-api-key`) is deliberately not supported: Rybbit documents it for tracking from localhost only, to be removed before deploying.

## Data and privacy

- **No accounts, no server storage.** The diagram autosaves in this browser's `localStorage["wireflow-flow-v1"]`, the key the editor has always used. Diagrams saved before these changes open unchanged; saves add `"version": 2`, which the previous editor can still read.
- Every write goes through one save boundary (`lib/diagram/store.ts` → `lib/diagram/rules.ts`): connections need two existing cards, ids are unique strings, only known fields are kept (no `__proto__`), image URLs come from the template catalog. If loading has to leave something out, or the stored data can't be read, the original is first copied to `wireflow-flow-v1.backup` (later copies get a time suffix). A diagram saved by a newer version is shown but never overwritten. Two open tabs follow each other's saves.
- The undo history of a tab is kept in `sessionStorage["wireflow-history-v1"]`, so it survives a reload of that tab.
- **AI assistant** (the AI button, optional): bring your own Anthropic API key. Requests go straight from the browser to `api.anthropic.com` with your messages and a compact copy of the diagram; Wireflow has no server and never sees them. The key stays in memory and is gone when the tab closes, unless you tick "Remember on this device", which stores it **unencrypted** in this browser's `localStorage["wireflow-ai"]`. Use a dedicated key with a spend limit. Each reply shows its cost. Model output is shown as plain text.
- Analytics load only when configured (see Environment variables).

## File format (Export JSON / Open file)

```json
{
  "format": "wireflow",
  "version": 2,
  "diagram": {
    "nodes": [{ "id": "…", "type": "flow", "position": { "x": 0, "y": 0 },
                "data": { "graphicId": "e-commerce-cart", "label": "Cart", "headerText": "My cart", "showHeader": true } }],
    "edges": [{ "id": "…", "source": "…", "target": "…", "markerEnd": { "type": "arrowclosed" },
                "label": "Checkout", "style": { "stroke": "#e8590c" } }]
  }
}
```

- Cards name their template by the stable id in `lib/graphics.json`; image URLs are not stored and always come from this build.
- Open file also reads Export JSON from before version 2 (plain React Flow `{nodes, edges}`), the earlier gg-editor app's `{"format": "wireflow", "version": 1}` files with `Category/Name` template keys, and its plain G6 `{nodes, edges, groups}` (`lib/legacy-templates.json` maps all 102 old keys; layouts scale from 96 to 220 px cards; groups are left out with a message, their cards kept).
- It refuses non-JSON, other formats, newer versions, bad or duplicate ids, missing positions, unknown templates, group loops, more than 2000 items or 5 MB; asks before replacing a diagram; keeps the current one if storage refuses the new one; drops loose connections with a message. Opening is one undo step.

## Offline

After one online visit to `/app`, the editor works offline. `scripts/build-sw.mjs` writes `public/sw.js` after `next build` (from `scripts/sw-template.js`): it controls `/app` only (never `/`, `/blog/*`, `/uploads/*` or other origins), precaches the build and the graphics, and refuses to cache an HTML page served for a script URL. A new deploy waits until the user clicks Reload in "A new version of Wireflow is available".

**Rollback:** build and deploy with `NEXT_PUBLIC_OFFLINE=off`. `/sw.js` then becomes a worker that deletes Wireflow's caches, unregisters itself and reloads open editor tabs. Keep serving that `/sw.js` for a while; deleting the file instead would leave installed browsers on their cached editor.

## Deploy (Cloudflare, OpenNext)

- `npm run preview` builds with `@opennextjs/cloudflare` and serves the Worker locally (bindings simulated).
- `npm run deploy:staging` deploys the Worker `wireflow-staging`. The top level of `wrangler.jsonc` is staging too, so a plain `wrangler deploy` can't replace production.
- Bindings: `ASSETS` (static assets), `NEXT_INC_CACHE_R2_BUCKET` (R2 incremental cache: `/` revalidates hourly) and `WORKER_SELF_REFERENCE` (a service binding to the Worker itself, for the revalidation queue). Uploads (`lib/storage.js`, `/uploads/*`) need an R2 binding `STORAGE` and optionally a `SITE_PREFIX` var; not bound, as nothing in the app uploads today.
- Owner TODOs before production:
  - fill in `env.production` in `wrangler.jsonc` (the Worker's name, routes, cache bucket; `STORAGE` if uploads are used) from the Cloudflare dashboard; its placeholders are invalid on purpose, so a deploy fails until then; deploy only with an explicit `opennextjs-cloudflare deploy --env production`;
  - create the staging cache bucket: `wrangler r2 bucket create wireflow-staging-opennext-cache`;
  - set the analytics variables in the build environment;
  - keep the `/blog/*` route to Ghost, or set `BLOG_ORIGIN`.
