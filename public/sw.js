const CACHE_NAME = 'signage-media-v5';
// Shell cache lives separate from media so size enforcement / precacheUrls
// eviction never wipe the player boot resources. Bump the suffix when a
// shell URL is added/removed so old clients drop the stale set on activate.
const SHELL_CACHE = 'signage-shell-v1';
const KEPT_CACHES = new Set([CACHE_NAME, SHELL_CACHE]);

// Resources the WebView needs to boot the player. Without these in cache, an
// offline reboot loads the HTML shell but the script never runs and the user
// is stuck on the static «Нет контента» placeholder.
const SHELL_URLS = [
  '/player/index.html',
  '/js/player.js',
  '/favicon.png',
];
const SHELL_PATHS = new Set(SHELL_URLS);

var cacheMaxBytes = 2048 * 1024 * 1024; // default 2 GB, updated from player settings
var sizeMap = new Map(); // url → size in bytes, for lightweight enforceLimit

const VIDEO_EXT_RE = /\.(mp4|webm|mov)(\?|$)/i;

function isVideoUrl(url) {
  return VIDEO_EXT_RE.test(url);
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {}) // first install may be offline — shell will fill in on next online fetch
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => !KEPT_CACHES.has(n))
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
      // Online: video.src = url, browser streams via Range (bypasses SW)
      // Offline: player.js toBlobUrl() fetches full response from cache
      // Non-Range requests go through cacheFirst to fill cache for offline
      if (e.request.headers.get('Range')) return;
      e.respondWith(cacheFirst(e.request));
    } else {
      // Images: cache-first as before
      e.respondWith(cacheFirst(e.request));
    }
    return;
  }

  if (url.pathname.startsWith('/api/player/')) {
    // /metrics is POST and irrelevant offline — pass through without caching
    if (e.request.method !== 'GET') {
      e.respondWith(networkOnly(e.request));
      return;
    }
    e.respondWith(playerApiNetworkFirst(e.request));
    return;
  }

  // Player shell — stale-while-revalidate so offline boots get the cached
  // copy instantly and online sessions silently refresh it for the next reboot.
  if (SHELL_PATHS.has(url.pathname) && e.request.method === 'GET') {
    e.respondWith(shellStaleWhileRevalidate(e.request));
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
    var cl = response.headers.get('Content-Length');
    if (cl) sizeMap.set(url, parseInt(cl, 10));
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
      var size = sizeMap.get(req.url) || 0;
      entries.push({ url: req.url, size: size });
      totalSize += size;
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
      sizeMap.delete(entry.url);
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
//  Network-first for /api/player/:screenId — falls back to the last
//  successful response when the server is unreachable, so the player can
//  keep rendering the most recently known playlist from local cache.
//
//  player.js appends a cache-buster (?t=...) to every poll, so cache keys
//  are normalized to origin + pathname to avoid an ever-growing cache.
// =========================================================
async function playerApiNetworkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cacheKey = canonicalPlayerKey(request.url);
  try {
    const resp = await fetch(request);
    if (resp.ok && resp.status === 200) {
      try { await cache.put(cacheKey, resp.clone()); } catch {}
    }
    return resp;
  } catch {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function canonicalPlayerKey(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

// =========================================================
//  Stale-while-revalidate for the player shell. Returns the cached copy
//  immediately so offline boots don't block on the network, and refreshes
//  the cache in the background when online so the next reboot has the
//  current code. A first install with no cache falls back to network.
// =========================================================
async function shellStaleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const networkPromise = fetch(request).then((resp) => {
    if (resp && resp.ok && resp.status === 200) {
      cache.put(request, resp.clone()).catch(() => {});
    }
    return resp;
  }).catch(() => null);
  if (cached) return cached;
  const fresh = await networkPromise;
  if (fresh) return fresh;
  return new Response('Offline', { status: 503 });
}

// =========================================================
//  Precache messaging from player.js
// =========================================================
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CLAIM') {
    // After install/activate, clients.claim() is only called once. A page
    // loaded later (e.g. WebView reload offline) starts uncontrolled, so the
    // fetch handler never runs for its requests. player.js posts CLAIM on
    // every load so the SW takes control before the first /api/player fetch.
    e.waitUntil(self.clients.claim());
  }
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

  // Remove cached items not in current playlist. Skip the cached playlist API
  // response — it lives in the same cache as media and would otherwise be wiped
  // on every successful poll, defeating the offline fallback. Shell lives in
  // SHELL_CACHE and is not touched here, but the guard is kept defensively.
  const keys = await cache.keys();
  for (const req of keys) {
    const parsed = new URL(req.url);
    if (parsed.pathname.startsWith('/api/player/')) continue;
    if (SHELL_PATHS.has(parsed.pathname)) continue;
    const key = parsed.pathname + parsed.search;
    if (!currentFullSet.has(key)) {
      await cache.delete(req);
      sizeMap.delete(req.url);
    }
  }
}
