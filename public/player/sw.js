const CACHE_NAME = 'signage-media-v3';

const VIDEO_EXT_RE = /\.(mp4|webm|mov)(\?|$)/i;

function isVideoUrl(pathname) {
  return VIDEO_EXT_RE.test(pathname);
}

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
    // Видео — не перехватываем, отдаём напрямую из сети/HTTP-кэша браузера
    // Это избегает загрузки всего файла в RAM через arrayBuffer() при Range-запросах
    if (isVideoUrl(url.pathname)) return;
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
    if (response.ok && response.status === 200) {
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
    // Видео не кэшируем в Cache API — стримятся напрямую из сети
    try {
      const parsed = new URL(url, self.location.origin);
      if (isVideoUrl(parsed.pathname)) continue;
    } catch {}
    const exists = await cache.match(url);
    if (!exists) {
      try {
        const resp = await fetch(url);
        if (resp.ok) await cache.put(url, resp);
      } catch {}
    }
  }

  const keys = await cache.keys();
  for (const req of keys) {
    const parsed = new URL(req.url);
    const key = parsed.pathname + parsed.search;
    if (!currentFullSet.has(key)) {
      await cache.delete(req);
    }
  }
}
