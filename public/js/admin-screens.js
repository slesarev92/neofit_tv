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

  function setFilter(filter) {
    screenFilter = filter;
    document.querySelectorAll('.screens-filter-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
  }

  function applyFilterAndRender() {
    if (!lastPlaylistMap) return;
    var searchQuery = getScreensSearchQuery();
    var bySearch = filterScreensBySearch(lastScreens, searchQuery);
    var filtered = bySearch.filter(function (s) {
      if (screenFilter === 'online') return s.isOnline === true;
      if (screenFilter === 'offline') return s.isOnline !== true;
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
    const titleText = escapeHtml(name || 'NeoFit_TV');
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>${titleText}</title>
<style>*{margin:0;padding:0;}html,body{width:100%;height:100%;overflow:hidden;background:#000;}</style>
</head><body>
<script>window.location.replace("${url}");<\/script>
<noscript><meta http-equiv="refresh" content="0;url=${url}"></noscript>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (name || 'NeoFit_TV_Player').replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '_') + '.html';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Файл скачан — откройте его с флешки на ТВ', 'success');
  }

  function getStatusLabel(screen) {
    if (!screen.lastSeenAt) return 'никогда';
    return screen.isOnline ? 'онлайн' : 'офлайн';
  }

  function renderRow(screen, playlistMap) {
    const tr = document.createElement('tr');
    const statusClass = getStatusClass(screen);
    const statusLabel = getStatusLabel(screen);
    const lastSeenText = timeAgo(screen.lastSeenAt);
    const playlistName = screen.playlistId ? (playlistMap.get(screen.playlistId)?.name || '—') : '—';

    tr.innerHTML = `
      <td data-label="Статус">
        <span class="status">
          <span class="status-dot ${statusClass}"></span>
          ${escapeHtml(statusLabel)}
        </span>
      </td>
      <td data-label="Название">${escapeHtml(screen.name)}</td>
      <td data-label="Плейлист">${escapeHtml(playlistName)}</td>
      <td data-label="Последняя активность">${escapeHtml(lastSeenText)}</td>
      <td data-label="Действия" class="screens-actions">
        <button class="btn btn-secondary btn-sm" data-id="${escapeAttr(screen.id)}" data-name="${escapeAttr(screen.name || '')}" onclick="deleteScreen(this)">Удалить</button>
        <button class="btn btn-secondary btn-sm" onclick="copyLink('${escapeAttr(screen.id)}')">Копировать ссылку</button>
        <button class="btn btn-secondary btn-sm" onclick="openEditModal('${escapeAttr(screen.id)}')">Редактировать</button>
        <a href="${escapeAttr(getPlayerUrl(screen.id))}" target="_blank" class="btn btn-secondary btn-sm">Открыть плеер</a>
        <button class="btn btn-secondary btn-sm" onclick="downloadPlayerFile('${escapeAttr(screen.id)}','${escapeAttr(screen.name)}')">Выгрузить ссылку</button>
      </td>
    `;
    return tr;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

  async function deleteScreen(btn) {
    var id = btn.dataset.id;
    var name = (btn.getAttribute('data-name') || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    if (!confirm('Удалить экран «' + name + '»?')) return;
    try {
      await API.deleteScreen(id);
      showToast('Экран удалён', 'success');
      loadScreens();
    } catch (err) {
      showToast(err.message || 'Ошибка удаления', 'error');
    }
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
    setFilter(screenFilter);

    document.querySelectorAll('.screens-filter-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setFilter(btn.dataset.filter);
        applyFilterAndRender();
      });
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
    setInterval(loadScreens, 15000);
  });

  screenModal?.addEventListener('click', (e) => {
    if (e.target === screenModal) closeScreenModal();
  });

  const pairByCodeModal = document.getElementById('pairByCodeModal');
  pairByCodeModal?.addEventListener('click', (e) => {
    if (e.target === pairByCodeModal) closePairByCodeModal();
  });
})();
