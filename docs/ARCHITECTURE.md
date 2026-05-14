# ARCHITECTURE

Глубокий разбор. В `CLAUDE.md` — общая карта; здесь — потоки и неочевидные решения.

---

## Слои

```
HTTP request
   │
   ▼
Express middleware (helmet → session → json)
   │
   ▼
Routes (src/modules/*/routes.js)
   │  ── validation: express-validator (src/middleware/validate.js)
   │  ── auth: requireAuth (на уровне router mount в server.js)
   │  ── rate limit: src/middleware/rateLimit.js (loginLimiter, playerLimiter)
   ▼
Services (src/modules/*/service.js)
   │  ── бизнес-логика, оркестрация, валидация бизнес-правил
   ▼
Repositories (src/modules/*/repository.js)
   │  ── чтение/запись JSON в data/*.json
   │  ── in-memory cache (читаем из памяти, пишем атомарно)
   │  ── ВСЕ записи через src/utils/atomicWrite.js
   ▼
data/*.json   (auth.json, settings.json, screens.json, playlists.json, media.json, pair.json, processing-queue.json)
```

---

## Playlist update flow

```
1. Админ меняет плейлист в UI
       │
       ▼  PUT /api/playlists/:id
2. playlists.service → playlists.repository.update()
       │  └── atomicWrite в data/playlists.json
       ▼
3. Если плейлист назначен на screen → каскад в screens.repository
       │  └── atomicWrite в data/screens.json
       ▼
4. Плеер опрашивает GET /api/player/:screenId раз в N секунд
       │  ── rate limit: 3 req / 10 sec per screenId
       │  ── обновляет screen.lastSeenAt (heartbeat)
       ▼
5. player.js получает { playlist, settings }
       │
       ▼
6. getPlaylistSignature() сравнивает по id+type+duration (БЕЗ URL)
       │  ── если структура та же → продолжаем играть с текущей позиции
       │  ── если изменилась → сохраняем позицию по id текущего элемента
       ▼                       и переключаемся на новый плейлист
7. Воспроизведение
```

URL не учитывается в signature, потому что:
- player.js приклеивает cache-buster `?v=…` к URL для борьбы с кэшем браузера.
- Реальное содержимое медиа меняется только при изменении `id`.

---

## Video pipeline

```
POST /api/media (multer файл во временную папку)
   │
   ▼
mediaService.upload(file)
   │  ├── magic bytes валидация (file-type)
   │  ├── картинки → sharp обрабатывает на месте → status: 'ready'
   │  └── видео → копируем в uploads/ → создаём запись status: 'processing'
   │             → videoQueue.enqueue(mediaId, sourcePath, ...)
   ▼
video.queue (concurrency 1, persisted в data/processing-queue.json)
   │
   ▼
media.processor.runJob(sourcePath, destPath)
   │
   ├── probeVideo(sourcePath)  ← ffprobe
   │     └── { codec, profile, level, width, height, fps, bitrate }
   │
   ├── checkCompatibility(info)
   │     │   совместимо если: codec=h264 ∧ profile≤high ∧ level≤4.1
   │     │                  ∧ width≤1920 ∧ fps≤30 ∧ bitrate≤8Mbps
   │     ▼
   │   ┌─ remux:    ffmpeg -i src -c:v copy -an -movflags +faststart dest
   │   │            (несколько секунд)
   │   │
   │   └─ transcode: ffmpeg -i src -c:v libx264 -crf 23 -preset medium
   │                 -r 30 -maxrate 8M -bufsize 16M -an
   │                 -movflags +faststart -profile:v high -level 4.0 dest
   │                 (минуты)
   │
   ├── .on('progress', p) → currentProgress = p.percent (для UI polling)
   │
   ▼
mediaRepository.update(mediaId, { status: 'ready', compressedSize, durationSeconds })
```

### Параметры ffmpeg — почему именно так

История и обоснование — `docs/archive/lagi.md`. Кратко:
- **profile high level 4.0/4.1** — нужно для 1080p. Level 3.1 не поддерживает 1080p (1280×720 макс), декодер на H616 уходил в софт.
- **-r 30** — H616 декодер плохо тянет 60fps, плюс цикл синхронизации с 60Hz панелью даёт 2:2.
- **-crf 23 -preset medium** — баланс качество/битрейт. Veryfast давал излишне крупный файл при том же качестве.
- **-maxrate 8M -bufsize 16M** — без maxrate декодер задыхался на пиках.
- **-an** — звука нет вообще, экономим биты.
- **-movflags +faststart** — moov atom в начале для быстрого старта при стриминге.

### Отмена обработки

```
DELETE /api/media/:id/cancel         или    DELETE /api/media/queue
        │                                          │
        ▼                                          ▼
mediaService.cancelMediaProcessing(id)     mediaService.cancelQueue()
        │                                          │
        ▼                                          ▼
videoQueue.cancelCurrent() or removePending(id)    videoQueue.clearQueue()
        │                                          │
        ▼                                          ▼
   active ffmpeg process: SIGTERM (НЕ SIGKILL)
        │
        ▼
fluent-ffmpeg ловит 'error' с code 255 / SIGTERM-сигналом
        │  ── флаг cancelled / currentCancelled предотвращает race с onComplete
        ▼
mediaRepository.update(mediaId, { status: 'cancelled' })
```

---

## Player (Android-плеер)

Гибридный режим:

```
                    ┌──────────────────────────────────────────┐
                    │  Android MainActivity                    │
                    │                                          │
                    │  ┌────────────────────────────────────┐  │
                    │  │ PlayerView (SurfaceView)           │  │
                    │  │ ── ExoPlayer ── SimpleCache 2GB    │  │   видео
                    │  │ ── hardware overlay (zero-copy)    │  │
                    │  └────────────────────────────────────┘  │
                    │                                          │
                    │  ┌────────────────────────────────────┐  │
                    │  │ WebView                            │  │
                    │  │ ── player.js                       │  │   картинки, UI,
                    │  │ ── SW Cache API (только картинки)  │  │   расписание, poll
                    │  └────────────────────────────────────┘  │
                    │                                          │
                    │  JS ←→ Kotlin через @JavascriptInterface │
                    │        window.NativePlayer.playVideo()   │
                    │        window.onExoVideoEnded()          │
                    │        window.onExoVideoError()          │
                    └──────────────────────────────────────────┘
```

`hasNativePlayer = typeof window.NativePlayer !== 'undefined'`:
- **true** (на приставке) → `playVideoNative()` → `NativePlayer.playVideo(absoluteUrl)`. ExoPlayer показывает видео через SurfaceView, последний кадр сохраняется (`keep_content_on_player_reset=true`).
- **false** (ПК-отладка) → `playVideoWebView()` → `<video>` элемент в WebView.

### Переходы

| Из | В | Что делать |
|----|---|-----------|
| video → video | оба | НЕ скрывать PlayerView. ExoPlayer заменяет источник, последний кадр виден до первого нового кадра. Gap 300–500мс — аппаратное ограничение MediaCodec init на H616. |
| video → image | оба | Грузим картинку в WebView под PlayerView. После `img.onload` → `NativePlayer.stopVideo()` → `hidePlayer()`. Без чёрного flash. |
| image → video | оба | `NativePlayer.playVideo()` показывает PlayerView. WebView с картинкой остаётся снизу — не видно. |
| image → image | WebView | стандартный transition. |
| любое → placeholder | оба | `showPlaceholder()` → `NativePlayer.stopVideo()` + placeholder в WebView. |

### Защита от багов в плеере

- **`isTransitioning`** — флаг, сбрасывается в `canplay`/`onload`/`error`. Защищает от гонки между poll-обновлением, watchdog'ом и `onended`.
- **`itemErrorCount`** — Map ошибок per-item. Элемент пропускается после 3 ошибок, счётчик сбрасывается при `onended` и смене плейлиста.
- **`watchdog`** — таймер на удвоенную длительность элемента. Если событие `onended` / `onload` не пришло, переходим к следующему. Защита от зависших декодеров.
- **`itemErrorCount` всех элементов > 0** → пауза 10 сек → retry. Защита от busy-loop, когда вся сеть лежит.

### Авто-перезагрузка

В админке настраиваемое время (по умолчанию 04:00). Если плеер запущен, в это время `window.location.reload()`. Помогает очистить любые ленивые утечки RAM, переподгрузить SW, подхватить новый player.js без визита к приставке.

---

## Pair flow (привязка устройств)

```
1. Админ открывает экран в админке → кнопка "Привязать устройство"
       │
       ▼
2. POST /api/pair/init → возвращает 6-символьный код (TTL 10 мин)
       │  ── код хранится в data/pair.json, привязан к screenId
       ▼
3. Админ показывает код на экране (или QR-код, см. BindingActivity.kt)
       │
       ▼
4. Android-приставка: пользователь вводит код в SettingsActivity / BindingActivity
       │
       ▼
5. POST /api/pair/complete { code, deviceInfo }
       │  ── pair.service проверяет код, не истёк ли, не использован ли
       │  ── связывает device с screenId
       │  ── удаляет код из pair.json (одноразовый)
       ▼
6. Приставка получает { screenId, baseUrl } → сохраняет → переходит в player
```

### Известные риски

- Race между двумя одновременными `/api/pair/init` (см. `docs/AUDIT.md`).
- TTL 10 мин — если админ открыл код и забыл, через 10 мин код невалиден. UI должен это показать.

---

## Backup

`scripts/backup.js` создаёт `backups/backup-YYYY-MM-DD-HH-mm.tar.gz` с содержимым `data/`. Запуск:
- Вручную: `npm run backup`.
- По расписанию: `node-cron` в `src/modules/backup/backup.scheduler.js` (внутри основного процесса PM2).
- Через системный cron: `scripts/setup-cron.sh` (работает независимо от PM2).

Защита:
- `isRunning` guard — два бэкапа одновременно не пойдут.
- Lock-файл `data/.backup.lock` — даже если процессов несколько.
- Async spawn `tar` — не блокирует event loop.
- Хранится 30 последних архивов, старые удаляются.

⚠️ На Windows `spawnSync('tar', …)` требует, чтобы `tar` был в PATH (Git-Bash / WSL / Win10 build-in). См. `docs/AUDIT.md`.

---

## Sessions

- `express-session` + `session-file-store` (prod) / memory (dev).
- Кука `neofit.sid`, `httpOnly`, `sameSite=lax`, `secure` зависит от `BASE_URL`.
- В prod: `SESSION_USE_MEMORY` **не** задавать — сессии в файлах в `data/sessions/`, переживают `pm2 restart`.
- В dev на Windows: `SESSION_USE_MEMORY=1` обязательно — file-store ловит EPERM/ENOENT.

### Auth + 2FA + rate limit

- Один общий пользователь — пароль в `data/auth.json` (bcrypt-хеш).
- 2FA опционально — секрет TOTP в `data/auth.json` после `/api/auth/totp/setup`.
- Flow:
  1. `POST /api/auth/login` { password } → если 2FA выключена, сразу залогинен. Если 2FA включена, `req.session.pendingAuth = true` и нужно `verify-totp`.
  2. `POST /api/auth/verify-totp` { token } → проверка TOTP → `req.session.user = true`.
- `loginLimiter` (10 req / 15 min per IP) общий для `/login` и `/verify-totp`. С 2FA — 5 полных попыток до блокировки (каждая = 2 запроса).

---

## Telemetry (плеер → сервер)

`POST /api/player/:screenId/metrics` собирает:
- `droppedFrames`, `totalFrames`, `dropPercent`
- `blobTimeMs`, `canplayTimeMs`
- источник: `cache` / `network`
- `fileSizeKb`

Отображается в админке на странице экранов под «Последняя активность». Используется для диагностики проблем плавности (см. `docs/archive/lagi.md`).

⚠️ Метрики работают только в WebView fallback (`playVideoWebView`). Нативный путь через ExoPlayer метрик пока не шлёт.

---

## Известные особенности (НЕ баги)

- **Gap 300–500мс при видео→видео** — аппаратное ограничение MediaCodec init на H616. Можно убрать через ExoPlayer playlist API, но потребует архитектурных изменений.
- **SurfaceView z-order** — нельзя alpha-blend или bringToFront стандартным способом. Все переходы видео↔картинка через VISIBLE/GONE.
- **`preloadVideo()` отключён** — на H616 CacheWriter конкурировал за I/O с воспроизведением. SimpleCache всё равно накапливает видео автоматически при первом проигрывании.
- **SW Cache API только для картинок** — видео фильтруются в `notifySwPrecache()` когда `hasNativePlayer=true`. ExoPlayer SimpleCache отдельно от SW.
- **Nginx `/uploads/`** — раздаётся через `sendfile`, минуя Node.js. Существенно снижает CPU.
- **Android `largeHeap=true`** — нужно для WebView с большим количеством картинок.
- **`setRendererPriorityPolicy(IMPORTANT)`** для API 26+ — WebView не убивается системой при бэкграунде.
- **`LAYER_TYPE_NONE`** для WebView (не HARDWARE) — HARDWARE-слой давал лишнюю GPU-копию, замедлял на H616.
- **`onBackPressed` заблокирован** — приставка должна играть, не позволять пользователю выходить.
