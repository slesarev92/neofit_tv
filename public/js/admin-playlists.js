(function () {
  let editingPlaylistId = null;
  let mediaCache = [];
  let playlistItems = [];
  let savePlaylistInProgress = false;
  let defaultImageDuration = 10;

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
    Promise.all([API.getPlaylists(), API.getScreens(), API.getMedia()])
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
          <div class="card" style="margin-bottom: 1rem;">
            <div class="card-body${isActive ? ' card-active' : ''}" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;${isActive ? ' border:1px solid var(--primary);box-shadow:0 0 0 1px var(--primary);' : ''}">
              <div>
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${escapeHtml(pl.name)}</div>
                <div class="stat-label">${(pl.items || []).length} элементов</div>
                <div class="stat-label playlist-screens-info">${screensHtml}</div>
                ${durationLine}
              </div>
              <div style="display: flex; gap: 0.5rem;">
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

  function openMediaSelectModal() {
    Promise.all([API.getMedia(), API.getSettings()])
      .then(([mediaRes, settingsRes]) => {
        mediaCache = mediaRes.items || [];
        // settingsRes приходит как { settings: {...} }
        const s = (settingsRes && settingsRes.settings) || settingsRes || {};
        defaultImageDuration = Math.min(3600, Math.max(1, Math.round(Number(s.imageDuration) || 10)));
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/9e083e65-9113-413f-bd68-284c44a9b523',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-playlists.js:openMediaSelectModal',message:'after set defaultImageDuration',data:{hasSettings:!!settingsRes,hasSettingsSettings:!!(settingsRes&&settingsRes.settings),sImageDuration:s.imageDuration,settingsImageDuration:settingsRes&&settingsRes.settings&&settingsRes.settings.imageDuration,defaultImageDuration:defaultImageDuration},timestamp:Date.now(),hypothesisId:'H1'})}).catch(function(){});
        // #endregion
        const readyMedia = mediaCache.filter((m) => !m.status || m.status === 'ready');
        const grid = document.getElementById('mediaSelectGrid');
        if (readyMedia.length === 0) {
          grid.innerHTML = '<p style="text-align:center;color:var(--gray-500);padding:1rem;">Нет готовых медиафайлов</p>';
          document.getElementById('mediaSelectModal').classList.add('active');
          return;
        }
        grid.innerHTML = readyMedia
          .map(
            (m) => `
          <label class="media-select-item" data-media-id="${m.id}" data-media-name="${escapeHtml(m.originalName || m.filename || '')}" data-mime="${escapeHtml(m.mimeType || '')}">
            <input type="checkbox" class="media-select-checkbox">
            ${m.mimeType && m.mimeType.startsWith('video/') ? `<div style="position:relative;"><video src="${getMediaThumbUrl(m)}#t=2" preload="metadata" muted style="width:100%;height:80px;object-fit:cover;"></video><span style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,.7);color:#fff;font-size:.6rem;padding:1px 4px;border-radius:3px;">VIDEO</span></div>` : `<img src="${getMediaThumbUrl(m) || ''}" alt="">`}
            <div class="name">${escapeHtml(m.originalName || m.filename || '')}</div>
          </label>
        `
          )
          .join('');
        document.getElementById('mediaSelectModal').classList.add('active');
      })
      .catch((err) => {
        showToast(err.message || 'Ошибка загрузки медиа', 'error');
      });
  }

  function newItemId() {
    return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  function addSelectedMediaToPlaylist() {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/9e083e65-9113-413f-bd68-284c44a9b523',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-playlists.js:addSelectedMediaToPlaylist',message:'entry',data:{defaultImageDuration:defaultImageDuration},timestamp:Date.now(),hypothesisId:'H3'})}).catch(function(){});
    // #endregion
    const grid = document.getElementById('mediaSelectGrid');
    const checked = grid.querySelectorAll('.media-select-checkbox:checked');
    let added = 0;
    checked.forEach((cb) => {
      const item = cb.closest('.media-select-item');
      if (!item) return;
      const mime = item.dataset.mime || '';
      const isVid = mime.indexOf('video/') === 0;
      const duration = isVid ? 10 : defaultImageDuration;
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/9e083e65-9113-413f-bd68-284c44a9b523',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-playlists.js:addSelectedMediaToPlaylist:item',message:'per item',data:{mime:mime,isVid:isVid,duration:duration},timestamp:Date.now(),hypothesisId:'H4'})}).catch(function(){});
      // #endregion
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
      let thumbHtml;
      if (isVid && thumbUrl) {
        thumbHtml = `<div class="item-thumb" style="position:relative;overflow:hidden;"><video src="${thumbUrl}#t=2" preload="metadata" muted style="width:100%;height:100%;object-fit:cover;"></video><span style="position:absolute;bottom:1px;right:1px;background:rgba(0,0,0,.7);color:#fff;font-size:.55rem;padding:1px 3px;border-radius:2px;">MP4</span></div>`;
      } else if (!isVid && thumbUrl) {
        thumbHtml = `<img class="item-thumb" src="${thumbUrl}" alt="">`;
      } else {
        thumbHtml = `<div class="item-thumb" style="background:var(--gray-200);display:flex;align-items:center;justify-content:center;color:var(--gray-400);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>`;
      }

      li.innerHTML = `
        <span class="drag-handle" aria-label="Перетащить">⠿</span>
        ${thumbHtml}
        <span class="item-name">${escapeHtml(name)}${dupBadge}</span>
        ${isVid
          ? '<div class="item-duration" style="display:flex;align-items:center;"><span style="font-size:.75rem;color:var(--gray-500);white-space:nowrap;">до конца</span></div>'
          : `<div class="item-duration"><input type="number" min="1" max="3600" value="${item.duration}" data-item-id="${escapeAttr(item.id)}"></div>`
        }
        <button type="button" class="btn btn-secondary btn-icon btn-sm" onclick="duplicatePlaylistItem('${escapeAttr(item.id)}')" title="Дублировать этот элемент" aria-label="Дублировать">⧉</button>
        <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="removePlaylistItem('${escapeAttr(item.id)}')" title="Удалить">×</button>
      `;
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
    API.getPlaylist(id)
      .then((res) => {
        var pl = res.item || res;
        var items = (pl.items || []).map(function (it, idx) {
          return { mediaId: it.mediaId, duration: it.duration ?? 10, order: idx };
        });
        var newName = (pl.name || 'Плейлист').trim() + ' (копия)';
        return API.createPlaylist({ name: newName, items });
      })
      .then(() => {
        showToast('Плейлист скопирован', 'success');
        loadPlaylists();
      })
      .catch((err) => {
        showToast(err.message || 'Ошибка копирования', 'error');
      });
  }

  function deletePlaylist(btn) {
    var id = btn.dataset.id;
    var name = (btn.getAttribute('data-name') || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<');
    if (!confirm('Удалить плейлист «' + name + '»?')) return;
    API.deletePlaylist(id)
      .then(() => {
        showToast('Плейлист удалён', 'success');
        loadPlaylists();
      })
      .catch((err) => {
        showToast(err.message || 'Ошибка удаления', 'error');
      });
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

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const playlistModal = document.getElementById('playlistModal');
    const mediaModal = document.getElementById('mediaSelectModal');
    if (playlistModal && playlistModal.classList.contains('active')) {
      closePlaylistModal();
    }
    if (mediaModal && mediaModal.classList.contains('active')) {
      closeMediaSelectModal();
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
