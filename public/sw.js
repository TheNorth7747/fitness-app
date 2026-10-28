const SHELL_VERSION = 'fitday-shell-v3'
const SHELL_CACHE = SHELL_VERSION
const MEDIA_CACHE = 'fitday-media-v1'
const SHELL_FILES = ['/', '/manifest.webmanifest', '/f-mark.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE)
    await Promise.allSettled(SHELL_FILES.map((file) => cache.add(file)))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('fitday-shell-') && key !== SHELL_CACHE).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

async function trimMedia(cache) {
  const keys = await cache.keys()
  if (keys.length <= 240) return
  await Promise.all(keys.slice(0, keys.length - 240).map((key) => cache.delete(key)))
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
      if (cacheName === MEDIA_CACHE) await trimMedia(cache)
    }
    return response
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' })
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone())
    return response
  }).catch(() => null)
  return cached || await network || new Response('', { status: 503, statusText: 'Offline' })
}

/**
 * Exercise data must never be one version behind: a stale copy renders English
 * names on an interface that is otherwise Chinese. Prefer the network, fall
 * back to cache only when the device is actually offline.
 */
async function networkFirstData(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timer)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ message: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
  }
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put('/', response.clone())
    return response
  } catch {
    return await cache.match('/') || new Response('<!doctype html><meta name="viewport" content="width=device-width"><title>Fitday 离线</title><body style="font:16px system-ui;padding:32px;background:#090b08;color:#f2f5ec"><h1>Fitday 暂时离线</h1><p>联网后重新打开，已缓存的训练页面和动作媒体仍可使用。</p></body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || request.headers.has('range')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
    return
  }
  if (url.pathname.startsWith('/media/')) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE))
    return
  }
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirstData(request))
    return
  }
  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith(staleWhileRevalidate(request))
  }
})
