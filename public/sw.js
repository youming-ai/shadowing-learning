// 变更缓存策略或外壳内容时**必须**改这个版本号：activate 处理器据此清理旧缓存。
const CACHE_NAME = 'shadowing-learning-v4'
const OFFLINE_URL = '/'
const urlsToCache = [OFFLINE_URL, '/manifest.json', '/icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache)
    }),
  )
  self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL)
        return cached ?? Response.error()
      }),
    )
    return
  }

  if (new URL(request.url).pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // 缓存 Vite 生成的 JS/CSS chunk 以支持离线。
  //
  // 关键：必须校验 content-type。SPA 回退会把 index.html 以 200 返回给**任何**未知路径，
  // 包括已被新构建替换掉的旧 chunk。若不分青红皂白地缓存，离线时该 URL 会返回 HTML，
  // 浏览器因 MIME 不匹配拒绝执行 → 白屏且无从排查。
  if (new URL(request.url).pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached

        return fetch(request).then((networkResponse) => {
          const contentType = networkResponse.headers.get('content-type') ?? ''
          const isRealAsset = networkResponse.ok && /javascript|css/.test(contentType)
          if (isRealAsset) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache))
          }
          return networkResponse
        })
      }),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
          const responseToCache = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache))
        }

        return networkResponse
      })
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
          return Promise.resolve()
        }),
      )
    }),
  )
  self.clients.claim()
})
