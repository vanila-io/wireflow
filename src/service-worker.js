// Offline support. vite-plugin-pwa (injectManifest) bundles this file into
// build/service-worker.js and replaces self.__WB_MANIFEST with every file of the
// build: the app shell, JS/CSS, the template SVGs, icons and the manifest.
//
// ponytail: why this worker lives at /service-worker.js. The old Create React
// App build registered its own Workbox worker at that URL, and the browsers of
// returning visitors keep checking that URL for updates. A browser allows one
// registration per scope, so serving the new worker at the same URL makes it a
// regular update of that registration: no second script URL, no
// unregister/re-register race, and one URL to keep forever. (Until this change
// the URL served a kill switch that only unregistered the CRA worker.)
// The CRA worker is replaced like this:
//   1. install: if a worker is active and caches that aren't ours exist, that
//      worker is CRA's (ours deletes such caches when it activates), so skip
//      waiting instead of queueing behind a worker that never asks for an update.
//   2. activate: delete every cache that isn't ours (CRA's Workbox precache and
//      runtime caches), take control of open tabs and reload them, because they
//      are still running the stale CRA bundle.
// Updates between our own builds don't skip waiting: the app shows an "update
// available" prompt (src/components/UpdatePrompt) and the user reloads into it.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { setCacheNameDetails } from 'workbox-core';

const PREFIX = 'wireflow';
const isOurs = (cacheName) => cacheName.startsWith(`${PREFIX}-`);

setCacheNameDetails({ prefix: PREFIX });
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches(); // precaches of our previous builds
// The editor is a single page: answer every navigation with the cached shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

let replacingForeignWorker = false;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      replacingForeignWorker = Boolean(self.registration.active) && names.some((name) => !isOurs(name));
      if (replacingForeignWorker) return self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => !isOurs(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
      .then(() => (replacingForeignWorker ? self.clients.matchAll({ type: 'window' }) : []))
      .then((clients) => {
        // Not awaited: the reload is answered by this worker, which can't handle
        // fetches until activation (this waitUntil) has finished.
        clients.forEach((client) => client.navigate(client.url).catch(() => {}));
      }),
  );
});

// Sent by the update prompt (workbox-window's messageSkipWaiting).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
