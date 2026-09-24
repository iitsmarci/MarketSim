const CACHE_NAME = 'marketsim-v1';

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  // Don't cache browser-sync or vite dev server requests
  if (
    event.request.url.includes('socket.io') ||
    event.request.url.includes('localhost:5173/@')
  )
    return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Fallback for offline if not in cache (e.g. index.html)
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
    }),
  );
});
