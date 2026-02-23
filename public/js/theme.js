/**
 * Единственный файл, отвечающий за тему админки.
 * Подключается на всех страницах (админка, логин, pair).
 */
(function () {
  const THEME_KEY = 'admin-theme';

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateToggleButton(theme);
  }

  function toggleTheme() {
    const current = getTheme();
    setTheme(current === 'light' ? 'dark' : 'light');
  }

  function updateToggleButton(theme) {
    const el = document.getElementById('theme-toggle');
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = theme === 'dark';
      el.setAttribute('aria-label', theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему');
    }
  }

  // Применить тему при загрузке (синхронно, до рендера — антимигание делается инлайн-скриптом в <head>)
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);

  // После DOM — обновить переключатель и повесить обработчик
  document.addEventListener('DOMContentLoaded', function () {
    updateToggleButton(getTheme());
    const el = document.getElementById('theme-toggle');
    if (el && el.type === 'checkbox') {
      el.addEventListener('change', function () {
        setTheme(this.checked ? 'dark' : 'light');
      });
    }
  });

  window.getTheme = getTheme;
  window.setTheme = setTheme;
  window.toggleTheme = toggleTheme;
})();
