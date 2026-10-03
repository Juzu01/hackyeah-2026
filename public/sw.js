// Service worker for the atlas (/cialo/). Hand-written and small:
// - pages: network first, so a deploy shows up on the next visit; the cached
//   page is the fallback offline;
// - hashed build assets, fonts, icons and the 3D model: cache first;
// - anything cross-origin (Supabase) or not a GET: left alone.
// The cache is named after the build (sw.js?v=<commit>), so each deploy starts
// a fresh cache and the old ones are dropped on activate.

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE = `atlas-${VERSION}`

self.addEventListener('install', (event) => {
  // The app's page, so the first visit already works offline next time.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(self.registration.scope)).catch(() => {}))
  self.skipWaiting()
})

// The page sends what it loaded before this worker took over (scripts, fonts, the
// model), so those are cached from the first visit rather than the second.
self.addEventListener('message', (event) => {
  const urls = event.data?.warm
  if (!Array.isArray(urls)) return
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      for (const href of urls) {
        const url = new URL(href, self.location.href)
        if (url.origin !== self.location.origin || !CACHE_FIRST.test(url.pathname)) continue
        if (await cache.match(url.href, { ignoreSearch: true })) continue
        await cache.add(url.href).catch(() => {})
      }
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith('atlas-') && k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

const CACHE_FIRST = /\/assets\/|\/icons\/|\.(?:glb|woff2?|png|svg|webmanifest)$/

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (request.mode === 'navigate') event.respondWith(networkFirst(event))
  else if (CACHE_FIRST.test(url.pathname)) event.respondWith(cacheFirst(event))
})

async function networkFirst(event) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(event.request)
    // One copy of the page is enough: it's a single-page app.
    if (response.ok) event.waitUntil(cache.put(self.registration.scope, response.clone()))
    return response
  } catch (err) {
    const cached = await cache.match(self.registration.scope)
    if (cached) return cached
    throw err
  }
}

async function cacheFirst(event) {
  const { request } = event
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request, { ignoreSearch: true })
  if (cached) return cached
  const response = await fetch(request)
  // Stored in the background: the page streams the response meanwhile (the model's progress bar).
  if (response.ok) event.waitUntil(cache.put(request, response.clone()))
  return response
}
