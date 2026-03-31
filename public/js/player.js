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

  let settings = { pollInterval: 15, requestTimeout: 25, maxRetries: 3, prefetchEnabled: true, cacheEnabled: true, showLastOnError: true, imageDuration: 10 };
  let currentPlaylist = null;
  let currentIndex = -1;
  let pollTimer = null;
  let pollInProgress = false;
  let imageTimer = null;
  let watchdogTimer = null;
  let wakeLock = null;

  const container = document.getElementById('mediaContainer');
  const placeholder = document.getElementById('placeholder');
  let scheduleBlackoutEl = null;
  let scheduleCheckTimer = null;
  let lastScheduleInside = null;

  let preloadedNextEl = null;
  let preloadedNextIndex = -1;
  let preloadedReady = false;
  let preloadFallbackTimer = null;
  let isTransitioning = false;
  let transitionSafetyTimer = null;
  let activeBlobUrls = new Map();
  let itemErrorCount = new Map();

  // Detect native ExoPlayer bridge (Android APK with VideoPlayerManager)
  var hasNativePlayer = typeof window.NativePlayer !== 'undefined';
  if (DEBUG) console.log('[Player] NativePlayer:', hasNativePlayer ? 'available' : 'not available (WebView fallback)');

  // =========================================================
  //  Blob URL helpers — WebView fallback only (not used with NativePlayer)
  // =========================================================
  function toBlobUrl(mediaUrl) {
    var existing = activeBlobUrls.get(mediaUrl);
    if (existing) return Promise.resolve({ src: existing, blobTimeMs: 0, fromCache: true, fileSizeKb: 0 });
    var t0 = Date.now();
    return fetch(mediaUrl).then(function (resp) {
      var fromCache = resp.headers.get('x-sw-cache') === 'hit' || !navigator.onLine;
      if (!resp.ok) return { src: mediaUrl, blobTimeMs: Date.now() - t0, fromCache: false, fileSizeKb: 0 };
      return resp.blob().then(function (blob) {
        var blobUrl = URL.createObjectURL(blob);
        activeBlobUrls.set(mediaUrl, blobUrl);
        return { src: blobUrl, blobTimeMs: Date.now() - t0, fromCache: fromCache, fileSizeKb: Math.round(blob.size / 1024) };
      });
    }).catch(function () {
      return { src: mediaUrl, blobTimeMs: Date.now() - t0, fromCache: false, fileSizeKb: 0 };
    });
  }

  function revokeBlobUrl(mediaUrl) {
    var blobUrl = activeBlobUrls.get(mediaUrl);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      activeBlobUrls.delete(mediaUrl);
    }
  }

  function sendMetrics(data) {
    if (!screenId) return;
    try {
      fetch('/api/player/' + screenId + '/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(function () {});
    } catch (e) {}
  }

  // =========================================================
  //  Work schedule — black screen outside configured hours
  // =========================================================
  function getCurrentTimeHHMM(tz) {
    try {
      const s = new Date().toLocaleTimeString('en-GB', { timeZone: tz || 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hour12: false });
      return s;
    } catch (_) {
      const d = new Date();
      const h = d.getHours();
      const m = d.getMinutes();
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }
  }

  function timeToMinutes(hhmm) {
    if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return 0;
    const parts = hhmm.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function isWithinSchedule(from, to, currentHHMM) {
    const fromM = timeToMinutes(from);
    const toM = timeToMinutes(to);
    const curM = timeToMinutes(currentHHMM);
    if (fromM === 0 && toM === 0) return true;
    if (fromM <= toM) return curM >= fromM && curM < toM;
    return curM >= fromM || curM < toM;
  }

  function ensureScheduleBlackoutEl() {
    if (scheduleBlackoutEl) return scheduleBlackoutEl;
    scheduleBlackoutEl = document.createElement('div');
    scheduleBlackoutEl.id = 'scheduleBlackout';
    scheduleBlackoutEl.setAttribute('aria-hidden', 'true');
    scheduleBlackoutEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:9999;pointer-events:none;';
    const player = document.getElementById('player');
    if (player) player.appendChild(scheduleBlackoutEl);
    else document.body.appendChild(scheduleBlackoutEl);
    return scheduleBlackoutEl;
  }

  function updateScheduleBlackoutContent(url) {
    const el = scheduleBlackoutEl;
    if (!el) return;
    const existingImg = el.querySelector('img');
    if (url && (url + '').trim()) {
      const src = (url.indexOf('?') === -1 ? url + '?t=' + Date.now() : url).trim();
      if (existingImg) {
        existingImg.src = src;
        existingImg.style.display = '';
      } else {
        const img = document.createElement('img');
        img.alt = '';
        img.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;';
        img.src = src;
        el.appendChild(img);
      }
    } else {
      if (existingImg) existingImg.remove();
    }
  }

  function checkSchedule() {
    const enabled = settings.workScheduleEnabled === true;
    const from = (settings.workScheduleFrom || '').trim();
    const to = (settings.workScheduleTo || '').trim();
    const hasTimes = /^\d{1,2}:\d{2}$/.test(from) && /^\d{1,2}:\d{2}$/.test(to);
    if (!enabled || !hasTimes) {
      if (lastScheduleInside === false) {
        lastScheduleInside = null;
        if (scheduleBlackoutEl) scheduleBlackoutEl.style.display = 'none';
      }
      return;
    }
    const tz = (settings.timezone || 'Europe/Moscow').trim() || 'Europe/Moscow';
    const current = getCurrentTimeHHMM(tz);
    const inside = isWithinSchedule(from, to, current);
    if (lastScheduleInside === inside) {
      if (!inside && scheduleBlackoutEl) {
        const offUrl = (settings.workScheduleOffImageUrl || '').trim() || null;
        updateScheduleBlackoutContent(offUrl);
      }
      return;
    }
    lastScheduleInside = inside;
    if (inside) {
      if (scheduleBlackoutEl) scheduleBlackoutEl.style.display = 'none';
    } else {
      ensureScheduleBlackoutEl();
      const offUrl = (settings.workScheduleOffImageUrl || '').trim() || null;
      updateScheduleBlackoutContent(offUrl);
      scheduleBlackoutEl.style.display = 'block';
    }
  }

  function scheduleScheduleCheck() {
    clearInterval(scheduleCheckTimer);
    scheduleCheckTimer = setInterval(function () {
      checkSchedule();
    }, 60000);
  }

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
      var currentItem = currentPlaylist && currentPlaylist.items && currentPlaylist.items[currentIndex];
      if (DEBUG) console.warn('[Watchdog] Элемент завис, принудительное переключение.', {
        index: currentIndex,
        id: currentItem ? currentItem.id : '?',
        type: (currentItem && currentItem.media && currentItem.media.mimeType) || 'unknown',
      });
      if (currentItem) {
        itemErrorCount.set(currentItem.id, (itemErrorCount.get(currentItem.id) || 0) + 1);
      }
      // Stop native player to prevent late STATE_ENDED callback
      if (hasNativePlayer) NativePlayer.stopVideo();
      isTransitioning = false;
      clearTimeout(transitionSafetyTimer);
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
  //  Playlist signature — stable comparison without cache-buster URLs
  // =========================================================
  function getPlaylistSignature(playlist) {
    if (!playlist || !playlist.items) return '';
    return playlist.id + ':' + playlist.items.map(function (it) {
      return it.id + '|' + (it.media && it.media.mimeType || '') + '|' + (it.duration || 0) + '|' + it.order;
    }).join(';');
  }

  // =========================================================
  //  Polling
  // =========================================================
  async function poll() {
    if (pollInProgress) return;
    pollInProgress = true;
    try {
      const data = await fetchWithRetry(`/api/player/${screenId}?t=${Date.now()}`, settings.maxRetries);
      settings = { ...settings, ...data.settings };
      checkSchedule();
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
        var newSig = getPlaylistSignature(data.playlist);
        var oldSig = getPlaylistSignature(currentPlaylist);
        if (newSig !== oldSig) {
          // Structure changed — preserve position by current item id
          var currentItemId = (currentPlaylist && currentIndex >= 0 && currentPlaylist.items[currentIndex])
            ? currentPlaylist.items[currentIndex].id : null;
          currentPlaylist = data.playlist;
          itemErrorCount.clear();
          // Clean up blob URLs from previous playlist
          activeBlobUrls.forEach(function (blobUrl) { URL.revokeObjectURL(blobUrl); });
          activeBlobUrls.clear();
          if (currentItemId) {
            var preserved = currentPlaylist.items.findIndex(function (it) { return it.id === currentItemId; });
            if (preserved >= 0) {
              currentIndex = preserved;
              // Invalidate preload — playlist structure changed
              if (preloadedNextEl) {
                if (preloadedNextEl.tagName === 'VIDEO') { if (preloadedNextEl.src && preloadedNextEl.src.startsWith('blob:')) URL.revokeObjectURL(preloadedNextEl.src); preloadedNextEl.pause(); preloadedNextEl.removeAttribute('src'); preloadedNextEl.load(); }
                preloadedNextEl.remove(); preloadedNextEl = null; preloadedNextIndex = -1; preloadedReady = false;
                clearTimeout(preloadFallbackTimer);
              }
              startPreloadNext();
            } else {
              currentIndex = -1;
              playNext();
            }
          } else {
            currentIndex = -1;
            playNext();
          }
        } else {
          // Only URLs changed (cache-buster) — update data silently, keep playing
          currentPlaylist = data.playlist;
        }
        notifySwPrecache(data.playlist.items);
      }
    } catch (err) {
      if (DEBUG) console.error('Poll error:', err);
      if (!settings.showLastOnError || !currentPlaylist) {
        showPlaceholder('Ошибка загрузки', 'Повторная попытка...');
      }
    } finally {
      pollInProgress = false;
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
    if (hasNativePlayer) NativePlayer.stopVideo();
    clearMediaElements();
    placeholder.style.display = 'flex';
    if (title) placeholder.querySelector('h2').textContent = title;
    if (subtitle) placeholder.querySelector('p').textContent = subtitle;
  }

  function clearMediaElements() {
    clearTimeout(imageTimer);
    clearTimeout(preloadFallbackTimer);
    isTransitioning = false;
    clearTimeout(transitionSafetyTimer);
    if (preloadedNextEl) {
      if (preloadedNextEl.tagName === 'VIDEO') {
        preloadedNextEl.onended = null;
        preloadedNextEl.onerror = null;
        preloadedNextEl.onstalled = null;
        preloadedNextEl.oncanplay = null;
        if (preloadedNextEl.src && preloadedNextEl.src.startsWith('blob:')) URL.revokeObjectURL(preloadedNextEl.src);
        preloadedNextEl.pause();
        preloadedNextEl.removeAttribute('src');
        preloadedNextEl.load();
      }
      preloadedNextEl.remove();
      preloadedNextEl = null;
      preloadedNextIndex = -1;
      preloadedReady = false;
    }
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

  // Удалить все медиа-элементы кроме указанного (и preload-слотов)
  function removeOldMedia(keepEl) {
    container.querySelectorAll('img, video').forEach(function (el) {
      if (el === keepEl || el.classList.contains('preload-slot')) return;
      if (el.tagName === 'VIDEO') {
        el.onended = null;
        el.onerror = null;
        el.onstalled = null;
        el.oncanplay = null;
        el.onloadedmetadata = null;
        if (el.src && el.src.startsWith('blob:')) {
          URL.revokeObjectURL(el.src);
        }
        el.pause();
        el.removeAttribute('src');
        el.load();
      }
      el.remove();
    });
  }

  function playNext() {
    if (!currentPlaylist || !currentPlaylist.items.length) return;
    if (isTransitioning) return;
    isTransitioning = true;
    clearTimeout(transitionSafetyTimer);
    transitionSafetyTimer = setTimeout(function () { isTransitioning = false; }, 10000);

    // Find next item, skipping those with >= 3 errors
    var nextIndex = (currentIndex + 1) % currentPlaylist.items.length;
    var skipAttempts = 0;
    while (skipAttempts < currentPlaylist.items.length) {
      var candidateId = currentPlaylist.items[nextIndex].id;
      if ((itemErrorCount.get(candidateId) || 0) < 3) break;
      if (DEBUG) console.warn('[Player] Skipping errored item:', candidateId, 'errors:', itemErrorCount.get(candidateId));
      nextIndex = (nextIndex + 1) % currentPlaylist.items.length;
      skipAttempts++;
    }
    if (skipAttempts >= currentPlaylist.items.length) {
      if (DEBUG) console.warn('[Player] All items errored, pausing 10s before retry');
      itemErrorCount.clear();
      isTransitioning = false;
      clearTimeout(transitionSafetyTimer);
      setTimeout(playNext, 10000);
      return;
    }

    const item = currentPlaylist.items[nextIndex];
    const prefetchOk = settings.prefetchEnabled !== false;

    if (prefetchOk && preloadedNextEl && preloadedNextIndex === nextIndex && preloadedReady) {
      const oldCurrent = container.querySelector('img, video');
      if (oldCurrent && oldCurrent !== preloadedNextEl) {
        if (oldCurrent.tagName === 'VIDEO') {
          oldCurrent.onended = null;
          oldCurrent.onerror = null;
          oldCurrent.onstalled = null;
          oldCurrent.oncanplay = null;
          oldCurrent.pause();
          oldCurrent.removeAttribute('src');
          oldCurrent.load();
        }
        oldCurrent.remove();
      }
      preloadedNextEl.style.visibility = '';
      preloadedNextEl.style.opacity = '';
      preloadedNextEl.style.position = '';
      preloadedNextEl.style.zIndex = '';
      preloadedNextEl.classList.remove('preload-slot');
      if (preloadedNextEl.tagName === 'VIDEO') {
        const video = preloadedNextEl;
        currentIndex = nextIndex;
        const MAX_VIDEO_FALLBACK = 600;
        resetWatchdog(MAX_VIDEO_FALLBACK * 2 * 1000);
        video.onloadedmetadata = () => {
          if (video.duration && isFinite(video.duration)) {
            resetWatchdog(video.duration * 2 * 1000);
          }
        };
        video.onended = () => { clearWatchdog(); itemErrorCount.delete(item.id); playNext(); };
        video.onerror = () => {
          if (DEBUG) console.error('[Player] Video error (preloaded):', item.media.url);
          clearWatchdog();
          itemErrorCount.set(item.id, (itemErrorCount.get(item.id) || 0) + 1);
          isTransitioning = false; clearTimeout(transitionSafetyTimer);
          setTimeout(playNext, 2000);
        };
        video.onstalled = () => {
          if (DEBUG) console.warn('[Player] Video stalled (preloaded):', item.media.url);
          setTimeout(() => {
            if (video.paused && !video.ended) {
              video.play().catch(() => { isTransitioning = false; clearTimeout(transitionSafetyTimer); playNext(); });
            }
          }, 5000);
        };
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => { isTransitioning = false; clearTimeout(transitionSafetyTimer); setTimeout(playNext, 2000); });
        });
        isTransitioning = false; clearTimeout(transitionSafetyTimer);
      } else {
        // Promoted preload: image
        if (hasNativePlayer) NativePlayer.stopVideo();
        const duration = (item.duration || settings.imageDuration || 10) * 1000;
        resetWatchdog(duration * 2);
        currentIndex = nextIndex;
        imageTimer = setTimeout(() => {
          if (currentPlaylist && currentPlaylist.items[currentIndex] === item) {
            clearWatchdog();
            playNext();
          }
        }, duration);
        isTransitioning = false; clearTimeout(transitionSafetyTimer);
      }
      preloadedNextEl = null;
      preloadedNextIndex = -1;
      preloadedReady = false;
      clearTimeout(preloadFallbackTimer);
      startPreloadNext();
      return;
    }

    currentIndex = nextIndex;
    placeholder.style.display = 'none';
    clearTimeout(imageTimer);
    clearWatchdog();
    clearTimeout(preloadFallbackTimer);
    // Clean up unused preloaded element
    if (preloadedNextEl) {
      if (preloadedNextEl.tagName === 'VIDEO') {
        if (preloadedNextEl.src && preloadedNextEl.src.startsWith('blob:')) URL.revokeObjectURL(preloadedNextEl.src);
        preloadedNextEl.pause();
        preloadedNextEl.removeAttribute('src');
        preloadedNextEl.load();
      }
      preloadedNextEl.remove();
      preloadedNextEl = null;
      preloadedNextIndex = -1;
      preloadedReady = false;
    }

    if (item.media.mimeType.startsWith('video/')) {
      if (hasNativePlayer) playVideoNative(item);
      else playVideoWebView(item);
    } else {
      if (hasNativePlayer) NativePlayer.stopVideo();
      playImage(item);
    }
    startPreloadNext();
  }

  function startPreloadNext() {
    if (settings.prefetchEnabled === false || !currentPlaylist || !currentPlaylist.items.length) return;
    const nextIndex = (currentIndex + 1) % currentPlaylist.items.length;
    const nextItem = currentPlaylist.items[nextIndex];
    if (!nextItem || !nextItem.media || !nextItem.media.url) return;

    if (preloadedNextEl) {
      if (preloadedNextEl.tagName === 'VIDEO') {
        if (preloadedNextEl.src && preloadedNextEl.src.startsWith('blob:')) URL.revokeObjectURL(preloadedNextEl.src);
        preloadedNextEl.pause();
        preloadedNextEl.removeAttribute('src');
        preloadedNextEl.load();
      }
      preloadedNextEl.remove();
      preloadedNextEl = null;
    }
    preloadedNextIndex = nextIndex;
    preloadedReady = false;

    // Native video preload — temporarily disabled to test if I/O contention causes stuttering
    if (hasNativePlayer && nextItem.media.mimeType.startsWith('video/')) {
      return;
    }

    if (nextItem.media.mimeType.startsWith('video/')) {
      // WebView fallback: hidden <video> element for preload
      const video = document.createElement('video');
      video.classList.add('preload-slot');
      video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;visibility:hidden;pointer-events:none;';
      video.muted = true;
      video.preload = 'metadata';
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.addEventListener('canplay', function () { preloadedReady = true; }, { once: true });
      video.addEventListener('loadedmetadata', function () { preloadedReady = true; }, { once: true });
      video.onerror = () => { preloadedReady = false; };
      preloadedNextEl = video;
      if (navigator.onLine) {
        video.src = nextItem.media.url;
        container.appendChild(video);
      } else {
        toBlobUrl(nextItem.media.url).then(function (result) {
          if (preloadedNextEl !== video) return;
          video.src = result.src;
          container.appendChild(video);
        });
      }
      clearTimeout(preloadFallbackTimer);
      preloadFallbackTimer = setTimeout(function () {
        if (preloadedNextEl === video && !preloadedReady) preloadedReady = true;
      }, 3000);
    } else {
      const img = document.createElement('img');
      img.classList.add('preload-slot');
      img.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;visibility:hidden;opacity:0;z-index:-1;pointer-events:none;';
      img.src = nextItem.media.url;
      img.alt = '';
      img.onload = () => { preloadedReady = true; };
      img.onerror = () => { preloadedReady = false; };
      container.appendChild(img);
      preloadedNextEl = img;
    }
  }

  // =========================================================
  //  Native video — ExoPlayer via JavascriptInterface
  // =========================================================
  function playVideoNative(item) {
    removeOldMedia(null);
    isTransitioning = false;
    clearTimeout(transitionSafetyTimer);
    var fallbackDuration = (item.media && item.media.duration) || 600;
    resetWatchdog(fallbackDuration * 2 * 1000);
    var fullUrl = new URL(item.media.url, window.location.origin).href;
    console.log('[NP] playVideo:', fullUrl, 'duration:', item.media && item.media.duration, 'item.duration:', item.duration);
    NativePlayer.playVideo(fullUrl);
  }

  // Callbacks from VideoPlayerManager.kt via evaluateJavascript
  window.onExoVideoEnded = function () {
    console.log('[NP] onExoVideoEnded, index:', currentIndex);
    clearWatchdog();
    var item = currentPlaylist && currentPlaylist.items && currentPlaylist.items[currentIndex];
    if (item) itemErrorCount.delete(item.id);
    playNext();
  };

  window.onExoVideoError = function (url) {
    console.log('[NP] onExoVideoError:', url);
    clearWatchdog();
    var item = currentPlaylist && currentPlaylist.items && currentPlaylist.items[currentIndex];
    if (item) {
      itemErrorCount.set(item.id, (itemErrorCount.get(item.id) || 0) + 1);
    }
    isTransitioning = false;
    clearTimeout(transitionSafetyTimer);
    setTimeout(playNext, 2000);
  };

  // =========================================================
  //  WebView video fallback — used when NativePlayer is not available (PC browser)
  // =========================================================
  function playVideoWebView(item) {
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    var metricsData = { videoUrl: item.media.url, blobTimeMs: 0, fromCache: false, fileSizeKb: 0, canplayTimeMs: 0 };
    var srcSetAt = 0;

    const MAX_VIDEO_FALLBACK = 600;
    resetWatchdog(MAX_VIDEO_FALLBACK * 2 * 1000);

    video.onloadedmetadata = () => {
      if (video.duration && isFinite(video.duration)) {
        resetWatchdog(video.duration * 2 * 1000);
      }
    };

    video.onended = () => {
      clearWatchdog(); itemErrorCount.delete(item.id);
      if (video.getVideoPlaybackQuality) {
        var q = video.getVideoPlaybackQuality();
        metricsData.droppedFrames = q.droppedVideoFrames;
        metricsData.totalFrames = q.totalVideoFrames;
        metricsData.dropPercent = q.totalVideoFrames > 0 ? Math.round(q.droppedVideoFrames / q.totalVideoFrames * 1000) / 10 : 0;
      }
      sendMetrics(metricsData);
      revokeBlobUrl(item.media.url);
      playNext();
    };

    video.onerror = () => {
      if (DEBUG) console.error('[Player] Video error:', item.media.url);
      clearWatchdog();
      revokeBlobUrl(item.media.url);
      itemErrorCount.set(item.id, (itemErrorCount.get(item.id) || 0) + 1);
      removeOldMedia(null);
      isTransitioning = false; clearTimeout(transitionSafetyTimer);
      setTimeout(playNext, 2000);
    };

    video.addEventListener('canplay', function () {
      metricsData.canplayTimeMs = srcSetAt > 0 ? Date.now() - srcSetAt : 0;
      removeOldMedia(video);
      isTransitioning = false; clearTimeout(transitionSafetyTimer);
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {
          if (DEBUG) console.error('[Player] Video play failed:', item.media.url);
          isTransitioning = false; clearTimeout(transitionSafetyTimer);
          setTimeout(playNext, 2000);
        });
      });
    }, { once: true });

    video.onstalled = () => {
      if (DEBUG) console.warn('[Player] Video stalled:', item.media.url);
      setTimeout(() => {
        if (video.paused && !video.ended) {
          video.play().catch(() => {
            if (DEBUG) console.error('[Player] Stalled video cannot resume, skipping');
            isTransitioning = false; clearTimeout(transitionSafetyTimer);
            playNext();
          });
        }
      }, 5000);
    };

    if (navigator.onLine) {
      srcSetAt = Date.now();
      video.src = item.media.url;
      container.appendChild(video);
    } else {
      toBlobUrl(item.media.url).then(function (result) {
        metricsData.blobTimeMs = result.blobTimeMs;
        metricsData.fromCache = result.fromCache;
        metricsData.fileSizeKb = result.fileSizeKb;
        srcSetAt = Date.now();
        video.src = result.src;
        container.appendChild(video);
      });
    }
  }

  function playImage(item) {
    const img = document.createElement('img');
    img.src = item.media.url;
    img.alt = '';

    img.onload = () => {
      removeOldMedia(img);
      isTransitioning = false; clearTimeout(transitionSafetyTimer);
    };

    img.onerror = () => {
      if (DEBUG) console.error('[Player] Image error:', item.media.url);
      clearWatchdog();
      itemErrorCount.set(item.id, (itemErrorCount.get(item.id) || 0) + 1);
      removeOldMedia(null);
      isTransitioning = false; clearTimeout(transitionSafetyTimer);
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
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SET_CACHE_LIMIT',
          cacheMaxSizeMb: settings.cacheMaxSizeMb || 2048,
        });
      }
    }).catch((err) => {
      if (DEBUG) console.error('[SW] Registration failed:', err);
    });
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then((granted) => {
        if (DEBUG) console.log('[Storage] Persistent:', granted);
      });
    }
  }

  function notifySwPrecache(items) {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
    let urls = items.map((i) => i.media && i.media.url).filter(Boolean);
    // When native player handles video, don't cache video in SW — ExoPlayer SimpleCache handles it
    if (hasNativePlayer) {
      urls = urls.filter(function (u) { return !/\.(mp4|webm|mov)(\?|$)/i.test(u); });
    }
    // Reorder: next item first for priority precaching
    var nextUrls = urls.slice();
    if (currentIndex >= 0 && currentIndex < nextUrls.length - 1) {
      var nextUrl = nextUrls.splice(currentIndex + 1, 1)[0];
      if (nextUrl) nextUrls.unshift(nextUrl);
    }
    navigator.serviceWorker.controller.postMessage({
      type: 'PRECACHE',
      urls: nextUrls,
      currentUrls: urls,
      cacheMaxSizeMb: settings.cacheMaxSizeMb || 2048,
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
      clearTimeout(pollTimer);
      poll();
    }
  });

  // =========================================================
  //  Start
  // =========================================================
  registerServiceWorker();
  scheduleScheduleCheck();
  requestWakeLock();
  poll();
})();
