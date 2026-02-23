/**
 * Единая навигация и переключатель темы для страниц админки.
 * Подключается на всех страницах админки. Добавление пункта меню — только здесь.
 */
(function () {
  var NAV_ITEMS = [
    { href: '/admin/index.html', label: 'Дашборд', id: 'dashboard', svg: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
    { href: '/admin/media.html', label: 'Медиа', id: 'media', svg: '<rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="8" cy="8" r="2"/><path d="M22 16l-5-5L5 22"/>' },
    { href: '/admin/playlists.html', label: 'Плейлисты', id: 'playlists', svg: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>' },
    { href: '/admin/screens.html', label: 'Экраны', id: 'screens', svg: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>' },
    { href: '/admin/settings.html', label: 'Настройки', id: 'settings', svg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>' },
    { href: '/admin/docs.html', label: 'Инструкция', id: 'docs', svg: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>' },
  ];

  var SVG_APK = '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>';

  function renderNav() {
    var nav = document.getElementById('main-nav');
    if (!nav) return;
    var path = window.location.pathname;
    var html = NAV_ITEMS.map(function (item) {
      var active = path === item.href || path.endsWith(item.href.split('/').pop());
      var cls = active ? 'active' : '';
      return '<a href="' + item.href + '" class="' + cls + '">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + item.svg + '</svg>' +
        item.label + '</a>';
    }).join('');
    html += '<a href="/NeoFit_TV.apk" download="NeoFit_TV.apk">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + SVG_APK + '</svg>Загрузить APK</a>';
    nav.innerHTML = html;
  }

  function renderThemeToggle() {
    var container = document.getElementById('theme-toggle-container');
    if (!container) return;
    container.innerHTML = '<div class="theme-toggle">' +
      '<span class="theme-toggle-icon theme-toggle-icon-sun" aria-hidden="true">☀️</span>' +
      '<label class="theme-toggle-track">' +
      '<input type="checkbox" id="theme-toggle" class="theme-toggle-input" aria-label="Переключить тему">' +
      '<span class="theme-toggle-thumb"></span></label>' +
      '<span class="theme-toggle-icon theme-toggle-icon-moon" aria-hidden="true">🌙</span></div>';
  }

  renderNav();
  renderThemeToggle();
})();
