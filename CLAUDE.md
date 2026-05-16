# CLAUDE.md — NeoFit TV / Digital Signage

Главный entry-point для AI-сессий. Всё критичное должно быть здесь либо за прямой ссылкой.

> **Внимание:** это **НЕ** Kutt-форк из глобального `~/.claude/CLAUDE.md`. Это совершенно другой проект — система управления контентом на ТВ-экранах. Игнорировать упоминания Kutt, ОРД, ЮKassa, Knex, Handlebars, PostgreSQL и Telegram-бота на grammy, которые есть в глобальном файле.

---

## Что это

Централизованная система управления контентом на удалённых ТВ-экранах в фитнес-клубе.

**Сценарий:** админ загружает видео/картинки → собирает плейлисты → назначает на экраны → Android-приставки воспроизводят контент по кругу.

**Масштаб:** 4 здания, 38 экранов (до 40 в обозримом будущем). Контент — видео 1–6 минут + картинки. Каналы в зданиях 100–200 Мбит/с.

**Текущая версия:** v3.2 (см. `CHANGELOG.md`). ⚠️ `package.json` показывает `2.0.0-NEO` — это устаревшее значение, требует синхронизации (зафиксировано в `docs/AUDIT.md`).

---

## Стек

| Компонент | Технология |
|-----------|-----------|
| Backend | Node.js 20+, Express 4 |
| HTTP-защита | helmet |
| Хранилище данных | JSON-файлы (`data/*.json`), in-memory cache + atomic write |
| Хранилище медиа | Локальная ФС (`uploads/`) |
| Картинки | sharp |
| Видео | ffmpeg + fluent-ffmpeg (smart processing: probe → remux/transcode) |
| Сессии | express-session (memory в dev, file-store в prod) |
| Auth | bcrypt + speakeasy (TOTP 2FA), кука `neofit.sid` |
| Логи | winston |
| Cron | node-cron |
| Процесс-менеджер | PM2 (prod) |
| Прокси | Nginx + Let's Encrypt |
| Фронтенд | Vanilla JS, HTML, CSS (без фреймворков) |
| Плеер (Android) | Kotlin, ExoPlayer + SurfaceView + WebView |

Подробности — `docs/ARCHITECTURE.md`.

---

## Production-сервер

- **Домен:** https://tv.n-fit.ru
- **IP:** 5.35.91.125
- **Путь:** `/opt/signage/`
- **Стек:** Node 20, PM2, Nginx, Let's Encrypt
- **Сервер:** 2 CPU, 2GB RAM, 40GB NVMe, 1 Гбит/с

Процедура деплоя и отката — `docs/DEPLOYMENT.md`.

---

## Структура

```
server.js                   # Entry point
src/
  config/index.js           # env vars, paths
  middleware/               # auth, rateLimit, validate, errorHandler
  modules/                  # auth, media, playlists, screens, player,
                            # pair, settings, system, backup
  utils/                    # logger (winston), telegram, atomicWrite, fileUtils
data/                       # JSON storage (не в git)
uploads/                    # медиа-файлы (не в git)
backups/                    # tar.gz архивы (не в git)
public/
  admin/                    # админка
  player/                   # плеер + Service Worker
  pair/                     # страница привязки
  js/                       # api.js, nav.js, player.js, admin-*.js, docs-content.js
scripts/                    # backup.js, reset-password.js, backfill-video-durations.js
android-app/                # Kotlin APK (WebView + ExoPlayer гибрид)
nginx.conf                  # копируется на сервер вручную
ecosystem.config.js         # PM2 config
docs/                       # ARCHITECTURE, DEPLOYMENT, AUDIT, archive/
```

---

## Модули (`src/modules/`)

- **`auth`** — единый пароль (bcrypt) + 2FA (TOTP). Сессии в куке `neofit.sid`. Rate limit `loginLimiter` общий для `/login` и `/verify-totp` (10 req/15 min per IP).
- **`media`** — загрузка, magic-bytes валидация, sharp (картинки), ffmpeg (видео). Smart processing: ffprobe → совместимое = remux (`-c:v copy`), несовместимое = полный transcode. Polling прогресса. Отмена: per-item `DELETE /:id/cancel` и всей очереди `DELETE /queue`.
- **`video.queue`** — очередь перекодирования (concurrency 1), восстанавливается после рестарта. `cancelCurrent()` / `removePending()` / `clearQueue()`.
- **`playlists`** — CRUD, порядок элементов. При удалении медиа → авто-удаление из плейлистов.
- **`screens`** — CRUD, назначение плейлиста, heartbeat, онлайн-статус.
- **`screens.monitor`** — периодические проверки + Telegram-уведомления.
- **`player`** — публичный `GET /api/player/:screenId` (плейлист + настройки + heartbeat) и `POST /:screenId/metrics` (телеметрия).
- **`pair`** — 6-символьные коды привязки устройств, TTL 10 мин.
- **`settings`** — глобальные настройки, триггер перепланировки backup.
- **`backup`** — tar.gz архив `data/`, cron-планировщик, async spawn.
- **`system`** — CPU, RAM, диск для дашборда.

---

## Правила разработки

1. **Atomic write** для **всех** JSON в `data/` — только через `src/utils/atomicWrite.js`. Прямой `fs.writeFile` запрещён.
2. **Не трогать** `node_modules/`, `data/`, `uploads/`, `backups/` без явного запроса.
3. **pollInterval** ≥ 10 сек — rate limiter 3 req / 10 sec per `screenId`.
4. **Видео smart processing:** не менять параметры ffmpeg без обоснования. Текущие — High profile, Level 4.0/4.1, `-r 30 -crf 23 -preset medium -maxrate 8M -bufsize 16M -an`. Все аргументы зафиксированы в `media.processor.js` после долгого расследования лагов (см. `docs/archive/lagi.md`).
5. **Отмена обработки видео:** ffmpeg убивается через **SIGTERM**, не SIGKILL. `cancelled` / `currentCancelled` флаги предотвращают race с onComplete.
6. **requireAuth** — на уровне router mount в `server.js`, **не** в route-файлах.
7. **Документация в `public/js/docs-content.js`** — это страница помощи в админке. Туда **не** добавлять changelog. История изменений — только в `CHANGELOG.md`.
8. **Debug-логи на фронте** — за флагом `if (DEBUG) console.log(...)`. Безусловные `console.log` в продовом коде запрещены.

### При правках `public/js/player.js`

- `hasNativePlayer = typeof window.NativePlayer !== 'undefined'`. Определяет ExoPlayer vs WebView fallback.
- `playVideoNative(item)` — ExoPlayer путь, URL должен быть **абсолютным** через `new URL(path, window.location.origin).href`.
- `playVideoWebView(item)` — `<video>` fallback для ПК-отладки.
- `window.onExoVideoEnded` / `window.onExoVideoError` — callbacks из VideoPlayerManager.
- `isTransitioning` — защита от гонки (poll/watchdog/onended). Сбрасывать в canplay/onload/error.
- `itemErrorCount` — Map ошибок per-item. Skip после 3 ошибок, reset при onended и смене плейлиста.
- `getPlaylistSignature()` — сравнение без URL (cache-buster `?v=`). При изменении структуры сохраняет позицию по `id`.
- `NativePlayer.stopVideo()` — **только** при переходе видео→картинка и в `showPlaceholder()`. **НЕ** при видео→видео (ExoPlayer сам заменяет).
- `sendMetrics()` — работает только в WebView fallback. Нативный путь без метрик.

### При правках `android-app/.../VideoPlayerManager.kt`

- `hidePlayer()` вызывается **только** в `stopVideo()` и `onPlayerError()`. **НЕ** в `STATE_ENDED` — последний кадр должен оставаться видимым до первого кадра нового видео.
- Все `evaluateJavascript` — через `mainHandler.post {}` (UI thread).
- URL для ExoPlayer — всегда абсолютный (передаётся из player.js).
- `preloadVideo()` отключён — на H616 I/O конкуренция с воспроизведением. SimpleCache накапливает видео автоматически.
- `released` guard — все callbacks проверяют флаг.
- `CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR` — fallback на сеть при ошибке кэша.

### При правках `src/modules/media/media.processor.js`

- `probeVideo()` → `checkCompatibility()` → remux или fullTranscode. Параметры ffmpeg в fullTranscode **не менять**.
- `activeCommand` — текущий ffmpeg-процесс. `cancelCurrentJob()` → **SIGTERM** (не SIGKILL).
- `currentProgress` 0–100, обновляется через `.on('progress')`. `getCurrentProgress()` для polling.

### При правках admin JS (`public/js/admin-*.js`)

- `showUndoToast` — каскадное удаление через `setTimeout(fn, 0)`, не синхронно.
- `escapeAttr()` — полная версия с `&`, `"`, `'`, `<` (в `admin-screens.js` была неполная — исправлено).
- `maxFileSizeMb` — валидация размера на клиенте перед загрузкой.
- `uploadFiles()` — блокирует навигацию (`beforeunload` + sidebar disabled) на время загрузки.
- Processing cards — progress bar + `×` cancel. Polling через `GET /:id/status`.

---

## Локальная разработка на Windows

- В `.env` задать `SESSION_USE_MEMORY=1` — сессии в памяти (file-store на Windows ловит EPERM/ENOENT).
- **Перед запуском убить все процессы Node:** `taskkill /IM node.exe /F`. Zombie-процессы держат порт 3000 и **старый** rate limit в памяти — новый сервер не сможет перехватить порт, запросы будут идти к старому. Проверка: `netstat -ano | findstr :3000 | findstr LISTENING` — должен быть ровно один PID.
- Запуск: `npm run dev` (nodemon) или `npm start`.
- На сервере `SESSION_USE_MEMORY` **не задавать** — сессии в файлах, переживают `pm2 restart`.

### Rate limiter и TOTP login

- При 2FA каждый вход = 2 запроса (login + verify-totp) → 5 полных попыток до блокировки (10/15min).
- При блокировке: перезапуск сервера (rate limit в памяти) или ждать 15 минут.
- **Если после рестарта rate limit не сбросился** — старый процесс node жив. См. выше.

---

## Workflow багов и изменений

Эта секция — главное, ради чего создана инфраструктура `.md`-файлов. Соблюдать строго.

1. **Нашли баг / подозрительное место.** Записать в `docs/AUDIT.md` под подходящий раздел (`Confirmed bugs` / `Needs verification` / `Notes`). Каждая запись: путь:строка + короткое описание симптома.
2. **Чините баг.** После того как фикс прошёл проверку:
   - Удалить запись из `docs/AUDIT.md`.
   - Добавить **одну строку** в `CHANGELOG.md` под `## [Unreleased]` → `### Fixed` (или `### Added` / `### Changed` / `### Removed` если применимо).
3. **Релиз.** Когда `[Unreleased]` накопил содержательный набор изменений и принято решение релизить:
   - Заменить `## [Unreleased]` на `## [X.Y.Z] — YYYY-MM-DD`.
   - Создать новый пустой `## [Unreleased]` сверху.
   - Bump версии в `package.json`.
   - Создать git tag `vX.Y.Z`.

**Старт новой сессии:** прочитать `CLAUDE.md` → `docs/AUDIT.md` (что висит) → `CHANGELOG.md` секцию `[Unreleased]` (что недавно делали). Этого достаточно, чтобы продолжить работу без потери контекста.

---

## Документация

- `CHANGELOG.md` — единый источник истины «что менялось и что чинили». Keep a Changelog format.
- `docs/AUDIT.md` — открытые баги и наблюдения. Удалять записи по мере фиксов.
- `docs/ARCHITECTURE.md` — глубокий разбор: data flow, плеер, видео-пайплайн, pair.
- `docs/DEPLOYMENT.md` — процедура деплоя и отката.
- `docs/archive/` — исторические доки (lagi.md — расследование лагов видео, v2.md — план перехода на v2/v3).
- `public/js/docs-content.js` — справка в админке для конечного пользователя. **Не путать** с этой документацией.

---

## Что НЕ делать без явного запроса

- Не трогать `node_modules/`, `data/`, `uploads/`, `backups/`.
- Не менять параметры ffmpeg в `media.processor.js` (см. `docs/archive/lagi.md` — почему именно так).
- Не добавлять changelog в `public/js/docs-content.js`.
- Не делать `git commit` без отдельного запроса. В коммитах **всегда** добавлять trailer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Не push'ить APK в репо без обновления соответствующего файла в корне. После введения Gradle product flavors каждый клуб имеет свой APK: `app-neofit-debug.apk`, `app-labgym-debug.apk`, `app-soham-debug.apk`. Раздаются через единый endpoint `/app-debug.apk` (под auth), сервер сам выбирает правильный файл по `settings.systemName`. Legacy `app-debug.apk` остаётся как fallback во время миграции. См. `docs/DEPLOYMENT.md`..

---

## Полезные ссылки

- Сервер: https://tv.n-fit.ru
- Админка: https://tv.n-fit.ru/admin
- Плеер: `https://tv.n-fit.ru/player/index.html?id=<screenId>`
- PM2: `pm2 status`, `pm2 logs signage`, `pm2 restart signage`
- Сброс пароля: `npm run reset-password <НовыйПароль>` (≥8 символов)
