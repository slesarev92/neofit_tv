# NeoFit TV — Digital Signage

## Архитектура

**Стек:** Node.js (Express) порт 3000, Nginx (443/HTTPS), данные `data/*.json`, медиа `uploads/`

**Слои:** `Routes` → валидация (express-validator) → `Services` → `Repositories` (JSON + in-memory cache)

**Модули** (`src/modules/`):
- `auth` — единый пароль (bcrypt) + 2FA (TOTP/speakeasy), сессии в памяти или файлах
- `media` — загрузка, magic bytes валидация, sharp (изображения), ffmpeg (видео H.264 High Level 4.0). Smart processing: ffprobe → совместимое видео remux (`-c:v copy`), несовместимое → полный transcode. Прогресс обработки через polling. Отмена: per-item (`/:id/cancel`) и всей очереди (`/queue`)
- `video.queue` — очередь перекодирования (concurrency: 1), восстанавливается после рестарта. `cancelCurrent()` / `removePending()` / `clearQueue()` для отмены
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
android-app/           # Kotlin Android приложение (WebView + ExoPlayer)
  MainActivity.kt      # WebView + VideoPlayerManager подключение
  VideoPlayerManager.kt # ExoPlayer + SimpleCache + @JavascriptInterface
  SettingsActivity.kt  # Настройки: URL, screenId, PIN
  BindingActivity.kt   # Привязка устройств (QR)
```

## Правила разработки

- **Atomic write** для ВСЕХ JSON файлов — использовать `src/utils/atomicWrite.js`
- **Не трогать** `node_modules/`, `data/`, `uploads/` без явного запроса
- **pollInterval** минимум 10 сек — rate limiter 3 req/10sec per screenId
- **Видео** — smart processing: `probeVideo()` проверяет совместимость (h264, profile ≤ High, level ≤ 4.0, width ≤ 1920, fps ≤ 30, bitrate ≤ 8Mbps). Совместимое → remux (`-c:v copy -an -movflags +faststart`, секунды). Несовместимое → полный transcode (`-crf 23 -preset medium -r 30 -maxrate 8M -bufsize 16M -an -movflags +faststart -profile:v high -level 4.0`)
- **videoMaxWidth** по умолчанию 1920px — защита от 4K видео
- **Отмена обработки**: `DELETE /api/media/:id/cancel` (per-item) и `DELETE /api/media/queue` (вся очередь). ffmpeg убивается через SIGTERM. `cancelled` / `currentCancelled` флаги в video.queue предотвращают race condition с onComplete
- **requireAuth** применяется на уровне router mount в `server.js`, а не в route-файлах
- **НЕ добавлять** разделы changelog/изменения в `docs-content.js` — документация описывает текущее состояние системы, не историю изменений

### При правках player.js учитывать:
- `hasNativePlayer` — `typeof window.NativePlayer !== 'undefined'`. Определяет режим воспроизведения видео: ExoPlayer (приставка) или WebView `<video>` (ПК/браузер)
- `playVideoNative(item)` — ExoPlayer путь. URL должен быть абсолютным: `new URL(path, window.location.origin).href`
- `playVideoWebView(item)` — WebView `<video>` fallback для ПК-отладки. Вся старая логика сохранена без изменений
- `window.onExoVideoEnded` / `window.onExoVideoError` — callbacks из VideoPlayerManager через evaluateJavascript
- `isTransitioning` — флаг защиты от race condition (poll/watchdog/onended). Сбрасывать в canplay/onload/error
- `itemErrorCount` — Map ошибок per-item. Элемент пропускается после 3 ошибок, сбрасывается при onended и смене плейлиста
- `getPlaylistSignature()` — сравнение без URL (cache-buster `?v=`). При изменении структуры сохраняет позицию по id
- `NativePlayer.stopVideo()` — вызывать при переходе от видео к изображению и в showPlaceholder(). НЕ вызывать при переходе видео → видео (ExoPlayer сам заменяет медиа)
- `sendMetrics()` — работает только в WebView fallback (`playVideoWebView`). Нативный путь пока без метрик

### При правках VideoPlayerManager.kt учитывать:
- `hidePlayer()` — вызывать **только** в `stopVideo()` и `onPlayerError()`. **НЕ** в `onPlaybackStateChanged(STATE_ENDED)` — последний кадр должен оставаться видимым до первого кадра нового видео
- Все `evaluateJavascript` — через `mainHandler.post {}` (UI thread)
- URL для ExoPlayer — всегда абсолютный (передаётся из player.js)
- `preloadVideo()` — отключён на стороне player.js (I/O конкуренция на H616). SimpleCache накапливает видео автоматически при воспроизведении
- `released` guard — все callbacks и JS-вызовы проверяют флаг
- `CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR` — при ошибке кэша fallback на сеть

### При правках media.processor.js учитывать:
- `probeVideo()` → `checkCompatibility()` → remux или fullTranscode. Не менять параметры ffmpeg в fullTranscode
- `activeCommand` — текущий ffmpeg-процесс. `cancelCurrentJob()` → SIGTERM (не SIGKILL)
- `currentProgress` — 0-100, обновляется через `.on('progress')`. `getCurrentProgress()` для polling

### При правках admin JS:
- `showUndoToast` — каскадное удаление через `setTimeout(fn, 0)`, не синхронно
- `escapeAttr()` — полная версия с `&`, `"`, `'`, `<` (в admin-screens.js была неполная, исправлено)
- `maxFileSizeMb` — валидация размера на клиенте перед загрузкой
- `uploadFiles()` — блокирует навигацию (beforeunload + sidebar disabled) на время загрузки
- Processing cards: progress bar + `×` cancel button. Polling обновляет progress через `GET /:id/status`

## Известные особенности (не баги)

- **Видео на приставке (ExoPlayer)**: VideoPlayerManager.kt — ExoPlayer + SurfaceView (zero-copy через hardware overlay). SimpleCache хранит видео в `cacheDir/video-cache`, LRU-eviction 2GB. После 1-2 циклов плейлиста все видео на диске → офлайн работает автоматически. `preloadVideo()` отключён намеренно — на H616 CacheWriter конкурирует за I/O с воспроизведением
- **Видео на ПК (WebView fallback)**: `playVideoWebView()` — стандартный `<video>` элемент. `toBlobUrl()` для офлайна, `video.src = url` для онлайна (Nginx Range). Используется когда `hasNativePlayer = false`
- **SW Cache API**: **только изображения** кэшируются в SW Cache API (видео фильтруется в `notifySwPrecache()` при `hasNativePlayer`). `enforceLimit()` использует `sizeMap` (Content-Length при `cache.put()`). Лимит кэша (`cacheMaxSizeMb`, по умолчанию 2048 МБ) задаётся в настройках админки
- **Nginx /uploads/**: раздаётся напрямую через sendfile, минуя Node.js
- **Backup**: async spawn (не блокирует event loop), isRunning guard, lock-файл `data/.backup.lock`
- **Telegram**: exponential backoff с jitter, валидация token/chatId, парсинг JSON ответа
- **Android**: `largeHeap=true`, `setRendererPriorityPolicy(IMPORTANT)` для API 26+, `LAYER_TYPE_NONE` (не HARDWARE — лишняя GPU-копия), `onTrimMemory` очищает WebView кэш, `onBackPressed` заблокирован

## Сервер (production)

- **Домен:** https://s9a.ru
- **IP:** 5.129.223.35
- **Путь:** `/opt/digital-signage/`
- **Стек:** Node 20, PM2, Nginx, Let's Encrypt
- **Nginx** проксирует на `127.0.0.1:3000` (не `localhost` — IPv6 проблема)
- **Nginx** раздаёт `/uploads/` напрямую через `sendfile`, минуя Node.js
- **Сервер:** 2 CPU, 2GB RAM, 40GB NVMe, 1Gbit

## Целевые устройства

- **Android приставка H96Max**, Allwinner H616, 2GB RAM, Android 10+
- Гибридный плеер: ExoPlayer + SurfaceView для видео, WebView для изображений и UI
- Аппаратное декодирование H.264 High Level 4.0 через MediaCodec (VPU)
- **Слабый чип** — не конкурировать за I/O (preloadVideo отключён), один HW decoder instance

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
