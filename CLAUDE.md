# Project Overview

Digital signage система управления экранами. Node.js (Express) + JSON-хранилище + браузерный/Android плеер.

## Architecture

**Stack:** Node.js (Express) на порту 3000, Nginx (443/HTTPS), данные в `data/\*.json`, медиа в `uploads/`

**Layers:**

* `Routes` → валидация (express-validator) → `Services` → `Repositories` (JSON + in-memory cache)

**Key modules** (`src/modules/`):

* `auth` — единый пароль администратора (bcrypt), сессии в файлах
* `media` — загрузка, magic bytes валидация, sharp (изображения), ffmpeg (видео H.264)
* `video.queue` — очередь перекодирования, восстанавливается после рестарта
* `playlists` — CRUD, порядок элементов; при удалении медиа — авто-удаление из плейлистов
* `screens` — CRUD, назначение плейлиста, heartbeat, онлайн-статус
* `screens.monitor` — периодические проверки + Telegram-уведомления
* `player` — публичный GET `/api/player/:screenId` → плейлист + настройки + heartbeat
* `pair` — 6-символьные коды привязки устройств, TTL 10 мин
* `settings` — глобальные настройки, триггер перепланировки backup при сохранении
* `backup` — tar.gz архив `data/`, cron-планировщик (node-cron)
* `system` — CPU, RAM, диск для дашборда

**Playlist update flow:**

1. Админ меняет плейлист → сохраняется `data/playlists.json` + `data/screens.json`
2. Плеер опрашивает `GET /api/player/:screenId` → получает актуальный плейлист
3. `player.js` сравнивает через `JSON.stringify` — если изменился, перезапускает с первого элемента

## File Structure

```
server.js              # Entry point
src/
  config/index.js      # Env vars, paths (dataDir, uploadsDir)
  middleware/          # auth.js, rateLimit.js, validate.js, errorHandler.js
  modules/             # auth, media, playlists, screens, player, pair, settings, system, backup
  utils/               # logger.js (winston), telegram.js, atomicWrite.js
data/                  # JSON storage (не в git)
uploads/               # Media files
public/
  admin/               # Admin UI pages
  player/              # Player HTML/JS + Service Worker
  pair/                # Pairing page
scripts/               # backup.js, reset-password.js, backfill-video-durations.js
```

**data/ files:** `auth.json`, `media.json`, `playlists.json`, `screens.json`, `settings.json`, `pairing.json`, `processing-queue.json`, `backup-status.json`

**Service Worker** (`public/player/sw.js`): Cache First для медиа, Network Only для API.

## Environments

* **Local:** http://localhost:3000 (development)
* **Production:** https://s9a.ru (production, nginx + PM2)

## Deploy Flow

```
Local edit → git commit → git push → deploy.bat
```

## Rules

* **Never edit files directly on server**
* After changing `data/\*.json` on server — `pm2 restart` required
* `.env` не коммитится в git

Atomic write для всех JSON (`src/utils/atomicWrite.js`) — защита от потери данных при 
краше

- \*\*After completing any task\*\* — update CLAUDE.md if architecture, modules, or rules changed

