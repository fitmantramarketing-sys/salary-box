const PRECACHE = 'hr-tool-v2'
const RUNTIME = 'hr-tool-runtime'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll([
      '/',
      '/index.html',
      '/manifest.webmanifest',
    ])).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  const currentCaches = [PRECACHE, RUNTIME]
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(cacheNames.map((name) => {
        if (!currentCaches.includes(name)) return caches.delete(name)
      }))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(RUNTIME).then((cache) => cache.put(event.request, clone))
          }
          return response
        }).catch(() => cached)
        return cached || fetchPromise
      })
    )
  }
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const { title, body } = event.data.json()

    const options = {
      body: body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
    }

    event.waitUntil(
      self.registration.showNotification(title || 'HR Tool', options)
    )
  } catch {
    // Ignore malformed payloads
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url === urlToOpen)
      if (existing) {
        existing.focus()
      } else {
        clients.openWindow(urlToOpen)
      }
    })
  )
})
