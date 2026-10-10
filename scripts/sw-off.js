/* Wireflow's service worker, switched off (NEXT_PUBLIC_OFFLINE=off at build).
 * Browsers that installed the offline editor check /sw.js for updates; this
 * version takes over at once, deletes Wireflow's caches, unregisters itself and
 * reloads the open editor tabs, which then load from the network again.
 * Deploy this instead of deleting /sw.js: without a /sw.js to update to,
 * installed browsers would keep serving their cached editor.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith("wireflow-precache-")) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
    })()
  );
});
