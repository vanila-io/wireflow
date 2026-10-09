<p align="center">
  <img src="docs/assets/hero.svg" width="100%" alt="Wireflow: sketch user flows for websites and apps with drag-and-drop wireframe screens">
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <a href="#backers"><img src="https://opencollective.com/wireflow/backers/badge.svg" alt="OpenCollective backers"></a>
  <a href="#sponsors"><img src="https://opencollective.com/wireflow/sponsors/badge.svg" alt="OpenCollective sponsors"></a>
</p>

<p align="center">
  <a href="https://wireflow.co"><b>Website</b></a> ·
  <a href="https://wireflow.co/app">Editor</a> ·
  <a href="https://www.producthunt.com/posts/wireflow">Product Hunt</a>
</p>

Wireflow is a free, open-source tool for sketching user flows. Drag wireframe screens onto a canvas, connect them, and save the result to a file you can open again. It runs entirely in your browser: no account, no backend.

Made by [The Vanila Team](https://vanila.io) and [Automatio AI](https://automatio.ai).

![The Wireflow editor: template sidebar on the left, a checkout flow on the canvas, the toolbar below](docs/screenshot.png)

## Features

- **102 screen templates** in ten categories (Article, Blog, E-Commerce, Features, Gallery, Header, Misc, Multimedia, Sign in, Socials), with search across all of them. Click a template to add it, or drag it onto the canvas (on a touch screen, swipe it sideways).
- **Connect screens**: drag from a card's bottom dot to another card's top dot, or tap one and then the other. A connection can have a label and its own colour (type a hex or `rgb()` value, pick from the palette, or reuse a colour already in the diagram).
- **Edit cards**: double-click a header to rename it, press `H` to hide or show it.
- **Organise**: select several cards (Ctrl+click, or Shift+drag a box) and group them; drag a card into or out of a group. Copy and paste keep the connections between the copied cards.
- **Undo and redo** every change, including whole batches (a paste, a group, an AI change, opening a file). The undo history survives a reload of the tab.
- **Autosave** in the browser, and **save to / open from a file** (`wireflow.json`), also files made by earlier versions of Wireflow.
- **AI assistant** (optional, with your own Anthropic API key): describe a flow or a change, and Claude edits the diagram. Each change is one undo step.
- **Works offline** after the first visit, and installs as an app.
- **Phones and tablets**: a layout that fits the screen, and touch for adding, moving and connecting cards.

## How it works

<p align="center">
  <img src="docs/assets/how-it-works.svg" width="100%" alt="Three steps: drag a screen from the sidebar, connect two screens by dragging from a handle, then save wireflow.json while work autosaves">
</p>

1. **Add screens.** Click a template in the left sidebar, or drag it onto the canvas.
2. **Connect the flow.** Grab a card's bottom dot and drop it on another card's top dot. Click a connection to give it a label or a colour.
3. **Keep it.** Everything autosaves in your browser. **Export JSON** saves `wireflow.json`; **Open file** loads one back, here or in another browser.

The landing page at `/` links every template into the editor at `/app?card=<template id>`.

## Quick start

Requirements: [Node.js](https://nodejs.org/) 24 and [pnpm](https://pnpm.io/) (the version is pinned in `package.json`; `corepack enable` uses it automatically).

```bash
git clone https://github.com/vanila-io/wireflow.git
cd wireflow
corepack enable
pnpm install
pnpm dev
```

Then open http://localhost:3000 (the editor is at http://localhost:3000/app).

## Scripts

| Command               | What it does                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm dev`            | Next.js dev server at http://localhost:3000                                                    |
| `pnpm build`          | Production build (`next build`, then `tools/build-sw.mjs` writes the offline worker)           |
| `pnpm start`          | Serve the production build with `next start`                                                  |
| `pnpm preview`        | Build for Cloudflare with OpenNext and run the Worker locally in workerd (http://localhost:8787) |
| `pnpm deploy:staging` | Build and deploy the `staging` environment (see [Deploy](#deploy))                             |
| `pnpm lint`           | ESLint                                                                                         |
| `pnpm typecheck`      | TypeScript                                                                                     |
| `pnpm test`           | Unit tests (Vitest, `tests/unit/`)                                                             |
| `pnpm test:e2e`       | End-to-end tests (Playwright, `e2e/`)                                                          |

## Testing

```bash
pnpm lint && pnpm typecheck
pnpm test                                       # unit tests

pnpm exec playwright install chromium firefox   # first run only
pnpm test:e2e                                   # builds, serves with next start on port 4400, runs Chromium + phone
E2E_FIREFOX=1 pnpm test:e2e                     # also Firefox
E2E_SERVER=preview pnpm test:e2e                # against the OpenNext Worker in workerd instead of next start
```

`E2E_PORT` picks another port. Every e2e test fails on any console error. The phone tests (`*.mobile.spec.ts`) run on a Pixel 7 viewport with real touch events.

The AI tests use a mocked API. A live test against the real API runs only when asked, with a key in `ANTHROPIC_API_KEY`, in `.env`, or in the file `AI_ENV_FILE` names (a run costs about $0.002 with Claude Haiku 5.5):

```bash
AI_LIVE=1 pnpm exec vitest run tests/unit/ai-live.test.ts --silent=false
```

CI (`.github/workflows/ci.yml`) runs lint, types, unit tests, `pnpm audit --prod`, the Cloudflare build, and the e2e suite against both `next start` (Chromium, Firefox, phone) and the OpenNext Worker.

## Project layout

```
app/                Next.js routes: / (landing), /app (editor), manifest, 404
components/         FlowEditor (the editor), editor/ (cards, groups, sidebar, panels), ai/ (the AI panel)
lib/diagram/        the diagram: model, rules, store, undo history, storage, file format, old formats
lib/ai/             the AI assistant: agent loop, planner, layout check, prompt, providers
data/               template catalog (graphics.json), sizes, old-template-key map
public/graphics/    the 102 template SVGs, served at /graphics/<category>/<slug>.svg
tools/              graphics download, size table, service worker build
```

## Environment variables

All optional. `NEXT_PUBLIC_*` values are read at build time.

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 measurement id (`G-…`). Loads gtag and allows its hosts in the CSP. |
| `NEXT_PUBLIC_RYBBIT_SRC`, `NEXT_PUBLIC_RYBBIT_SITE_ID` | A self-hosted [Rybbit](https://rybbit.io) script URL (https) and site id. No API key is ever put in the page. |
| `CLOUDFLARE_WEB_ANALYTICS=1` | Allows Cloudflare's Web Analytics beacon in the CSP, if the zone injects it. |
| `BLOG_ORIGIN` | Proxy `/blog` and `/blog/*` to this origin (the Ghost blog, which serves its pages under `/blog/`). Unset, the app has no `/blog` route at all, so whatever routes `/blog/*` at Cloudflare keeps serving it. With it set, trailing slashes are kept as requested, because Ghost and Next.js would otherwise redirect each other in a loop. |
| `NEXT_PUBLIC_OFFLINE=off` | Switch offline support off (see [Offline](#offline)). |

Without any of them, the site loads no third-party script at all.

## Data and privacy

- **Your diagram stays in your browser.** It autosaves to `localStorage['wireflow-flow-v1']`, the same key and format wireflow.co has used, so diagrams made there open unchanged. The undo history of a tab is kept in `sessionStorage`. Nothing is sent to a Wireflow server; there is none.
- If a saved diagram can't be read, it is copied to `localStorage['wireflow-flow-v1.unreadable']` before anything else is written. A diagram saved by a newer version of Wireflow is shown but never overwritten.
- A diagram autosaved by the previous editor (`localStorage['data']`, app.wireflow.co and earlier staging builds) is brought over once, on the first visit, and left in place.
- **The AI assistant** sends your messages and the current diagram (screens, labels, positions, connections and groups) straight from your browser to Anthropic, under your own API key and your organisation's data settings. The key is kept in memory and is gone when you close or reload the tab, unless you tick **Remember on this device**, which stores it **unencrypted** in this browser's `localStorage['wireflow-ai']`. Anyone who can run code on the page or read this browser profile could use it, so use a dedicated key with an expiry and a spend limit. **Forget key** removes it. The assistant's replies are shown as plain text.
- Analytics load only if a deployment configures them (see [Environment variables](#environment-variables)). Every page is served with a Content-Security-Policy that only allows connections to the site itself, `api.anthropic.com` and the configured analytics.

## File format

**Export JSON** writes `wireflow.json`:

```json
{
  "format": "wireflow",
  "version": 2,
  "diagram": {
    "nodes": [
      { "id": "e-commerce-cart-1791567209999-abcde", "type": "flow", "position": { "x": 180, "y": 400 },
        "data": { "graphicId": "e-commerce-cart", "label": "Cart", "headerText": "My cart", "showHeader": true } },
      { "id": "group-mf2k1-x9a2", "type": "group", "position": { "x": -16, "y": -36 }, "width": 252, "height": 250,
        "data": { "label": "Checkout" } }
    ],
    "edges": [
      { "id": "xy-edge__a-b", "source": "a", "target": "b", "label": "Pay",
        "style": { "stroke": "#e8590c" }, "markerEnd": { "type": "arrowclosed", "color": "#e8590c" } }
    ]
  }
}
```

- `diagram` is the autosaved diagram in React Flow's shape: cards (`type: "flow"`) name their template by its stable id (`data.graphicId`, as in `data/graphics.json`); the image URL is taken from the catalog when a file is opened, so a file can't point an image anywhere else. Groups are `type: "group"` nodes, and a card in a group has a `parentId` and a position relative to the group.
- **Open file** also reads production's earlier Export JSON (React Flow's plain `{nodes, edges}`), the previous editor's files (`"version": 1`, gg-editor/G6 items with `"<folder>/<file>"` template keys) and its plain `{nodes, edges, groups}`. Old layouts are scaled to the new card size.
- A file is refused, with a message and without changing anything, if it isn't JSON, isn't a Wireflow diagram, is from a newer version, has missing, non-text or duplicate ids, positions that aren't numbers, unknown templates, a group inside itself, more than 2000 items or more than 5 MB. `__proto__` keys are dropped. Connections with a missing end are dropped, with a message. Opening over a diagram asks first, and is one undo step.

## Offline

After the first visit to `/app`, a service worker (`public/sw.js`, written by `tools/build-sw.mjs` after `next build`) keeps the editor, its scripts, the icons and all 102 templates, so it opens and works without a network. Its scope is `/app`: it never answers the landing page, `/blog/*` or any other path, and it never touches requests to other sites (the AI assistant needs the network).

When a new version is deployed, it installs in the background; open editor tabs show **A new version of Wireflow is available** and wait. **Reload** switches every tab that was offered the update. Tabs kept open check for updates every hour.

To switch offline support off, build with `NEXT_PUBLIC_OFFLINE=off` and deploy: `/sw.js` then removes itself and its caches and reloads open editor tabs. **Don't just delete `/sw.js`**: browsers that installed the editor would keep their cached copy.

## Deploy

The app is deployed to Cloudflare Workers with [OpenNext](https://opennext.js.org/cloudflare) (`open-next.config.ts`, `wrangler.jsonc`). Every page is prerendered at build time and served from Workers static assets; no R2 bucket or KV namespace is needed.

```bash
pnpm preview          # build and run the Worker locally
pnpm deploy:staging   # build and deploy to the wireflow-staging Worker
```

`wrangler.jsonc` has three targets:

- the top level, used by `pnpm preview` and by a plain `wrangler deploy`: the **staging** Worker `wireflow-staging`, so a deploy without `--env` can never replace production;
- `--env staging`: `wireflow-staging`;
- `--env production`: an explicit environment, deployed only with `opennextjs-cloudflare deploy --env production`. **Before using it**, check the name, routes and custom domains of the Worker that serves wireflow.co today in the Cloudflare dashboard (it wasn't created from this repo), and that `/blog/*` stays routed to Ghost.

Recommended zone settings: Always Use HTTPS and HSTS.

`pnpm build && pnpm start` (or `docker compose up -d --build`, then http://localhost:8083) runs the same app on Node instead.

## Dependencies

Versions are pinned exactly, and `pnpm-workspace.yaml` refuses any release younger than 14 days. The exceptions are security releases: Next.js 16.3.8 (production ran 16.2.9, which has critical and high advisories, among them remote code execution in the image optimizer) with the OpenNext adapter that supports it, and `source-map-js` 1.2.2. Next.js's optional `sharp` is not installed: images are served as plain files (`images.unoptimized`).

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd> (or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>) | Undo / redo |
| <kbd>H</kbd> | Hide or show the header of the selected cards |
| Double-click a header or a group label | Rename it |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Delete the selection (a group with its contents) |
| <kbd>Ctrl</kbd> + <kbd>G</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>G</kbd> | Group the selected cards / ungroup the selected group |
| <kbd>Ctrl</kbd> + <kbd>C</kbd> / <kbd>Ctrl</kbd> + <kbd>V</kbd> | Copy / paste the selection with the connections between it |
| Ctrl+click, or <kbd>Shift</kbd> + drag | Select several |

On a Mac, use <kbd>Cmd</kbd> instead of <kbd>Ctrl</kbd>. Shortcuts don't fire while you type in a field.

## Contributing

Contributions are welcome. Bug reports and ideas go in [GitHub issues](https://github.com/vanila-io/wireflow/issues).

1. Fork the repository and create a branch for your change.
2. Install dependencies with `pnpm install` and make your change.
3. Run the checks locally:

   ```bash
   pnpm lint && pnpm test && pnpm test:e2e
   ```

4. Open a pull request that explains what changed and why. Include a screenshot for UI changes.

## Around the web

- [Wireflow website](https://wireflow.co)
- [Product Hunt page](https://www.producthunt.com/posts/wireflow)
- [Open Hub analysis of the code](https://www.openhub.net/p/wireflow)
- [Original call for contributors (Meteor forums)](https://forums.meteor.com/t/anyone-interested-in-collaboration-on-wireflow-co-open-source-project/40716)
- [Slack invite](https://join.slack.com/t/wireflow/shared_invite/zt-iwgx8efa-Vt~_rnkw2tGAhSR~nJs9bA) (older invite link, may have expired)

## Credits

### Contributors

This project exists thanks to everyone who contributes.

<a href="https://github.com/vanila-io/wireflow/graphs/contributors"><img src="https://opencollective.com/wireflow/contributors.svg?width=890&button=false" alt="Contributors"></a>

### Backers

Thank you to all our backers! [Become a backer](https://opencollective.com/wireflow#backer)

<a href="https://opencollective.com/wireflow#backer" target="_blank"><img src="https://opencollective.com/wireflow/backers.svg?width=890" alt="Backers"></a>

### Sponsors

Support this project by becoming a sponsor. Your logo will show up here with a link to your website. [Become a sponsor](https://opencollective.com/wireflow#sponsor)

<a href="https://opencollective.com/wireflow/sponsor/0/website" target="_blank"><img src="https://opencollective.com/wireflow/sponsor/0/avatar.svg" alt="Sponsor"></a>
<a href="https://opencollective.com/wireflow/sponsor/1/website" target="_blank"><img src="https://opencollective.com/wireflow/sponsor/1/avatar.svg" alt="Sponsor"></a>
<a href="https://opencollective.com/wireflow/sponsor/2/website" target="_blank"><img src="https://opencollective.com/wireflow/sponsor/2/avatar.svg" alt="Sponsor"></a>

## License

[MIT](LICENSE)
