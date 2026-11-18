<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Goal

wireflow.co — the Wireflow wireframe/user-flow tool (Next.js landing page plus the
`/app` editor), published via this project. Deployed site subdomain is
`wireflow-rebuild`; custom domain `wireflow.co` points at the production deploy.

## Stack

Next.js 16 (App Router, Turbopack) on Cloudflare Workers via OpenNext
(`open-next.config.ts`), Tailwind v4, React Flow for the editor, Vitest for unit
tests, Playwright for e2e. TypeScript is checked with `tsc --noEmit`.

## Commands

- `npm run dev` — dev server on :3000
- `npm test` — vitest unit suite
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — eslint
- `npm run build` — `next build` plus the service-worker build (`scripts/build-sw.mjs`)
- `npx playwright test` — e2e (needs the app running)

## Constraints

- Analytics and the Content-Security-Policy are coupled. `lib/env.ts` owns
  `DEFAULT_RYBBIT` (this site's Rybbit property, `https://rybbit-d367d4.automatio.run`,
  site id 3) and `rybbitScript(env)`. Both `app/layout.tsx` (the script tag) and
  `lib/security.ts` (`script-src` and `connect-src`) read it, so the page can never
  load a beacon its own policy blocks. Change the Rybbit origin in ONE place there.
  A deployment that sets `NEXT_PUBLIC_RYBBIT_SRC` + `NEXT_PUBLIC_RYBBIT_SITE_ID`
  still overrides the default, and the CSP follows it.
- `lib/security.ts` builds the CSP without nonces on purpose: pages are prerendered,
  and it allows only `'self'`, `'unsafe-inline'`, the Rybbit origin, and whatever a
  deployment explicitly enables (GA4, Cloudflare Web Analytics). Widening a
  directive beyond that needs a real reason.
- The landing page must never 500 because an upstream is down: remote data goes
  through `lib/remote-data.ts` `unavailable()`, which logs and returns a fallback
  (no star count, empty sponsor tiers) instead of throwing.
- `next.config.ts` is loaded at server start, so a CSP/header change is not visible
  until the dev server restarts.

## Don't-do

- Don't add a `data-api-key` to the deployed Rybbit tag. Rybbit's ingest key is for
  localhost tracking only; the production tag relies on the page's Origin instead.
- Don't point the tag at a different Rybbit host without updating `DEFAULT_RYBBIT`
  — the CSP will block the script and `/api/track` will never fire.