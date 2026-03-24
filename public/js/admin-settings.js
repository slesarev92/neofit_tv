(function () {
  var saveInProgress = false;
  var pendingLogoFile = null;
  var logoRemoveRequested = false;
  var currentLogoObjectUrl = null;
  var settingsDirty = {};

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

  function padTimePart(num) {
    return num != null && num !== '' ? String(num).padStart(2, '0') : '';
  }
  function normalizeTimeHHMM(str) {
    if (!str || typeof str !== 'string') return '';
    var s = str.trim().slice(0, 5);
    var m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return s;
    var h = parseInt(m[1], 10);
    var min = parseInt(m[2], 10);
    if (!Number.isInteger(h) || !Number.isInteger(min)) return s;
    return padTimePart(h) + ':' + padTimePart(min);
  }

  function updateThresholdModeHint(mode) {
    var thresholdEl = getEl('onlineThreshold');
    var multiplierEl = getEl('onlineThresholdMultiplier');
    var isMultiplier = mode === 'multiplier';
    if (thresholdEl) thresholdEl.style.opacity = isMultiplier ? '0.5' : '';
    if (multiplierEl) multiplierEl.style.opacity = isMultiplier ? '' : '0.5';
    var hintId = '_thresholdModeHint';
    var existing = document.getElementById(hintId);
    if (!existing) {
      var multiplierGroup = multiplierEl && multiplierEl.closest('.form-group');
      if (multiplierGroup) {
        existing = document.createElement('small');
        existing.id = hintId;
        existing.style.cssText = 'display:block;margin-top:0.25rem;color:var(--gray-500);font-size:.75rem;';
        multiplierGroup.appendChild(existing);
      }
    }
    if (existing) {
      existing.textContent = isMultiplier
        ? 'Активен: множитель (приоритет над фиксированным порогом)'
        : 'Активен: фиксированный порог';
    }
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
    setValue('workScheduleFrom', normalizeTimeHHMM(s.workScheduleFrom));
    setValue('workScheduleTo', normalizeTimeHHMM(s.workScheduleTo));
    setTimezoneSelect(s.timezone || 'Europe/Moscow');
    setOffHoursImagePreview(s.workScheduleOffImageUrl || null);
    setValue('onlineThreshold', s.onlineThreshold ?? 30);
    setValue('monitorCheckIntervalSec', s.monitorCheckIntervalSec ?? 10);
    setValue('onlineThresholdMultiplier', s.onlineThresholdMultiplier == null ? '' : s.onlineThresholdMultiplier);
    updateThresholdModeHint(s.activeThresholdMode || ((s.onlineThresholdMultiplier != null && Number(s.onlineThresholdMultiplier) > 0) ? 'multiplier' : 'fixed'));
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
    setValue('backupScheduleTime', normalizeTimeHHMM(s.backupScheduleTime || '03:00'));
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

  function updateDirtyTabs() {
    document.querySelectorAll('.settings-tabs .tab').forEach(function (t) {
      var tabId = t.getAttribute('data-tab');
      t.classList.toggle('tab-dirty', !!settingsDirty[tabId]);
    });
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
    var parsed = w === '' ? null : parseInt(w, 10);
    return {
      maxFileSizeMb: parseInt(getValue('maxFileSizeMb'), 10) || 500,
      videoCrf: parseInt(getValue('videoCrf'), 10) || 23,
      videoMaxWidth: (parsed === 0 || parsed === null || Number.isNaN(parsed)) ? null : parsed,
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

    // Track dirty state per-tab
    document.querySelectorAll('.settings-section').forEach(function (sec) {
      var tabId = sec.getAttribute('data-section');
      sec.addEventListener('input', function () { settingsDirty[tabId] = true; updateDirtyTabs(); });
      sec.addEventListener('change', function () { settingsDirty[tabId] = true; updateDirtyTabs(); });
    });

    document.getElementById('formPlayback').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (saveInProgress) return;
      saveInProgress = true;
      var submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await API.updateSettings(collectPlayback());
        settingsDirty['playback'] = false; updateDirtyTabs();
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
        settingsDirty['schedule'] = false; updateDirtyTabs();
        showToast('Настройки расписания сохранены', 'success');
      } catch (err) {
        showToast(err.message || 'Ошибка сохранения', 'error');
      } finally {
        saveInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    var mulInput = document.getElementById('onlineThresholdMultiplier');
    if (mulInput) {
      mulInput.addEventListener('input', function () {
        var v = this.value.trim();
        updateThresholdModeHint((v !== '' && Number(v) > 0) ? 'multiplier' : 'fixed');
      });
    }

    document.getElementById('formMonitor').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (saveInProgress) return;
      saveInProgress = true;
      var submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await API.updateSettings(collectMonitor());
        settingsDirty['monitor'] = false; updateDirtyTabs();
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
        settingsDirty['media'] = false; updateDirtyTabs();
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
        settingsDirty['system'] = false; updateDirtyTabs();
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
        settingsDirty['telegram'] = false; updateDirtyTabs();
        showToast('Настройки Telegram сохранены', 'success');
      } catch (err) {
        showToast(err.message || 'Ошибка сохранения', 'error');
      } finally {
        saveInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    var btnTelegramTest = document.getElementById('btnTelegramTest');
    if (btnTelegramTest) {
      btnTelegramTest.addEventListener('click', async function () {
        if (btnTelegramTest.disabled) return;
        btnTelegramTest.disabled = true;
        try {
          await API.sendTelegramTest();
          showToast('Тестовое сообщение отправлено', 'success');
        } catch (err) {
          showToast(err.message || 'Не удалось отправить', 'error');
        } finally {
          btnTelegramTest.disabled = false;
        }
      });
    }

    document.getElementById('formBackup').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (saveInProgress) return;
      saveInProgress = true;
      var submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        await API.updateSettings(collectBackup());
        settingsDirty['backup'] = false; updateDirtyTabs();
        showToast('Настройки бэкапов сохранены', 'success');
      } catch (err) {
        showToast(err.message || 'Ошибка сохранения', 'error');
      } finally {
        saveInProgress = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    function defaultBackupName() {
      var d = new Date();
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      var h = String(d.getHours()).padStart(2, '0');
      var min = String(d.getMinutes()).padStart(2, '0');
      return 'backup-' + y + '-' + m + '-' + day + '-' + h + '-' + min;
    }

    var backupCreateModal = document.getElementById('backupCreateModal');
    var backupCreateName = document.getElementById('backupCreateName');
    var backupCreateSubmit = document.getElementById('backupCreateSubmit');
    var backupCreateCancel = document.getElementById('backupCreateModalClose');
    var backupCreateCancel2 = document.getElementById('backupCreateCancel');
    function openBackupCreateModal() {
      if (backupCreateName) {
        backupCreateName.value = '';
        backupCreateName.placeholder = defaultBackupName();
      }
      if (backupCreateModal) backupCreateModal.classList.add('active');
    }
    function closeBackupCreateModal() {
      if (backupCreateModal) backupCreateModal.classList.remove('active');
    }
    [backupCreateCancel, backupCreateCancel2].forEach(function (btn) {
      if (btn) btn.addEventListener('click', closeBackupCreateModal);
    });
    if (backupCreateModal && backupCreateModal.querySelector('.modal')) {
      backupCreateModal.querySelector('.modal').addEventListener('click', function (e) { e.stopPropagation(); });
      backupCreateModal.addEventListener('click', function (e) { if (e.target === backupCreateModal) closeBackupCreateModal(); });
    }
    if (backupCreateSubmit) {
      backupCreateSubmit.addEventListener('click', async function () {
        if (backupCreateSubmit.disabled) return;
        var name = backupCreateName && backupCreateName.value.trim() ? backupCreateName.value.trim() : defaultBackupName();
        backupCreateSubmit.disabled = true;
        backupCreateSubmit.textContent = 'Создаётся…';
        try {
          await API.runBackup(name);
          showToast('Бэкап создан', 'success');
          closeBackupCreateModal();
        } catch (err) {
          showToast(err.message || 'Ошибка создания бэкапа', 'error');
        } finally {
          backupCreateSubmit.disabled = false;
          backupCreateSubmit.textContent = 'Создать';
        }
      });
    }

    var backupRunBtn = document.getElementById('backupRunBtn');
    if (backupRunBtn) backupRunBtn.addEventListener('click', openBackupCreateModal);

    var backupRestoreModal = document.getElementById('backupRestoreModal');
    var backupRestoreList = document.getElementById('backupRestoreList');
    var backupRestoreEmpty = document.getElementById('backupRestoreEmpty');
    var backupRestoreCancel = document.getElementById('backupRestoreModalClose');
    var backupRestoreCancel2 = document.getElementById('backupRestoreCancel');
    function closeBackupRestoreModal() {
      if (backupRestoreModal) backupRestoreModal.classList.remove('active');
    }
    function openBackupRestoreModal() {
      if (backupRestoreModal) backupRestoreModal.classList.add('active');
      if (backupRestoreList) backupRestoreList.innerHTML = '';
      if (backupRestoreEmpty) backupRestoreEmpty.style.display = 'none';
      API.getBackupList().then(function (data) {
        var items = (data && data.items) || [];
        if (backupRestoreEmpty) backupRestoreEmpty.style.display = items.length ? 'none' : 'block';
        items.forEach(function (item) {
          var row = document.createElement('div');
          row.className = 'backup-list-item';
          var fileName = item.fileName || item.file_name || '';
          var displayName = fileName || 'Бэкап';
          var dateStr = item.mtime ? (function () {
            try {
              var d = new Date(item.mtime);
              return d.getDate().toString().padStart(2, '0') + '.' + (d.getMonth() + 1).toString().padStart(2, '0') + '.' + d.getFullYear() + ' ' + d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
            } catch (_) { return ''; }
          })() : '';
          var sizeStr = typeof formatBytes === 'function' ? formatBytes(item.sizeBytes || 0) : (item.sizeBytes || 0) + ' Б';
          row.innerHTML = '<div class="backup-list-info"><div class="backup-list-name">' + String(displayName).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div><div class="backup-list-meta">' + dateStr + ' · ' + sizeStr + '</div></div><button type="button" class="btn btn-primary btn-sm" data-file-name="' + String(fileName).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">Восстановить</button>';
          var btn = row.querySelector('button');
          if (btn) {
            btn.addEventListener('click', function () {
              var fileName = btn.getAttribute('data-file-name');
              if (!fileName) return;
              showConfirm(
                'Восстановить из архива «' + fileName + '»?<br><span style="font-size:.8125rem;color:var(--gray-500);">Текущие данные будут заменены. Действие необратимо.</span>',
                function () {
                  API.restoreBackup(fileName).then(function () {
                    showToast('Настройки восстановлены. Страница перезагрузится.', 'success');
                    closeBackupRestoreModal();
                    setTimeout(function () { location.reload(); }, 800);
                  }).catch(function (err) {
                    showToast(err.message || 'Ошибка восстановления', 'error');
                  });
                },
                { confirmLabel: 'Восстановить', confirmClass: 'btn-danger' }
              );
            });
          }
          if (backupRestoreList) backupRestoreList.appendChild(row);
        });
      }).catch(function (err) {
        if (backupRestoreEmpty) { backupRestoreEmpty.textContent = 'Ошибка загрузки списка: ' + (err.message || 'нет данных'); backupRestoreEmpty.style.display = 'block'; }
      });
    }
    [backupRestoreCancel, backupRestoreCancel2].forEach(function (btn) {
      if (btn) btn.addEventListener('click', closeBackupRestoreModal);
    });
    if (backupRestoreModal && backupRestoreModal.querySelector('.modal')) {
      backupRestoreModal.querySelector('.modal').addEventListener('click', function (e) { e.stopPropagation(); });
      backupRestoreModal.addEventListener('click', function (e) { if (e.target === backupRestoreModal) closeBackupRestoreModal(); });
    }
    var backupLoadBtn = document.getElementById('backupLoadBtn');
    if (backupLoadBtn) backupLoadBtn.addEventListener('click', openBackupRestoreModal);

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

    // 2FA management
    (function () {
      var currentTotpSecret = null;

      function setTotpStatus(enabled) {
        var statusText = document.getElementById('totpStatusText');
        var disabledView = document.getElementById('totpDisabledView');
        var setupView = document.getElementById('totpSetupView');
        var enabledView = document.getElementById('totpEnabledView');
        if (!statusText || !disabledView || !setupView || !enabledView) return;
        if (enabled) {
          statusText.textContent = 'Статус: включена';
          disabledView.style.display = 'none';
          setupView.style.display = 'none';
          enabledView.style.display = 'block';
        } else {
          statusText.textContent = 'Статус: отключена';
          disabledView.style.display = 'block';
          setupView.style.display = 'none';
          enabledView.style.display = 'none';
        }
        currentTotpSecret = null;
      }

      API.getTotpStatus()
        .then(function (data) { setTotpStatus(data && data.enabled); })
        .catch(function () {});

      var totpSetupBtn = document.getElementById('totpSetupBtn');
      if (totpSetupBtn) {
        totpSetupBtn.addEventListener('click', async function () {
          if (totpSetupBtn.disabled) return;
          totpSetupBtn.disabled = true;
          try {
            var data = await API.setupTotp();
            currentTotpSecret = data.secret;
            var qrImg = document.getElementById('totpQrImg');
            if (qrImg) qrImg.src = data.qrCodeUrl;
            var confirmInput = document.getElementById('totpConfirmCode');
            if (confirmInput) confirmInput.value = '';
            document.getElementById('totpDisabledView').style.display = 'none';
            document.getElementById('totpSetupView').style.display = 'block';
            if (confirmInput) confirmInput.focus();
          } catch (err) {
            showToast(err.message || 'Ошибка инициализации 2FA', 'error');
          } finally {
            totpSetupBtn.disabled = false;
          }
        });
      }

      var totpEnableBtn = document.getElementById('totpEnableBtn');
      if (totpEnableBtn) {
        totpEnableBtn.addEventListener('click', async function () {
          if (totpEnableBtn.disabled) return;
          var code = (document.getElementById('totpConfirmCode').value || '').trim();
          if (!code) { showToast('Введите код из приложения', 'error'); return; }
          if (!currentTotpSecret) { showToast('Начните настройку заново', 'error'); return; }
          totpEnableBtn.disabled = true;
          try {
            await API.enableTotp(currentTotpSecret, code);
            showToast('2FA включена', 'success');
            setTotpStatus(true);
          } catch (err) {
            showToast(err.message || 'Неверный код', 'error');
          } finally {
            totpEnableBtn.disabled = false;
          }
        });
      }

      var totpCancelBtn = document.getElementById('totpCancelSetupBtn');
      if (totpCancelBtn) {
        totpCancelBtn.addEventListener('click', function () {
          setTotpStatus(false);
        });
      }

      var totpDisableBtn = document.getElementById('totpDisableBtn');
      if (totpDisableBtn) {
        totpDisableBtn.addEventListener('click', function () {
          if (totpDisableBtn.disabled) return;
          // Custom password prompt instead of native prompt()
          var existing = document.getElementById('_totpDisableDialog');
          if (existing) existing.remove();
          var overlay = document.createElement('div');
          overlay.id = '_totpDisableDialog';
          overlay.className = 'modal-overlay active';
          overlay.style.zIndex = '300';
          overlay.innerHTML =
            '<div class="modal confirm-modal" role="dialog" aria-modal="true">' +
            '<div class="modal-body" style="text-align:center;padding:1.5rem;">' +
            '<p style="margin-bottom:1rem;">Введите пароль для отключения 2FA:</p>' +
            '<input type="password" id="_totpDisablePwd" class="form-group-input" style="width:100%;padding:.625rem .75rem;border:1px solid var(--gray-300);border-radius:var(--radius);font-size:.875rem;background:var(--bg-card);color:var(--gray-800);" autocomplete="current-password">' +
            '</div>' +
            '<div class="modal-footer" style="justify-content:center;gap:.75rem;">' +
            '<button type="button" class="btn btn-secondary" id="_totpDisableCancel">Отмена</button>' +
            '<button type="button" class="btn btn-danger" id="_totpDisableOk">Отключить 2FA</button>' +
            '</div></div>';
          document.body.appendChild(overlay);
          var pwdInput = document.getElementById('_totpDisablePwd');
          setTimeout(function () { pwdInput.focus(); }, 50);
          function close() { overlay.classList.remove('active'); setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 250); }
          document.getElementById('_totpDisableCancel').addEventListener('click', close);
          overlay.addEventListener('click', function (ev) { if (ev.target === overlay) close(); });
          document.getElementById('_totpDisableOk').addEventListener('click', async function () {
            var password = pwdInput.value;
            if (!password) { pwdInput.focus(); return; }
            close();
            totpDisableBtn.disabled = true;
            try {
              await API.disableTotp(password);
              showToast('2FA отключена', 'success');
              setTotpStatus(false);
            } catch (err) {
              showToast(err.message || 'Ошибка отключения 2FA', 'error');
            } finally {
              totpDisableBtn.disabled = false;
            }
          });
          pwdInput.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') { document.getElementById('_totpDisableOk').click(); }
            if (ev.key === 'Escape') { close(); }
          });
        });
      }
    })();

    // Ctrl+S / Cmd+S: submit the active settings tab form
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        var activeSection = document.querySelector('.settings-section.active');
        if (!activeSection) return;
        var submitBtn = activeSection.querySelector('button[type="submit"]');
        if (submitBtn && !submitBtn.disabled) submitBtn.click();
      }
    });
  });
})();
