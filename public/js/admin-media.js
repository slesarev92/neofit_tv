(function () {
  let pollTimers = {};
  let lastMediaItems = [];
  let mediaUsageMap = {};
  const SORT_STORAGE_KEY = 'mediaSort';

  const SORT_VALUES = ['date-desc', 'date-asc', 'name-asc', 'name-desc', 'size-desc', 'size-asc'];

  function getSortOrder() {
    try {
      const s = localStorage.getItem(SORT_STORAGE_KEY);
      if (SORT_VALUES.indexOf(s) >= 0) return s;
    } catch (e) {}
    return 'date-desc';
  }

  function setSortOrder(value) {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, value);
    } catch (e) {}
  }

  function sortItems(items, order) {
    if (!items || items.length === 0) return items;
    const arr = items.slice();
    if (order === 'date-desc') {
      arr.sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
    } else if (order === 'date-asc') {
      arr.sort(function (a, b) { return new Date(a.createdAt || 0) - new Date(b.createdAt || 0); });
    } else if (order === 'name-asc') {
      arr.sort(function (a, b) {
        const na = (a.originalName || a.filename || '').toLowerCase();
        const nb = (b.originalName || b.filename || '').toLowerCase();
        return na.localeCompare(nb, 'ru');
      });
    } else if (order === 'name-desc') {
      arr.sort(function (a, b) {
        const na = (a.originalName || a.filename || '').toLowerCase();
        const nb = (b.originalName || b.filename || '').toLowerCase();
        return nb.localeCompare(na, 'ru');
      });
    } else if (order === 'size-desc') {
      arr.sort(function (a, b) { return (b.size || 0) - (a.size || 0); });
    } else if (order === 'size-asc') {
      arr.sort(function (a, b) { return (a.size || 0) - (b.size || 0); });
    }
    return arr;
  }

  function getSearchQuery() {
    const el = document.getElementById('mediaSearch');
    return (el && el.value) ? el.value.trim().toLowerCase() : '';
  }

  function getTypeFilter() {
    const el = document.getElementById('mediaTypeFilter');
    return (el && el.value) ? el.value : 'all';
  }

  function filterBySearch(items, query) {
    if (!query) return items;
    return items.filter(function (item) {
      const name = (item.originalName || item.filename || '').toLowerCase();
      return name.indexOf(query) >= 0;
    });
  }

  function filterByType(items, type) {
    if (!type || type === 'all') return items;
    return items.filter(function (item) {
      const isVid = isVideo(item.mimeType);
      if (type === 'video') return isVid;
      if (type === 'image') return !isVid;
      return true;
    });
  }

  function applySortAndRender() {
    const query = getSearchQuery();
    const type = getTypeFilter();
    const bySearch = filterBySearch(lastMediaItems, query);
    const filtered = filterByType(bySearch, type);
    const order = getSortOrder();
    const sorted = sortItems(filtered, order);
    renderMediaGrid(sorted);
  }

  function isVideo(mimeType) {
    return mimeType && mimeType.startsWith('video/');
  }

  function truncate(str, len = 40) {
    if (!str) return '';
    return str.length <= len ? str : str.slice(0, len) + '…';
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function formatDuration(seconds) {
    if (seconds == null || !Number.isFinite(seconds)) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? m + ':' + String(s).padStart(2, '0') : '0:' + String(s).padStart(2, '0');
  }

  function savedBadge(item) {
    const orig = item.originalSize || item.size;
    const comp = item.compressedSize || item.size;
    if (!orig || !comp || comp >= orig) return '';
    const pct = Math.round((1 - comp / orig) * 100);
    if (pct <= 1) return '';
    return `<span style="background:#d1fae5;color:#059669;padding:1px 6px;border-radius:4px;font-size:.7rem;margin-left:.25rem;">−${pct}%</span>`;
  }

  function renderMediaCard(item) {
    const card = document.createElement('div');
    card.className = 'media-card';
    card.dataset.id = item.id;

    const thumb = document.createElement('div');
    thumb.className = 'media-thumb';
    thumb.style.position = 'relative';

    const status = item.status || 'ready';

    if (status === 'processing') {
      thumb.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:.5rem;color:var(--gray-400);">
        <div class="spinner"></div><span style="font-size:.75rem;">Оптимизация...</span></div>`;
    } else if (isVideo(item.mimeType)) {
      const video = document.createElement('video');
      video.src = `/uploads/${item.filename}#t=2`;
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = 'width:100%;height:100%;object-fit:cover;pointer-events:none;';
      video.addEventListener('loadeddata', () => { video.currentTime = 2; });
      const badge = document.createElement('div');
      badge.style.cssText = 'position:absolute;bottom:6px;left:6px;background:rgba(0,0,0,.7);color:#fff;padding:2px 6px;border-radius:4px;font-size:.7rem;pointer-events:none;';
      badge.textContent = 'VIDEO';
      thumb.appendChild(video);
      thumb.appendChild(badge);
      if (status === 'ready') {
        thumb.style.cursor = 'pointer';
        thumb.addEventListener('click', function () { openMediaPreview(item); });
      }
    } else {
      const img = document.createElement('img');
      img.src = `/uploads/${item.filename}`;
      img.alt = escapeAttr(truncate(item.originalName));
      img.loading = 'lazy';
      thumb.appendChild(img);
      if (status === 'ready') {
        thumb.style.cursor = 'pointer';
        thumb.addEventListener('click', function () { openMediaPreview(item); });
      }
    }

    const info = document.createElement('div');
    info.className = 'media-info';

    const sizeText = formatBytes(item.size);
    const badge = status === 'ready' ? savedBadge(item) : '';
    const errorText = status === 'error'
      ? `<div style="color:var(--danger);font-size:.75rem;margin-top:.25rem;">Ошибка: ${escapeHtml(item.statusMessage || 'неизвестная')}</div>`
      : '';

    const names = mediaUsageMap[item.id];
    const namesEscaped = (names || []).map(escapeHtml);
    const usageText = names && names.length
      ? 'В плейлистах: ' + namesEscaped.slice(0, 3).join(', ') + (names.length > 3 ? ' (+' + (names.length - 3) + ')' : '')
      : 'Не используется';
    const usageTitle = escapeAttr((names || []).join(', ') || 'Не используется');
    const dateOrDuration = isVideo(item.mimeType) ? formatDuration(item.durationSeconds) : formatDate(item.createdAt);
    info.innerHTML = `
      <div class="media-name">${escapeHtml(truncate(item.originalName))}</div>
      <div class="media-meta">
        <span>${sizeText}${badge}</span>
        <span class="media-duration">${dateOrDuration}</span>
      </div>
      <div class="media-usage" title="${usageTitle}">${usageText}</div>
      ${errorText}
    `;

    if (isVideo(item.mimeType) && status === 'ready') {
      const durationSpan = info.querySelector('.media-duration');
      const videoEl = thumb.querySelector('video');
      if (durationSpan && videoEl && (item.durationSeconds == null || item.durationSeconds === '')) {
        videoEl.addEventListener('loadedmetadata', () => {
          if (videoEl.duration && isFinite(videoEl.duration)) {
            durationSpan.textContent = formatDuration(Math.round(videoEl.duration));
          }
        });
      }
    }

    if (status !== 'processing') {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = 'Удалить';
      deleteBtn.style.marginTop = '.5rem';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        var name = item.originalName || item.filename || 'файл';
        if (confirm('Удалить файл «' + name + '»?')) deleteMedia(item.id);
      };
      info.appendChild(deleteBtn);
    }

    card.appendChild(thumb);
    card.appendChild(info);
    return card;
  }

  function renderMediaGrid(items) {
    const grid = document.getElementById('mediaGrid');
    if (!grid) return;
    grid.innerHTML = '';

    Object.values(pollTimers).forEach(clearInterval);
    pollTimers = {};

    if (!items || items.length === 0) {
      grid.innerHTML = '<p class="empty-state">Нет загруженных файлов</p>';
      return;
    }
    items.forEach((item) => grid.appendChild(renderMediaCard(item)));

    const processing = items.filter((i) => i.status === 'processing');
    processing.forEach((item) => startPolling(item.id));
  }

  function startPolling(mediaId) {
    if (pollTimers[mediaId]) return;
    pollTimers[mediaId] = setInterval(async () => {
      try {
        const res = await fetch(`/api/media/${mediaId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status !== 'processing') {
          clearInterval(pollTimers[mediaId]);
          delete pollTimers[mediaId];
          await loadMedia();
        }
      } catch {}
    }, 3000);
  }

  function buildMediaUsageMap(mediaItems, playlists) {
    const map = {};
    (mediaItems || []).forEach((m) => { map[m.id] = []; });
    (playlists || []).forEach((pl) => {
      (pl.items || []).forEach((it) => {
        if (map[it.mediaId] && map[it.mediaId].indexOf(pl.name) < 0) map[it.mediaId].push(pl.name);
      });
    });
    return map;
  }

  async function loadMedia() {
    try {
      const [mediaRes, playlistsRes] = await Promise.all([API.getMedia(), API.getPlaylists()]);
      lastMediaItems = mediaRes.items || [];
      mediaUsageMap = buildMediaUsageMap(lastMediaItems, playlistsRes.items || []);
      applySortAndRender();
    } catch (err) {
      showToast(err.message || 'Ошибка загрузки медиафайлов', 'error');
      lastMediaItems = [];
      mediaUsageMap = {};
      renderMediaGrid([]);
    }
  }

  async function deleteMedia(id) {
    try {
      await API.deleteMedia(id);
      showToast('Файл удалён', 'success');
      await loadMedia();
    } catch (err) {
      showToast(err.message || 'Ошибка удаления', 'error');
    }
  }

  function showProgress(percent, label) {
    const wrap = document.getElementById('progressBarWrap');
    const fill = document.getElementById('progressBarFill');
    const labelEl = document.getElementById('progressBarLabel');
    if (wrap) wrap.style.display = 'block';
    if (fill) fill.style.width = Math.min(100, Math.max(0, percent)) + '%';
    if (labelEl && label) labelEl.textContent = label;
  }

  function hideProgress() {
    const wrap = document.getElementById('progressBarWrap');
    const fill = document.getElementById('progressBarFill');
    const labelEl = document.getElementById('progressBarLabel');
    if (wrap) wrap.style.display = 'none';
    if (fill) fill.style.width = '0';
    if (labelEl) labelEl.textContent = '';
  }

  async function uploadFiles(files) {
    if (!files || files.length === 0) return;
    const allowed = Array.from(files).filter((f) =>
      f.type && (f.type.startsWith('image/') || f.type.startsWith('video/'))
    );
    if (allowed.length === 0) {
      showToast('Поддерживаются только изображения и видео', 'error');
      return;
    }
    const total = allowed.length;
    for (let i = 0; i < total; i++) {
      const file = allowed[i];
      const label = 'Загружается файл ' + (i + 1) + ' из ' + total + ': ' + file.name;
      try {
        showProgress((i / total) * 100, label);
        await API.uploadMedia(file, (p) => {
          showProgress((i + p / 100) / total * 100, label);
        });
        showToast('«' + file.name + '» загружен', 'success');
      } catch (err) {
        showToast(err.message || 'Ошибка загрузки', 'error');
      }
    }
    hideProgress();
    await loadMedia();
  }

  function setupUploadZone() {
    const zone = document.getElementById('uploadZone');
    const input = document.getElementById('fileInput');
    if (!zone || !input) return;
    zone.onclick = () => input.click();
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('dragover'); uploadFiles(e.dataTransfer.files); });
    input.addEventListener('change', (e) => { uploadFiles(e.target.files); e.target.value = ''; });
  }

  function openMediaPreview(item) {
    const modal = document.getElementById('mediaPreviewModal');
    const titleEl = document.getElementById('mediaPreviewTitle');
    const videoEl = document.getElementById('mediaPreviewVideo');
    const imgEl = document.getElementById('mediaPreviewImage');
    const metaEl = document.getElementById('mediaPreviewMeta');
    if (!modal || !titleEl || !videoEl || !imgEl) return;
    const name = item.originalName || item.filename || 'Медиа';
    const isVid = isVideo(item.mimeType);
    const src = '/uploads/' + (item.filename || item.path || '');
    titleEl.textContent = truncate(name);
    if (metaEl) {
      const usage = mediaUsageMap[item.id] || [];
      const usageText = usage.length
        ? 'В плейлистах: ' + usage.slice(0, 3).join(', ') + (usage.length > 3 ? ' (+' + (usage.length - 3) + ')' : '')
        : 'Не используется';
      const sizeText = typeof formatBytes === 'function' ? formatBytes(item.size) : '';
      const dateText = formatDate(item.createdAt);
      metaEl.textContent = [sizeText, dateText, usageText].filter(Boolean).join(' · ');
    }
    if (isVid) {
      imgEl.style.display = 'none';
      imgEl.removeAttribute('src');
      videoEl.style.display = 'block';
      videoEl.src = src;
      videoEl.load();
      modal.classList.add('active');
      videoEl.play().catch(function () {});
    } else {
      if (!src) return;
      videoEl.pause();
      videoEl.style.display = 'none';
      videoEl.removeAttribute('src');
      imgEl.style.display = 'block';
      imgEl.src = src;
      modal.classList.add('active');
    }
  }

  function closeMediaPreview() {
    const modal = document.getElementById('mediaPreviewModal');
    const videoEl = document.getElementById('mediaPreviewVideo');
    const imgEl = document.getElementById('mediaPreviewImage');
    if (modal) modal.classList.remove('active');
    if (videoEl) {
      videoEl.pause();
      videoEl.style.display = 'none';
      videoEl.removeAttribute('src');
    }
    if (imgEl) {
      imgEl.style.display = 'none';
      imgEl.removeAttribute('src');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sortEl = document.getElementById('mediaSort');
    if (sortEl) {
      sortEl.value = getSortOrder();
      sortEl.addEventListener('change', function () {
        setSortOrder(sortEl.value);
        applySortAndRender();
      });
    }
    const searchEl = document.getElementById('mediaSearch');
    if (searchEl) {
      searchEl.addEventListener('input', applySortAndRender);
      searchEl.addEventListener('keyup', function (e) { if (e.key === 'Escape') { searchEl.value = ''; applySortAndRender(); } });
    }
    const typeEl = document.getElementById('mediaTypeFilter');
    if (typeEl) {
      typeEl.addEventListener('change', function () {
        applySortAndRender();
      });
    }
    loadMedia();
    setupUploadZone();
    const previewModal = document.getElementById('mediaPreviewModal');
    const previewClose = document.getElementById('mediaPreviewClose');
    if (previewModal) {
      previewModal.addEventListener('click', function (e) {
        if (e.target === previewModal || e.target.classList.contains('modal-overlay')) closeMediaPreview();
      });
    }
    if (previewClose) previewClose.addEventListener('click', closeMediaPreview);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMediaPreview();
    });
    const logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn && typeof API !== 'undefined') {
      logoutBtn.addEventListener('click', function () {
        API.logout().then(function () { location.href = '/login.html'; });
      });
    }
  });
})();
