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

const origin = (page) => new URL(page.url()).origin;
const cacheNames = (page) => page.evaluate(() => caches.keys());

// Open the editor under a worker with different bytes, standing in for the
// previous deploy; the real worker then arrives as an update. (Playwright can
// route the first fetch of a worker script, not the browser's update checks.)
async function openPreviousBuild(page, context) {
  const current = await (await context.request.get('/service-worker.js')).text();
  await context.route('**/service-worker.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: `${current}\n// previous build\n` }),
  );
  await openEditor(page);
  await waitForOfflineReady(page);
  await context.unrouteAll();
}

// The current build is deployed and the browser checks for an update.
const checkForUpdate = (page) =>
  page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));

const updatePrompt = (page) => page.locator('.ant-notification-notice').filter({ hasText: 'Update available' });

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
  await openPreviousBuild(page, context);
  // A cache the app doesn't own (another feature, a library) is left alone and
  // doesn't make the update skip the prompt.
  await page.evaluate(() => caches.open('not-wireflow').then(() => {}));
  await page.evaluate(() => (window.beforeUpdate = true));
  await checkForUpdate(page);

  const prompt = updatePrompt(page);
  await expect(prompt).toBeVisible({ timeout: 15_000 });
  // Nothing changes until the user asks for it.
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => Boolean(r.waiting)))).toBe(true);
  expect(await page.evaluate(() => window.beforeUpdate)).toBe(true);

  // The new build is already downloaded: switching to it needs no network.
  await context.setOffline(true);
  const reloaded = page.waitForEvent('load');
  await prompt.getByRole('button', { name: 'Reload' }).click();
  await reloaded;
  await expect(page.locator('#canvas_1')).toBeVisible();
  expect(await page.evaluate(() => window.beforeUpdate)).toBeUndefined();
  expect(
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => [Boolean(r.waiting), r.active.state])),
  ).toEqual([false, 'activated']);
  await expect(prompt).toHaveCount(0);
  expect(await cacheNames(page)).toContain('not-wireflow');
});

test('reloading into an update in one tab reloads the other open tabs too', async ({ page, context }) => {
  await openPreviousBuild(page, context);
  const other = await context.newPage();
  const errors = [];
  other.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  other.on('pageerror', (error) => errors.push(error.message));
  await openEditor(other);
  await other.evaluate(() => (window.beforeUpdate = true));
  await checkForUpdate(page);
  await expect(updatePrompt(page)).toBeVisible({ timeout: 15_000 });
  await expect(updatePrompt(other)).toBeVisible({ timeout: 15_000 });

  // The new worker takes over both tabs; the other one must not stay on the old
  // build with a Reload button that has nothing left to activate.
  const otherReloaded = other.waitForEvent('load');
  await updatePrompt(page).getByRole('button', { name: 'Reload' }).click();
  await otherReloaded;
  await expect(other.locator('#canvas_1')).toBeVisible();
  expect(await other.evaluate(() => window.beforeUpdate)).toBeUndefined();
  await expect(updatePrompt(other)).toHaveCount(0);
  expect(errors).toEqual([]);
});

// Returning visitors of the old Create React App build have a Workbox 4 worker
// at /service-worker.js. This stand-in behaves like the one react-scripts 3.4
// generated: a precache named with Workbox's default prefix, clients.claim(),
// no skipWaiting() (only on a SKIP_WAITING message, which the CRA page never
// sent), and navigations answered with the cached CRA shell.
const LEGACY_SHELL = `<!doctype html><title>Legacy CRA shell</title><p id="legacy">old build</p>
<script>addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js'));</script>`;
const LEGACY_WORKER = `
const PRECACHE = 'workbox-precache-v2-' + self.registration.scope;
const SHELL = '/index.html?__WB_REVISION__=legacy';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PRECACHE).then((cache) =>
    cache.put(SHELL, new Response(${JSON.stringify(LEGACY_SHELL)}, { headers: { 'content-type': 'text/html' } }))));
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') event.respondWith(caches.open(PRECACHE).then((cache) => cache.match(SHELL)));
});`;
const legacyPrecache = (page) => `workbox-precache-v2-${origin(page)}/`;

test('the old CRA service worker is replaced and its open tab reloaded', async ({ page, context }) => {
  await context.route('**/service-worker.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: LEGACY_WORKER }),
  );
  await context.route('/', (route) => route.fulfill({ contentType: 'text/html', body: LEGACY_SHELL }));
  await page.goto('/');
  await waitForOfflineReady(page);
  await page.reload();
  await expect(page.locator('#legacy')).toBeVisible(); // served by the legacy worker
  expect(await cacheNames(page)).toEqual([legacyPrecache(page)]);

  // The new build is deployed. Opening the app still shows the CRA shell (the
  // CRA worker answers the navigation), but the browser then fetches
  // /service-worker.js, and the new worker takes over and reloads the tab.
  await context.unrouteAll();
  const navigations = [];
  page.on('framenavigated', (frame) => frame === page.mainFrame() && navigations.push(frame.url()));
  await page.reload();
  await expect(page.locator('#canvas_1')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => brokenImages(page)).toBe(0);
  expect(navigations).toHaveLength(2); // our reload, then the worker's

  const registrations = await page.evaluate(() =>
    navigator.serviceWorker.getRegistrations().then((rs) => rs.map((r) => [r.scope, r.active?.scriptURL, Boolean(r.waiting)])),
  );
  expect(registrations).toEqual([[`${origin(page)}/`, `${origin(page)}/service-worker.js`, false]]);
  expect(await cacheNames(page)).toEqual([`wireflow-precache-v2-${origin(page)}/`]);
});

test('a CRA precache left behind by the old kill switch is deleted without reloading the page', async ({ page }) => {
  // The kill switch unregistered the CRA worker but kept its caches. Seed one
  // from a page that registers no worker.
  await page.route('**/seed', (route) => route.fulfill({ contentType: 'text/html', body: '<title>seed</title>' }));
  await page.goto('/seed');
  await page.evaluate((name) => caches.open(name).then((c) => c.put('/index.html', new Response('old'))), legacyPrecache(page));

  const navigations = [];
  page.on('framenavigated', (frame) => frame === page.mainFrame() && navigations.push(frame.url()));
  await openEditor(page);
  await waitForOfflineReady(page);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  expect(await cacheNames(page)).toEqual([`wireflow-precache-v2-${origin(page)}/`]);
  expect(navigations).toHaveLength(1); // only openEditor's
});
