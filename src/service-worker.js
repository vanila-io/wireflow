// Offline support. vite-plugin-pwa (injectManifest) bundles this file into
// build/service-worker.js and replaces self.__WB_MANIFEST with every file of the
// build: the app shell, JS/CSS, the template SVGs, icons and the manifest.
//
// ponytail: why this worker lives at /service-worker.js. The old Create React
// App build registered its own Workbox worker at that URL, and the browsers of
// returning visitors keep checking that URL for updates. A browser allows one
// registration per scope, so serving the new worker at the same URL makes it a
// regular update of that registration: no second script URL and no
// unregister/re-register race. Keep this URL forever, and never ship a build
// without it: browsers that installed the app would keep running their cached
// copy, because a missing script fails the update check (Cloudflare answers it
// with index.html, nginx with a 404). To switch offline support off, build with
// `selfDestroying: true` (vite.config.js) and deploy that.
//
// Updates between our own builds wait for the user: the app shows an "Update
// available" prompt (src/components/UpdatePrompt) that sends SKIP_WAITING. The
// CRA worker is the exception, see the install and activate handlers below.
import { addPlugins, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { setCacheNameDetails } from 'workbox-core';

// Our caches are named wireflow-*. Don't drop this prefix: the CRA build's
// Workbox used the default one ('workbox'), and that is how its precache is
// told apart from ours below.
setCacheNameDetails({ prefix: 'wireflow' });
const CRA_PRECACHE = `workbox-precache-v2-${self.registration.scope}`;

// Cloudflare (static assets with SPA not_found_handling) and `vite preview`
// answer a request for a file the deployment doesn't have with index.html and
// status 200. An install that races a deploy would then store that page under
// the URL of a script or image of the build it is installing, and once it took
// over, the app would break (a blank page if it was the main script). Fail the
// install instead; the browser tries again later. This replaces Workbox's
// default check, which only rejects error statuses, so it rejects those too.
addPlugins([
  {
    cacheWillUpdate: async ({ request, response }) => {
      const isHtml = /^text\/html\b/i.test(response.headers.get('content-type'));
      const htmlExpected = new URL(request.url).pathname.endsWith('.html');
      return response.ok && (!isHtml || htmlExpected) ? response : null;
    },
  },
]);

// Workbox keeps one precache across our builds and drops files a new build no
// longer lists when it activates. No cleanupOutdatedCaches(): the only other
// precache that can exist here is CRA's, and activate below must be the one
// that deletes it, because it acts on whether it was there.
precacheAndRoute(self.__WB_MANIFEST);
// The editor is a single page: answer every navigation with the cached shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Replacing the CRA worker: it is still active and its precache is still here.
// Its page never sends SKIP_WAITING, so without this its open tabs would keep
// the old build until every one of them is closed. Take over now.
self.addEventListener('install', (event) => {
  if (!self.registration.active) return; // first install: nothing to replace
  event.waitUntil(caches.has(CRA_PRECACHE).then((found) => found && self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // True if the CRA precache was here: we replaced the CRA worker, or the
      // old kill switch unregistered it and left its cache behind.
      const hadCraPrecache = await caches.delete(CRA_PRECACHE);
      // Before claim(), these are the tabs the replaced worker controlled (none
      // for a first install). If that was the CRA worker, they still run the
      // CRA bundle.
      const craTabs = hadCraPrecache ? await self.clients.matchAll({ type: 'window' }) : [];
      await self.clients.claim();
      // Reload them. Not awaited: this worker answers the reload, and it can't
      // handle fetches until activation (this waitUntil) has finished.
      craTabs.forEach((tab) => tab.navigate(tab.url).catch(() => {}));
    })(),
  );
});

// Sent by the update prompt (workbox-window's messageSkipWaiting).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
