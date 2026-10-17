// Travel Earth service worker: keeps the app usable on weak or no signal.
//
// - Pages: network first, fall back to the cached app shell when offline.
// - Built assets, Cesium runtime files, train data, fonts, icons: cache first
//   (their URLs are versioned or never change).
// - Map tiles from Google/Cesium ion and journal uploads are NOT cached here:
//   tile terms don't allow it and they're huge. Offline, the app falls back to
//   the small globe bundled with Cesium, which is cached like any asset.
// Both values are rewritten at build time by the offlinePrecache plugin in vite.config.ts.
const VERSION = 'te-dev'
const PRECACHE_EXTRA = []
const SHELL = `${VERSION}-shell`
const STATIC = `${VERSION}-static`

const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/apple-touch-icon.png',
  '/rail/shinkansen.json',
  '/rail/jr.json',
  '/rail/other.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await (await caches.open(SHELL)).addAll(PRECACHE)
      // App code, Cesium's workers and the offline globe: best effort, so one
      // failed file never blocks installing.
      const statics = await caches.open(STATIC)
      await Promise.allSettled(PRECACHE_EXTRA.map((url) => statics.add(url)))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

const isStatic = (url) =>
  url.origin === self.location.origin
    ? /^\/(assets|cesium|rail|icons)\//.test(url.pathname)
    : url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/', { ignoreSearch: true })),
    )
    return
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok || res.type === 'opaque') {
              const copy = res.clone()
              caches.open(STATIC).then((c) => c.put(request, copy))
            }
            return res
          }),
      ),
    )
  }
})
