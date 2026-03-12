const CACHE_NAME = 'signage-media-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.pathname.startsWith('/uploads/')) {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  if (url.pathname.startsWith('/api/player/')) {
    e.respondWith(networkOnly(e.request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'PRECACHE') {
    e.waitUntil(precacheUrls(e.data.urls || [], e.data.currentUrls || []));
  }
});

async function precacheUrls(urls, currentUrls) {
  const cache = await caches.open(CACHE_NAME);

  // Build set of full URLs (pathname + query) for cleanup comparison.
  // After re-encoding ?v= changes, so old cache entries with stale ?v= must be evicted.
  const currentFullSet = new Set(
    (currentUrls || []).map((u) => {
      try {
        const parsed = new URL(u, self.location.origin);
        return parsed.pathname + parsed.search;
      } catch {
        return u;
      }
    })
  );

  for (const url of urls) {
    const exists = await cache.match(url);
    if (!exists) {
      try {
        const resp = await fetch(url);
        if (resp.ok) await cache.put(url, resp);
      } catch {}
    }
  }

  // Evict entries not in the current playlist (including stale ?v= versions)
  const keys = await cache.keys();
  for (const req of keys) {
    const parsed = new URL(req.url);
    const key = parsed.pathname + parsed.search;
    if (!currentFullSet.has(key)) {
      await cache.delete(req);
    }
  }
}
