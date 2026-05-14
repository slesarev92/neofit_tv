# Changelog

Все значимые изменения в проекте — здесь. Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/). Версионирование: [SemVer](https://semver.org/lang/ru/).

> Каждый фикс/фича пишется одной строкой. После релиза `[Unreleased]` запечатывается в `[X.Y.Z] — YYYY-MM-DD`, создаётся новый пустой `[Unreleased]`, бампается `package.json`, ставится git tag.

---

## [Unreleased]

### Fixed
- Удалены безусловные `console.log('[media] cancelQueue …')` в `src/modules/media/media.routes.js` — спамили серверные логи. (2026-05-14)
- Дебажные `console.log('[NP] playVideo / onExoVideoEnded / onExoVideoError')` в `public/js/player.js` обёрнуты в `if (DEBUG)` для соответствия стилю файла — больше не спамят logcat на Android-плеере. (2026-05-14)
- `src/modules/media/video.queue.js::resumeUnfinished` теперь валидирует `processing-queue.json` (массив, элементы с `mediaId`). При повреждённом файле очередь не падает молча, а пишет warning. (2026-05-14)
- `src/modules/media/media.service.js::cleanupStaleTmpFiles()` + вызов из `server.js` подметают orphan-`.tmp.mp4` в `uploads/` после краша Node. Раньше при `SIGTERM` ffmpeg-tmp файлы оставались на диске и копились. Sweep делается **до** `videoQueue.resumeUnfinished`, чтобы не было гонки с воркером (Linux unlink на открытом файле ломал бы финальный rename). (2026-05-14)
- `scripts/reset-password.js` переведён на `writeFileAtomic` — сбой между байтами больше не зальёт `auth.json` мусором и не потеряет TOTP-секрет. Минимальная длина пароля поднята с 6 до 8 символов (согласовано с API `auth.routes.js:89`). (2026-05-14)
- `src/modules/screens/screens.monitor.js` — добавлен таймаут `MAX_CHECK_DURATION_MS = 90s` с принудительным сбросом `isRunning`. Если одна проверка зависнет (например, на медленном Telegram-вызове, который сам имеет worst case ~64s), следующий interval больше не пропускается молча, а форсирует новую. Гонку с orphan-resolve защищает token-механизм: только текущая проверка имеет право снимать lock. (2026-05-14)
- **Offline-цепочка плеера.** При ребуте Android-приставки без сети (и с заполненным локальным кэшем медиа) WebView больше не залипает на «не удалось открыть ссылку», а нормально проигрывает контент из кэша. Три согласованные правки: (1) `server.js` — `/player/*.html` теперь отдаётся с `Cache-Control: public, max-age=3600` (админка/login остаются `no-store, no-cache`). (2) `public/player/sw.js` — `/api/player/:screenId` GET переключен с `networkOnly` на `network-first → cache fallback`, ключ кэша нормализован (отбрасывается `?t=` cache-buster, иначе кэш рос бы бесконечно). (3) `android-app/.../MainActivity.kt` — на первой ошибке main-frame в `WebViewClient.onReceivedError` WebView сначала повторяет загрузку с `LOAD_CACHE_ELSE_NETWORK`; errorOverlay показывается только если и этот fallback не нашёл ничего в кэше. После успешной загрузки cacheMode сбрасывается обратно в `LOAD_DEFAULT` для следующей навигации. (2026-05-14)

### Changed
- `package.json` версия `2.0.0-NEO` → `3.2.0`. Соответствует реальному релизу из CHANGELOG; `/api/system/health` и UI теперь показывают актуальное значение. (2026-05-14)
- Введена документная инфраструктура: `CLAUDE.md` (главный entry-point), `CHANGELOG.md`, `docs/AUDIT.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`. Старые `lagi.md` и `v2.md` перенесены в `docs/archive/`. (2026-05-14)

---

## [3.2] — 2026-03-31

### Added
- Smart video processing — `probeVideo()` + `checkCompatibility()` → совместимое видео идёт через remux (`-c:v copy`, секунды), несовместимое через полный transcode (минуты). Экономит ~90 % времени для подготовленного контента. (`9d80d15`)
- Прогресс-бар обработки видео в админке: `currentProgress` 0–100 через ffmpeg `.on('progress')`, polling `GET /:id/status`. (`8ac2705`)
- Отмена обработки: per-item `DELETE /api/media/:id/cancel` и всей очереди `DELETE /api/media/queue`. Кнопка «Остановить очередь» в админке + `×` на карточках в обработке. (`9333976`, `8ac2705`)
- Блокировка навигации во время загрузки медиа — `beforeunload` + disabled sidebar, чтобы случайный клик не оборвал заливку. (`c4ccf58`)

### Fixed
- Allow H.264 Level 4.1 в `checkCompatibility()` — раньше требовался Level 4.0, и слегка более качественные исходники шли через полный transcode без причины. (`bb80cd3`)
- `pendingAuth` теперь очищается при логине без 2FA — фикс залипания сессии в промежуточном состоянии. Заодно синхронизирован prod `nginx.conf`. (`e3b29b9`)
- `PlayerView` скрывается **после** загрузки картинки (img.onload), не до — убран чёрный flash при переходе видео→картинка. (`87dc696`)
- `PlayerView` остаётся видимым между видео — `keep_content_on_player_reset=true` плюс `hidePlayer()` только в `stopVideo()` и `onPlayerError()`. (`b3c13e2`, `f6ab9a1`)
- ffmpeg убивается через **SIGTERM** (не SIGKILL) — корректно завершает запись, `fluent-ffmpeg` ловит ошибку. (`9333976`)

### Changed
- Видео отменяется атомарно: флаги `cancelled` / `currentCancelled` в `video.queue` гарантируют отсутствие race condition с `onComplete`. (`9333976`)

---

## [3.1] — 2026-03-31

### Fixed
- URL для ExoPlayer теперь абсолютный — `new URL(path, window.location.origin).href`. Раньше относительный URL ломал воспроизведение на NativePlayer. (`2482dad`, `f6ab9a1`)
- `preloadVideo()` отключён на стороне `player.js` — на H616 CacheWriter конкурировал за I/O с воспроизведением, давал микро-лаги. SimpleCache всё равно накапливает видео автоматически. (`e00b316`, `f6ab9a1`)
- Последний кадр сохраняется между видео — `keep_content_on_player_reset=true` + `LAYER_TYPE_NONE` (раньше HARDWARE-слой давал лишнюю GPU-копию). (`f6ab9a1`)

---

## [3.0] — 2026-03-31

### Added
- **Гибридный плеер ExoPlayer + SurfaceView** для видео на Android-приставке. WebView остался для картинок, расписания, UI. SurfaceView использует hardware overlay — кадры идут от VPU напрямую на дисплей, без GPU-копирования. CPU ~10–15 % vs ~35–40 % в WebView `<video>`. (`f8aa0f9`)
- `VideoPlayerManager.kt` — ExoPlayer + SimpleCache + `@JavascriptInterface NativePlayer`. LRU-eviction 2 ГБ в `cacheDir/video-cache`. (`f8aa0f9`)
- Гибридный режим в `public/js/player.js` — `hasNativePlayer` определяет ExoPlayer vs WebView fallback. (`f8aa0f9`)
- media3 1.9.2, compileSdk 35, minSdk 23 в `android-app/app/build.gradle`. (`f8aa0f9`)

### Changed
- `LAYER_TYPE_NONE` для WebView (раньше HARDWARE) — убрали лишний GPU-сэмплинг.
- SW Cache API теперь кэширует **только картинки**. Видео фильтруются в `notifySwPrecache()` при `hasNativePlayer = true` — ExoPlayer держит свой кэш на диске.

---

## [2.0-NEO] — 2026-03 (расследование лагов видео)

Серия итераций по устранению микро-лагов на H96Max / Allwinner H616 / 2 ГБ RAM. Все детали — `docs/archive/lagi.md`.

### Fixed
- H.264 profile/level: было `baseline level 3.1` → стало `high level 4.0`. Level 3.1 не поддерживает 1080p (3600 макроблоков vs 8160 для 1080p), декодер уходил в софт-фоллбек. (`744465f`)
- ffmpeg: `-r 30 -preset medium -maxrate 8M -bufsize 16M` (вместо `-preset veryfast` без ограничения битрейта). (`2efde54`, `744465f`)
- Blob URL вместо `blob.slice()` в SW — устранили десятки аллокаций в секунду на Range-запросах. (`2987fb8`)
- Прямой URL для онлайна (без `toBlobUrl()`) — `video.src = url` через Nginx Range, blob URL остался только как offline fallback. (`d8382c3`)
- `enforceLimit()` использует `sizeMap` с Content-Length из `cache.put()` — раньше перечитывал все блобы. (`d8382c3`)

### Added
- Телеметрия воспроизведения: `droppedFrames`, `totalFrames`, `dropPercent`, `blobTimeMs`, `canplayTimeMs`, источник cache/network, размер файла. POST `/api/player/:screenId/metrics`, отображается в админке. (`071dd8b`)
- Офлайн-кэширование видео в SW Cache API — все медиа кэшируются, Range из кэша, настройка `cacheMaxSizeMb` (по умолчанию 2048 МБ). (`1ebca50`) — *устарело в v3.0, видео теперь через ExoPlayer SimpleCache.*

---

## Более ранние версии

История до v2.0-NEO — в `git log`. Ключевые релизы:

- **v1.7.1-NEO** — фикс плеера: playlist signature, position save, canplay fallback, error counter, isTransitioning guard (`0715306`).
- **v1.7-NEO** — нативный `<video>` оптимизации, заметки про zombie Node и rate limiter на Windows (`83d571a`).
- **v1.6-NEO** — стабилизация.
- **v1.5-NEO** — фикс minimatch ReDoS через `npm audit` (`94c1428`).
- **v1.4-NEO** — Android stability fixes.
- **100.3.0** — 2FA (TOTP, Google Authenticator). (`3c91401`)
- **100.2.0** — UX, playlist duration with video, backfill script, errorHandler fix. (`424df02`)
- **7.0** — Telegram-уведомления (rich messages, grouping, test), BASE_URL в env. (`8813d43`)
- **5.1** — кэш, atomic write, session file store, backup rollback, video thumb t=2, UTF-8 в именах. (`db811e7`)
