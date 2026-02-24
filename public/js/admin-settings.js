(function () {
  var saveInProgress = false;
  var pendingLogoFile = null;
  var logoRemoveRequested = false;
  var currentLogoObjectUrl = null;

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
    setValue('workScheduleEnabled', !!s.workScheduleEnabled, true);
    setValue('workScheduleFrom', (s.workScheduleFrom || '').slice(0, 5));
    setValue('workScheduleTo', (s.workScheduleTo || '').slice(0, 5));
    setTimezoneSelect(s.timezone || 'Europe/Moscow');
    setOffHoursImagePreview(s.workScheduleOffImageUrl || null);
    setValue('onlineThreshold', s.onlineThreshold ?? 15);
    setValue('monitorCheckIntervalSec', s.monitorCheckIntervalSec ?? 10);
    setValue('onlineThresholdMultiplier', s.onlineThresholdMultiplier == null ? '' : s.onlineThresholdMultiplier);
    setValue('maxFileSizeMb', s.maxFileSizeMb ?? 500);
    setValue('videoCrf', s.videoCrf ?? 23);
    setValue('videoMaxWidth', s.videoMaxWidth == null ? '' : s.videoMaxWidth);
    setValue('systemName', s.systemName || '');
    pendingLogoFile = null;
    logoRemoveRequested = false;
    if (currentLogoObjectUrl) {
      URL.revokeObjectURL(currentLogoObjectUrl);
      currentLogoObjectUrl = null;
    }
    setLogoPreview(s.logoUrl || null);
    setValue('telegramEnabled', !!s.telegramEnabled, true);
    setValue('telegramBotToken', s.telegramBotToken || '');
    setValue('telegramChatId', s.telegramChatId || '');
    setValue('backupKeepCount', s.backupKeepCount != null ? s.backupKeepCount : 30);
    setValue('backupScheduleEnabled', !!s.backupScheduleEnabled, true);
    setValue('backupScheduleTime', (s.backupScheduleTime || '03:00').slice(0, 5));
    setValue('backupScheduleFrequency', s.backupScheduleFrequency || 'daily');
    setValue('backupScheduleWeekday', s.backupScheduleWeekday != null ? String(s.backupScheduleWeekday) : '0');
    setValue('backupScheduleMonthDays', s.backupScheduleMonthDays || '1,10,20');
    toggleBackupScheduleExtra();
  }

  function setTimezoneSelect(value) {
    var el = getEl('timezone');
    if (!el) return;
    var v = (value || 'Europe/Moscow').trim() || 'Europe/Moscow';
    if (el.tagName === 'SELECT') {
      var found = false;
      for (var i = 0; i < el.options.length; i++) {
        if (el.options[i].value === v) { found = true; break; }
      }
      if (!found) {
        var opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v + ' (текущий)';
        el.insertBefore(opt, el.firstChild);
      }
    }
    el.value = v;
  }

  function toggleBackupScheduleExtra() {
    var freq = getValue('backupScheduleFrequency');
    var weekdayWrap = document.getElementById('backupScheduleWeekdayWrap');
    var monthDaysWrap = document.getElementById('backupScheduleMonthDaysWrap');
    if (weekdayWrap) weekdayWrap.style.display = freq === 'weekly' ? '' : 'none';
    if (monthDaysWrap) monthDaysWrap.style.display = freq === 'monthly' ? '' : 'none';
  }

  function updateSidebarBrand(settings) {
    var name = (settings && settings.systemName) || 'NeoFit TV';
    var logoUrl = (settings && settings.logoUrl) || null;
    var logoUrlWithCacheBuster = (logoUrl && logoUrl.trim())
      ? (logoUrl.replace(/\?.*$/, '') + '?t=' + Date.now())
      : null;
    var brand = document.querySelector('.sidebar-brand');
    if (!brand) return;
    var img = brand.querySelector('.sidebar-logo');
    var span = brand.querySelector('.sidebar-brand-name');
    if (logoUrlWithCacheBuster) {
      if (img) { img.src = logoUrlWithCacheBuster; img.alt = name; img.style.display = ''; }
      if (span) { span.textContent = name; span.style.display = ''; }
    } else {
      if (img) img.style.display = 'none';
      if (span) { span.textContent = name; span.style.display = ''; }
    }
  }

  async function loadSettings() {
    try {
      var data = await API.getSettings();
      var s = data.settings || data;
      applyToForm(s);
      updateSidebarBrand(s);
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
    var form = document.getElementById('formSchedule');
    var cb = form && form.elements && form.elements.namedItem('workScheduleEnabled');
    var enabled = cb ? !!cb.checked : (getValue('workScheduleEnabled', true) === true);
    var from = (getValue('workScheduleFrom') || '').trim().slice(0, 5);
    var to = (getValue('workScheduleTo') || '').trim().slice(0, 5);
    return {
      autoReloadAt: getValue('autoReloadAt').trim() || null,
      workScheduleEnabled: !!enabled,
      workScheduleFrom: from && /^\d{1,2}:\d{2}$/.test(from) ? from : null,
      workScheduleTo: to && /^\d{1,2}:\d{2}$/.test(to) ? to : null,
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
  function collectBackup() {
    var v = parseInt(getValue('backupKeepCount'), 10);
    var timeVal = getValue('backupScheduleTime') || '03:00';
    if (/^\d{1,2}:\d{2}$/.test(timeVal) === false) timeVal = '03:00';
    var form = document.getElementById('formBackup');
    var cb = form && form.elements && form.elements.namedItem('backupScheduleEnabled');
    var enabled = cb ? !!cb.checked : (getValue('backupScheduleEnabled', true) === true);
    var freq = getValue('backupScheduleFrequency') || 'daily';
    if (freq !== 'daily' && freq !== 'weekly' && freq !== 'monthly') freq = 'daily';
    var weekday = parseInt(getValue('backupScheduleWeekday'), 10);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) weekday = 0;
    var monthDays = (getValue('backupScheduleMonthDays') || '').trim();
    return {
      backupKeepCount: (v >= 10 && v <= 90) ? v : 30,
      backupScheduleEnabled: !!enabled,
      backupScheduleTime: timeVal,
      backupScheduleFrequency: freq,
      backupScheduleWeekday: weekday,
      backupScheduleMonthDays: monthDays || '1,10,20',
    };
  }
  function getCurrentLogoPath() {
    var wrap = document.getElementById('logoPreviewWrap');
    var img = document.getElementById('logoPreviewImg');
    if (!wrap || !img || wrap.style.display === 'none') return null;
    var src = img.src;
    if (!src || !src.trim() || src.indexOf('blob:') === 0) return null;
    try {
      var url = new URL(src);
      return url.pathname || null;
    } catch (_) {
      return src.indexOf('?') !== -1 ? src.slice(0, src.indexOf('?')) : src;
    }
  }

  function collectSystem() {
    return {
      systemName: getValue('systemName').trim() || 'NeoFit TV',
      logoUrl: getCurrentLogoPath()
    };
  }

  function setLogoPreview(url) {
    var wrap = document.getElementById('logoPreviewWrap');
    var img = document.getElementById('logoPreviewImg');
    var fileInput = document.getElementById('logoFileInput');
    if (!wrap || !img) return;
    if (url && String(url).trim()) {
      if (url.indexOf('blob:') === 0) {
        img.src = url;
      } else {
        img.src = url.indexOf('?') === -1 ? url + '?t=' + Date.now() : url;
      }
      wrap.style.display = 'flex';
      if (fileInput) fileInput.value = '';
    } else {
      img.src = '';
      wrap.style.display = 'none';
    }
  }
  function setOffHoursImagePreview(url) {
    var wrap = document.getElementById('offHoursPreviewWrap');
    var img = document.getElementById('offHoursPreviewImg');
    var fileInput = document.getElementById('offHoursFileInput');
    if (!wrap || !img) return;
    if (url && String(url).trim()) {
      img.src = url.indexOf('?') === -1 ? url + '?t=' + Date.now() : url;
      wrap.style.display = 'flex';
      if (fileInput) fileInput.value = '';
    } else {
      img.src = '';
      wrap.style.display = 'none';
    }
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
      var systemName = getValue('systemName').trim() || 'NeoFit TV';
      try {
        if (logoRemoveRequested) {
          await API.updateSettings({ systemName: systemName, logoUrl: null });
          setLogoPreview(null);
          updateSidebarBrand({ systemName: systemName, logoUrl: null });
          logoRemoveRequested = false;
        } else if (pendingLogoFile) {
          var data = await API.uploadLogo(pendingLogoFile);
          var url = data.url;
          await API.updateSettings({ systemName: systemName, logoUrl: url });
          if (currentLogoObjectUrl) {
            URL.revokeObjectURL(currentLogoObjectUrl);
            currentLogoObjectUrl = null;
          }
          pendingLogoFile = null;
          setLogoPreview(url);
          updateSidebarBrand({ systemName: systemName, logoUrl: (url && url.indexOf('?') === -1) ? url + '?t=' + Date.now() : url });
        } else {
          await API.updateSettings(collectSystem());
          var path = getCurrentLogoPath();
          updateSidebarBrand({ systemName: systemName, logoUrl: path ? (path.indexOf('?') === -1 ? path + '?t=' + Date.now() : path) : null });
        }
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

    document.getElementById('formBackup').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (saveInProgress) return;
      saveInProgress = true;
      var submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await API.updateSettings(collectBackup());
        showToast('Настройки бэкапов сохранены', 'success');
      } catch (err) {
        showToast(err.message || 'Ошибка сохранения', 'error');
      } finally {
        saveInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    var backupRunBtn = document.getElementById('backupRunBtn');
    if (backupRunBtn) {
      backupRunBtn.addEventListener('click', async function () {
        if (backupRunBtn.disabled) return;
        backupRunBtn.disabled = true;
        var originalText = backupRunBtn.textContent;
        backupRunBtn.textContent = 'Создаётся бэкап…';
        try {
          await API.runBackup();
          showToast('Бэкап создан', 'success');
        } catch (err) {
          showToast(err.message || 'Ошибка создания бэкапа', 'error');
        } finally {
          backupRunBtn.disabled = false;
          backupRunBtn.textContent = originalText;
        }
      });
    }
    var backupFreqEl = document.getElementById('backupScheduleFrequency');
    if (backupFreqEl) backupFreqEl.addEventListener('change', toggleBackupScheduleExtra);

    var logoFileInput = document.getElementById('logoFileInput');
    if (logoFileInput) {
      logoFileInput.addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file) return;
        if (!file.type || !file.type.startsWith('image/')) {
          showToast('Выберите изображение (PNG, JPG, WebP или SVG)', 'error');
          this.value = '';
          return;
        }
        logoRemoveRequested = false;
        if (currentLogoObjectUrl) {
          URL.revokeObjectURL(currentLogoObjectUrl);
          currentLogoObjectUrl = null;
        }
        currentLogoObjectUrl = URL.createObjectURL(file);
        pendingLogoFile = file;
        setLogoPreview(currentLogoObjectUrl);
        showToast('Логотип выбран. Нажмите «Сохранить», чтобы применить.', 'success');
        this.value = '';
      });
    }
    var logoRemoveBtn = document.getElementById('logoRemoveBtn');
    if (logoRemoveBtn) {
      logoRemoveBtn.addEventListener('click', function () {
        if (saveInProgress) return;
        logoRemoveRequested = true;
        pendingLogoFile = null;
        if (currentLogoObjectUrl) {
          URL.revokeObjectURL(currentLogoObjectUrl);
          currentLogoObjectUrl = null;
        }
        setLogoPreview(null);
        showToast('Логотип будет удалён после нажатия «Сохранить».', 'success');
      });
    }

    var offHoursFileInput = document.getElementById('offHoursFileInput');
    if (offHoursFileInput) {
      offHoursFileInput.addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file) return;
        if (!file.type || !file.type.startsWith('image/')) {
          showToast('Выберите изображение (PNG, JPG или WebP)', 'error');
          this.value = '';
          return;
        }
        var label = document.querySelector('label[for="offHoursFileInput"]');
        if (label) { label.disabled = true; label.textContent = 'Загрузка…'; }
        API.uploadOffHoursImage(file)
          .then(function (data) {
            setOffHoursImagePreview(data.url);
            showToast('Заставка загружена', 'success');
          })
          .catch(function (err) {
            showToast(err.message || 'Ошибка загрузки', 'error');
          })
          .finally(function () {
            if (label) { label.disabled = false; label.textContent = 'Выбрать изображение'; }
            offHoursFileInput.value = '';
          });
      });
    }
    var offHoursRemoveBtn = document.getElementById('offHoursRemoveBtn');
    if (offHoursRemoveBtn) {
      offHoursRemoveBtn.addEventListener('click', function () {
        if (saveInProgress) return;
        saveInProgress = true;
        offHoursRemoveBtn.disabled = true;
        API.updateSettings({ workScheduleOffImageUrl: null })
          .then(function () {
            setOffHoursImagePreview(null);
            showToast('Заставка удалена', 'success');
          })
          .catch(function (err) {
            showToast(err.message || 'Ошибка', 'error');
          })
          .finally(function () {
            saveInProgress = false;
            offHoursRemoveBtn.disabled = false;
          });
      });
    }

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
