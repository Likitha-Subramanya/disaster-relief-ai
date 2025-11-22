const CACHE_NAME = 'reliefai-cache-v2'
const APP_SHELL = [
  '/',
  '/index.html',
  '/favicon.svg'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
})

// Background sync: ask page clients to flush their outbox
self.addEventListener('sync', (event) => {
  if (event.tag === 'rescue-sync') {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'flush-outbox' })
        })
      })
    )
  }
})

// Also respond to a manual ping from the page to propagate a flush signal
self.addEventListener('message', (event) => {
  try {
    const data = event.data || {}
    if (data && data.type === 'sync-outbox') {
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'flush-outbox' })
        })
      })
    }
  } catch {}
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=> k!==CACHE_NAME).map(k=> caches.delete(k))))
  )
})

// Cache strategy:
// - OSM tiles: cache-first
// - App shell/assets: stale-while-revalidate
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.hostname.match(/tile\.openstreetmap\.org$/)) {
    event.respondWith(
      caches.open('osm-tiles').then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) return cached
        const res = await fetch(event.request)
        cache.put(event.request, res.clone())
        return res
      })
    )
    return
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone())
        })
        return networkResponse
      }).catch(()=> cached)
      return cached || fetchPromise
    })
  )
})
