/**
 * Единая навигация и переключатель темы для страниц админки.
 * Подключается на всех страницах админки. Добавление пункта меню — только здесь.
 * Загружает systemName и logoUrl из /api/settings и подставляет в сайдбар и document.title.
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

  function applyBranding(settings) {
    var systemName = (settings && (settings.systemName || settings.settings && settings.settings.systemName)) || 'NeoFit TV';
    var logoUrl = (settings && (settings.logoUrl || settings.settings && settings.settings.logoUrl)) || null;
    var logoUrlWithCacheBuster = (logoUrl && logoUrl.trim())
      ? logoUrl.replace(/\?.*$/, '') + '?t=' + Date.now()
      : null;

    var pageTitle = document.body.getAttribute('data-page-title');
    if (pageTitle) {
      document.title = pageTitle + ' — ' + systemName;
    }

    var brand = document.querySelector('.sidebar-brand');
    if (brand) {
      var img = brand.querySelector('.sidebar-logo');
      var span = brand.querySelector('.sidebar-brand-name');
      if (logoUrlWithCacheBuster) {
        if (img) {
          img.src = logoUrlWithCacheBuster;
          img.alt = systemName;
          img.style.display = '';
        }
        if (span) {
          span.textContent = systemName;
          span.style.display = '';
        }
      } else {
        if (img) img.style.display = 'none';
        if (span) {
          span.textContent = systemName;
          span.style.display = '';
        }
      }
    }
    var mobileBrand = document.querySelector('.mobile-brand');
    if (mobileBrand) {
      var mImg = mobileBrand.querySelector('img');
      var mSpan = mobileBrand.querySelector('span');
      if (logoUrlWithCacheBuster) {
        if (mImg) { mImg.src = logoUrlWithCacheBuster; mImg.alt = systemName; mImg.style.display = ''; }
        if (mSpan) { mSpan.textContent = systemName; mSpan.style.display = ''; }
      } else {
        if (mImg) mImg.style.display = 'none';
        if (mSpan) { mSpan.textContent = systemName; mSpan.style.display = ''; }
      }
    }
  }

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
    html += '<a href="#" class="nav-apk-download" data-apk-url="/neofit_tv.apk" data-apk-filename="neofit_tv.apk">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + SVG_APK + '</svg>Загрузить APK</a>';
    nav.innerHTML = html;
    nav.querySelectorAll('.nav-apk-download').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var url = this.getAttribute('data-apk-url');
        var filename = this.getAttribute('data-apk-filename');
        if (!url || !filename) return;
        fetch(url, { credentials: 'include' })
          .then(function (r) {
            if (!r.ok) {
              return r.text().then(function (body) {
                throw new Error(r.status === 401 ? 'Войдите в админку' : (body || 'Ошибка загрузки'));
              });
            }
            return r.blob();
          })
          .then(function (blob) {
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            URL.revokeObjectURL(link.href);
          })
          .catch(function (err) {
            alert(err.message || 'Не удалось скачать файл');
          });
      });
    });
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
    var el = document.getElementById('theme-toggle');
    if (el && el.type === 'checkbox' && typeof window.getTheme === 'function' && typeof window.setTheme === 'function') {
      window.setTheme(window.getTheme());
      el.addEventListener('change', function () {
        window.setTheme(this.checked ? 'dark' : 'light');
      });
    }
  }

  function showAppVersion() {
    var footer = document.querySelector('.sidebar-footer');
    if (!footer) return;
    fetch('/api/system/health?_=' + Date.now(), { credentials: 'include', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.version) return;
        var existing = footer.querySelector('.sidebar-version');
        if (existing) existing.remove();
        var el = document.createElement('div');
        el.className = 'sidebar-version';
        el.style.cssText = 'font-size:11px;color:var(--gray-500);text-align:center;padding:0.35rem 0 0;';
        el.textContent = 'v' + d.version;
        footer.appendChild(el);
      })
      .catch(function () {});
  }

  function init() {
    fetch('/api/settings', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var s = (data && data.settings) ? data.settings : data || {};
        applyBranding(s);
      })
      .catch(function () {
        applyBranding({});
      })
      .then(function () {
        renderNav();
        renderThemeToggle();
        showAppVersion();
      });
  }

  init();

  // Custom confirm dialog (used for irreversible actions like backup restore)
  window.showConfirm = function (message, onConfirm, options) {
    var opts = options || {};
    var confirmLabel = opts.confirmLabel || 'Удалить';
    var confirmClass = opts.confirmClass || 'btn-danger';
    var existing = document.getElementById('_confirmDialog');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = '_confirmDialog';
    overlay.className = 'modal-overlay active';
    overlay.style.zIndex = '300';
    overlay.innerHTML =
      '<div class="modal confirm-modal" role="dialog" aria-modal="true">' +
      '<div class="modal-body" style="text-align:center;padding:1.5rem 1.5rem 1rem;">' +
      '<p>' + String(message || 'Вы уверены?') + '</p>' +
      '</div>' +
      '<div class="modal-footer" style="justify-content:center;gap:.75rem;">' +
      '<button type="button" class="btn btn-secondary" id="_confirmCancel">Отмена</button>' +
      '<button type="button" class="btn ' + confirmClass + '" id="_confirmOk">' + confirmLabel + '</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    var okBtn = overlay.querySelector('#_confirmOk');
    var cancelBtn = overlay.querySelector('#_confirmCancel');
    function close() {
      overlay.classList.remove('active');
      setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 250);
      document.removeEventListener('keydown', keyHandler);
    }
    function keyHandler(e) {
      if (e.key === 'Escape') { close(); }
      if (e.key === 'Enter') { e.preventDefault(); close(); if (onConfirm) onConfirm(); }
    }
    okBtn.addEventListener('click', function () { close(); if (onConfirm) onConfirm(); });
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', keyHandler);
    setTimeout(function () { cancelBtn.focus(); }, 50);
  };

  // Undo-toast: immediately hides item in UI, executes delete after delay, cancellable
  window.showUndoToast = function (message, onExecute, onUndo) {
    var DELAY = 5000;
    var existing = document.getElementById('_undoToast');
    if (existing) {
      var fn = existing._pendingExecute;
      if (fn) fn();
      clearTimeout(existing._timer);
      existing.remove();
    }
    var toast = document.createElement('div');
    toast.id = '_undoToast';
    toast.className = 'toast toast-undo show';
    toast.innerHTML = '<span>' + message + '</span><button type="button" class="toast-undo-btn">Отменить</button>';
    document.body.appendChild(toast);
    var cancelled = false;
    var undoBtn = toast.querySelector('.toast-undo-btn');
    function hide() {
      clearTimeout(toast._timer);
      toast.classList.remove('show');
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 350);
    }
    toast._pendingExecute = function () { if (!cancelled && onExecute) onExecute(); };
    toast._timer = setTimeout(function () { hide(); if (!cancelled && onExecute) onExecute(); }, DELAY);
    undoBtn.addEventListener('click', function () {
      cancelled = true;
      hide();
      if (onUndo) onUndo();
    });
  };
})();
