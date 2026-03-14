# Project Overview

Digital signage система управления экранами. Node.js (Express) + JSON-хранилище + браузерный/Android плеер.

## Architecture

**Stack:** Node.js (Express) на порту 3000, Nginx (443/HTTPS), данные в `data/\*.json`, медиа в `uploads/`

**Layers:**

* `Routes` → валидация (express-validator) → `Services` → `Repositories` (JSON + in-memory cache)

**Key modules** (`src/modules/`):

* `auth` — единый пароль администратора (bcrypt), сессии в памяти или в файлах (см. ниже)
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

## Сессии и Windows (локальная разработка)

* На Windows при `NODE_ENV=production` без `SESSION_USE_MEMORY=1` используется file store (`data/sessions/`). Запись сессии может давать **EPERM** (блокировка файла), из‑за чего авторизация «мигает».
* **Рекомендация:** в `.env` при локальной разработке на Windows задать `SESSION_USE_MEMORY=1` — сессии хранятся в памяти, перезапуск сервера сбрасывает вход.
* **Перезапуск сервера:** перед новым запуском убедиться, что не осталось старых процессов Node (Диспетчер задач → «Подробности» → завершить все `node.exe`). Иначе может работать старый процесс со старым кодом/переменными окружения.

**Деплой на сервер (Linux):** `.env` не коммитится в git — на сервере свой `.env`. В нём **не** задавать `SESSION_USE_MEMORY=1`: тогда сессии пишутся в `data/sessions/`, переживают `pm2 restart` и не сбрасываются при деплое. После `git pull` обязательно выполнять `pm2 restart` — один процесс под управлением PM2, конфликта старый/новый код не будет.

- \*\*After completing any task\*\* — update CLAUDE.md if architecture, modules, or rules changed

