const API = {
  async request(url, options = {}) {
    const config = {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...options,
    };
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    }
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
      config.body = options.body;
    }

    const res = await fetch(url, config);

    if (res.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/verify-totp')) {
      var returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = '/login.html?returnUrl=' + returnUrl;
      return;
    }

    var data;
    try {
      data = await res.json();
    } catch (_) {
      throw new Error('Ответ сервера не JSON (статус ' + res.status + '). Возможно, ошибка на сервере.');
    }
    if (!res.ok) {
      throw new Error(data.error || 'Ошибка ' + res.status);
    }
    return data;
  },

  login(password) {
    return this.request('/api/auth/login', { method: 'POST', body: { password } });
  },
  logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  },
  changePassword(currentPassword, newPassword) {
    return this.request('/api/auth/password', { method: 'PUT', body: { currentPassword, newPassword } });
  },
  verifyTotp(token) {
    return this.request('/api/auth/verify-totp', { method: 'POST', body: { token } });
  },
  getTotpStatus() {
    return this.request('/api/auth/totp/status');
  },
  setupTotp() {
    return this.request('/api/auth/totp/setup', { method: 'POST' });
  },
  enableTotp(secret, token) {
    return this.request('/api/auth/totp/enable', { method: 'POST', body: { secret, token } });
  },
  disableTotp(password) {
    return this.request('/api/auth/totp/disable', { method: 'POST', body: { password } });
  },

  getMedia() {
    return this.request('/api/media');
  },
  uploadMedia(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media');
      xhr.withCredentials = true;
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || `Ошибка ${xhr.status}`));
        } catch { reject(new Error('Ошибка обработки ответа')); }
      };
      xhr.onerror = () => reject(new Error('Ошибка сети'));
      if (onProgress) xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    });
  },
  deleteMedia(id) {
    return this.request(`/api/media/${id}`, { method: 'DELETE' });
  },

  getPlaylists() {
    return this.request('/api/playlists');
  },
  getPlaylist(id) {
    return this.request(`/api/playlists/${id}`);
  },
  createPlaylist(data) {
    return this.request('/api/playlists', { method: 'POST', body: data });
  },
  updatePlaylist(id, data) {
    return this.request(`/api/playlists/${id}`, { method: 'PUT', body: data });
  },
  deletePlaylist(id) {
    return this.request(`/api/playlists/${id}`, { method: 'DELETE' });
  },

  getScreens() {
    return this.request('/api/screens');
  },
  getScreen(id) {
    return this.request(`/api/screens/${id}`);
  },
  createScreen(data) {
    return this.request('/api/screens', { method: 'POST', body: data });
  },
  updateScreen(id, data) {
    return this.request(`/api/screens/${id}`, { method: 'PUT', body: data });
  },
  deleteScreen(id) {
    return this.request(`/api/screens/${id}`, { method: 'DELETE' });
  },

  getSettings() {
    return this.request('/api/settings');
  },
  updateSettings(data) {
    return this.request('/api/settings', { method: 'PUT', body: data });
  },
  sendTelegramTest() {
    return this.request('/api/settings/telegram-test', { method: 'POST' });
  },
  uploadLogo(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/settings/logo');
      xhr.withCredentials = true;
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || 'Ошибка ' + xhr.status));
        } catch (e) {
          reject(new Error('Ответ сервера не JSON (статус ' + xhr.status + '). Проверьте консоль разработчика или логи сервера.'));
        }
      };
      xhr.onerror = () => reject(new Error('Ошибка сети'));
      if (onProgress) xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      const fd = new FormData();
      fd.append('logo', file);
      xhr.send(fd);
    });
  },
  uploadOffHoursImage(file) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/settings/off-hours-image');
      xhr.withCredentials = true;
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || 'Ошибка ' + xhr.status));
        } catch (e) {
          reject(new Error('Ответ сервера не JSON (статус ' + xhr.status + ').'));
        }
      };
      xhr.onerror = () => reject(new Error('Ошибка сети'));
      const fd = new FormData();
      fd.append('offHoursImage', file);
      xhr.send(fd);
    });
  },
  getSystem() {
    return this.request('/api/system');
  },
  runBackup(name) {
    return this.request('/api/backup/run', { method: 'POST', body: name != null ? { name } : {} });
  },
  getBackupList() {
    return this.request('/api/backup/list');
  },
  restoreBackup(fileName) {
    return this.request('/api/backup/restore', { method: 'POST', body: { fileName } });
  },
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function timeAgo(dateStr) {
  if (!dateStr) return 'никогда';
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 30) return 'только что';
  if (sec < 60) return `${sec} сек. назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин. назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч. назад`;
  const days = Math.floor(hr / 24);
  return `${days} дн. назад`;
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// Branding (systemName, logo) загружается из nav.js — дублирующий fetch убран
