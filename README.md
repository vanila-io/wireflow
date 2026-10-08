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
  <a href="https://www.producthunt.com/posts/wireflow">Product Hunt</a>
</p>

Wireflow is a free, open-source tool for sketching user flows. Drag wireframe screens onto a canvas, connect them, and export the result as an image. It runs entirely in the browser: no account, no backend.

Made by [The Vanila Team](https://vanila.io) and [Automatio AI](https://automatio.ai).

![The Wireflow editor: template sidebar on the left, flow canvas in the middle, properties panel and minimap on the right](docs/screenshot.png)

## Features

- **100+ screen templates** in ten categories (Article, Blog, E-Commerce, Features, Gallery, Header, Misc, Multimedia, Sign in, Socials), with search in the sidebar.
- **Drag and drop** templates onto a zoomable canvas.
- **Connect screens** with edges. Each edge has its own label, shape (smooth, polyline, rounded polyline), width, and color.
- **Edit nodes**: rename them, and show or hide the header with a shortcut.
- **Organize**: multi-select, group and ungroup, bring to front and send to back.
- **Edit history**: undo, redo, copy, paste, and delete.
- **Navigate**: zoom in and out, fit to screen, actual size, and a minimap.
- **Export** the canvas to a JPEG with one click.
- **Autosave**: every change is saved to your browser's `localStorage`.

## How it works

<p align="center">
  <img src="docs/assets/how-it-works.svg" width="100%" alt="Three steps: drag a screen from the sidebar, connect two screens by dragging from an anchor, then export a JPEG while work autosaves">
</p>

1. **Drag a screen.** Pick a template from the left sidebar and drop it on the canvas.
2. **Connect the flow.** Hover a screen to show its anchor points, then drag from an anchor to another screen. Select a node, edge, or group to edit it in the right-hand panel.
3. **Export.** Click the round button in the top-left corner of the canvas to download `wireflow.jpg`. You don't need to save; the diagram is stored in your browser as you work.

## Quick start

Requirements:

- [Node.js](https://nodejs.org/) 20.19+ or 22.12+. Node 24 LTS is recommended.
- [pnpm](https://pnpm.io/). The version is pinned in `package.json`. Run `corepack enable` (Corepack ships with Node 24) to use it automatically, or follow the [pnpm installation guide](https://pnpm.io/installation).

```bash
git clone https://github.com/vanila-io/wireflow.git
cd wireflow
corepack enable
pnpm install
pnpm dev
```

Then open http://localhost:5173.

## Scripts

| Command           | What it does                                              |
| ----------------- | --------------------------------------------------------- |
| `pnpm dev`        | Start the Vite dev server at http://localhost:5173        |
| `pnpm build`      | Create a production build in `build/`                     |
| `pnpm preview`    | Serve the production build at http://localhost:4173       |
| `pnpm lint`       | Lint the project with ESLint                              |
| `pnpm test`       | Run the Vitest unit tests (`src/**/*.test.{js,jsx}`)      |
| `pnpm test:e2e`   | Run the Playwright end-to-end tests in `e2e/`             |

## Testing

```bash
pnpm test                                  # unit tests (Vitest)

pnpm exec playwright install chromium      # first run only: download the test browser
pnpm test:e2e                              # end-to-end tests (Playwright, Chromium)
```

Unit tests are `*.test.js` / `*.test.jsx` files under `src/`. The end-to-end specs live in `e2e/` and are configured in `playwright.config.js`. `pnpm test:e2e` builds the app and serves it on port 4179 by itself, so you don't need a running dev server (the port must be free).

## Docker

```bash
docker compose up -d --build
```

Then open http://localhost:8083. The image builds the app in a Node 24 stage and serves the static `build/` output with nginx. Stop it with `docker compose down`.

## Deploy

The app is a static site, so any static host can serve `build/`.

### Cloudflare Workers (staging)

`wrangler.jsonc` serves `build/` as [Workers static assets](https://developers.cloudflare.com/workers/static-assets/), with no Worker script. Its `staging` environment deploys to a separate Worker, `wireflow-staging`, at `https://wireflow-staging.<your-subdomain>.workers.dev`. Per-version preview URLs are turned off.

Deploy the `staging` branch from your machine:

```bash
pnpm exec wrangler login                  # first time only
git switch staging
pnpm install
pnpm build
pnpm exec wrangler dev --env staging      # optional: try it at http://localhost:8787
pnpm exec wrangler deploy --env staging
```

Production will be the `wireflow` Worker, deployed from `main` with `pnpm build && pnpm exec wrangler deploy`. It isn't set up yet.

To deploy on every push to `staging` instead, connect the repository in the Cloudflare dashboard (**Workers & Pages** → `wireflow-staging` → **Settings** → **Builds** → **Connect**) and use these settings:

| Setting               | Value                                                             |
| --------------------- | ----------------------------------------------------------------- |
| Git branch            | `staging`                                                         |
| Build command         | `pnpm build`                                                      |
| Deploy command        | `pnpm exec wrangler deploy --env staging`                         |
| Enable Preview Builds | Off, so pull requests and other branches never build or deploy    |
| Build variable        | `PNPM_VERSION` = `12.10.1` (the build image defaults to pnpm 10)  |

## Keyboard shortcuts

| Shortcut                   | Action                                   |
| -------------------------- | ---------------------------------------- |
| <kbd>Ctrl</kbd> + <kbd>=</kbd> | Zoom in                              |
| <kbd>Ctrl</kbd> + <kbd>-</kbd> | Zoom out                             |
| <kbd>Ctrl</kbd> + <kbd>H</kbd> | Hide the header of the selected node |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Show the header of the selected node |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Delete the selection       |

## Data and privacy

- Your diagram is saved automatically to your browser's `localStorage` (key `data`) on every change. Nothing is sent to a server, and there are no accounts or analytics.
- The diagram only exists in the browser where you made it. Clearing site data deletes it, and you can't move the editable diagram to another browser yet. JPEG export saves an image of the canvas, not an editable file.
- The toolbar icon font is loaded from Alibaba's iconfont CDN (`at.alicdn.com`).

## Tech stack

[React 19](https://react.dev/) · [Vite 8](https://vite.dev/) · [Ant Design 6](https://ant.design/) · [GGEditor 2](https://github.com/alibaba/GGEditor) (built on G6) · [html-to-image](https://github.com/bubkoo/html-to-image) · [react-colorful](https://github.com/omgovich/react-colorful) · [Vitest](https://vitest.dev/) · [Playwright](https://playwright.dev/) · [ESLint](https://eslint.org/)

## Project structure

```text
.
├── docs/                 README images (animated SVGs, screenshot)
├── e2e/                  Playwright end-to-end specs
├── public/               static files copied as-is (icons, manifest, service worker)
├── src/
│   ├── assets/images/    wireframe screen templates (SVG), one folder per category
│   ├── components/       canvas, sidebar, toolbar, detail panel, minimap, export button
│   ├── containers/       app layout and custom node shapes
│   └── utils/            localStorage persistence helpers
├── index.html            Vite entry page
├── vite.config.js        Vite + Vitest config (build output: build/)
├── playwright.config.js  Playwright config
├── eslint.config.js      ESLint flat config
├── Dockerfile            Node 24 build stage + nginx runtime
├── docker-compose.yml    serves the app on port 8083
└── wrangler.jsonc        Cloudflare Workers config (staging environment)
```

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
