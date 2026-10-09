import { test, expect, saved, templates, openEditor, onCanvas, dropTemplate } from './helpers.js';

// The registration's active worker state, e.g. 'activated'.
const workerState = (page) =>
  page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.active?.state ?? null));

async function waitForOfflineReady(page) {
  await expect.poll(() => workerState(page), { timeout: 15_000 }).toBe('activated');
}

const brokenImages = (page) =>
  templates(page).evaluateAll((imgs) => imgs.filter((img) => !img.complete || img.naturalWidth === 0).length);

const missingIcons = (page) =>
  page
    .locator('.toolbar use, .export use')
    .evaluateAll((uses) =>
      uses.map((use) => use.getAttribute('xlink:href')).filter((href) => !document.getElementById(href.slice(1))),
    );

test('manifest is linked and makes the app installable', async ({ page, request }) => {
  await openEditor(page);

  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const manifest = await (await request.get(href)).json();
  expect(manifest).toMatchObject({
    name: 'Wireflow',
    short_name: 'Wireflow',
    start_url: '/',
    scope: '/',
    display: 'standalone',
  });
  const sizes = manifest.icons.filter((icon) => icon.type === 'image/png').map((icon) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok(), icon.src).toBe(true);
    expect(response.headers()['content-type'], icon.src).toBe(icon.type);
  }

  // Chrome's own installability check (what DevTools > Application > Manifest shows).
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
});

test('after the first visit the editor works offline', async ({ page, context }) => {
  await openEditor(page);
  await waitForOfflineReady(page);
  await page.reload();
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(/\/service-worker\.js$/);

  await context.setOffline(true);
  const responses = [];
  page.on('response', (response) => responses.push(response));
  await openEditor(page);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);

  expect(await templates(page).count()).toBeGreaterThanOrEqual(100);
  await expect.poll(() => brokenImages(page)).toBe(0);
  await expect.poll(() => missingIcons(page)).toEqual([]);
  expect(await page.locator('.toolbar use').count()).toBe(14);
  // Everything, including the page itself, came out of the service worker's cache.
  expect(responses.length).toBeGreaterThan(100);
  expect(responses.filter((r) => !r.fromServiceWorker()).map((r) => r.url())).toEqual([]);

  const CART = 19;
  await dropTemplate(page, CART, await onCanvas(page, 400, 300));
  await expect.poll(() => saved(page)).toMatchObject({ nodes: [{ label: 'Cart', x: 400, y: 300 }] });
});

test('a new deploy is offered as an update and reloading switches to it', async ({ page, context }) => {
  // Install a worker with different bytes, standing in for the previous deploy.
  // (Playwright can route the first fetch of a worker script, not update checks.)
  const current = await (await context.request.get('/service-worker.js')).text();
  await context.route('**/service-worker.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: `${current}\n// previous build\n` }),
  );
  await openEditor(page);
  await waitForOfflineReady(page);

  // The current build is deployed and the browser checks for an update.
  await context.unrouteAll();
  await page.evaluate(() => {
    window.beforeUpdate = true;
    return navigator.serviceWorker.getRegistration().then((r) => r.update());
  });

  const prompt = page.locator('.ant-notification-notice').filter({ hasText: 'Update available' });
  await expect(prompt).toBeVisible({ timeout: 15_000 });
  // Nothing changes until the user asks for it.
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => Boolean(r.waiting)))).toBe(true);

  const reloaded = page.waitForEvent('load');
  await prompt.getByRole('button', { name: 'Reload' }).click();
  await reloaded;
  await expect(page.locator('#canvas_1')).toBeVisible();
  expect(await page.evaluate(() => window.beforeUpdate)).toBeUndefined();
  expect(
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => [Boolean(r.waiting), r.active.state])),
  ).toEqual([false, 'activated']);
  await expect(prompt).toHaveCount(0);
});

// Returning visitors of the old Create React App build have a Workbox worker
// registered at /service-worker.js that serves a cached CRA shell.
const LEGACY_CACHE = 'workbox-precache-v2-legacy';
const LEGACY_SHELL = `<!doctype html><title>Legacy CRA shell</title><p id="legacy">old build</p>
<script>navigator.serviceWorker.register('/service-worker.js');</script>`;
const LEGACY_WORKER = `
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open('${LEGACY_CACHE}').then((cache) =>
    cache.put('/index.html', new Response(${JSON.stringify(LEGACY_SHELL)}, { headers: { 'content-type': 'text/html' } }))));
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') event.respondWith(caches.match('/index.html'));
});`;

test('the old CRA service worker is replaced by the new one', async ({ page, context }) => {
  await context.route('**/service-worker.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: LEGACY_WORKER }),
  );
  await context.route('/', (route) => route.fulfill({ contentType: 'text/html', body: LEGACY_SHELL }));
  await page.goto('/');
  await waitForOfflineReady(page);
  await page.reload();
  await expect(page.locator('#legacy')).toBeVisible(); // served by the legacy worker
  expect(await page.evaluate(() => caches.keys())).toEqual([LEGACY_CACHE]);

  // The new build is deployed. The stale shell re-registers /service-worker.js,
  // which makes the browser fetch the new worker; it takes over and reloads the tab.
  await context.unrouteAll();
  await page.reload();
  await expect(page.locator('#canvas_1')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => brokenImages(page)).toBe(0);

  const registrations = await page.evaluate(() =>
    navigator.serviceWorker.getRegistrations().then((rs) => rs.map((r) => [r.scope, r.active?.scriptURL, Boolean(r.waiting)])),
  );
  const origin = new URL(page.url()).origin;
  expect(registrations).toEqual([[`${origin}/`, `${origin}/service-worker.js`, false]]);
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.length).toBeGreaterThan(0);
  expect(cacheNames.filter((name) => !name.startsWith('wireflow-'))).toEqual([]);
});
