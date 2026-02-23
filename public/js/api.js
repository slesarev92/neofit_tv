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

    if (res.status === 401 && !url.includes('/api/auth/login')) {
      var returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = '/login.html?returnUrl=' + returnUrl;
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Ошибка ${res.status}`);
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

  getMedia() {
    return this.request('/api/media');
  },
  uploadMedia(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media');
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
  getSystem() {
    return this.request('/api/system');
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setSidebarSystemName);
} else {
  setSidebarSystemName();
}
function setSidebarSystemName() {
  var el = document.querySelector('.sidebar-brand-name');
  if (!el) return;
  fetch('/api/settings', { credentials: 'include' })
    .then(function (r) { return r.status === 200 ? r.json() : null; })
    .then(function (d) {
      if (d && d.settings && d.settings.systemName) el.textContent = d.settings.systemName;
    })
    .catch(function () {});
}
