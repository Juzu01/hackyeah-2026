// Doco's service worker: pages and files always come fresh from the network, and the last copy of each is kept,
// so the app still opens without a connection (the home-screen app on a train, a weak signal at the venue).
const CACHE = 'doco-offline-1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Only this site's files, and not the 3D body models (tens of MB each): those stay with the browser's own cache
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('.glb')) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      return response;
    } catch (err) {
      const saved = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
      if (saved) return saved;
      throw err;
    }
  })());
});
