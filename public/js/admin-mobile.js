(function () {
  var sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sidebar-toggle';
  btn.setAttribute('aria-label', 'Открыть меню');
  btn.innerHTML = '<span class="sidebar-toggle-bar"></span><span class="sidebar-toggle-bar"></span><span class="sidebar-toggle-bar"></span>';
  btn.addEventListener('click', function () {
    document.body.classList.toggle('sidebar-open');
    btn.setAttribute('aria-label', document.body.classList.contains('sidebar-open') ? 'Закрыть меню' : 'Открыть меню');
  });

  var header = document.createElement('div');
  header.className = 'mobile-header';
  var brand = document.createElement('div');
  brand.className = 'mobile-brand';
  var img = document.createElement('img');
  img.src = '/logo.png';
  img.alt = 'NeoFit';
  var span = document.createElement('span');
  span.textContent = 'NeoFit TV';
  brand.appendChild(img);
  brand.appendChild(span);
  header.appendChild(btn);
  header.appendChild(brand);

  var themeWrap = document.createElement('div');
  themeWrap.className = 'mobile-header-theme';
  header.appendChild(themeWrap);

  var themeToggle = sidebar.querySelector('.theme-toggle');
  function placeThemeToggle() {
    if (!themeToggle) return;
    var mobile = window.innerWidth < 768;
    var footer = document.querySelector('.sidebar-footer');
    if (mobile && themeWrap) {
      if (themeToggle.parentNode !== themeWrap) {
        themeWrap.appendChild(themeToggle);
      }
    } else if (footer) {
      if (themeToggle.parentNode !== footer) {
        footer.insertBefore(themeToggle, footer.firstChild);
      }
    }
  }
  if (themeToggle) {
    placeThemeToggle();
    window.addEventListener('resize', placeThemeToggle);
  }

  var backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.addEventListener('click', function () {
    document.body.classList.remove('sidebar-open');
    btn.setAttribute('aria-label', 'Открыть меню');
  });

  document.body.insertBefore(header, document.body.firstChild);
  document.body.insertBefore(backdrop, document.body.firstChild);

  sidebar.addEventListener('click', function (e) {
    if (e.target.closest('a') || e.target.closest('button')) {
      document.body.classList.remove('sidebar-open');
      btn.setAttribute('aria-label', 'Открыть меню');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
      document.body.classList.remove('sidebar-open');
      btn.setAttribute('aria-label', 'Открыть меню');
    }
  });
})();
