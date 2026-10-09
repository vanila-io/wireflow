// The offline editor (#110): public/sw.js, written by tools/build-sw.mjs.
import { readFileSync } from 'node:fs';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect, openEditor, saved } from './fixtures';

const workerReady = (page: Page) =>
  page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.scope;
  });
const controlled = (page: Page) => page.evaluate(() => !!navigator.serviceWorker.controller);
const cacheNames = (page: Page) => page.evaluate(() => caches.keys());

async function installed(page: Page) {
  await openEditor(page);
  expect(await workerReady(page)).toMatch(/\/app$/);
  // The first install takes control without a reload (clients.claim).
  await expect.poll(() => controlled(page)).toBe(true);
}

test('after one visit the editor loads and works offline; nothing outside /app is controlled', async ({ page, context, baseURL }) => {
  await installed(page);
  await context.setOffline(true);
  const fromNetwork: string[] = [];
  page.on('response', (r) => !r.fromServiceWorker() && r.url().startsWith(baseURL!) && fromNetwork.push(r.url()));
  await page.goto('/app?card=e-commerce-cart');
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.locator('.react-flow__node img')).toHaveJSProperty('complete', true);
  await page.locator('aside button[draggable="true"]').nth(10).click();
  await expect.poll(async () => (await saved(page))?.nodes.length).toBe(2);
  expect(fromNetwork).toEqual([]);
  // Every template is available offline.
  const missing = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('aside img')].map((i) => (i as HTMLImageElement).src);
    const bad = [];
    for (const src of imgs) if (!(await fetch(src)).ok) bad.push(src);
    return bad;
  });
  expect(missing).toEqual([]);

  await context.setOffline(false);
  await page.goto('/');
  expect(await controlled(page)).toBe(false);
});

test.describe('pages outside /app', () => {
  test.use({ allowErrors: /Failed to load resource|ERR_INTERNET_DISCONNECTED|NS_ERROR_OFFLINE/ });

  test('the landing page and /blog/ are never answered by the worker', async ({ page, context }) => {
    await installed(page);
    await context.setOffline(true);
    for (const path of ['/', '/blog/', '/blog/a-post/']) {
      await expect(page.goto(path), path).rejects.toThrow(/ERR_INTERNET_DISCONNECTED|NS_ERROR_OFFLINE/);
    }
  });
});

// Playwright routes a worker's script and the worker's own requests in Chromium only.
const ONLY_CHROMIUM = 'routes service worker scripts and requests (Chromium only in Playwright)';

// The worker of an earlier build: the real one with another version.
const previousBuild = (context: BrowserContext) =>
  context.route('**/sw.js', async (route) => {
    const real = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
    await route.fulfill({ contentType: 'text/javascript', body: real.replace(/const VERSION = "[^"]+"/, 'const VERSION = "previous"') });
  });

test('a new deploy is offered as an update; Reload switches every tab that was offered it', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', ONLY_CHROMIUM);
  // Playwright can route a worker script's first fetch, not the browser's later
  // update checks: install a stand-in for the previous build, then let the real
  // worker arrive as the update.
  await previousBuild(context);
  await installed(page);
  await context.unroute('**/sw.js');
  expect(await cacheNames(page)).toEqual(['wireflow-precache-previous']);
  const other = await context.newPage();
  await other.goto('/app');
  await expect.poll(() => controlled(other)).toBe(true);

  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/app'))!.update());
  const prompt = (p: Page) => p.getByRole('status').filter({ hasText: 'A new version of Wireflow is available.' });
  await expect(prompt(page)).toBeVisible({ timeout: 15_000 });
  await expect(prompt(other)).toBeVisible({ timeout: 15_000 });
  // Nothing changes until Reload is clicked.
  expect(await cacheNames(page)).toContain('wireflow-precache-previous');

  // A label being typed is saved by the reload (the click blurs it first).
  await page.locator('aside button[draggable="true"]').first().click();
  await page.locator('.flow-node-header button').dblclick();
  await page.getByRole('textbox', { name: 'Card header' }).fill('Typed before reload');
  const reloads = Promise.all([page.waitForEvent('load'), other.waitForEvent('load')]);
  await prompt(page).getByRole('button', { name: 'Reload' }).click();
  await reloads;
  await expect.poll(() => cacheNames(page)).not.toContain('wireflow-precache-previous');
  expect(await cacheNames(page)).toHaveLength(1);
  await expect(page.locator('.flow-node-header')).toHaveText('Typed before reload');
  await expect(prompt(page)).toHaveCount(0);
  await expect(prompt(other)).toHaveCount(0);
});

test('an install that gets an HTML page instead of a script fails instead of caching it', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', ONLY_CHROMIUM);
  // A host that answers a missing file with a page (SPA fallback, a login page).
  await context.route('**/_next/static/chunks/*.js', async (route) => {
    if (route.request().serviceWorker()) return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>fallback</title>' });
    return route.fallback();
  });
  // Follow the worker the page registers from its first moment.
  await page.addInitScript(() => {
    const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = async (...args) => {
      const reg = await register(...args);
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => ((window as unknown as { swState: string }).swState = worker.state));
      return reg;
    };
  });
  await openEditor(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { swState?: string }).swState)).toBe('redundant');
  expect(await cacheNames(page)).toEqual([]);
  expect(await controlled(page)).toBe(false);
});

test('the switched-off worker (NEXT_PUBLIC_OFFLINE=off) removes itself and its caches and reloads the editor', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', ONLY_CHROMIUM);
  await installed(page);
  expect(await cacheNames(page)).toHaveLength(1);
  // Registering another script URL for the same scope replaces the worker, as a
  // deploy of the switched-off /sw.js does on the next update check.
  await context.route('**/sw.js?off', (route) => route.fulfill({ contentType: 'text/javascript', body: readFileSync(new URL('../tools/sw-off.js', import.meta.url), 'utf8') }));
  // The page a switched-off build serves doesn't register a worker at all.
  await page.addInitScript(() => {
    navigator.serviceWorker.register = () => Promise.reject(new Error('offline support is off'));
  });
  const reload = page.waitForEvent('load');
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js?off', { scope: '/app' }));
  await reload;
  await expect.poll(() => cacheNames(page)).toEqual([]);
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  await expect(page.locator('.react-flow__pane')).toBeVisible();
});
