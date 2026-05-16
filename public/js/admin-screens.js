(function () {
  const screensList = document.getElementById('screensList');
  const screenModal = document.getElementById('screenModal');
  const screenModalTitle = document.getElementById('screenModalTitle');
  const screenForm = document.getElementById('screenForm');
  const screenIdInput = document.getElementById('screenId');
  const screenNameInput = document.getElementById('screenName');
  const screenPlaylistSelect = document.getElementById('screenPlaylist');
  let saveInProgress = false;
  let screenFilter = 'all';
  let lastScreens = [];
  let lastPlaylistMap = null;
  const SCREENS_SORT_KEY = 'screensSort';
  const SCREENS_SORT_VALUES = ['name-asc', 'name-desc', 'status', 'lastSeen-desc', 'lastSeen-asc'];

  function getScreensSort() {
    try {
      var s = localStorage.getItem(SCREENS_SORT_KEY);
      if (SCREENS_SORT_VALUES.indexOf(s) >= 0) return s;
    } catch (e) {}
    return 'status';
  }

  function setScreensSort(value) {
    try {
      localStorage.setItem(SCREENS_SORT_KEY, value);
    } catch (e) {}
  }

  function sortScreens(list, order) {
    if (!list || list.length === 0) return list;
    var arr = list.slice();
    if (order === 'name-asc') {
      arr.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'ru'); });
    } else if (order === 'name-desc') {
      arr.sort(function (a, b) { return (b.name || '').localeCompare(a.name || '', 'ru'); });
    } else if (order === 'status') {
      arr.sort(function (a, b) {
        var ao = a.isOnline ? 2 : (a.lastSeenAt ? 1 : 0);
        var bo = b.isOnline ? 2 : (b.lastSeenAt ? 1 : 0);
        if (bo !== ao) return bo - ao;
        return (b.lastSeenAt || 0) - (a.lastSeenAt || 0);
      });
    } else if (order === 'lastSeen-desc') {
      arr.sort(function (a, b) { return (b.lastSeenAt || 0) - (a.lastSeenAt || 0); });
    } else if (order === 'lastSeen-asc') {
      arr.sort(function (a, b) { return (a.lastSeenAt || 0) - (b.lastSeenAt || 0); });
    }
    return arr;
  }

  function getScreensSearchQuery() {
    var el = document.getElementById('screensSearch');
    return (el && el.value) ? el.value.trim().toLowerCase() : '';
  }

  function filterScreensBySearch(list, query) {
    if (!query) return list;
    return list.filter(function (s) {
      var name = (s.name || '').toLowerCase();
      var id = (s.id || '').toLowerCase();
      return name.indexOf(query) >= 0 || id.indexOf(query) >= 0;
    });
  }

  function getFilterFromUrl() {
    var p = new URLSearchParams(window.location.search);
    var f = (p.get('filter') || '').toLowerCase();
    return f === 'online' || f === 'offline' ? f : 'all';
  }

  function getPlaylistFilterFromUrl() {
    var p = new URLSearchParams(window.location.search);
    var id = (p.get('playlistId') || '').trim();
    return id || null;
  }

  function setFilter(filter) {
    screenFilter = filter;
    document.querySelectorAll('.screens-filter-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
  }

  let currentPlaylistFilterId = null;

  function applyFilterAndRender() {
    if (!lastPlaylistMap) return;
    var searchQuery = getScreensSearchQuery();
    var bySearch = filterScreensBySearch(lastScreens, searchQuery);
    var filtered = bySearch.filter(function (s) {
      if (screenFilter === 'online') return s.isOnline === true;
      if (screenFilter === 'offline') return s.isOnline !== true;
      if (currentPlaylistFilterId && s.playlistId !== currentPlaylistFilterId) return false;
      return true;
    });
    var order = getScreensSort();
    var sorted = sortScreens(filtered, order);
    screensList.innerHTML = '';
    if (sorted.length === 0) {
      var emptyMsg = searchQuery ? 'Нет экранов по запросу' : (screenFilter === 'all' ? 'Нет экранов' : 'Нет экранов в этой категории');
      screensList.innerHTML = '<tr><td colspan="5" class="empty-state">' + emptyMsg + '</td></tr>';
    } else {
      sorted.forEach(function (s) { screensList.appendChild(renderRow(s, lastPlaylistMap)); });
    }
  }

  function updateCounts(countAll, countOnline, countOffline) {
    var elAll = document.getElementById('screensCountAll');
    var elOn = document.getElementById('screensCountOnline');
    var elOff = document.getElementById('screensCountOffline');
    if (elAll) elAll.textContent = countAll;
    if (elOn) elOn.textContent = countOnline;
    if (elOff) elOff.textContent = countOffline;
  }

  function getStatusClass(screen) {
    if (!screen.lastSeenAt) return 'never';
    return screen.isOnline ? 'online' : 'offline';
  }

  function getPlayerUrl(screenId) {
    return window.location.origin + '/player/index.html?id=' + encodeURIComponent(screenId);
  }

  function copyLink(id) {
    const url = getPlayerUrl(id);
    navigator.clipboard.writeText(url).then(
      () => showToast('Ссылка скопирована', 'success'),
      () => showToast('Не удалось скопировать', 'error')
    );
  }

  function downloadPlayerFile(id, name) {
    const url = getPlayerUrl(id);
    const safeUrl = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const jsUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const brand = (window.__brand && window.__brand.systemName) || 'NeoFit TV';
    const titleText = escapeHtml(name || brand);
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>${titleText}</title>
<style>*{margin:0;padding:0;}html,body{width:100%;height:100%;overflow:hidden;background:#000;}</style>
</head><body>
<script>window.location.replace("${jsUrl}");<\/script>
<noscript><meta http-equiv="refresh" content="0;url=${safeUrl}"></noscript>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (name || (brand + ' Player')).replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_') + '.html';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Файл скачан', 'success');
  }

  function getStatusLabel(screen) {
    if (!screen.lastSeenAt) return 'никогда';
    return screen.isOnline ? 'онлайн' : 'офлайн';
  }

  function formatMetrics(m) {
    if (!m || !m.ts) return '';
    var parts = [];
    if (m.totalFrames > 0) {
      var color = m.dropPercent > 5 ? 'var(--danger)' : m.dropPercent > 2 ? 'var(--warning, orange)' : 'var(--success, green)';
      parts.push('<span style="color:' + color + '">' + escapeHtml(m.dropPercent + '% drop') + '</span>');
    }
    parts.push(m.fromCache ? 'cache' : 'net');
    if (m.blobTimeMs > 0) parts.push(m.blobTimeMs + 'ms blob');
    if (m.canplayTimeMs > 0) parts.push(m.canplayTimeMs + 'ms canplay');
    if (m.fileSizeKb > 0) parts.push(Math.round(m.fileSizeKb / 1024) + ' MB');
    return '<div style="font-size:.7rem;color:var(--gray-500);margin-top:2px;">' + parts.join(' · ') + '</div>';
  }

  function renderRow(screen, playlistMap) {
    const tr = document.createElement('tr');
    const statusClass = getStatusClass(screen);
    const statusLabel = getStatusLabel(screen);
    const lastSeenText = timeAgo(screen.lastSeenAt);
    let playlistText;
    if (!screen.playlistId) {
      playlistText = 'Без плейлиста';
    } else if (playlistMap.has(screen.playlistId)) {
      const name = playlistMap.get(screen.playlistId)?.name || '—';
      playlistText = name;
    } else {
      playlistText = 'Плейлист удалён';
    }

    tr.innerHTML = `
      <td data-label="Статус">
        <span class="status">
          <span class="status-dot ${statusClass}"></span>
          ${escapeHtml(statusLabel)}
        </span>
      </td>
      <td data-label="Название">${escapeHtml(screen.name)}</td>
      <td data-label="Плейлист" class="playlist-cell" data-action="quick-assign-cell" data-screen-id="${escapeAttr(screen.id)}" data-playlist-id="${escapeAttr(screen.playlistId || '')}" title="Нажмите для изменения плейлиста" style="cursor:pointer;">${
        (!screen.playlistId || !playlistMap.has(screen.playlistId))
          ? '<span class="quick-assign-label">' + escapeHtml(playlistText) + '</span>'
          : `<span class="quick-assign-label"><button type="button" class="link-button" data-action="screen-go-playlist" data-playlist-id="${escapeAttr(screen.playlistId)}" style="background:none;border:none;padding:0;color:var(--primary);text-decoration:underline;cursor:pointer;">${escapeHtml(playlistText)}</button></span>`
      }</td>
      <td data-label="Последняя активность">${escapeHtml(lastSeenText)}${formatMetrics(screen.playbackMetrics)}</td>
      <td data-label="Действия" class="screens-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-action="screen-edit" data-id="${escapeAttr(screen.id)}">Редактировать</button>
        <a href="${escapeAttr(getPlayerUrl(screen.id))}" target="_blank" class="btn btn-secondary btn-sm screens-secondary-btn">Открыть плеер</a>
        <button type="button" class="btn btn-secondary btn-sm screens-secondary-btn" data-action="screen-copy-link" data-id="${escapeAttr(screen.id)}">Копировать ссылку</button>
        <button type="button" class="btn btn-secondary btn-sm screens-secondary-btn" data-action="screen-download" data-id="${escapeAttr(screen.id)}" data-name="${escapeAttr(screen.name || '')}">Выгрузить ссылку</button>
        <button type="button" class="btn btn-danger btn-sm" data-action="screen-delete" data-id="${escapeAttr(screen.id)}" data-name="${escapeAttr(screen.name || '')}">Удалить</button>
        <div class="screens-actions-more">
          <button type="button" class="btn btn-secondary btn-sm screens-more-toggle" data-action="screens-more-toggle" title="Ещё действия">⋯</button>
          <div class="screens-more-menu">
            <a href="${escapeAttr(getPlayerUrl(screen.id))}" target="_blank" class="screens-more-item">Открыть плеер</a>
            <button type="button" class="screens-more-item" data-action="screen-copy-link" data-id="${escapeAttr(screen.id)}">Копировать ссылку</button>
            <button type="button" class="screens-more-item" data-action="screen-download" data-id="${escapeAttr(screen.id)}" data-name="${escapeAttr(screen.name || '')}">Выгрузить ссылку</button>
          </div>
        </div>
      </td>
    `;
    return tr;
  }

  function openQuickAssign(cell) {
    if (cell.querySelector('.quick-assign-select')) return; // already open
    var screenId = cell.dataset.screenId;
    var currentPlaylistId = cell.dataset.playlistId || '';
    var labelEl = cell.querySelector('.quick-assign-label');
    var originalHTML = cell.innerHTML;

    var select = document.createElement('select');
    select.className = 'quick-assign-select';
    var noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '— Без плейлиста —';
    select.appendChild(noneOpt);
    if (lastPlaylistMap) {
      lastPlaylistMap.forEach(function (pl, id) {
        var opt = document.createElement('option');
        opt.value = id;
        opt.textContent = pl.name;
        select.appendChild(opt);
      });
    }
    select.value = currentPlaylistId;

    cell.innerHTML = '';
    cell.appendChild(select);
    select.focus();

    function restore() {
      cell.innerHTML = originalHTML;
    }

    select.addEventListener('change', async function () {
      var newPlaylistId = select.value || null;
      select.disabled = true;
      try {
        await API.updateScreen(screenId, { playlistId: newPlaylistId });
        showToast('Плейлист обновлён', 'success');
        await loadScreens();
      } catch (err) {
        showToast(err.message || 'Ошибка сохранения', 'error');
        restore();
      }
    });

    select.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); restore(); }
    });

    select.addEventListener('blur', function () {
      setTimeout(function () {
        if (cell.contains(document.activeElement)) return;
        restore();
      }, 150);
    });
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

  async function loadScreens() {
    try {
      const [screensRes, playlistsRes] = await Promise.all([
        API.getScreens(),
        API.getPlaylists()
      ]);
      const screens = screensRes.items || [];
      const playlists = playlistsRes.items || [];
      lastPlaylistMap = new Map(playlists.map(function (p) { return [p.id, p]; }));
      lastScreens = screens;

      var countOnline = screens.filter(function (s) { return s.isOnline === true; }).length;
      updateCounts(screens.length, countOnline, screens.length - countOnline);

      applyFilterAndRender();
    } catch (err) {
      showToast(err.message || 'Ошибка загрузки экранов', 'error');
      screensList.innerHTML = '<tr><td colspan="5" class="empty-state">Ошибка загрузки</td></tr>';
    }
  }

  function openCreateModal() {
    saveInProgress = false;
    var btn = screenModal.querySelector('button[type="submit"]');
    if (btn) btn.disabled = false;
    screenModalTitle.textContent = 'Создать экран';
    screenIdInput.value = '';
    screenNameInput.value = '';
    screenPlaylistSelect.value = '';
    loadPlaylistsInDropdown();
    screenModal.classList.add('active');
  }

  async function openEditModal(id) {
    saveInProgress = false;
    var btn = screenModal.querySelector('button[type="submit"]');
    if (btn) btn.disabled = false;
    try {
      const data = await API.getScreen(id);
      const screen = data.item || data;
      screenModalTitle.textContent = 'Редактировать экран';
      screenIdInput.value = screen.id;
      screenNameInput.value = screen.name || '';
      await loadPlaylistsInDropdown();
      screenPlaylistSelect.value = screen.playlistId || '';
      screenModal.classList.add('active');
    } catch (err) {
      showToast(err.message || 'Ошибка загрузки экрана', 'error');
    }
  }

  async function loadPlaylistsInDropdown() {
    try {
      const res = await API.getPlaylists();
      const playlists = res.items || [];
      screenPlaylistSelect.innerHTML = '<option value="">— Без плейлиста —</option>';
      playlists.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        screenPlaylistSelect.appendChild(opt);
      });
    } catch (err) {
      showToast(err.message || 'Ошибка загрузки плейлистов', 'error');
    }
  }

  function closeScreenModal() {
    screenModal.classList.remove('active');
  }

  async function saveScreen(e) {
    e.preventDefault();
    if (saveInProgress) return;
    const id = screenIdInput.value.trim();
    const name = screenNameInput.value.trim();
    const playlistId = screenPlaylistSelect.value || null;

    saveInProgress = true;
    var submitBtn = screenModal.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      if (id) {
        await API.updateScreen(id, { name, playlistId });
        showToast('Экран обновлён', 'success');
      } else {
        await API.createScreen({ name, playlistId });
        showToast('Экран создан', 'success');
      }
      closeScreenModal();
      loadScreens();
    } catch (err) {
      showToast(err.message || 'Ошибка сохранения', 'error');
      saveInProgress = false;
      if (submitBtn) submitBtn.disabled = false;
    }
    // Не сбрасываем saveInProgress при успехе — иначе второй submit из очереди снова вызовет API
  }

  function deleteScreen(btn) {
    var id = btn.dataset.id;
    var name = (btn.getAttribute('data-name') || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    var row = btn.closest('tr');
    if (row) { row.style.opacity = '.4'; row.style.pointerEvents = 'none'; }
    showUndoToast(
      'Экран «' + name + '» удалён.',
      function () {
        API.deleteScreen(id)
          .then(function () { loadScreens(); })
          .catch(function (err) { showToast(err.message || 'Ошибка удаления', 'error'); loadScreens(); });
      },
      function () {
        if (row) { row.style.opacity = ''; row.style.pointerEvents = ''; }
      }
    );
  }

  function openPairByCodeModal() {
    const modal = document.getElementById('pairByCodeModal');
    const input = document.getElementById('pairCodeInput');
    if (modal && input) {
      input.value = '';
      input.placeholder = 'Например: A3X7K2';
      modal.classList.add('active');
      setTimeout(() => input.focus(), 100);
    }
  }

  function closePairByCodeModal() {
    const modal = document.getElementById('pairByCodeModal');
    if (modal) modal.classList.remove('active');
  }

  function goToPairWithCode() {
    const input = document.getElementById('pairCodeInput');
    if (!input) return;
    const code = (input.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) {
      showToast('Введите 6-символьный код (буквы и цифры)', 'error');
      return;
    }
    closePairByCodeModal();
    window.location.href = '/pair?code=' + encodeURIComponent(code);
  }

  window.openCreateModal = openCreateModal;
  window.openEditModal = openEditModal;
  window.closeScreenModal = closeScreenModal;
  window.openPairByCodeModal = openPairByCodeModal;
  window.closePairByCodeModal = closePairByCodeModal;
  window.goToPairWithCode = goToPairWithCode;
  window.saveScreen = saveScreen;
  window.deleteScreen = deleteScreen;
  window.copyLink = copyLink;
  window.downloadPlayerFile = downloadPlayerFile;

  document.addEventListener('DOMContentLoaded', function () {
    screenFilter = getFilterFromUrl();
    currentPlaylistFilterId = getPlaylistFilterFromUrl();
    setFilter(screenFilter);

    document.querySelectorAll('.screens-filter-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setFilter(btn.dataset.filter);
        applyFilterAndRender();
      });
    });

    if (screensList) {
      screensList.addEventListener('click', function (e) {
        // Toggle overflow dropdown
        var moreToggle = e.target.closest('[data-action="screens-more-toggle"]');
        if (moreToggle) {
          var wrap = moreToggle.closest('.screens-actions-more');
          if (wrap) {
            var wasOpen = wrap.classList.contains('open');
            document.querySelectorAll('.screens-actions-more.open').forEach(function (el) { el.classList.remove('open'); });
            if (!wasOpen) wrap.classList.add('open');
          }
          return;
        }
        // Close dropdown on any other click inside list
        document.querySelectorAll('.screens-actions-more.open').forEach(function (el) { el.classList.remove('open'); });
        // Quick-assign: click on playlist cell (but not on the go-to-playlist link)
        var quickCell = e.target.closest('[data-action="quick-assign-cell"]');
        if (quickCell && !e.target.closest('[data-action="screen-go-playlist"]')) {
          openQuickAssign(quickCell);
          return;
        }
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.dataset.action;
        var id = btn.dataset.id;
        var name = (btn.getAttribute('data-name') || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<');
        if (action === 'screen-edit' && id) openEditModal(id);
        else if (action === 'screen-copy-link' && id) copyLink(id);
        else if (action === 'screen-download' && id) downloadPlayerFile(id, name);
        else if (action === 'screen-delete') deleteScreen(btn);
        else if (action === 'screen-go-playlist' && btn.dataset.playlistId) {
          var pid = btn.dataset.playlistId;
          window.location.href = '/admin/playlists.html?playlistId=' + encodeURIComponent(pid);
        }
      });
    }
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.screens-actions-more')) {
        document.querySelectorAll('.screens-actions-more.open').forEach(function (el) { el.classList.remove('open'); });
      }
    });

    var sortEl = document.getElementById('screensSort');
    if (sortEl) {
      sortEl.value = getScreensSort();
      sortEl.addEventListener('change', function () {
        setScreensSort(sortEl.value);
        applyFilterAndRender();
      });
    }
    var searchEl = document.getElementById('screensSearch');
    if (searchEl) {
      searchEl.addEventListener('input', applyFilterAndRender);
      searchEl.addEventListener('keyup', function (e) { if (e.key === 'Escape') { searchEl.value = ''; applyFilterAndRender(); } });
    }

    var logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn && typeof API !== 'undefined') {
      logoutBtn.addEventListener('click', function () { API.logout().then(function () { location.href = '/login.html'; }); });
    }
    var btnAddByCode = document.getElementById('btnAddByCode');
    if (btnAddByCode) btnAddByCode.addEventListener('click', openPairByCodeModal);
    var btnCreateScreen = document.getElementById('btnCreateScreen');
    if (btnCreateScreen) btnCreateScreen.addEventListener('click', openCreateModal);
    var screenModalClose = document.getElementById('screenModalClose');
    if (screenModalClose) screenModalClose.addEventListener('click', closeScreenModal);
    var screenModalCancel = document.getElementById('screenModalCancel');
    if (screenModalCancel) screenModalCancel.addEventListener('click', closeScreenModal);
    var screenForm = document.getElementById('screenForm');
    if (screenForm) screenForm.addEventListener('submit', function (e) { saveScreen(e); });
    var pairByCodeModalClose = document.getElementById('pairByCodeModalClose');
    if (pairByCodeModalClose) pairByCodeModalClose.addEventListener('click', closePairByCodeModal);
    var pairByCodeModalCancel = document.getElementById('pairByCodeModalCancel');
    if (pairByCodeModalCancel) pairByCodeModalCancel.addEventListener('click', closePairByCodeModal);
    var pairByCodeGoBtn = document.getElementById('pairByCodeGoBtn');
    if (pairByCodeGoBtn) pairByCodeGoBtn.addEventListener('click', goToPairWithCode);
    var pairCodeInput = document.getElementById('pairCodeInput');
    if (pairCodeInput) {
      pairCodeInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); goToPairWithCode(); } });
    }

    loadScreens();
    setInterval(function () {
      if (document.querySelector('.quick-assign-select, .screens-actions-more.open')) return;
      loadScreens();
    }, 15000);
  });

  screenModal?.addEventListener('click', (e) => {
    if (e.target === screenModal) closeScreenModal();
  });

  const pairByCodeModal = document.getElementById('pairByCodeModal');
  pairByCodeModal?.addEventListener('click', (e) => {
    if (e.target === pairByCodeModal) closePairByCodeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (screenModal && screenModal.classList.contains('active')) {
      closeScreenModal();
    }
    const pairModal = document.getElementById('pairByCodeModal');
    if (pairModal && pairModal.classList.contains('active')) {
      closePairByCodeModal();
    }
  });
})();
