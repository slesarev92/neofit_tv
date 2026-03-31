# NeoFit TV — Digital Signage

## Архитектура

**Стек:** Node.js (Express) порт 3000, Nginx (443/HTTPS), данные `data/*.json`, медиа `uploads/`

**Слои:** `Routes` → валидация (express-validator) → `Services` → `Repositories` (JSON + in-memory cache)

**Модули** (`src/modules/`):
- `auth` — единый пароль (bcrypt) + 2FA (TOTP/speakeasy), сессии в памяти или файлах
- `media` — загрузка, magic bytes валидация, sharp (изображения), ffmpeg (видео H.264 High Level 4.0)
- `video.queue` — очередь перекодирования, восстанавливается после рестарта
- `playlists` — CRUD, порядок элементов; при удалении медиа — авто-удаление из плейлистов
- `screens` — CRUD, назначение плейлиста, heartbeat, онлайн-статус
- `screens.monitor` — периодические проверки + Telegram-уведомления
- `player` — публичный GET `/api/player/:screenId` → плейлист + настройки + heartbeat; POST `/api/player/:screenId/metrics` → телеметрия воспроизведения (droppedFrames, canplayTimeMs и др.)
- `pair` — 6-символьные коды привязки устройств, TTL 10 мин
- `settings` — глобальные настройки, триггер перепланировки backup
- `backup` — tar.gz архив `data/`, cron-планировщик (node-cron), async spawn
- `system` — CPU, RAM, диск для дашборда

**Playlist update flow:**
1. Админ меняет плейлист → сохраняется `data/playlists.json` + `data/screens.json`
2. Плеер опрашивает `GET /api/player/:screenId` → получает актуальный плейлист
3. `player.js` сравнивает через `getPlaylistSignature()` (id+type+duration, без URL) — если структура изменилась, сохраняет текущую позицию по id элемента

## Структура файлов

```
server.js              # Entry point
src/
  config/index.js      # Env vars, paths
  middleware/           # auth.js, rateLimit.js, validate.js, errorHandler.js
  modules/             # auth, media, playlists, screens, player, pair, settings, system, backup
  utils/               # logger.js (winston), telegram.js, atomicWrite.js
data/                  # JSON storage (не в git)
uploads/               # Media files
public/
  admin/               # Admin UI pages
  player/              # Player HTML/JS + Service Worker
  pair/                # Pairing page
  js/                  # Клиентский JS (api.js, nav.js, player.js, admin-*.js, docs-content.js)
scripts/               # backup.js, reset-password.js, backfill-video-durations.js
android-app/           # Kotlin Android приложение (WebView)
```

## Правила разработки

- **Atomic write** для ВСЕХ JSON файлов — использовать `src/utils/atomicWrite.js`
- **Не трогать** `node_modules/`, `data/`, `uploads/` без явного запроса
- **pollInterval** минимум 10 сек — rate limiter 3 req/10sec per screenId
- **Видео** кодируется в H.264 High profile level 4.0 (`-profile:v high -level 4.0`), `-crf 23 -preset medium -r 30 -maxrate 8M -bufsize 16M -an -movflags +faststart`
- **videoMaxWidth** по умолчанию 1920px — защита от 4K видео
- **requireAuth** применяется на уровне router mount в `server.js`, а не в route-файлах
- **НЕ добавлять** разделы changelog/изменения в `docs-content.js` — документация описывает текущее состояние системы, не историю изменений

### При правках player.js учитывать:
- `isTransitioning` — флаг защиты от race condition (poll/watchdog/onended). Сбрасывать в canplay/onload/error
- `itemErrorCount` — Map ошибок per-item. Элемент пропускается после 3 ошибок, сбрасывается при onended и смене плейлиста
- `getPlaylistSignature()` — сравнение без URL (cache-buster `?v=`). При изменении структуры сохраняет позицию по id
- `preloadFallbackTimer` — 3 сек fallback если canplay/loadedmetadata не сработали на слабом WebView
- `addEventListener('canplay', ..., { once: true })` — one-shot обработчики, не использовать oncanplay
- `activeBlobUrls` Map — blob URL создаются **только в офлайн-режиме** (`!navigator.onLine`). В онлайне `video.src = url` напрямую (Nginx стримит через Range)
- `sendMetrics()` вызывается **только** в `playVideo()` → `onended`. Promoted preload path (`playNext()`) метрики не отправляет — только первое видео каждой сессии

### При правках admin JS:
- `showUndoToast` — каскадное удаление через `setTimeout(fn, 0)`, не синхронно
- `escapeAttr()` — полная версия с `&`, `"`, `'`, `<` (в admin-screens.js была неполная, исправлено)
- `maxFileSizeMb` — валидация размера на клиенте перед загрузкой

## Известные особенности (не баги)

- **SW Cache API**: все медиа (видео + изображения) кэшируются в Cache API для офлайн-воспроизведения. В онлайне видео стримит Nginx через Range-запросы напрямую (SW не участвует в воспроизведении). В офлайне `player.js` читает полный файл из кэша через `toBlobUrl()` → blob URL. `enforceLimit()` использует `sizeMap` (Content-Length при `cache.put()`) — без `resp.blob()`. Лимит кэша (`cacheMaxSizeMb`, по умолчанию 2048 МБ) задаётся в настройках админки. При превышении лимита самые большие видео удаляются первыми. При удалении медиа из плейлиста — кэш очищается автоматически при следующем poll.
- **Nginx /uploads/**: раздаётся напрямую через sendfile, минуя Node.js
- **Backup**: async spawn (не блокирует event loop), isRunning guard, lock-файл `data/.backup.lock`
- **Telegram**: exponential backoff с jitter, валидация token/chatId, парсинг JSON ответа
- **Android**: `largeHeap=true`, `setRendererPriorityPolicy(IMPORTANT)` для API 26+, `onTrimMemory` очищает кэш, `onBackPressed` заблокирован

## Сервер (production)

- **Домен:** https://s9a.ru
- **IP:** 5.129.223.35
- **Путь:** `/opt/digital-signage/`
- **Стек:** Node 20, PM2, Nginx, Let's Encrypt
- **Nginx** проксирует на `127.0.0.1:3000` (не `localhost` — IPv6 проблема)
- **Nginx** раздаёт `/uploads/` напрямую через `sendfile`, минуя Node.js
- **Сервер:** 2 CPU, 2GB RAM, 40GB NVMe, 1Gbit

## Целевые устройства

- **Android приставка H96Max**, 2GB RAM, Android 10+
- WebView-плеер, аппаратное декодирование H.264 High Level 4.0
- **Слабый чип** — не использовать `preload="auto"` для prefetch, не держать 2 video в DOM одновременно
- `preload="metadata"` + fallback timer 3 сек для prefetch

## Деплой

```
Локально: git commit → git push → ssh → git pull + pm2 restart signage
```
- После изменений в `nginx.conf`: `sudo cp nginx.conf /etc/nginx/sites-available/signage && nginx -t && nginx -s reload`
- APK пересобирать только если менялись файлы в `android-app/`
- После деплоя `player.js` — перезапустить приложение на приставке (или дождаться авто-перезагрузки в 04:00)

## Сессии и Windows (локальная разработка)

- На Windows задать `SESSION_USE_MEMORY=1` в `.env` — сессии в памяти
- **Перед запуском убить ВСЕ процессы Node** (`taskkill /IM node.exe /F`). Zombie-процессы держат порт 3000 и старый rate limit в памяти — новый сервер не может перехватить порт, запросы идут к старому процессу
- Проверка: `netstat -ano | grep :3000 | grep LISTEN` — должен быть ровно один PID
- На сервере НЕ задавать `SESSION_USE_MEMORY=1` — сессии в файлах, переживают pm2 restart

### Rate limiter и TOTP login

- `loginLimiter` (10 req / 15 min per IP) общий для `/login` И `/verify-totp`
- Каждая попытка входа с 2FA = 2 запроса (login + verify-totp), итого 5 полных попыток до блокировки
- При блокировке: перезапустить сервер (rate limit в памяти) или ждать 15 минут
- **Если после перезапуска rate limit не сбросился** — значит старый процесс node жив (см. выше)

- **After completing any task** — update CLAUDE.md if architecture, modules, or rules changed
