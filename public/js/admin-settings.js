(function () {
  var saveInProgress = false;

  function getEl(id) {
    var el = document.getElementById(id);
    return el;
  }

  function setValue(id, value, isCheckbox) {
    var el = getEl(id);
    if (!el) return;
    if (isCheckbox) {
      el.checked = !!value;
    } else {
      el.value = value == null || value === '' ? '' : String(value);
    }
  }

  function getValue(id, isCheckbox) {
    var el = getEl(id);
    if (!el) return undefined;
    return isCheckbox ? el.checked : el.value;
  }

  function applyToForm(s) {
    setValue('imageDuration', s.imageDuration ?? 10);
    setValue('pollInterval', s.pollInterval ?? 10);
    setValue('requestTimeout', s.requestTimeout ?? 10);
    setValue('maxRetries', s.maxRetries ?? 3);
    setValue('prefetchEnabled', s.prefetchEnabled !== false, true);
    setValue('cacheEnabled', s.cacheEnabled !== false, true);
    setValue('showLastOnError', s.showLastOnError !== false, true);
    setValue('autoReloadAt', s.autoReloadAt || '');
    setValue('workScheduleFrom', s.workScheduleFrom || '');
    setValue('workScheduleTo', s.workScheduleTo || '');
    setValue('timezone', s.timezone || '');
    setValue('onlineThreshold', s.onlineThreshold ?? 15);
    setValue('monitorCheckIntervalSec', s.monitorCheckIntervalSec ?? 10);
    setValue('onlineThresholdMultiplier', s.onlineThresholdMultiplier == null ? '' : s.onlineThresholdMultiplier);
    setValue('maxFileSizeMb', s.maxFileSizeMb ?? 500);
    setValue('videoCrf', s.videoCrf ?? 23);
    setValue('videoMaxWidth', s.videoMaxWidth == null ? '' : s.videoMaxWidth);
    setValue('systemName', s.systemName || '');
    setValue('telegramEnabled', !!s.telegramEnabled, true);
    setValue('telegramBotToken', s.telegramBotToken || '');
    setValue('telegramChatId', s.telegramChatId || '');
  }

  function updateSidebarName(name) {
    var el = document.querySelector('.sidebar-brand-name');
    if (el && name) el.textContent = name;
  }

  async function loadSettings() {
    try {
      var data = await API.getSettings();
      var s = data.settings || data;
      applyToForm(s);
      updateSidebarName(s.systemName || 'NeoFit TV');
    } catch (err) {
      showToast(err.message || 'Ошибка загрузки настроек', 'error');
    }
  }

  function switchTab(tabId) {
    document.querySelectorAll('.settings-tabs .tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.settings-section').forEach(function (sec) {
      sec.classList.toggle('active', sec.getAttribute('data-section') === tabId);
    });
  }

  function collectPlayback() {
    return {
      imageDuration: parseInt(getValue('imageDuration'), 10) || 10,
      pollInterval: parseInt(getValue('pollInterval'), 10) || 10,
      requestTimeout: parseInt(getValue('requestTimeout'), 10) || 10,
      maxRetries: parseInt(getValue('maxRetries'), 10) || 3,
      prefetchEnabled: getValue('prefetchEnabled', true),
      cacheEnabled: getValue('cacheEnabled', true),
      showLastOnError: getValue('showLastOnError', true),
    };
  }
  function collectSchedule() {
    return {
      autoReloadAt: getValue('autoReloadAt').trim() || null,
      workScheduleFrom: getValue('workScheduleFrom').trim() || null,
      workScheduleTo: getValue('workScheduleTo').trim() || null,
      timezone: getValue('timezone').trim() || 'Europe/Moscow',
    };
  }
  function collectMonitor() {
    var mul = getValue('onlineThresholdMultiplier').trim();
    return {
      onlineThreshold: parseInt(getValue('onlineThreshold'), 10) || 15,
      monitorCheckIntervalSec: parseInt(getValue('monitorCheckIntervalSec'), 10) || 10,
      onlineThresholdMultiplier: mul === '' ? null : parseFloat(mul),
    };
  }
  function collectMedia() {
    var w = getValue('videoMaxWidth').trim();
    return {
      maxFileSizeMb: parseInt(getValue('maxFileSizeMb'), 10) || 500,
      videoCrf: parseInt(getValue('videoCrf'), 10) || 23,
      videoMaxWidth: w === '' ? null : parseInt(w, 10),
    };
  }
  function collectSystem() {
    return { systemName: getValue('systemName').trim() || 'NeoFit TV' };
  }
  function collectTelegram() {
    return {
      telegramEnabled: getValue('telegramEnabled', true),
      telegramBotToken: getValue('telegramBotToken').trim(),
      telegramChatId: getValue('telegramChatId').trim(),
    };
  }

  function initHintPopovers() {
    var popover = document.createElement('div');
    popover.className = 'hint-popover';
    popover.setAttribute('role', 'tooltip');
    popover.style.display = 'none';
    document.body.appendChild(popover);

    function positionPopover(btn) {
      var rect = btn.getBoundingClientRect();
      var spaceAbove = rect.top;
      var spaceBelow = window.innerHeight - rect.bottom;
      var below = spaceBelow >= spaceAbove;
      popover.classList.toggle('below', !below);
      var x = rect.left + rect.width / 2;
      popover.style.left = x + 'px';
      popover.style.transform = 'translateX(-50%)';
      if (below) {
        popover.style.top = (rect.bottom + 6) + 'px';
        popover.style.transform = 'translateX(-50%)';
      } else {
        popover.style.top = (rect.top - 6) + 'px';
        popover.style.transform = 'translate(-50%, -100%)';
      }
    }

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.hint-icon');
      if (btn && btn.getAttribute('data-hint')) {
        e.preventDefault();
        e.stopPropagation();
        var hint = btn.getAttribute('data-hint');
        var isOpen = popover.style.display === 'block' && popover._owner === btn;
        if (isOpen) {
          popover.style.display = 'none';
          popover._owner = null;
          btn.removeAttribute('aria-expanded');
          return;
        }
        popover.textContent = hint;
        popover._owner = btn;
        popover.style.display = 'block';
        positionPopover(btn);
        btn.setAttribute('aria-expanded', 'true');
        return;
      }
      if (popover.style.display === 'block') {
        popover.style.display = 'none';
        if (popover._owner) {
          popover._owner.removeAttribute('aria-expanded');
          popover._owner = null;
        }
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && popover.style.display === 'block') {
        popover.style.display = 'none';
        if (popover._owner) {
          popover._owner.removeAttribute('aria-expanded');
          popover._owner = null;
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadSettings();
    initHintPopovers();

    var logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn && typeof API !== 'undefined') {
      logoutBtn.addEventListener('click', function () {
        API.logout().then(function () { location.href = '/login.html'; });
      });
    }

    document.querySelectorAll('.settings-tabs .tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab'));
      });
    });

    document.getElementById('formPlayback').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (saveInProgress) return;
      saveInProgress = true;
      var submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await API.updateSettings(collectPlayback());
        showToast('Настройки воспроизведения сохранены', 'success');
      } catch (err) {
        showToast(err.message || 'Ошибка сохранения', 'error');
      } finally {
        saveInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    document.getElementById('formSchedule').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (saveInProgress) return;
      saveInProgress = true;
      var submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await API.updateSettings(collectSchedule());
        showToast('Настройки расписания сохранены', 'success');
      } catch (err) {
        showToast(err.message || 'Ошибка сохранения', 'error');
      } finally {
        saveInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    document.getElementById('formMonitor').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (saveInProgress) return;
      saveInProgress = true;
      var submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await API.updateSettings(collectMonitor());
        showToast('Настройки мониторинга сохранены', 'success');
      } catch (err) {
        showToast(err.message || 'Ошибка сохранения', 'error');
      } finally {
        saveInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    document.getElementById('formMedia').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (saveInProgress) return;
      saveInProgress = true;
      var submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await API.updateSettings(collectMedia());
        showToast('Настройки медиа сохранены', 'success');
      } catch (err) {
        showToast(err.message || 'Ошибка сохранения', 'error');
      } finally {
        saveInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    document.getElementById('formSystem').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (saveInProgress) return;
      saveInProgress = true;
      var submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await API.updateSettings(collectSystem());
        updateSidebarName(getValue('systemName') || 'NeoFit TV');
        showToast('Настройки системы сохранены', 'success');
      } catch (err) {
        showToast(err.message || 'Ошибка сохранения', 'error');
      } finally {
        saveInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    document.getElementById('formTelegram').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (saveInProgress) return;
      saveInProgress = true;
      var submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await API.updateSettings(collectTelegram());
        showToast('Настройки Telegram сохранены', 'success');
      } catch (err) {
        showToast(err.message || 'Ошибка сохранения', 'error');
      } finally {
        saveInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    document.getElementById('passwordForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (saveInProgress) return;
      saveInProgress = true;
      var submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await API.changePassword(getValue('currentPassword'), getValue('newPassword'));
        showToast('Пароль изменён', 'success');
        e.target.reset();
      } catch (err) {
        showToast(err.message || 'Ошибка смены пароля', 'error');
      } finally {
        saveInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  });
})();
