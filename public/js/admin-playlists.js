(function () {
  let editingPlaylistId = null;
  let mediaCache = [];
  let playlistItems = [];
  let savePlaylistInProgress = false;
  let defaultImageDuration = 10;
  var mediaSelectView = localStorage.getItem('mediaSelectView') || 'grid';
  var mediaSelectReadyItems = [];
  var mediaSelectSort = localStorage.getItem('mediaSelectSort') || 'date-desc';

  function sortMediaItems(items, order) {
    var arr = items.slice();
    if (order === 'date-desc') arr.sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
    else if (order === 'date-asc') arr.sort(function (a, b) { return new Date(a.createdAt || 0) - new Date(b.createdAt || 0); });
    else if (order === 'name-asc') arr.sort(function (a, b) { return (a.originalName || a.filename || '').localeCompare(b.originalName || b.filename || '', 'ru'); });
    else if (order === 'name-desc') arr.sort(function (a, b) { return (b.originalName || b.filename || '').localeCompare(a.originalName || a.filename || '', 'ru'); });
    else if (order === 'size-desc') arr.sort(function (a, b) { return (b.size || 0) - (a.size || 0); });
    else if (order === 'size-asc') arr.sort(function (a, b) { return (a.size || 0) - (b.size || 0); });
    return arr;
  }

  function renderMediaSelectGrid(items) {
    var grid = document.getElementById('mediaSelectGrid');
    var sorted = sortMediaItems(items, mediaSelectSort);
    var html = '';
    sorted.forEach(function (m) {
      var name = m.originalName || m.filename || '';
      var isVid = m.mimeType && m.mimeType.startsWith('video/');
      var typeLabel = isVid ? 'Видео' : 'Изображение';
      var thumbSrc = getMediaThumbUrl(m) || '';
      var thumbHtml = isVid
        ? '<div class="msi-thumb-inner" style="position:relative;width:100%;height:100%;"><video src="' + thumbSrc + '#t=2" preload="metadata" muted class="msi-thumb-media"></video><span style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,.6);color:#fff;font-size:.6rem;padding:1px 4px;border-radius:3px;">VIDEO</span></div>'
        : '<img src="' + thumbSrc + '" alt="" class="msi-thumb-media">';
      var metaParts = [typeLabel];
      if (m.size) metaParts.push(formatSize(m.size));
      if (m.createdAt) metaParts.push(formatDateShort(m.createdAt));
      html += '<label class="media-select-item"'
        + ' data-media-id="' + escapeAttr(m.id) + '"'
        + ' data-media-name="' + escapeAttr(name) + '"'
        + ' data-mime="' + escapeAttr(m.mimeType || '') + '">'
        + '<input type="checkbox" class="media-select-checkbox">'
        + '<div class="msi-thumb">' + thumbHtml + '</div>'
        + '<div class="msi-info">'
        + '<div class="msi-name">' + escapeHtml(name) + '</div>'
        + '<div class="msi-meta">' + metaParts.join(' · ') + '</div>'
        + '</div>'
        + '</label>';
    });
    grid.innerHTML = html;
    grid.classList.toggle('list-view', mediaSelectView === 'list');
    var btnGrid = document.getElementById('msiViewGrid');
    var btnList = document.getElementById('msiViewList');
    if (btnGrid) btnGrid.classList.toggle('active', mediaSelectView === 'grid');
    if (btnList) btnList.classList.toggle('active', mediaSelectView === 'list');
  }

  function getMediaThumbUrl(media) {
    if (!media || !media.path) return null;
    return '/' + media.path.replace(/^\//, '');
  }

  function isVideo(media) {
    return media && media.mimeType && media.mimeType.startsWith('video/');
  }

  function buildPlaylistScreensMap(screens) {
    const map = {};
    (screens || []).forEach((s) => {
      if (!s.playlistId) return;
      if (!map[s.playlistId]) map[s.playlistId] = [];
      map[s.playlistId].push(s.name || s.id || 'Экран');
    });
    return map;
  }

  function formatDurationSeconds(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return '';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    if (minutes && seconds) return minutes + ' мин ' + seconds + ' c';
    if (minutes) return minutes + ' мин';
    return seconds + ' c';
  }

  /** Считает длительность цикла: для видео — durationSeconds из media, для изображений — item.duration. mediaMap: Map(mediaId -> { mimeType, durationSeconds }) */
  function computePlaylistDurationSeconds(items, mediaMap) {
    if (!items || !items.length) return 0;
    return items.reduce((sum, it) => {
      const media = mediaMap && it.mediaId ? mediaMap.get(it.mediaId) : null;
      const isVid = media && media.mimeType && media.mimeType.startsWith('video/');
      let sec = 0;
      if (isVid && media.durationSeconds != null && Number.isFinite(media.durationSeconds)) {
        sec = Math.max(0, Math.floor(Number(media.durationSeconds)));
      } else {
        const d = typeof it.duration === 'number' ? it.duration : (it.duration ? Number(it.duration) : 10);
        sec = Number.isFinite(d) && d > 0 ? d : 0;
      }
      return sum + sec;
    }, 0);
  }

  function formatPlaylistDuration(items, mediaMap) {
    const totalSeconds = computePlaylistDurationSeconds(items, mediaMap);
    return formatDurationSeconds(totalSeconds);
  }

  function loadPlaylists() {
    const params = new URLSearchParams(window.location.search);
    const activePlaylistId = params.get('playlistId') || null;
    return Promise.all([API.getPlaylists(), API.getScreens(), API.getMedia()])
      .then(([playlistsRes, screensRes, mediaRes]) => {
        const items = playlistsRes.items || [];
        const screensMap = buildPlaylistScreensMap(screensRes.items || []);
        const mediaList = mediaRes.items || [];
        const mediaMap = new Map(mediaList.map((m) => [m.id, { mimeType: m.mimeType, durationSeconds: m.durationSeconds }]));
        const listEl = document.getElementById('playlistsList');
        if (items.length === 0) {
          listEl.innerHTML = `
            <div class="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              <h3>Нет плейлистов</h3>
              <p>Создайте первый плейлист, нажав «Создать плейлист»</p>
            </div>
          `;
          return;
        }
        listEl.innerHTML = items
          .map((pl) => {
            const screenNames = screensMap[pl.id] || [];
            const screenCount = screenNames.length;
            const durationText = formatPlaylistDuration(pl.items || [], mediaMap);
            const durationLine = durationText
              ? '<div class="stat-label playlist-duration-info">Длительность цикла: ' + escapeHtml(durationText) + '</div>'
              : '';
            const screensText = screenCount === 0
              ? 'Не назначен экранам'
              : screenCount === 1
                ? 'На экране: ' + escapeHtml(screenNames[0])
                : 'На экранах (' + screenCount + '): ' + screenNames.slice(0, 3).map(escapeHtml).join(', ') + (screenCount > 3 ? ' …' : '');
            const screensHtml = screenCount === 0
              ? screensText
              : `<button type="button" class="link-button" data-action="playlist-go-screens" data-id="${escapeAttr(pl.id)}" title="${escapeAttr(screenNames.join(', '))}" style="background:none;border:none;padding:0;color:var(--primary);text-decoration:underline;cursor:pointer;">${screensText}</button>`;
            const isActive = activePlaylistId && pl.id === activePlaylistId;
            return `
          <div class="card" data-playlist-id="${escapeAttr(pl.id)}" style="margin-bottom: 1rem;">
            <div class="card-body${isActive ? ' card-active' : ''}" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;${isActive ? ' border:1px solid var(--primary);box-shadow:0 0 0 1px var(--primary);' : ''}">
              <div>
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${escapeHtml(pl.name)}</div>
                <div class="stat-label">${(pl.items || []).length} элементов</div>
                <div class="stat-label playlist-screens-info">${screensHtml}</div>
                ${durationLine}
              </div>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-primary btn-sm" data-action="playlist-send-to-screens" data-id="${escapeAttr(pl.id)}" data-name="${escapeAttr(pl.name || '')}">Отправить на экраны</button>
                <button type="button" class="btn btn-secondary btn-sm" data-action="playlist-edit" data-id="${escapeAttr(pl.id)}">Редактировать</button>
                <button type="button" class="btn btn-secondary btn-sm" data-action="playlist-duplicate" data-id="${escapeAttr(pl.id)}">Дублировать</button>
                <button type="button" class="btn btn-danger btn-sm" data-action="playlist-delete" data-id="${escapeAttr(pl.id)}" data-name="${escapeAttr(pl.name || '')}">Удалить</button>
              </div>
            </div>
          </div>
        `;
          })
          .join('');
      })
      .catch((err) => {
        showToast(err.message || 'Ошибка загрузки плейлистов', 'error');
        document.getElementById('playlistsList').innerHTML = '<div class="empty-state"><p>Не удалось загрузить плейлисты</p></div>';
      });
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }

  function formatDateShort(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.getDate().toString().padStart(2, '0') + '.' + (d.getMonth() + 1).toString().padStart(2, '0') + '.' + d.getFullYear();
    } catch (e) { return ''; }
  }

  function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
  }

  function openCreateModal() {
    savePlaylistInProgress = false;
    var btn = document.querySelector('#playlistModal .modal-footer .btn-primary');
    if (btn) btn.disabled = false;
    editingPlaylistId = null;
    document.getElementById('playlistModalTitle').textContent = 'Создать плейлист';
    document.getElementById('playlistName').value = '';
    playlistItems = [];
    renderPlaylistItems();
    document.getElementById('playlistModal').classList.add('active');
  }

  function openEditModal(id) {
    savePlaylistInProgress = false;
    var btn = document.querySelector('#playlistModal .modal-footer .btn-primary');
    if (btn) btn.disabled = false;
    editingPlaylistId = id;
    document.getElementById('playlistModalTitle').textContent = 'Редактировать плейлист';
    Promise.all([API.getPlaylist(id), API.getMedia()])
      .then(([playlistRes, mediaRes]) => {
        mediaCache = mediaRes.items || [];
        const item = playlistRes.item || playlistRes;
        document.getElementById('playlistName').value = item.name || '';
        playlistItems = (item.items || []).map((i, idx) => {
          const media = mediaCache.find((m) => m.id === i.mediaId);
          return {
            id: i.id || newItemId(),
            mediaId: i.mediaId,
            mediaName: media ? (media.originalName || media.filename) : 'Медиа',
            mimeType: media ? media.mimeType : '',
            duration: i.duration ?? 10,
            order: i.order !== undefined ? i.order : idx,
          };
        });
        renderPlaylistItems();
        document.getElementById('playlistModal').classList.add('active');
      })
      .catch((err) => {
        showToast(err.message || 'Ошибка загрузки плейлиста', 'error');
      });
  }

  function closePlaylistModal() {
    document.getElementById('playlistModal').classList.remove('active');
  }

  let sendToScreensPlaylistId = null;

  function openSendToScreensModal(playlistId, playlistName) {
    sendToScreensPlaylistId = playlistId;
    document.getElementById('sendToScreensModalTitle').textContent = 'Отправить плейлист на экраны';
    document.getElementById('sendToScreensModalPlaylistName').textContent = playlistName ? 'Плейлист: «' + playlistName + '»' : '';
    var listEl = document.getElementById('sendToScreensList');
    listEl.innerHTML = '<p class="stat-label">Загрузка экранов…</p>';
    document.getElementById('sendToScreensModal').classList.add('active');
    var submitBtn = document.getElementById('sendToScreensModalSubmit');
    submitBtn.disabled = true;
    API.getScreens()
      .then(function (res) {
        var screens = res.items || [];
        if (screens.length === 0) {
          listEl.innerHTML = '<p class="stat-label">Нет добавленных экранов. Сначала создайте экраны в разделе «Экраны».</p>';
          return;
        }
        listEl.innerHTML = screens
          .map(function (s) {
            var name = escapeHtml(s.name || s.id || 'Экран');
            var online = s.isOnline ? '<span class="stat-label" style="color:var(--success);margin-left:0.25rem;">● онлайн</span>' : '';
            return (
              '<label class="send-to-screens-item" style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;cursor:pointer;">' +
              '<input type="checkbox" class="send-to-screens-checkbox" data-screen-id="' + escapeAttr(s.id) + '">' +
              '<span>' + name + online + '</span></label>'
            );
          })
          .join('');
        submitBtn.disabled = false;
      })
      .catch(function (err) {
        listEl.innerHTML = '<p class="stat-label" style="color:var(--danger);">Ошибка загрузки экранов: ' + escapeHtml(err.message || '') + '</p>';
        submitBtn.disabled = false;
      });
  }

  function closeSendToScreensModal() {
    document.getElementById('sendToScreensModal').classList.remove('active');
    sendToScreensPlaylistId = null;
  }

  function submitSendToScreens() {
    var playlistId = sendToScreensPlaylistId;
    if (!playlistId) return;
    var listEl = document.getElementById('sendToScreensList');
    var checked = listEl.querySelectorAll('.send-to-screens-checkbox:checked');
    if (!checked.length) {
      showToast('Выберите хотя бы один экран', 'error');
      return;
    }
    var screenIds = Array.prototype.map.call(checked, function (cb) { return cb.dataset.screenId; }).filter(Boolean);
    var submitBtn = document.getElementById('sendToScreensModalSubmit');
    submitBtn.disabled = true;
    var origText = submitBtn.textContent;
    submitBtn.innerHTML = '<span class="btn-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:.4rem;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;"></span>Отправка…';
    var promises = screenIds.map(function (id) { return API.updateScreen(id, { playlistId: playlistId }); });
    Promise.all(promises)
      .then(function () {
        showToast('Плейлист назначен на ' + screenIds.length + ' экран(ов)', 'success');
        closeSendToScreensModal();
        loadPlaylists();
      })
      .catch(function (err) {
        showToast(err.message || 'Ошибка назначения плейлиста', 'error');
        submitBtn.textContent = origText;
        submitBtn.disabled = false;
      });
  }

  function openMediaSelectModal() {
    Promise.all([API.getMedia(), API.getSettings()])
      .then(([mediaRes, settingsRes]) => {
        mediaCache = mediaRes.items || [];
        // settingsRes приходит как { settings: {...} }
        const s = (settingsRes && settingsRes.settings) || settingsRes || {};
        defaultImageDuration = Math.min(3600, Math.max(1, Math.round(Number(s.imageDuration) || 10)));
        const readyMedia = mediaCache.filter((m) => !m.status || m.status === 'ready');
        const grid = document.getElementById('mediaSelectGrid');
        if (readyMedia.length === 0) {
          grid.innerHTML = '<p style="text-align:center;color:var(--gray-500);padding:1rem;">Нет готовых медиафайлов</p>';
          document.getElementById('mediaSelectModal').classList.add('active');
          return;
        }
        mediaSelectReadyItems = readyMedia;
        var msiSortEl = document.getElementById('msiSort');
        if (msiSortEl) msiSortEl.value = mediaSelectSort;
        renderMediaSelectGrid(readyMedia);
        var searchEl = document.getElementById('mediaSelectSearch');
        if (searchEl) { searchEl.value = ''; }
        document.getElementById('mediaSelectModal').classList.add('active');
        if (searchEl) searchEl.focus();
      })
      .catch((err) => {
        showToast(err.message || 'Ошибка загрузки медиа', 'error');
      });
  }

  function newItemId() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function addSelectedMediaToPlaylist() {
    const grid = document.getElementById('mediaSelectGrid');
    const checked = grid.querySelectorAll('.media-select-checkbox:checked');
    let added = 0;
    checked.forEach((cb) => {
      const item = cb.closest('.media-select-item');
      if (!item) return;
      const mime = item.dataset.mime || '';
      const isVid = mime.indexOf('video/') === 0;
      const duration = isVid ? 10 : defaultImageDuration;
      playlistItems.push({
        id: newItemId(),
        mediaId: item.dataset.mediaId,
        mediaName: item.dataset.mediaName || '',
        mimeType: mime,
        duration: duration,
        order: playlistItems.length,
      });
      added++;
    });
    renderPlaylistItems();
    closeMediaSelectModal();
    if (added > 0) showToast('Добавлено: ' + added, 'success');
  }

  window.addSelectedMediaToPlaylist = addSelectedMediaToPlaylist;

  window.openMediaSelectModal = openMediaSelectModal;

  function closeMediaSelectModal() {
    document.getElementById('mediaSelectModal').classList.remove('active');
  }

  window.closeMediaSelectModal = closeMediaSelectModal;

  function getMediaCountInPlaylist(mediaId, items) {
    return (items || []).filter((it) => it.mediaId === mediaId).length;
  }

  function openPlaylistMediaPreview(media) {
    const modal = document.getElementById('playlistPreviewModal');
    const titleEl = document.getElementById('playlistPreviewTitle');
    const videoEl = document.getElementById('playlistPreviewVideo');
    const imgEl = document.getElementById('playlistPreviewImage');
    if (!modal || !titleEl || !videoEl || !imgEl || !media) return;
    const name = media.originalName || media.filename || 'Медиа';
    const isVid = media.mimeType && media.mimeType.startsWith('video/');
    const src = getMediaThumbUrl(media) || '';
    titleEl.textContent = escapeHtml(name);
    if (isVid) {
      imgEl.style.display = 'none';
      imgEl.removeAttribute('src');
      videoEl.style.display = 'block';
      // убираем #t=2 если есть
      const cleanSrc = src.split('#')[0];
      videoEl.src = cleanSrc;
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

  function closePlaylistMediaPreview() {
    const modal = document.getElementById('playlistPreviewModal');
    const videoEl = document.getElementById('playlistPreviewVideo');
    const imgEl = document.getElementById('playlistPreviewImage');
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

  function renderPlaylistItems() {
    const ul = document.getElementById('playlistItems');
    ul.innerHTML = '';
    const sorted = [...playlistItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    sorted.forEach((item, idx) => {
      const order = idx;
      item.order = order;
      const media = mediaCache.find((m) => m.id === item.mediaId);
      const isVid = isVideo(media) || (item.mimeType && item.mimeType.startsWith('video/'));
      const name = item.mediaName || media?.originalName || media?.filename || 'Медиа';
      const thumbUrl = media ? getMediaThumbUrl(media) : null;
      const dupCount = getMediaCountInPlaylist(item.mediaId, playlistItems);
      const dupBadge = dupCount > 1 ? '<span class="playlist-item-dup-badge" title="Один и тот же файл в плейлисте несколько раз">×' + dupCount + '</span>' : '';
      const li = document.createElement('li');
      li.className = 'playlist-item';
      li.draggable = true;
      li.dataset.index = String(idx);
      li.dataset.itemId = item.id;
      const vidDur = isVid && media && media.durationSeconds
        ? formatDurationSeconds(media.durationSeconds)
        : null;
      let thumbHtml;
      if (isVid && thumbUrl) {
        thumbHtml = `<div class="item-thumb" style="position:relative;overflow:hidden;"><video src="${thumbUrl}#t=2" preload="metadata" muted style="width:100%;height:100%;object-fit:cover;"></video></div>`;
      } else if (!isVid && thumbUrl) {
        thumbHtml = `<img class="item-thumb" src="${thumbUrl}" alt="">`;
      } else {
        thumbHtml = `<div class="item-thumb" style="background:var(--gray-200);display:flex;align-items:center;justify-content:center;color:var(--gray-400);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>`;
      }

      var durationHtml = isVid
        ? '<div class="item-duration" style="display:flex;align-items:center;"><span style="font-size:.75rem;color:var(--gray-500);white-space:nowrap;">' + (vidDur || '—') + '</span></div>'
        : '<div class="item-duration"><input type="number" min="1" max="3600" value="' + item.duration + '" data-item-id="' + escapeAttr(item.id) + '"></div>';
      li.innerHTML = ''
        + '<span class="drag-handle" aria-label="Перетащить" title="Перетащить для изменения порядка">⠿</span>'
        + thumbHtml
        + '<span class="item-name">' + escapeHtml(name) + dupBadge + '</span>'
        + durationHtml
        + '<button type="button" class="btn btn-secondary btn-icon btn-sm" data-action="dup-item" title="Дублировать этот элемент" aria-label="Дублировать">⧉</button>'
        + '<button type="button" class="btn btn-danger btn-icon btn-sm" data-action="rm-item" title="Удалить">×</button>';
      li.querySelector('[data-action="dup-item"]').addEventListener('click', function () {
        window.duplicatePlaylistItem(item.id);
      });
      li.querySelector('[data-action="rm-item"]').addEventListener('click', function () {
        window.removePlaylistItem(item.id);
      });
      const thumbEl = li.querySelector('.item-thumb');
      if (thumbEl && media) {
        thumbEl.style.cursor = 'pointer';
        thumbEl.addEventListener('click', function () {
          openPlaylistMediaPreview(media);
        });
      }
      if (!isVid) {
        li.querySelector('input').addEventListener('change', (e) => {
          const val = parseInt(e.target.value, 10);
          const p = playlistItems.find((x) => x.id === item.id);
          if (p && !isNaN(val) && val >= 1) p.duration = val;
        });
      }
      li.addEventListener('dragstart', onDragStart);
      li.addEventListener('dragover', onDragOver);
      li.addEventListener('drop', onDrop);
      li.addEventListener('dragend', onDragEnd);
      ul.appendChild(li);
    });

    const totalDurationEl = document.getElementById('playlistTotalDuration');
    if (totalDurationEl) {
      if (!playlistItems.length) {
        totalDurationEl.textContent = '';
        return;
      }
      const mediaMapFromCache = new Map(mediaCache.map((m) => [m.id, { mimeType: m.mimeType, durationSeconds: m.durationSeconds }]));
      const totalSeconds = computePlaylistDurationSeconds(playlistItems, mediaMapFromCache);
      const text = formatDurationSeconds(totalSeconds);
      totalDurationEl.textContent = text ? ('Длительность цикла: ' + text) : '';
    }
  }

  window.removePlaylistItem = function (itemId) {
    playlistItems = playlistItems.filter((p) => p.id !== itemId);
    playlistItems.forEach((p, i) => (p.order = i));
    renderPlaylistItems();
  };

  window.duplicatePlaylistItem = function (itemId) {
    const item = playlistItems.find((p) => p.id === itemId);
    if (!item) return;
    const copy = {
      id: newItemId(),
      mediaId: item.mediaId,
      mediaName: item.mediaName,
      mimeType: item.mimeType,
      duration: item.duration ?? 10,
      order: (item.order ?? 0) + 0.5,
    };
    playlistItems.push(copy);
    playlistItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    playlistItems.forEach((p, i) => (p.order = i));
    renderPlaylistItems();
  };

  let draggedEl = null;

  function onDragStart(e) {
    draggedEl = e.currentTarget;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.currentTarget.dataset.index);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.currentTarget;
    if (target !== draggedEl && target.classList.contains('playlist-item')) {
      const ul = document.getElementById('playlistItems');
      const all = Array.from(ul.querySelectorAll('.playlist-item'));
      const dragIdx = all.indexOf(draggedEl);
      const targetIdx = all.indexOf(target);
      if (dragIdx < targetIdx) {
        target.parentNode.insertBefore(draggedEl, target.nextSibling);
      } else {
        target.parentNode.insertBefore(draggedEl, target);
      }
    }
  }

  function onDrop(e) {
    e.preventDefault();
    recalcOrderFromDom();
  }

  function onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    draggedEl = null;
  }

  function recalcOrderFromDom() {
    const ul = document.getElementById('playlistItems');
    const lis = ul.querySelectorAll('.playlist-item');
    const orderById = {};
    lis.forEach((li, idx) => {
      const id = li.dataset.itemId;
      if (id) orderById[id] = idx;
    });
    playlistItems.forEach((p) => {
      if (orderById[p.id] !== undefined) p.order = orderById[p.id];
    });
    playlistItems.sort((a, b) => a.order - b.order);
    renderPlaylistItems();
  }

  function savePlaylist() {
    if (savePlaylistInProgress) return;
    const name = document.getElementById('playlistName').value?.trim();
    if (!name) {
      showToast('Введите название плейлиста', 'error');
      return;
    }
    savePlaylistInProgress = true;
    var saveBtn = document.querySelector('#playlistModal .modal-footer .btn-primary');
    if (saveBtn) saveBtn.disabled = true;

    const inputs = document.querySelectorAll('#playlistItems .item-duration input:not([disabled])');
    inputs.forEach((inp) => {
      const id = inp.dataset.itemId;
      const val = parseInt(inp.value, 10);
      const p = playlistItems.find((x) => x.id === id);
      if (p && !isNaN(val) && val >= 1) p.duration = val;
    });
    const items = playlistItems.map((p, idx) => ({
      id: p.id,
      mediaId: p.mediaId,
      duration: p.duration ?? 10,
      order: idx,
    }));

    if (editingPlaylistId) {
      API.updatePlaylist(editingPlaylistId, { name, items })
        .then(() => {
          showToast('Плейлист сохранён', 'success');
          closePlaylistModal();
          loadPlaylists();
        })
        .catch((err) => {
          showToast(err.message || 'Ошибка сохранения', 'error');
          savePlaylistInProgress = false;
          if (saveBtn) saveBtn.disabled = false;
        });
    } else {
      API.createPlaylist({ name, items })
        .then(() => {
          showToast('Плейлист создан', 'success');
          closePlaylistModal();
          loadPlaylists();
        })
        .catch((err) => {
          showToast(err.message || 'Ошибка создания', 'error');
          savePlaylistInProgress = false;
          if (saveBtn) saveBtn.disabled = false;
        });
    }
  }

  window.openCreateModal = openCreateModal;
  window.closePlaylistModal = closePlaylistModal;
  window.savePlaylist = savePlaylist;
  window.openEditModal = openEditModal;
  window.openMediaSelectModal = openMediaSelectModal;
  window.duplicatePlaylist = duplicatePlaylist;

  function duplicatePlaylist(id) {
    var newId = null;
    API.getPlaylist(id)
      .then(function (res) {
        var pl = res.item || res;
        var items = (pl.items || []).map(function (it, idx) {
          return { mediaId: it.mediaId, duration: it.duration ?? 10, order: idx };
        });
        var newName = (pl.name || 'Плейлист').trim() + ' (копия)';
        return API.createPlaylist({ name: newName, items });
      })
      .then(function (createRes) {
        var created = (createRes && createRes.item) || createRes || {};
        newId = created.id || null;
        showToast('Плейлист скопирован', 'success');
        return loadPlaylists();
      })
      .then(function () {
        if (!newId) return;
        var listEl = document.getElementById('playlistsList');
        if (!listEl) return;
        var origCard = listEl.querySelector('[data-playlist-id="' + id + '"]');
        var newCard = listEl.querySelector('[data-playlist-id="' + newId + '"]');
        if (origCard && newCard && origCard !== newCard) {
          origCard.parentNode.insertBefore(newCard, origCard.nextSibling);
          newCard.style.transition = 'box-shadow .4s';
          newCard.style.boxShadow = '0 0 0 2px var(--primary)';
          setTimeout(function () { newCard.style.boxShadow = ''; }, 1500);
        }
      })
      .catch(function (err) {
        showToast(err.message || 'Ошибка копирования', 'error');
      });
  }

  function deletePlaylist(btn) {
    var id = btn.dataset.id;
    var name = (btn.getAttribute('data-name') || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<');
    var card = btn.closest('.card');
    if (card) { card.style.opacity = '.4'; card.style.pointerEvents = 'none'; }
    showUndoToast(
      'Плейлист «' + name + '» удалён.',
      function () {
        API.deletePlaylist(id)
          .then(function () { loadPlaylists(); })
          .catch(function (err) { showToast(err.message || 'Ошибка удаления', 'error'); loadPlaylists(); });
      },
      function () {
        if (card) { card.style.opacity = ''; card.style.pointerEvents = ''; }
      }
    );
  }

  window.deletePlaylist = deletePlaylist;

  var listEl = document.getElementById('playlistsList');
  if (listEl) {
    listEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      var id = btn.dataset.id;
      if (action === 'playlist-edit' && id) openEditModal(id);
      else if (action === 'playlist-duplicate' && id) duplicatePlaylist(id);
      else if (action === 'playlist-delete') deletePlaylist(btn);
      else if (action === 'playlist-send-to-screens' && id) openSendToScreensModal(id, (btn.dataset.name || '').trim());
      else if (action === 'playlist-go-screens' && id) {
        window.location.href = '/admin/screens.html?playlistId=' + encodeURIComponent(id);
      }
    });
  }

  document.getElementById('playlistModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closePlaylistModal();
  });
  document.getElementById('mediaSelectModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeMediaSelectModal();
  });
  var sendToScreensModalEl = document.getElementById('sendToScreensModal');
  if (sendToScreensModalEl) {
    sendToScreensModalEl.addEventListener('click', function (e) {
      if (e.target === sendToScreensModalEl || e.target.classList.contains('modal-overlay')) closeSendToScreensModal();
    });
  }
  document.getElementById('sendToScreensModalClose').addEventListener('click', closeSendToScreensModal);
  document.getElementById('sendToScreensModalCancel').addEventListener('click', closeSendToScreensModal);
  document.getElementById('sendToScreensSelectAll').addEventListener('click', function () {
    document.querySelectorAll('#sendToScreensList .send-to-screens-checkbox').forEach(function (cb) { cb.checked = true; });
  });
  document.getElementById('sendToScreensDeselectAll').addEventListener('click', function () {
    document.querySelectorAll('#sendToScreensList .send-to-screens-checkbox').forEach(function (cb) { cb.checked = false; });
  });
  document.getElementById('sendToScreensModalSubmit').addEventListener('click', submitSendToScreens);

  document.addEventListener('keydown', (e) => {
    // Ctrl+S / Cmd+S: save playlist if modal is open
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      const playlistModal = document.getElementById('playlistModal');
      if (playlistModal && playlistModal.classList.contains('active')) {
        e.preventDefault();
        savePlaylist();
        return;
      }
    }
    if (e.key !== 'Escape') return;
    const playlistModal = document.getElementById('playlistModal');
    const mediaModal = document.getElementById('mediaSelectModal');
    const sendModal = document.getElementById('sendToScreensModal');
    if (playlistModal && playlistModal.classList.contains('active')) {
      closePlaylistModal();
    }
    if (mediaModal && mediaModal.classList.contains('active')) {
      closeMediaSelectModal();
    }
    if (sendModal && sendModal.classList.contains('active')) {
      closeSendToScreensModal();
    }
  });

  var logoutBtn = document.getElementById('sidebarLogoutBtn');
  if (logoutBtn && typeof API !== 'undefined') {
    logoutBtn.addEventListener('click', function () { API.logout().then(function () { location.href = '/login.html'; }); });
  }
  var btnCreate = document.getElementById('btnCreatePlaylist');
  if (btnCreate) btnCreate.addEventListener('click', openCreateModal);
  var playlistModalClose = document.getElementById('playlistModalClose');
  if (playlistModalClose) playlistModalClose.addEventListener('click', closePlaylistModal);
  var btnAddMedia = document.getElementById('btnAddMediaInPlaylist');
  if (btnAddMedia) btnAddMedia.addEventListener('click', openMediaSelectModal);
  var playlistModalCancel = document.getElementById('playlistModalCancel');
  if (playlistModalCancel) playlistModalCancel.addEventListener('click', closePlaylistModal);
  var playlistModalSave = document.getElementById('playlistModalSave');
  if (playlistModalSave) playlistModalSave.addEventListener('click', savePlaylist);
  var mediaSelectModalClose = document.getElementById('mediaSelectModalClose');
  if (mediaSelectModalClose) mediaSelectModalClose.addEventListener('click', closeMediaSelectModal);
  var mediaSelectModalCancel = document.getElementById('mediaSelectModalCancel');
  if (mediaSelectModalCancel) mediaSelectModalCancel.addEventListener('click', closeMediaSelectModal);
  var mediaSelectAddBtn = document.getElementById('mediaSelectAddBtn');
  if (mediaSelectAddBtn) mediaSelectAddBtn.addEventListener('click', addSelectedMediaToPlaylist);

  ['msiViewGrid', 'msiViewList'].forEach(function (btnId) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', function () {
      mediaSelectView = btnId === 'msiViewGrid' ? 'grid' : 'list';
      localStorage.setItem('mediaSelectView', mediaSelectView);
      if (mediaSelectReadyItems.length) renderMediaSelectGrid(mediaSelectReadyItems);
    });
  });

  var msiSortEl = document.getElementById('msiSort');
  if (msiSortEl) {
    msiSortEl.addEventListener('change', function () {
      mediaSelectSort = msiSortEl.value;
      localStorage.setItem('mediaSelectSort', mediaSelectSort);
      if (mediaSelectReadyItems.length) renderMediaSelectGrid(mediaSelectReadyItems);
    });
  }

  // Media-select search: filter grid items by name
  var mediaSelectSearchEl = document.getElementById('mediaSelectSearch');
  if (mediaSelectSearchEl) {
    mediaSelectSearchEl.addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      var grid = document.getElementById('mediaSelectGrid');
      if (!grid) return;
      grid.querySelectorAll('.media-select-item').forEach(function (item) {
        var name = (item.dataset.mediaName || '').toLowerCase();
        item.style.display = (!q || name.indexOf(q) >= 0) ? '' : 'none';
      });
    });
    mediaSelectSearchEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { this.value = ''; this.dispatchEvent(new Event('input')); }
    });
  }

  var playlistPreviewModal = document.getElementById('playlistPreviewModal');
  var playlistPreviewClose = document.getElementById('playlistPreviewClose');
  if (playlistPreviewModal) {
    playlistPreviewModal.addEventListener('click', function (ev) {
      if (ev.target === playlistPreviewModal || ev.target.classList.contains('modal-overlay')) {
        closePlaylistMediaPreview();
      }
    });
  }
  if (playlistPreviewClose) {
    playlistPreviewClose.addEventListener('click', closePlaylistMediaPreview);
  }

  loadPlaylists();
})();
