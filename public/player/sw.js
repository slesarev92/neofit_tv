const CACHE_NAME = 'signage-media-v5';
var cacheMaxBytes = 2048 * 1024 * 1024; // default 2 GB, updated from player settings

const VIDEO_EXT_RE = /\.(mp4|webm|mov)(\?|$)/i;

function isVideoUrl(url) {
  return VIDEO_EXT_RE.test(url);
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

// =========================================================
//  Fetch handler
// =========================================================
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.pathname.startsWith('/uploads/')) {
    if (isVideoUrl(url.pathname)) {
      // Video: serve full response from cache (player.js converts to blob URL)
      // Range requests from blob URLs never reach SW — no blob.slice() needed
      if (e.request.headers.get('Range')) return; // safety: don't intercept Range
      e.respondWith(cacheFirst(e.request));
    } else {
      // Images: cache-first as before
      e.respondWith(cacheFirst(e.request));
    }
    return;
  }

  if (url.pathname.startsWith('/api/player/')) {
    e.respondWith(networkOnly(e.request));
    return;
  }
});

// =========================================================
//  Cache-first strategy
// =========================================================
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request.url, { ignoreSearch: false });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      await cachePut(cache, request.url, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// =========================================================
//  Cache put with size limit enforcement
// =========================================================
async function cachePut(cache, url, response) {
  try {
    await cache.put(url, response);
    enforceLimit(cache);
  } catch {}
}

async function enforceLimit(cache) {
  try {
    const keys = await cache.keys();
    var totalSize = 0;
    var entries = [];

    for (const req of keys) {
      const resp = await cache.match(req);
      if (!resp) continue;
      const blob = await resp.blob();
      entries.push({ url: req.url, size: blob.size });
      totalSize += blob.size;
    }

    if (totalSize <= cacheMaxBytes) return;

    // Evict largest videos first
    entries.sort((a, b) => {
      var aVid = isVideoUrl(a.url) ? 0 : 1;
      var bVid = isVideoUrl(b.url) ? 0 : 1;
      if (aVid !== bVid) return aVid - bVid;
      return b.size - a.size;
    });

    for (const entry of entries) {
      if (totalSize <= cacheMaxBytes) break;
      await cache.delete(entry.url);
      totalSize -= entry.size;
    }
  } catch {}
}

// =========================================================
//  Network only (API calls)
// =========================================================
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

// =========================================================
//  Precache messaging from player.js
// =========================================================
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'PRECACHE') {
    if (e.data.cacheMaxSizeMb) {
      cacheMaxBytes = e.data.cacheMaxSizeMb * 1024 * 1024;
    }
    e.waitUntil(precacheUrls(e.data.urls || [], e.data.currentUrls || []));
  }
  if (e.data && e.data.type === 'SET_CACHE_LIMIT') {
    if (e.data.cacheMaxSizeMb) {
      cacheMaxBytes = e.data.cacheMaxSizeMb * 1024 * 1024;
    }
  }
});

async function precacheUrls(urls, currentUrls) {
  const cache = await caches.open(CACHE_NAME);

  // Build set of current URLs for cleanup
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

  // Download missing items (images + video) in order
  for (const url of urls) {
    const exists = await cache.match(url);
    if (!exists) {
      try {
        const resp = await fetch(url);
        if (resp.ok) await cachePut(cache, url, resp);
      } catch {}
    }
  }

  // Remove cached items not in current playlist
  const keys = await cache.keys();
  for (const req of keys) {
    const parsed = new URL(req.url);
    const key = parsed.pathname + parsed.search;
    if (!currentFullSet.has(key)) {
      await cache.delete(req);
    }
  }
}
