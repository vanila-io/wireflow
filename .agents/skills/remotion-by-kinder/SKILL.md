---
name: remotion-by-kinder
description: Unified Remotion video production skill: build promo/demo videos from scratch (brand assets, scene anatomy, TTS voiceover, remocn), capture and animate live webpages in Remotion (Playwright DOM capture, iframe + staticFile), headless Chrome rendering fixes, still-frame visual QA, Next.js Player integration, and Cloudflare 25MB deployment budgeting. Use when the user wants to create, render, animate, QA, fix, or deploy any Remotion video: promo videos, product demos, webpage-to-video capture, voiceover sync, render crashes, hydration errors, or oversized MP4s.
---

# Remotion by Kinder

One pipeline for shipping Remotion videos: produce a promo from scratch (Path A), animate a real webpage (Path B), then render, QA, and deploy. Every rule below came from real renders that broke; do not skip the QA gate or the asset budget.

## Pick your path first

- **Path A (produce from scratch):** promo/demo video built from brand assets, scripted scenes, TTS voiceover. Use when the product UI will be simulated (chat prompt, terminal, browser frame) or the video is mostly motion graphics.
- **Path B (capture a real page):** animate a live website's actual DOM inside Remotion. Use when the user wants the real landing page in the video, the site has JS-rendered canvas/WebGL, or you are turning logged-in app states into a storyboard. Never rebuild a page you can capture.
- Most projects use A for hook/CTA scenes and B for the product reveal.

---

# PATH A: Produce a promo/demo video

## 1. Discovery and design system

- Crawl the target product URL or repo for high-res brand assets. Use app icons at 512px or larger; header wordmarks pixelate when scaled.
- Theme rule: logo/positioning scenes on white background use dark text + icon; hook/CTA scenes on dark background (#0a0a0a) use light text + icon.
- Strict color system: dark #0a0a0a, light #fafafa, plus ONE accent color taken from the brand logo. No multi-color gradients, no heavy background glow halos. That combination reads as AI slop.

## 2. Scene structure (product demo anatomy, ~43s at 30fps)

| Beat | Time | Content |
|------|------|---------|
| Hook | 0-6s | Problem statement, the busywork pain point |
| Positioning | 6-11s | "Meet [Product]", one-line tagline, crisp logo |
| Product Reveal | 11-17s | Real-looking UI simulation: chat prompt, terminal, or browser frame |
| Features | 17-24s | 2-4 concrete capabilities, routing or execution steps |
| Proof & Scale | 24-31s | Concrete metric count-up (1,000+ URLs, batch mode) |
| Privacy/Security | 31-37s | Real UI screenshot in a browser frame + privacy promise |
| CTA | 37-43s | Logo lockup, value prop pill, domain link |

Scale timings proportionally for shorter cuts; keep the beat order.

## 3. remocn (shadcn-for-video)

- Install components with `npx shadcn add @remocn/<component-name>`.

Headless Chrome anti-patterns, all observed as real crashes or broken frames:

- NEVER use components that rely on DOM text measurement (`measureWidths`, `KineticCenterBuild`). Text renders transparent and overlaps in headless renderers. Use custom spring word reveals with fixed container widths (`width: 1080, justifyContent: "center"`).
- NEVER use `useTypewriter` + `Caret`, and avoid special unicode characters (checkmarks, em dashes). Both crash the deterministic headless Chrome renderer. Inline typing logic with simple string slicing: `text.slice(0, Math.floor(frame * speed))`.
- Count-up numbers: use `fontVariantNumeric: "tabular-nums"` with simple linear/spring interpolation so layout stays stable.

## 4. React inline style strictness

Remotion components take plain React CSS properties. Tailwind-style shorthand names fail silently or throw:

- `justifyContent: "space-between"` (not `justifyBetween`)
- `alignItems: "center"` (not `itemsCenter`)
- `fontFamily: "monospace"` (not `fontMono`)
- `fontWeight: 800` (numeric or strict string)

---

# AUDIO (both paths)

## Voiceover

- Generate per-scene VO with Kokoro TTS (Hugging Face) or equivalent quality TTS. Use the media tool's `text_to_speech` in this environment; Kokoro-82M is the default.
- Measure the actual file duration before hardcoding scene lengths: `ffprobe` or a small Node script. Then:

  `durationInFrames = Math.ceil(audioDurationSeconds * fps)`

- Drive `SCENE_FRAMES` dynamically from measured VO durations. Never hand-guess durations; visuals and audio must stay locked.

## Background music

- Trim music tracks with a static ffmpeg binary before shipping so the bundle stays under the 25MB deployment cap.
- In Remotion: background music at 30-40% gain (`volume={0.15}` to `volume={0.3}`), VO at `volume={1.0}`. Apply a 1.5s fade-in and 2.0s fade-out.
- Wire music and narration with `<Sequence from={frameOffset}>` so they sync with scenes.

---

# PATH B: Webpage capture and animate

## Core principle

Do not recreate the page in Remotion. Capture the fully-rendered DOM after JS runs, inline every external asset so the file is 100% offline, freeze JS canvases into static images, strip hydration scripts, then load it in a Remotion iframe and animate real DOM nodes driven by `useCurrentFrame`.

## Why simpler approaches fail

| Approach | Failure mode |
|----------|-------------|
| `fetch(url)` + regex CSS | JS never runs: canvas backgrounds, lazy images, injected styles missing |
| Inlining only `<link rel="stylesheet">` from raw HTML | Next.js/Vercel injects CSS chunks and font URLs at runtime; relative font paths break |
| Keeping `<script src="/_next/...">` | React/Next hydration wipes the captured DOM to a blank shell |
| `document.documentElement.className = 'dark'` | Overwrites font-variable classes, produces invalid duplicate `class` attributes |
| Raw relative iframe `src="/captured.html"` | Remotion bundler 404s. Must use `staticFile("captured.html")` from `"remotion"` |
| Waiting only on iframe `onLoad` | Cached iframes may miss `onLoad`. Guard with `contentDocument?.readyState === "complete"` |
| One giant iframe per scene | A 10MB HTML loaded 5+ times causes memory spikes and dropped frames |

## Capture script (Playwright, DOM surgery inside the browser)

Run the surgery inside `page.evaluate()` so you avoid CORS, can read computed styles, and can call `canvas.toDataURL()` on tainted canvases.

```js
const { chromium } = require('playwright');
const fs = require('fs');

const TARGET_URL = 'https://example.com';
const OUTPUT_FILE = './public/captured.html';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(4000); // let JS animations/canvas settle

  await page.evaluate(async () => {
    const toB64 = async (url) => {
      try {
        const res = await fetch(url, { credentials: 'omit' });
        if (!res.ok) return null;
        const blob = await res.blob();
        return new Promise((resolve) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result);
          r.readAsDataURL(blob);
        });
      } catch { return null; }
    };

    // 1. Inline stylesheets and their url(...) assets
    for (const link of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) {
      const href = link.href;
      if (!href || href.startsWith('data:')) continue;
      try {
        const res = await fetch(href, { credentials: 'omit' });
        let css = await res.text();
        // Resolve font/image URLs relative to the CSS file
        for (const m of css.matchAll(/url\(['"]?([^'"\)\s]+)['"]?\)/g)) {
          const raw = m[1];
          if (raw.startsWith('data:')) continue;
          const assetUrl = new URL(raw, href).href;
          const b64 = await toB64(assetUrl);
          if (b64) css = css.split(raw).join(b64);
        }
        const style = document.createElement('style');
        style.textContent = `/* inlined from ${href} */\n${css}`;
        link.replaceWith(style);
      } catch {}
    }

    // 2. Inline images (src, poster, srcset first candidate)
    for (const el of Array.from(document.querySelectorAll('img, source, video, audio'))) {
      for (const attr of ['src', 'poster']) {
        const val = el.getAttribute(attr);
        if (val && !val.startsWith('data:') && !val.startsWith('blob:')) {
          const b64 = await toB64(new URL(val, location.href).href);
          if (b64) el.setAttribute(attr, b64);
        }
      }
      const srcset = el.getAttribute('srcset');
      if (srcset && !srcset.startsWith('data:')) {
        const first = srcset.split(',')[0].trim().split(' ')[0];
        const b64 = await toB64(new URL(first, location.href).href);
        if (b64) el.setAttribute('srcset', b64);
      }
    }

    // 3. Freeze JS-rendered canvas backgrounds
    const canvas = document.querySelector('canvas.absolute.inset-0') || document.querySelector('canvas');
    if (canvas) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = 'captured hero background';
        img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;';
        canvas.replaceWith(img);
      } catch {}
    }

    // 4. Strip ALL framework/hydration scripts
    for (const script of Array.from(document.querySelectorAll('script'))) {
      const src = script.getAttribute('src') || '';
      const id = script.getAttribute('id') || '';
      const text = script.textContent || '';
      if (
        src.includes('/_next/') ||
        id.startsWith('_next') ||
        script.hasAttribute('data-nscript') ||
        text.includes('__NEXT_DATA__') ||
        text.includes('__next_f') ||
        text.includes('__next_s') ||
        text.includes('next-route-announcer') ||
        text.includes('data-nextjs-scroll-focus-boundary')
      ) {
        script.remove();
      }
    }
    // JSON-LD/schema scripts are safe to keep; remove empty script tags
    for (const script of Array.from(document.querySelectorAll('script'))) {
      if (!script.textContent?.trim() && !script.getAttribute('src')) {
        script.remove();
      }
    }

    // 5. Lock theme WITHOUT destroying font classes
    document.documentElement.classList.add('dark');
    document.documentElement.style.background = '#07090e';
    document.documentElement.style.colorScheme = 'dark';
    document.body.style.background = '#07090e';
    document.body.style.color = '#e2e8f0';
    document.body.style.overflowX = 'hidden';

    // 6. Remove resource-hint links and CSP meta (they 404 offline)
    for (const link of Array.from(document.querySelectorAll('link[rel="preload"], link[rel="prefetch"], link[rel="preconnect"], link[rel="dns-prefetch"]'))) {
      link.remove();
    }
    for (const meta of Array.from(document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]'))) {
      meta.remove();
    }
  });

  const html = await page.evaluate(() => {
    const dt = document.doctype;
    const doctype = dt ? `<!DOCTYPE ${dt.name}>` : '<!DOCTYPE html>';
    return doctype + document.documentElement.outerHTML;
  });

  fs.writeFileSync(OUTPUT_FILE, html);
  await browser.close();
}

capture().catch(console.error);
```

## Verify the capture before touching Remotion

Run on `captured.html` (Python or Node equivalent):

```python
import re
html = open('public/captured.html').read()
print('Size MB:', round(len(html)/1024/1024, 2))
print('Stylesheet links:', len(re.findall(r'<link[^>]*stylesheet', html)))
print('Script tags:', len(re.findall(r'<script', html)))
print('Canvas tags:', len(re.findall(r'<canvas', html)))
print('Base64 images:', len(re.findall(r'data:image', html)))
print('Base64 fonts:', len(re.findall(r'url\(data:font', html)))
print('Duplicate class attr:', len(re.findall(r'<html[^>]*class=[^>]*class=', html)))
print('Preload links:', len(re.findall(r'<link[^>]*rel="(?:preload|prefetch|preconnect|dns-prefetch)"', html)))
```

Healthy capture: stylesheet links = 0, canvas tags = 0, base64 images > 0, base64 fonts > 0, duplicate class attr = 0, preload links = 0.

Then open the file standalone (`npx serve public`, open `/captured.html`). If logo, hero background, fonts, or colors are wrong, fix the capture and rerun. Do not proceed until the static file looks correct.

Most common capture mistakes: forgetting to strip `data-nscript` scripts, using `className = 'dark'`, not resolving font URLs relative to the CSS file.

## Iframe base component

```tsx
// components/CapturedPageBase.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { AbsoluteFill, staticFile } from "remotion";

interface Props {
  children?: React.ReactNode;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  onLoad?: () => void;
  scrollY?: number;
  scale?: number;
  opacity?: number;
  overlayOpacity?: number;
  vignette?: boolean;
  blur?: number;
}

export const CapturedPageBase: React.FC<Props> = ({
  children, iframeRef: externalRef, onLoad, scrollY = 0,
  scale = 1, opacity = 1, overlayOpacity = 0, vignette = true, blur = 0,
}) => {
  const internalRef = useRef<HTMLIFrameElement>(null);
  const iframeRef = externalRef || internalRef;
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => { setIsLoaded(true); onLoad?.(); };
    if (iframe.contentDocument?.readyState === "complete" && iframe.contentDocument?.body?.children.length) {
      setIsLoaded(true);
      onLoad?.();
    } else {
      iframe.addEventListener("load", handleLoad);
      return () => iframe.removeEventListener("load", handleLoad);
    }
  }, [iframeRef, onLoad]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !isLoaded) return;
    try {
      iframe.contentWindow?.scrollTo({ top: scrollY, behavior: "instant" as ScrollBehavior });
    } catch {}
  }, [scrollY, isLoaded, iframeRef]);

  return (
    <AbsoluteFill className="bg-[#07090e] overflow-hidden relative">
      {!isLoaded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#07090e] text-cyan-400">
          Loading captured page...
        </div>
      )}
      <div style={{ opacity, transform: `scale(${scale})`, transformOrigin: "center top", filter: blur > 0 ? `blur(${blur}px)` : undefined }}>
        <iframe ref={iframeRef} src={staticFile("captured.html")} className="w-full h-full border-0 bg-[#07090e]" style={{ pointerEvents: "none" }} />
      </div>
      {vignette && <div className="absolute inset-0 pointer-events-none z-20" style={{ background: "radial-gradient(circle at center, transparent 30%, rgba(7,9,14,0.55) 100%)" }} />}
      {overlayOpacity > 0 && <div className="absolute inset-0 pointer-events-none z-20 bg-[#07090e]" style={{ opacity: overlayOpacity }} />}
      {children && <div className="absolute inset-0 z-30 pointer-events-none">{children}</div>}
    </AbsoluteFill>
  );
};
```

## Animating captured DOM nodes

Drive animation from `useCurrentFrame`; mutate the iframe document in `useEffect`:

```tsx
// inside a scene component
const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const iframeRef = useRef<HTMLIFrameElement>(null);
const [isLoaded, setIsLoaded] = useState(false);

const badgeScale = spring({ frame, fps, config: { damping: 14, stiffness: 100 } });
const titleY = interpolate(frame, [10, 45], [50, 0], { extrapolateLeft: "clamp" });

useEffect(() => {
  const doc = iframeRef.current?.contentDocument;
  if (!doc || !isLoaded) return;
  const badgeXpath = doc.evaluate(
    "//*[contains(text(), '11 AI Agents')]",
    doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
  ).singleNodeValue as HTMLElement;
  const badge = badgeXpath?.closest("div[class*='inline-flex']") as HTMLElement || badgeXpath;
  if (badge) {
    badge.style.transform = `scale(${badgeScale})`;
    badge.style.opacity = `${interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp" })}`;
    badge.style.transition = "none";
  }
  const h1 = doc.querySelector("h1");
  if (h1) {
    h1.style.transform = `translate3d(0, ${titleY}px, 0)`;
    h1.style.opacity = `${interpolate(frame, [10, 45], [0, 1], { extrapolateLeft: "clamp" })}`;
    h1.style.transition = "none";
  }
}, [frame, isLoaded, badgeScale, titleY]);
```

DOM manipulation rules:

1. Always guard with `if (!doc || !isLoaded) return;`
2. Always set `transition = "none"` on manipulated elements so Remotion owns every frame
3. Animate `transform` and `opacity` only; avoid `width`/`height`/`top`/`left` to prevent layout thrash
4. Prefer `querySelector` for stable selectors; use XPath only as text-based fallback
5. Test selectors against the captured file in a browser console before writing Remotion code

## Composition and memory

Chain scenes with `Series`. For heavy captures, prefer ONE shared iframe that never unmounts (scenes control scroll and overlays), or split the capture into per-section files (`hero.html`, `agents.html`) if scenes are independent. Loading the same 10MB capture in multiple iframes per scene causes dropped frames.

## Recorded journeys (logged-in/app pages)

For pages behind login, drive the browser through the journey first (see the `browser-batch-automation` skill for selector-driven navigation), then capture after each meaningful state:

```js
await page.goto('https://app.example.com/login');
await page.fill('input[type="email"]', process.env.EMAIL);
await page.fill('input[type="password"]', process.env.PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');

await capturePageState(page, 'dashboard', 0);
await page.click('text=Agents');
await capturePageState(page, 'agents', 1);
```

Each captured state becomes a Remotion scene. Store journey metadata (`scrollY`, `clickTarget`, `typedText`) in `storyboard.json` so the video replays the actions visually. For dynamic backend reports (analyzers, form tools): submit via Playwright, wait for the API response to render, save a verification screenshot, and dump the resulting DOM to a separate static file.

---

# RENDERING

## Headless Linux container fix (missing Chrome libs)

If the render box lacks `libnss3`/`libnspr4` and you have no root: extract the deb packages into `.chrome-libs/` and pass the library path to the renderer:

```bash
LD_LIBRARY_PATH=.chrome-libs/usr/lib/aarch64-linux-gnu npx remotion render remotion/index.ts MyComposition public/output.mp4
```

(Adjust the path suffix for the box architecture.) Use `--concurrency=1` for WebGL shader scenes or resource-constrained machines.

## QA gate (mandatory, before any full render)

Still-frame QA, every scene:

```bash
npx remotion still remotion/index.ts MyComposition public/qa/scene_N.png --frame=<F>
```

Inspect every still with a vision tool (`viewImage`) and check font sizes, layout bounds, text centering, contrast, spacing. For timeline-wide validation, run a headless Playwright script that seeks the `<Player>` page and screenshots representative frame offsets (e.g. 100, 600, 1200, 1800), then inspect those the same way.

Never run the full video render before the stills pass. Re-render stills after any fix.

## Next.js integration

- Wrap `<Player>` in an `isMounted` gate. `@remotion/player` uses browser DOM measurements and window APIs that differ from server-rendered HTML:

```tsx
const [isMounted, setIsMounted] = useState(false);
useEffect(() => setIsMounted(true), []);
return isMounted ? <Player component={MyVideo} ... /> : <LoadingPlaceholder />;
```

- On the showcase page, embed the `<Player>` for interactive preview and offer a direct download button for the rendered `.mp4` in `public/`.

## Cloudflare Workers 25MiB asset budget

- Individual static assets in `public/` cap at 25MiB on Workers/OpenNext. Budget VO + music + MP4 together.
- Render with compression: `--crf 26` or `--crf 28`. CRF 28 takes 1080p from ~27MB to ~10-12MB with no visible quality loss:

```bash
npx remotion render remotion/index.ts MyComposition public/output.mp4 --crf 28 --overwrite
```

- If a rendered asset still exceeds 25MB, drop resolution or bitrate; do not deploy and hope.

---

# Troubleshooting checklist

- Capture opens correctly standalone; no stylesheet links, hydration scripts, or resource-hint links remain
- Hero canvas frozen to `<img>`; logo visible as base64; no duplicate class attribute
- Scene waits for iframe load before touching `contentDocument`; selectors tested against the capture first
- VO durations measured with ffprobe; scene frames driven from them; music ducked with fades
- No `measureWidths` components, no `useTypewriter` + `Caret`, no unicode glyphs in text
- React CSS properties used (no Tailwind shorthand in style objects)
- Per-scene stills inspected with vision before full render
- `<Player>` behind `isMounted` gate; MP4 under 25MB with `--crf 26/28`

# Cross-linked skills

- `browser-batch-automation`: navigating, logging in, capturing multiple page states
- `media-generation-craft`: generating background music and TTS narration
- `web-research-toolcraft`: inspecting the target site and finding the right selectors
- `web3d-integration-patterns`: combining Remotion with GSAP/R3F when scenes need richer motion
