/* Wireflow's service worker, for the editor at /app only (README "Offline").
 * scripts/build-sw.mjs writes public/sw.js from this file after `next build`,
 * filling in VERSION (the build) and PRECACHE (every file the editor needs).
 *
 * It is registered with scope /app, so it never controls the landing page,
 * /blog/* (Ghost) or anything else on the site. Within /app it answers only:
 * - navigations to /app (any query, e.g. ?card=) with the cached editor page;
 * - same-origin GETs of files in PRECACHE.
 * Everything else, including api.anthropic.com and analytics, goes to the
 * network untouched. A new build installs in the background and waits until
 * the page asks it to take over (the "Update available" prompt).
 */
const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const SHELL = "/app";
const PREFIX = "wireflow-precache-";
const CACHE = PREFIX + VERSION;
const precached = new Set(PRECACHE);
const CONCURRENCY = 4;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const store = async (path) => {
        // Revalidate with the server: an older copy in the HTTP cache must not
        // end up in this build's cache.
        const response = await fetch(path, { cache: "no-cache" });
        if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
        // A server that answers a missing file with a page (an SPA fallback, a
        // login page) must not have that page cached as a script or a style:
        // the install fails and the browser tries again on a later visit.
        if (path !== SHELL && (response.headers.get("content-type") || "").includes("text/html")) {
          throw new Error(`${path}: got an HTML page instead of the file`);
        }
        await cache.put(path, response);
      };
      // A few files at a time, so the install doesn't crowd out the page.
      const queue = [...PRECACHE];
      const worker = async () => {
        for (let path = queue.shift(); path !== undefined; path = queue.shift()) await store(path);
      };
      try {
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      } catch (error) {
        queue.length = 0;
        // Leave nothing half-filled behind; the browser tries again on a later visit.
        await caches.delete(CACHE);
        throw error;
      }
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

// The page's "Reload" button.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    if (url.pathname === SHELL) event.respondWith(fromCache(SHELL, request));
    return;
  }
  if (precached.has(url.pathname)) event.respondWith(fromCache(url.pathname, request));
});

async function fromCache(path, request) {
  const cached = await caches.match(path, { cacheName: CACHE });
  return cached || fetch(request);
}
