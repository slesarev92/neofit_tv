# Changelog

Все значимые изменения в проекте — здесь. Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/). Версионирование: [SemVer](https://semver.org/lang/ru/).

> Каждый фикс/фича пишется одной строкой. После релиза `[Unreleased]` запечатывается в `[X.Y.Z] — YYYY-MM-DD`, создаётся новый пустой `[Unreleased]`, бампается `package.json`, ставится git tag.

---

## [Unreleased]

### Added
- **Android-плеер: выбор клуба из списка вместо ручного ввода URL.** На экране привязки (`BindingActivity`) и в настройках (`SettingsActivity`) появился `Spinner` с тремя предзаданными деплоями (NeoFit TV / Labgym TV / Soham TV) и опцией «Другое (ручной ввод)» для нестандартных случаев. На пульте 3 нажатия вместо ввода ~30-символьного URL. Один APK ставится во все клубы. Добавление нового клуба = одна строка в `res/values/clubs.xml` + пересборка APK. Затронуты: `clubs.xml` (новый, source of truth), `Clubs.kt` (новый, парсер + reverse lookup), `strings.xml` (3 новые строки), оба layout'а, обе Activity. Backward compat: существующие установки с сохранённым custom URL автоматически попадут в «Другое» с подставленным значением. (2026-05-16)

### Changed
- **APK переименован: `neofit_tv.apk` → `app-debug.apk`.** Имя совпадает с дефолтным выводом Gradle (`assembleDebug`), специальное переименование при копировании в корень репо больше не требуется. Затронуты: `server.js` (URL + lookup), `scripts/upload-apk.ps1`, `public/js/nav.js` (download link), `public/js/docs-content.js` (упоминания в справке), `CLAUDE.md`, `docs/DEPLOYMENT.md`. **Действие на проде после деплоя:** `mv /opt/digital-signage/neofit_tv.apk /opt/digital-signage/app-debug.apk` либо перелить через `scripts/upload-apk.ps1`. (2026-05-16)

### Added
- **Phase A мульти-брендинга — web-страницы.** Каждый деплой (NeoFit TV / Labgym TV / Soham TV / …) теперь правильно показывает свой бренд во всех клиентских точках входа. (2026-05-16)
  - **Новый публичный endpoint `GET /api/branding`** (без `requireAuth`) возвращает `{ systemName, logoUrl }`. Используется страницами `login.html`, `pair/index.html`, `player/index.html`, которые работают без авторизации. Никаких секретов не отдаёт.
  - `public/login.html` — `<title>`, `<h1>`, `<img>` логотипа теперь динамические. Подтягиваются из `/api/branding` после загрузки страницы. Fallback — захардкоженные значения если endpoint недоступен.
  - `public/pair/index.html`, `public/player/index.html` — `<title>` динамический.
  - `public/js/nav.js` — после применения брендинга экспортирует `window.__brand = { systemName, logoUrl }` для синхронного доступа из других скриптов.
  - `public/js/admin-screens.js::downloadPlayerFile` — title и имя скачиваемого HTML-файла плеера используют `window.__brand.systemName` вместо захардкоженного `'NeoFit_TV'`.
  - `public/js/docs-content.js` — плейсхолдер `{{brand}}` в контенте справки подставляется на render. `initDocsPage` сам делает fetch на `/api/branding`, чтобы не было race с `nav.js`. Заодно исправлен неточный пример формата Telegram-сообщения — теперь соответствует реальному выводу `screens.monitor.js`.
  - `src/modules/settings/settings.routes.js::telegram-test` — тестовое сообщение использует `systemName` (с HTML-escape для безопасности, т.к. пользовательский ввод идёт в `<b>` тег).

### Changed
- `src/modules/auth/auth.service.js::setupTotp` — название и issuer для TOTP-записи берутся из `settings.systemName` вместо захардкоженного `'NeoFit TV'`. Каждый деплой (labgym / soham / neofit / …) теперь показывает свой бренд в аутентификатор-апе. Fallback на `'NeoFit TV'` если systemName пустой. Изменение влияет только на НОВЫЕ setup'ы — уже привязанные записи на телефонах не меняются (там фиксированный секрет). (2026-05-16)

### Removed
- Убран warning над кнопкой «Подключить Google Authenticator» в настройках 2FA — по решению поддерживать чистый UI. Инструкция «удалите старые записи перед настройкой» осталась в коммит-логе и CHANGELOG, актуальна при ручной переустановке 2FA. (2026-05-16)

---

## [3.4.0] — 2026-05-16

### Fixed
- **2FA «иногда не заходит» решено.** Не код, а накопленные записи в Google Authenticator: каждое пере-подключение 2FA (с локалки, теста, прода) оставляло в приложении старую запись с прежним секретом — сервер хранил только последний. Угадал запись правом — зашёл, попал на устаревшую — «неверный код». Расширение `window` маскировало симптом, но не лечило. Очистка телефона + переподключение → стабильно. (2026-05-16)
- `src/modules/settings/settings.service.js::update` — при `workScheduleEnabled=false` (по эффективному состоянию после merge) принудительно сбрасывает `workScheduleFrom`/`workScheduleTo` в `null`. Раньше выключенное расписание оставляло «слепые» значения в БД, при следующем включении они применялись неожиданно. (2026-05-16)
- `src/modules/settings/settings.service.js::validate` — `backupScheduleMonthDays` больше не фильтрует молча невалидные значения. Раньше ввод `0,1,32,50` сохранялся как `1` без уведомления. Теперь любой невалидный токен (нечисло, `<1`, `>31`) → 400 с перечислением неправильных значений. (2026-05-16)

### Added
- `public/admin/settings.html` — warning перед кнопкой «Подключить Google Authenticator»: «Удалите старые записи NeoFit TV из приложения-аутентификатора перед настройкой». Предотвращает повторение бага «иногда заходит, иногда нет» при будущих переподключениях. (2026-05-16)
- `src/modules/settings/settings.service.js::update` — cross-field валидация `monitorCheckIntervalSec` против эффективного порога онлайн (`max(onlineThreshold, pollInterval × 2)`). Если интервал проверки больше — 400 с пояснением «короткие оффлайны пропускаются между проверками». Закрывает дыру в детекте, когда чек реже окна офлайна. Срабатывает только при изменении monitor-полей, чтобы не блокировать сохранение других вкладок при legacy-конфиге. (2026-05-16)

### Changed
- `src/modules/auth/auth.service.js` — TOTP `window` сужен с `4` (±2 мин) до `1` (±30 сек) в `verifyTotp` и `enableTotp`. Раньше украденный код был валиден до 4 минут — security smell, который маскировал реальную проблему (множественные записи в Authenticator) ошибочной диагностикой «дрейфа часов». С работающим NTP стандартного окна достаточно. (2026-05-16)
- `src/modules/auth/auth.service.js::setupTotp` — добавлен `issuer: 'NeoFit TV'` в `speakeasy.generateSecret`. Аутентификатор-апы теперь видят явный issuer вместо bare label, что улучшает группировку записей и совместимость с экзотическими TOTP-апами. (2026-05-16)
- `public/js/admin-settings.js` — поля `workScheduleFrom`/`workScheduleTo` теперь `disabled` при выключенном чекбоксе `workScheduleEnabled`. Состояние применяется при загрузке формы и обновляется на `change`. Визуально показывает, что значения вне «часов работы» не имеют эффекта. (2026-05-16)
- `public/admin/settings.html` — добавлены warning-hint'ы под полями `videoCrf` и `videoMaxWidth` («экспертные параметры, подобраны под слабые декодеры H616, менять только если знаете, что делаете»). Соответствует правилу из CLAUDE.md «не менять параметры ffmpeg без обоснования». (2026-05-16)

---

## [3.3.0] — 2026-05-16

### Fixed
- Удалены безусловные `console.log('[media] cancelQueue …')` в `src/modules/media/media.routes.js` — спамили серверные логи. (2026-05-14)
- Дебажные `console.log('[NP] playVideo / onExoVideoEnded / onExoVideoError')` в `public/js/player.js` обёрнуты в `if (DEBUG)` для соответствия стилю файла — больше не спамят logcat на Android-плеере. (2026-05-14)
- `src/modules/media/video.queue.js::resumeUnfinished` теперь валидирует `processing-queue.json` (массив, элементы с `mediaId`). При повреждённом файле очередь не падает молча, а пишет warning. (2026-05-14)
- `src/modules/media/media.service.js::cleanupStaleTmpFiles()` + вызов из `server.js` подметают orphan-`.tmp.mp4` в `uploads/` после краша Node. Раньше при `SIGTERM` ffmpeg-tmp файлы оставались на диске и копились. Sweep делается **до** `videoQueue.resumeUnfinished`, чтобы не было гонки с воркером (Linux unlink на открытом файле ломал бы финальный rename). (2026-05-14)
- `scripts/reset-password.js` переведён на `writeFileAtomic` — сбой между байтами больше не зальёт `auth.json` мусором и не потеряет TOTP-секрет. Минимальная длина пароля поднята с 6 до 8 символов (согласовано с API `auth.routes.js:89`). (2026-05-14)
- `src/modules/screens/screens.monitor.js` — добавлен таймаут `MAX_CHECK_DURATION_MS = 90s` с принудительным сбросом `isRunning`. Если одна проверка зависнет (например, на медленном Telegram-вызове, который сам имеет worst case ~64s), следующий interval больше не пропускается молча, а форсирует новую. Гонку с orphan-resolve защищает token-механизм: только текущая проверка имеет право снимать lock. (2026-05-14)
- **Offline-цепочка плеера.** При ребуте Android-приставки без сети (и с заполненным локальным кэшем медиа) WebView больше не залипает на «не удалось открыть ссылку», а нормально проигрывает контент из кэша. Три согласованные правки: (1) `server.js` — `/player/*.html` теперь отдаётся с `Cache-Control: public, max-age=3600` (админка/login остаются `no-store, no-cache`). (2) `public/player/sw.js` — `/api/player/:screenId` GET переключен с `networkOnly` на `network-first → cache fallback`, ключ кэша нормализован (отбрасывается `?t=` cache-buster, иначе кэш рос бы бесконечно). (3) `android-app/.../MainActivity.kt` — на первой ошибке main-frame в `WebViewClient.onReceivedError` WebView сначала повторяет загрузку с `LOAD_CACHE_ELSE_NETWORK`; errorOverlay показывается только если и этот fallback не нашёл ничего в кэше. После успешной загрузки cacheMode сбрасывается обратно в `LOAD_DEFAULT` для следующей навигации. (2026-05-14)
- **Bulk-операции в админке теперь стабильны.** «Плейлисты → Отправить на экраны» → выбор N экранов иногда возвращал «ошибка сервера», хотя плейлист реально применялся ко всем. Корневая причина — race в `src/utils/atomicWrite.js`: tmp-путь строился как `pid + Date.now()` (миллисекундное разрешение). При `Promise.all([updateScreen…])` несколько параллельных записей могли получить идентичный tmp-путь → один из `fs.rename` ловил ENOENT → HTTP 500. Добавлен process-local счётчик `tmpSeq++`, теперь tmp-пути гарантированно уникальны независимо от количества параллельных вызовов. Затрагивает все параллельные записи в `data/*.json` — не только этот сценарий. (2026-05-14)
- `public/js/admin-playlists.js::submitSendToScreens` переведён с `Promise.all` на `Promise.allSettled`. Одна транзиентная ошибка (network blip и т.п.) больше не маскирует N-1 успешных назначений — пользователь видит «Назначено на N из M экранов, K не удалось» или соответствующий конкретный результат. (2026-05-14)

### Added
- В модалке «Отправить плейлист на экраны» экраны, на которых **уже** стоит выбираемый плейлист, теперь предварительно отмечены галочкой. Submit бидирекциональный: галочка проставленная заново — назначить; снятая с предчекнутой — отвязать. Toast разделяет «назначено: N, снято: K» для прозрачности. Если пользователь нажал «Отправить» без изменений — модалка просто закрывается с info-тостом «Изменений нет». В data-атрибутах хранится исходный `playlistId` каждого экрана, поэтому submit шлёт минимальный diff на сервер вместо тупого N запросов. (2026-05-14)

- **Прозрачность онлайн-порога для админа.** Под полем «Порог онлайн» в настройках теперь живой расчёт **эффективного** значения: `max(введённый порог, интервал опроса × 2)`. Когда backend клампит вверх — выводится оранжевая подсказка «Эффективный порог: NNN сек (увеличен до 2× интервала опроса)». Это закрывает «иногда онлайн-статус неверный» — раньше админ мог поставить `pollInterval=60, threshold=15`, ожидать 15с детекта, а получать 120с молча. (2026-05-14)
- `src/modules/settings/settings.service.js::update` — cross-field валидация Telegram: при сохранении настроек если эффективное (merged с current) состояние `telegramEnabled === true`, **обязательно** должны быть заполнены `telegramBotToken` и `telegramChatId`. Иначе возвращается 400 с сообщением «Для включения Telegram-уведомлений заполните токен бота и Chat ID». Раньше можно было включить уведомления без кредов, сохранить (успешно), и потом тихо не получать уведомлений — теперь баг ловится в источнике. (2026-05-14)
- `public/js/admin-settings.js::collectMonitor` — fallback для `onlineThreshold` сменён с `|| 15` на `|| 30` (соответствует `DEFAULTS.onlineThreshold` в репозитории). При пустом инпуте клиент больше не отсылает значение, не совпадающее с серверным дефолтом. (2026-05-14)

### Removed
- **Удалена настройка `onlineThresholdMultiplier`** — функционал полностью дублировал `onlineThreshold + clamping (pollInterval × 2)`. Два поля в UI создавали путаницу: при заданном multiplier фиксированный порог молча игнорировался. Чистка: убрано из `settings.repository.js` defaults, `settings.service.js` validate+sanitize, `settings.routes.js` (computed `activeThresholdMode`), `screens.service.js::getThresholdSec`, `screens.monitor.js` inline-формула, `settings.html` форма, `admin-settings.js` (collect, applyToForm, listener, `updateThresholdModeHint`-функция). **Миграция**: в `settings.repository.js::get()` при первой загрузке data/settings.json, если поле есть и > 0, конвертирует в абсолютное значение `onlineThreshold = round(pollInterval × multiplier)` (с clamp 5–300) и удаляет ключ; асинхронно перезаписывает файл. Backwards-compatible. (2026-05-14)
- Удалена мёртвая настройка `cacheEnabled`. UI-чекбокс «Кэширование контента в браузере» был, значение передавалось плееру, но **нигде** не использовалось для управления поведением (SW-кэш работает независимо от этого флага). Чистка: убрана из `settings.repository.js` defaults, `settings.service.js` sanitization, `player.service.js` settings object, `settings.html` форма, `admin-settings.js` обработка, `player.js` default settings. Аналогичные `prefetchEnabled` и `showLastOnError` **оставлены** — они реально используются в плеере (агент аудита ошибочно отнёс их к dead). (2026-05-14)

- Удалена фича «Конфигурация плеера через USB-флешку» (читать `signage.txt` с подключённой флешки и применять URL/screenId). Чистка затронула:
  - `android-app/.../UsbReceiver.kt` — удалён файл целиком.
  - `AndroidManifest.xml` — удалён receiver `.UsbReceiver`, удалено разрешение `READ_EXTERNAL_STORAGE`.
  - `app/proguard-rules.pro` — удалено keep-правило для `UsbReceiver`.
  - `res/values/strings.xml` — удалены три строки `msg_usb_*`.
  - `public/js/docs-content.js` — удалён раздел «Конфигурация с флешки (USB)» и упоминание в описании APK.
  
  Привязка устройств остаётся через коды/QR (`BindingActivity`) и ручную настройку (`SettingsActivity`). Существующий `downloadPlayerFile` в админке (генерация HTML-шортката для не-Android устройств) **не затронут** — это другая фича. (2026-05-14)
- **Android security/hygiene фиксы:**
  - `MainActivity.kt:68` — `setWebContentsDebuggingEnabled(BuildConfig.DEBUG)` вместо `true`. В release-сборке WebView больше не доступен для удалённой инспекции через Chrome DevTools (никто с физическим/ADB-доступом не сможет вытащить screenId/PIN или менять JS на лету).
  - `MainActivity.kt:176` — `mixedContentMode = MIXED_CONTENT_COMPATIBILITY_MODE` вместо `ALWAYS_ALLOW`. Пассивные ресурсы (картинки/CSS) через HTTP всё ещё пропускаются, но активный mixed content (скрипты, XHR, iframes) блокируется — устранён вектор MITM.
  - `MainActivity.kt:184-188` — `getDefaultVideoPoster()` возвращает один общий 1×1 bitmap вместо создания нового на каждый вызов. WebView дёргает геттер часто, утечка пиксельных буферов по нескольку KB на каждый.
  - `AndroidManifest.xml:14` — `android:allowBackup="false"`. Раньше через `adb backup` можно было выгрузить SharedPreferences (URL сервера, PIN). На приставке с физическим доступом это реальный риск.
  - `VideoPlayerManager.kt:59` — `@Volatile private var released`. Поле читается из background-потока `preloadExecutor` и пишется из main thread в `release()` — без volatile background мог не увидеть write и продолжать работу с уже освобождёнными ресурсами.
  - `SettingsActivity.kt::checkConnection` — `HttpURLConnection.disconnect()` перенесён в `finally`, не утечёт сокет при исключении между `openConnection()` и нормальным `disconnect()`. Добавлены `isFinishing/isDestroyed` гарды перед `Toast.makeText` из background callback.
  - `SettingsActivity.kt::onDestroy` и `BindingActivity.kt::onDestroy` — `executor.shutdownNow()` вместо `shutdown()`. Interrupts in-flight HTTP-потоки вместо того, чтобы дать им завершиться и попытаться постить Toast на мёртвую Activity.
  - `BindingActivity.kt::fetchCode` и `startPolling` — те же два HTTP-блока переведены на `var conn = ...` + `finally { conn?.disconnect() }`. (2026-05-14)

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
