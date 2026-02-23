(function () {
  let editingPlaylistId = null;
  let mediaCache = [];
  let playlistItems = [];
  let savePlaylistInProgress = false;

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

  function loadPlaylists() {
    Promise.all([API.getPlaylists(), API.getScreens()])
      .then(([playlistsRes, screensRes]) => {
        const items = playlistsRes.items || [];
        const screensMap = buildPlaylistScreensMap(screensRes.items || []);
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
            const screensText = screenCount === 0
              ? 'Не назначен экранам'
              : screenCount === 1
                ? 'На экране: ' + escapeHtml(screenNames[0])
                : 'На экранах (' + screenCount + '): ' + screenNames.slice(0, 3).map(escapeHtml).join(', ') + (screenCount > 3 ? ' …' : '');
            return `
          <div class="card" style="margin-bottom: 1rem;">
            <div class="card-body" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
              <div>
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${escapeHtml(pl.name)}</div>
                <div class="stat-label">${(pl.items || []).length} элементов</div>
                <div class="stat-label playlist-screens-info">${screensText}</div>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary btn-sm" onclick="openEditModal('${escapeAttr(pl.id)}')">Редактировать</button>
                <button class="btn btn-secondary btn-sm" onclick="duplicatePlaylist('${escapeAttr(pl.id)}')">Дублировать</button>
                <button class="btn btn-danger btn-sm" data-id="${escapeAttr(pl.id)}" data-name="${escapeAttr(pl.name || '')}" onclick="deletePlaylist(this)">Удалить</button>
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
        playlistItems = (item.items || []).map((i) => {
          const media = mediaCache.find((m) => m.id === i.mediaId);
          return {
            id: i.id,
            mediaId: i.mediaId,
            mediaName: media ? (media.originalName || media.filename) : 'Медиа',
            mimeType: media ? media.mimeType : '',
            duration: i.duration ?? 10,
            order: i.order,
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
    API.getMedia()
      .then((res) => {
        mediaCache = res.items || [];
        const readyMedia = mediaCache.filter((m) => !m.status || m.status === 'ready');
        const grid = document.getElementById('mediaSelectGrid');
        if (readyMedia.length === 0) {
          grid.innerHTML = '<p style="text-align:center;color:var(--gray-500);padding:1rem;">Нет готовых медиафайлов</p>';
          document.getElementById('mediaSelectModal').classList.add('active');
          return;
        }
        grid.innerHTML = readyMedia
          .map(
            (m) => {
              const alreadyInPlaylist = playlistItems.some((p) => p.mediaId === m.id);
              return `
          <label class="media-select-item ${alreadyInPlaylist ? 'media-select-item-disabled' : ''}" data-media-id="${m.id}" data-media-name="${escapeHtml(m.originalName || m.filename || '')}" data-mime="${escapeHtml(m.mimeType || '')}">
            <input type="checkbox" class="media-select-checkbox" ${alreadyInPlaylist ? 'disabled' : ''}>
            ${m.mimeType && m.mimeType.startsWith('video/') ? `<div style="position:relative;"><video src="${getMediaThumbUrl(m)}#t=0.5" preload="metadata" muted style="width:100%;height:80px;object-fit:cover;"></video><span style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,.7);color:#fff;font-size:.6rem;padding:1px 4px;border-radius:3px;">VIDEO</span></div>` : `<img src="${getMediaThumbUrl(m) || ''}" alt="">`}
            <div class="name">${escapeHtml(m.originalName || m.filename || '')}</div>
          </label>
        `;
            }
          )
          .join('');
        document.getElementById('mediaSelectModal').classList.add('active');
      })
      .catch((err) => {
        showToast(err.message || 'Ошибка загрузки медиа', 'error');
      });
  }

  function addSelectedMediaToPlaylist() {
    const grid = document.getElementById('mediaSelectGrid');
    const checked = grid.querySelectorAll('.media-select-checkbox:checked:not([disabled])');
    let added = 0;
    checked.forEach((cb) => {
      const item = cb.closest('.media-select-item');
      if (!item || playlistItems.some((p) => p.mediaId === item.dataset.mediaId)) return;
      playlistItems.push({
        mediaId: item.dataset.mediaId,
        mediaName: item.dataset.mediaName || '',
        mimeType: item.dataset.mime || '',
        duration: 10,
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
      const li = document.createElement('li');
      li.className = 'playlist-item';
      li.draggable = true;
      li.dataset.index = String(idx);
      li.dataset.mediaId = item.mediaId;
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
        <span class="item-name">${escapeHtml(name)}</span>
        ${isVid
          ? '<div class="item-duration" style="display:flex;align-items:center;"><span style="font-size:.75rem;color:var(--gray-500);white-space:nowrap;">до конца</span></div>'
          : `<div class="item-duration"><input type="number" min="1" max="3600" value="${item.duration}" data-media-id="${escapeAttr(item.mediaId)}"></div>`
        }
        <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="removePlaylistItem('${escapeAttr(item.mediaId)}')" title="Удалить">×</button>
      `;
      if (!isVid) {
        li.querySelector('input').addEventListener('change', (e) => {
          const val = parseInt(e.target.value, 10);
          const p = playlistItems.find((x) => x.mediaId === item.mediaId);
          if (p && !isNaN(val) && val >= 1) p.duration = val;
        });
      }
      li.addEventListener('dragstart', onDragStart);
      li.addEventListener('dragover', onDragOver);
      li.addEventListener('drop', onDrop);
      li.addEventListener('dragend', onDragEnd);
      ul.appendChild(li);
    });
  }

  window.removePlaylistItem = function (mediaId) {
    playlistItems = playlistItems.filter((p) => p.mediaId !== mediaId);
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
    const orderByMediaId = {};
    lis.forEach((li, idx) => {
      const mid = li.dataset.mediaId;
      if (mid) orderByMediaId[mid] = idx;
    });
    playlistItems.forEach((p) => {
      if (orderByMediaId[p.mediaId] !== undefined) p.order = orderByMediaId[p.mediaId];
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
      const mid = inp.dataset.mediaId;
      const val = parseInt(inp.value, 10);
      const p = playlistItems.find((x) => x.mediaId === mid);
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

  document.getElementById('playlistModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closePlaylistModal();
  });
  document.getElementById('mediaSelectModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeMediaSelectModal();
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

  loadPlaylists();
})();
