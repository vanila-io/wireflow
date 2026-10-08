// ponytail: kill switch for the service worker the old Create React App build
// registered at /service-worker.js. Browsers of existing visitors keep polling
// this URL for updates; serving a worker that unregisters itself and reloads
// open tabs evicts the stale cached CRA shell. Safe to delete once old visitors
// have cycled through (no app code registers a service worker any more).
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration
      .unregister()
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((client) => client.navigate(client.url)))
  );
});
