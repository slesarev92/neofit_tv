const CACHE_NAME = 'signage-media-v4';
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
      e.respondWith(serveMedia(e.request, true));
    } else {
      e.respondWith(serveMedia(e.request, false));
    }
    return;
  }

  if (url.pathname.startsWith('/api/player/')) {
    e.respondWith(networkOnly(e.request));
    return;
  }
});

// =========================================================
//  Serve media — cache first, with Range support for video
// =========================================================
async function serveMedia(request, isVideo) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request.url, { ignoreSearch: false });

  if (cached) {
    // Serve Range from cached full response
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader && isVideo) {
      return serveRange(cached, rangeHeader);
    }
    return cached;
  }

  // Not in cache — fetch from network
  try {
    // For video Range requests: fetch full file for caching, return sliced
    if (isVideo && request.headers.get('Range')) {
      const fullReq = new Request(request.url, {
        headers: buildHeadersWithoutRange(request.headers),
        mode: 'cors',
        credentials: 'same-origin',
      });
      const response = await fetch(fullReq);
      if (response.ok && response.status === 200) {
        await cachePut(cache, request.url, response.clone());
        return serveRange(response, request.headers.get('Range'));
      }
      // If full fetch failed, fallback to original Range request
      return fetch(request);
    }

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
//  Range response from full cached blob
// =========================================================
async function serveRange(fullResponse, rangeHeader) {
  try {
    const blob = await fullResponse.clone().blob();
    const total = blob.size;
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader || '');
    if (!match) return fullResponse.clone();

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : total - 1;
    const sliced = blob.slice(start, end + 1, blob.type);

    return new Response(sliced, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': blob.type || 'video/mp4',
        'Content-Length': String(sliced.size),
        'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
        'Accept-Ranges': 'bytes',
      },
    });
  } catch {
    return fullResponse.clone();
  }
}

function buildHeadersWithoutRange(headers) {
  const h = new Headers();
  for (const [key, val] of headers.entries()) {
    if (key.toLowerCase() !== 'range') h.set(key, val);
  }
  return h;
}

// =========================================================
//  Cache put with size limit enforcement
// =========================================================
async function cachePut(cache, url, response) {
  try {
    await cache.put(url, response);
    // Enforce size limit asynchronously
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

    // Sort: videos first (largest), then by size descending — evict biggest first
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
