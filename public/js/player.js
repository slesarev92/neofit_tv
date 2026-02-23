(function () {
  const DEBUG = typeof window !== 'undefined' && window.DEBUG;
  const params = new URLSearchParams(window.location.search);
  var _idRaw = params.get('id');
  var screenId = (_idRaw != null ? _idRaw.trim() : '') || null;
  if (DEBUG) console.log('[Player] Полный URL:', window.location.href);
  if (DEBUG) console.log('[Player] screenId:', screenId);

  if (!screenId) {
    document.getElementById('placeholder').querySelector('h2').textContent = 'ID экрана не указан';
    document.getElementById('placeholder').querySelector('p').textContent = 'Добавьте ?id=SCREEN_ID в URL';
    return;
  }

  let settings = { pollInterval: 10, requestTimeout: 10, maxRetries: 3, prefetchEnabled: true, cacheEnabled: true, showLastOnError: true, imageDuration: 10 };
  let currentPlaylist = null;
  let currentIndex = -1;
  let pollTimer = null;
  let imageTimer = null;
  let watchdogTimer = null;
  let wakeLock = null;

  const container = document.getElementById('mediaContainer');
  const placeholder = document.getElementById('placeholder');

  // =========================================================
  //  Fullscreen — any key / click / tap
  // =========================================================
  document.addEventListener('keydown', (e) => {
    e.preventDefault();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  });
  document.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  });
  document.addEventListener('touchstart', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  });

  // =========================================================
  //  Watchdog — force next item if current one hangs
  // =========================================================
  function resetWatchdog(timeoutMs) {
    clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
      if (DEBUG) console.warn('[Watchdog] Элемент завис, принудительное переключение.', {
        index: currentIndex,
        type: (currentPlaylist && currentPlaylist.items && currentPlaylist.items[currentIndex] && currentPlaylist.items[currentIndex].media && currentPlaylist.items[currentIndex].media.mimeType) || 'unknown',
      });
      playNext();
    }, timeoutMs);
  }

  function clearWatchdog() {
    clearTimeout(watchdogTimer);
  }

  // =========================================================
  //  Network
  // =========================================================
  async function fetchWithRetry(url, retries) {
    for (let i = 0; i <= retries; i++) {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), settings.requestTimeout * 1000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        if (i === retries) throw err;
        await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, i), 30000)));
      }
    }
  }

  // =========================================================
  //  Polling
  // =========================================================
  async function poll() {
    try {
      const data = await fetchWithRetry(`/api/player/${screenId}?t=${Date.now()}`, settings.maxRetries);
      settings = { ...settings, ...data.settings };
      if (!autoReloadScheduled && (settings.autoReloadAt || '04:00')) {
        autoReloadScheduled = true;
        scheduleAutoReload(settings.autoReloadAt || '04:00');
      }

      if (!data.playlist || !data.playlist.items || data.playlist.items.length === 0) {
        if (!settings.showLastOnError || !currentPlaylist) {
          showPlaceholder();
          currentPlaylist = null;
          currentIndex = -1;
        }
      } else {
        const newJSON = JSON.stringify(data.playlist);
        if (newJSON !== JSON.stringify(currentPlaylist)) {
          currentPlaylist = data.playlist;
          currentIndex = -1;
          playNext();
        }
        notifySwPrecache(data.playlist.items);
      }
    } catch (err) {
      if (DEBUG) console.error('Poll error:', err);
      if (!settings.showLastOnError || !currentPlaylist) {
        showPlaceholder('Ошибка загрузки', 'Повторная попытка...');
      }
    }
    schedulePoll();
  }

  function schedulePoll() {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(poll, settings.pollInterval * 1000);
  }

  // =========================================================
  //  Playback
  // =========================================================
  function showPlaceholder(title, subtitle) {
    clearWatchdog();
    clearMediaElements();
    placeholder.style.display = 'flex';
    if (title) placeholder.querySelector('h2').textContent = title;
    if (subtitle) placeholder.querySelector('p').textContent = subtitle;
  }

  function clearMediaElements() {
    clearTimeout(imageTimer);
    container.querySelectorAll('img, video').forEach((el) => {
      if (el.tagName === 'VIDEO') {
        el.onended = null;
        el.onerror = null;
        el.onstalled = null;
        el.oncanplay = null;
        el.pause();
        el.removeAttribute('src');
        el.load();
      }
      el.remove();
    });
  }

  function playNext() {
    if (!currentPlaylist || !currentPlaylist.items.length) return;

    currentIndex = (currentIndex + 1) % currentPlaylist.items.length;
    const item = currentPlaylist.items[currentIndex];
    placeholder.style.display = 'none';
    clearMediaElements();
    clearWatchdog();

    if (item.media.mimeType.startsWith('video/')) {
      playVideo(item);
    } else {
      playImage(item);
    }
  }

  function playVideo(item) {
    const video = document.createElement('video');
    video.src = item.media.url;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    const MAX_VIDEO_FALLBACK = 600;
    resetWatchdog(MAX_VIDEO_FALLBACK * 2 * 1000);

    video.onloadedmetadata = () => {
      if (video.duration && isFinite(video.duration)) {
        resetWatchdog(video.duration * 2 * 1000);
      }
    };

    video.onended = () => { clearWatchdog(); playNext(); };

    video.onerror = () => {
      if (DEBUG) console.error('[Player] Video error:', item.media.url);
      clearWatchdog();
      setTimeout(playNext, 2000);
    };

    video.oncanplay = () => {
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {
          if (DEBUG) console.error('[Player] Video play failed:', item.media.url);
          setTimeout(playNext, 2000);
        });
      });
    };

    video.onstalled = () => {
      if (DEBUG) console.warn('[Player] Video stalled:', item.media.url);
      setTimeout(() => {
        if (video.paused && !video.ended) {
          video.play().catch(() => {
            if (DEBUG) console.error('[Player] Stalled video cannot resume, skipping');
            playNext();
          });
        }
      }, 5000);
    };

    container.appendChild(video);
  }

  function playImage(item) {
    const img = document.createElement('img');
    img.src = item.media.url;
    img.alt = '';

    img.onerror = () => {
      if (DEBUG) console.error('[Player] Image error:', item.media.url);
      clearWatchdog();
      setTimeout(playNext, 2000);
    };

    container.appendChild(img);

    const duration = (item.duration || settings.imageDuration || 10) * 1000;
    resetWatchdog(duration * 2);

    imageTimer = setTimeout(() => {
      if (currentPlaylist && currentPlaylist.items[currentIndex] === item) {
        clearWatchdog();
        playNext();
      }
    }, duration);
  }

  // =========================================================
  //  Service Worker — registration + precache messaging
  // =========================================================
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/player/sw.js').then((reg) => {
      if (DEBUG) console.log('[SW] Registered, scope:', reg.scope);
    }).catch((err) => {
      if (DEBUG) console.error('[SW] Registration failed:', err);
    });
  }

  function notifySwPrecache(items) {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
    const urls = items.map((i) => i.media.url);
    navigator.serviceWorker.controller.postMessage({
      type: 'PRECACHE',
      urls: urls,
      currentUrls: urls,
    });
  }

  // =========================================================
  //  Auto-reload at configured time — memory leak prevention
  // =========================================================
  let autoReloadScheduled = false;
  function scheduleAutoReload(timeStr) {
    const match = (timeStr || '04:00').trim().match(/^(\d{1,2}):(\d{2})$/);
    const h = match ? parseInt(match[1], 10) : 4;
    const m = match ? parseInt(match[2], 10) : 0;
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const ms = target - now;
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (DEBUG) console.log('[AutoReload] Перезагрузка запланирована через ' + hours + ' ч ' + minutes + ' мин (в ' + (timeStr || '04:00') + ')');
    setTimeout(() => {
      if (DEBUG) console.log('[AutoReload] Перезагрузка...');
      location.reload();
    }, ms);
  }

  // =========================================================
  //  Wake Lock
  // =========================================================
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch {}
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!wakeLock) requestWakeLock();
      const vid = container.querySelector('video');
      if (vid && vid.paused && !vid.ended) vid.play().catch(() => {});
    }
  });

  // =========================================================
  //  Start
  // =========================================================
  registerServiceWorker();
  scheduleAutoReload('04:00');
  requestWakeLock();
  poll();
})();
