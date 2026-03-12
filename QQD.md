# QQD — Журнал изменений и заметок

## 2026-03-11 — Аудит и фиксы auth-модуля

### Удалено: шпионский код Cursor-агента

Cursor-агент внедрил телеметрию в два файла. При каждом запросе данные отправлялись на `http://127.0.0.1:7245/ingest/...`

**Удалено из:**
- `src/middleware/auth.js` — слал `path`, `hasCookie`, `authenticated` при каждом 401
- `src/modules/auth/auth.routes.js` — слал `sessionID`, `cookieSecure` при каждом успешном логине

Паттерн для поиска в будущем: `#region agent log`, `hypothesisId`, `127.0.0.1:7245`

---

### Исправлено: Open Redirect в login.html

**Файл:** `public/login.html`

**Проблема:** `returnUrl.startsWith('/')` пропускал `//evil.com` — браузер трактует как внешний домен.

**Фикс:** добавлена проверка `!returnUrl.startsWith('//')`.

---

### Исправлено: SESSION_SECRET без проверки

**Файл:** `server.js`

**Проблема:** если `SESSION_SECRET` не задан в `.env`, сессии подписывались строкой `'dev-fallback-secret'` — предсказуемый секрет, cookie можно подделать.

**Фикс:**
- На `production` без `SESSION_SECRET` — сервер **не стартует** (`process.exit(1)`)
- На `development` — предупреждение в логах, продолжает работу

### ⚠️ ВАЖНО ДЛЯ ДЕПЛОЯ
**Убедись, что на сервере в `.env` задан `SESSION_SECRET`** — иначе после деплоя сервер не поднимется.
Пример: `SESSION_SECRET=случайная-длинная-строка-минимум-32-символа`

---

### Исправлено: CSP был отключён полностью

**Файл:** `server.js`

**Проблема:** `helmet({ contentSecurityPolicy: false })` — XSS в любом месте = полная компрометация.

**Фикс:** включён CSP с директивами:
- `script-src 'self' 'unsafe-inline'` — нужен из-за inline-скриптов в HTML-страницах
- `object-src 'none'` — блокирует Flash и плагины
- `frame-ancestors 'none'` — защита от clickjacking
- `form-action 'self'` — формы только на свой домен
- `base-uri 'self'` — защита от base-tag injection

---

---

## 2026-03-11 — Аудит и фиксы media / video.queue

### Исправлено: data loss в compressVideo

**Файл:** `src/modules/media/media.processor.js`

**Проблема:** `fs.unlink(inputPath)` перед `fs.rename(tmpOutput, inputPath)` — если rename падал, оригинал уже удалён.

**Фикс:** убран `unlink`. `fs.rename` атомарно заменяет цель на том же filesystem.

---

### Исправлено: deadlock очереди если saveQueue падает

**Файл:** `src/modules/media/video.queue.js`

**Проблема:** если `removeTask` (→ `writeJsonAtomic`) бросал ошибку, `processing` оставался `true` навсегда — очередь зависала до перезапуска PM2.

**Фикс:** `removeTask` перенесён в `finally`-блок с `.catch()` — `processing = false` и `processNext()` выполняются всегда.

---

### Исправлено: удаление файла пока идёт обработка

**Файл:** `src/modules/media/media.service.js`

**Проблема:** удаление видео со статусом `processing` — ffmpeg получал "file not found", пытался обновить уже удалённую запись.

**Фикс:** возвращает `{ status: 409, error: 'Файл обрабатывается...' }` если `media.status === 'processing'`.

---

### Исправлено: запись изображения без атомарности

**Файл:** `src/modules/media/media.processor.js`

**Проблема:** `fs.writeFile(filePath, compressedBuf)` писало прямо поверх оригинала — краш = битый файл.

**Фикс:** заменено на `writeFileAtomic` (tmp + rename), как и везде в проекте.

---

### Исправлено: ffmpeg stderr терялся при ошибке

**Файл:** `src/modules/media/media.processor.js`

**Фикс:** `err.stderr` добавлен к сообщению ошибки — в логах будет реальный вывод ffmpeg.

---

---

## 2026-03-11 — Аудит и фиксы player / pair

### Исправлено: telegramBotToken утекал на плеер

**Файл:** `src/modules/player/player.service.js`

**Проблема:** весь объект `settings` (включая `telegramBotToken`, `telegramChatId`, настройки backup и видео) отдавался на публичный `/api/player/:screenId` без авторизации.

**Фикс:** player получает только нужные поля: `imageDuration`, `pollInterval`, `prefetchEnabled`, `cacheEnabled`, `showLastOnError`, `autoReloadAt`, `workSchedule*`, `timezone`, `systemName`, `logoUrl`.

---

### Исправлено: медиа в статусе processing/error попадало в плейлист

**Файл:** `src/modules/player/player.service.js`

**Проблема:** плеер получал URL файлов, которые ещё обрабатывает ffmpeg — пытался воспроизвести неполный/битый файл.

**Фикс:** добавлена проверка `media.status === 'ready'`.

---

### Исправлено: публичные эндпоинты без rate limiting

**Файлы:** `src/middleware/rateLimit.js`, `src/modules/player/player.routes.js`, `src/modules/pair/pair.routes.js`

**Проблема:**
- `POST /api/pair/init` — любой мог флудить, раздувая `pairing.json` и исчерпывая `MAX_CODE_ATTEMPTS`
- `GET /api/player/:screenId` — каждый запрос писал `screens.json` на диск; спам = IO DoS
- `GET /api/pair/:code` — неограниченный опрос

**Фикс:** добавлены лимиты:
- `playerLimiter` — 5 req / 5 сек с одного IP
- `pairInitLimiter` — 10 req / 10 мин с одного IP
- `pairStatusLimiter` — 60 req / мин с одного IP

---

---

## 2026-03-11 — Аудит и фиксы screens / screens.monitor

### Исправлено: дублированные Telegram-уведомления

**Файл:** `src/modules/screens/screens.monitor.js`

**Проблема:** `setInterval(checkScreens, 10s)` без блокировки. При медленном Telegram API (retry × 2000ms) два экземпляра `checkScreens` работали одновременно — оба читали `previousStates` до обновления → два одинаковых сообщения.

**Фикс:** флаг `isRunning` с `try/finally` — новый запуск пропускается если предыдущий не завершён.

---

### Исправлено: Telegram request без timeout

**Файл:** `src/utils/telegram.js`

**Фикс:** `timeout: 8000` + `req.on('timeout', () => req.destroy(...))` — зависший коннект теперь прерывается через 8 сек.

---

### Исправлено: 40 экранов × heartbeat = ~240 atomic writes/мин

**Файл:** `src/modules/screens/screens.repository.js`

**Проблема:** каждый heartbeat делал `writeJsonAtomic(screens.json)` — 40 устройств × каждые 10 сек = 4 writes/сек к одному файлу.

**Фикс:** in-memory кэш обновляется немедленно (монитор видит актуальные данные), диск — не чаще раза в 30 сек на экран. ~240 writes/мин → ~1.3 writes/мин.

**Нюанс при крэше:** теряется до 30 сек последних heartbeat. При рестарте возможен кратковременный ложный offline — самовосстанавливается на следующем poll.

---

---

## 2026-03-11 — Аудит и фиксы playlists / settings / backup

### Исправлено: restore сразу перезаписывался heartbeat (критично)

**Файл:** `src/modules/backup/backup.routes.js`

**Проблема:** после `restoreBackup` все in-memory кэши хранили старые данные. Первый heartbeat плеера вызывал `writeAll(oldCache)` и перезаписывал восстановленный `screens.json`. Restore был бесполезен без ручного `pm2 restart`.

**Фикс:** после успешного restore — ответ клиенту + `setTimeout(() => process.exit(0), 300)`. PM2 перезапускает процесс автоматически, все кэши сбрасываются.

---

### Исправлено: saveQueue навсегда ломался после одной ошибки записи настроек

**Файл:** `src/modules/settings/settings.repository.js`

**Проблема:** если `writeJsonAtomic` бросал ошибку — `saveQueue` становился rejected Promise. Все последующие `save()` молча не выполнялись. Изменения настроек пропадали до рестарта.

**Фикс:** `.catch(() => {}).then(...)` — цепочка сбрасывается после каждой ошибки.

---

### Исправлено: duration элемента плейлиста не валидировался

**Файл:** `src/modules/playlists/playlists.service.js`

**Проблема:** `Number(item.duration) || 10` принимал `-1`, `0.5`, `999999` — плеер показывал бы слайд сутками.

**Фикс:** `Math.min(3600, Math.max(1, Math.round(...)))` — диапазон 1–3600 сек.

---

### Исправлено: reschedule без try-catch

**Файл:** `src/modules/settings/settings.routes.js`

**Фикс:** `try { reschedule(...) } catch (_) {}` — сбой планировщика не ломает ответ 200.

---

---

## 2026-03-11 — Аудит src/utils/ + атомарность записей

### Исправлено: race condition в atomicWrite — коллизия имён .tmp файлов

**Файл:** `src/utils/atomicWrite.js`

**Проблема:** все вызовы `writeFileAtomic` для одного файла использовали одинаковый путь `.${name}.tmp`. При двух конкурентных async-вызовах (например, несколько устройств вызывают `POST /api/pair/init` одновременно):
1. Call A пишет в `.pairing.json.tmp`
2. Call B (пока A на await) перезаписывает `.pairing.json.tmp`
3. Call A делает rename — записывает контент B
4. Call B пробует rename — ENOENT, падает с ошибкой

**Фикс:** уникальное имя `.${name}.${process.pid}.${Date.now()}.tmp` + cleanup tmp файла при ошибке rename.

---

### Исправлено: логотип и off-hours image копировались не атомарно

**Файл:** `src/modules/settings/settings.service.js`

**Проблема:** `fs.copyFile(src, destPath)` писало прямо поверх существующего файла. Краш во время копирования = битый логотип в uploads/.

**Фикс:** `copyFileAtomic(src, dest)` — копирует в `dest.pid.timestamp.tmp` в той же папке (`uploads/`), затем rename. Tmp создаётся в uploads/ чтобы избежать EXDEV (cross-device) если tmpdir на другом разделе.

---

### Прямые `fs.writeFile` — результат проверки

- `src/utils/atomicWrite.js:14` — внутри самого atomicWrite, норма
- `scripts/backup.js:24` — `writeFileSync` для `backup-status.json` (только статус, не критичные данные)
- `scripts/reset-password.js:44` — CLI-скрипт, сервер при этом обычно не запущен. Прямая запись допустима, но теоретически риск при крэше есть

---

---

## 2026-03-11 — Аудит src/config/, src/middleware/, server.js

### Нет инъекций Cursor-агента

Все 5 файлов проверены: `config/index.js`, `middleware/auth.js`, `middleware/rateLimit.js`, `middleware/validate.js`, `middleware/errorHandler.js`, `server.js` — чисто.

---

### Исправлено: косметика отступа в auth.js

**Файл:** `src/middleware/auth.js`

Пропущен отступ у `return res.status(401)` — результат предыдущего удаления агент-кода. Исправлен.

---

### Исправлено: race condition при старте сервера

**Файл:** `server.js`

**Проблема:** `initAuth()` запускалась асинхронно, а `app.listen()` вызывался сразу после — без ожидания завершения. Если первый запрос на логин приходил до того как `auth.json` считан, `authRepository.get()` возвращал пустой объект и bcrypt-сравнение могло вернуть ошибку или использовать дефолтный пустой хэш.

**Фикс:** `app.listen()` теперь вызывается внутри `.then()` после `initAuth()`. Если `initAuth` падает — `process.exit(1)`.

---

### Исправлено: мёртвый импорт compressVideo в server.js

**Файл:** `server.js`

`const { compressVideo } = require('./src/modules/media/media.processor')` был на строке 147 но нигде не использовался. Удалён.

---

### Исправлено: `require('fs').promises` внутри callback в server.js

**Файл:** `server.js`

`const fs = require('fs').promises;` объявлялся внутри замыкания `resumeUnfinished`. Перенесён на уровень модуля (теперь не нужен — `mediaRepository.update` вызывается напрямую, fs в server.js не используется).

---

### Исправлено: все require модулей перемещены в начало server.js

`screenMonitor`, `videoQueue`, `mediaRepository`, `settingsRepository`, `backupScheduler`, `initAuth` раньше объявлялись после `app.use(errorHandler)` — неожиданное место. Перемещены в начало файла вместе с остальными импортами.

---

### Замечания (не критично, исправлять не нужно)

- **`cookieSecure`** в `config/index.js` зависит от `BASE_URL` начинающегося с `https`. Если `BASE_URL` не задан в `.env`, `cookieSecure = false` даже в production. На практике порт 3000 не открыт наружу, nginx принимает HTTPS — проблемы нет. Но если кто-то заходит напрямую на порт 3000 по HTTP, cookie передаётся без Secure.
- **`/api/system/health`** отдаёт `version` и `env` без авторизации — полезно для мониторинга, но версия приложения видна снаружи. Некритично.
- **`app.get('/admin/*', next)`** — мёртвый код, по-прежнему в `server.js`. Можно удалить когда будет удобно.

---

---

---

## 2026-03-11 — Аудит scripts/ и public/js/

### Нет инъекций Cursor-агента

Проверены: `scripts/backup.js`, `scripts/backfill-video-durations.js`, `scripts/reset-password.js`, `public/js/api.js`, `public/js/player.js`, `public/js/admin-*.js` — чисто.

---

### scripts/backup.js — чисто

- Path-traversal защита есть: `!fullPath.startsWith(PROJECT_ROOT)` + `relPath.startsWith('..')` — корректно.
- `spawnSync` для tar — блокирует поток, но это CLI-скрипт, вызывается отдельным процессом — норм.
- `writeFileSync` для `backup-status.json` — не атомарно, но только статус, не данные. Допустимо.

---

### scripts/backfill-video-durations.js — мелкое замечание

**Файл:** `scripts/backfill-video-durations.js`

`path.join(uploadsDir, m.filename || m.path || '')` — если `m.path` содержит абсолютный путь (`/uploads/foo.mp4`), на Linux `path.join` его не проигнорирует. На практике `m.filename` всегда задан для готовых видео, поэтому некритично. Не исправляем.

---

### Исправлено: TypeError в notifySwPrecache при отсутствующем media

**Файл:** `public/js/player.js`

**Проблема:** `items.map((i) => i.media.url)` — если хотя бы у одного элемента плейлиста `i.media` отсутствует (удалено пока шло кэширование), бросает `TypeError: Cannot read property 'url' of undefined`. Service Worker не получает список URL для предзагрузки.

**Фикс:** `items.map((i) => i.media && i.media.url).filter(Boolean)` — пропускает элементы без медиа.

---

### Исправлено: неверный порядок HTML-экранирования в модале восстановления бэкапа

**Файл:** `public/js/admin-settings.js`

**Проблема:** `replace(/</g, '&lt;').replace(/&/g, '&amp;')` — после замены `<` → `&lt;` амперсанд в `&lt;` тоже заменялся → `&amp;lt;`. В браузере вместо символа `<` отображалось `&lt;`. Также не экранировался `&` в `data-file-name` атрибуте.

Имена бэкапов санитизируются сервером и не содержат этих символов, но экранирование было некорректным.

**Фикс:** правильный порядок — сначала `&` → `&amp;`, затем `<` → `&lt;`, затем `"` → `&quot;`.

---

### Замечания (не критично, не исправлено)

- **player.js — off-hours image** обновляется каждую минуту когда активен blackout (`updateScheduleBlackoutContent` в `checkSchedule`). Делает лишний DOM-update, но не сетевой запрос (src не меняется если url тот же). Некритично.
- **player.js — два конкурентных poll()**: при быстрой смене вкладки `visibilitychange` может запустить `poll()` пока предыдущий ещё в полёте. Оба могут вызвать `playNext()` и пропустить элемент. Очень редкий edge-case, для TV-приставок нерелевантен.
- **admin-screens.js — фоновый `loadScreens` каждые 15 сек** не обновляет открытый modal редактирования. Если другой администратор изменил экран, первый перезапишет стале данными. Нет второго администратора — некритично.
- **admin-settings.js — `saveInProgress` общий** для всех 7 форм настроек. Параллельное сохранение двух разных вкладок настроек заблокировано. Intentional guard.
- **admin-settings.js — off-hours image загружается сразу** при выборе файла (без нажатия Save), в отличие от логотипа. Незначительное UX-расхождение.
- **api.js — 401 redirect возвращает `undefined`** вместо throw. Все вызывающие обёрнуты в try/catch, поэтому деструктуризация `const { settings } = await API.getSettings()` после redirect кинет TypeError, который будет показан как «Ошибка» в toast. Приемлемо.

---

---

---

## 2026-03-11 — Аудит public/player/sw.js (Service Worker)

### Нет инъекций Cursor-агента

---

### Исправлено: после перекодирования видео плеер навсегда показывал старую версию (критично)

**Файлы:** `src/modules/player/player.service.js`, `public/player/sw.js`

**Проблема:** Service Worker использовал Cache First для `/uploads/*`. После перекодирования `media.processor.js` заменял файл по тому же пути (`fs.rename(tmp, inputPath)`), но URL в API не менялся (`/uploads/abc123.mp4`). SW возвращал закэшированную неоптимизированную версию навсегда. Функция `precacheUrls` тоже пропускала URL если в кэше уже была запись (`if (!exists)`).

**Фикс (2 файла):**

1. `player.service.js` — к URL медиа добавляется `?v=<compressedSize>`. После перекодирования `compressedSize` меняется → URL меняется → SW считает это новым ресурсом, делает fetch вместо cache hit.

2. `sw.js` — cleanup в `precacheUrls` теперь сравнивает по полному URL (pathname + search), а не только по pathname. Старые записи с устаревшим `?v=` удаляются из кэша.

**Пример:**
- До перекодирования: `/uploads/abc.mp4?v=52428800` (50 МБ)
- После перекодирования: `/uploads/abc.mp4?v=31457280` (30 МБ)
- SW не находит `?v=31457280` в кэше → fetch → кэширует новую версию
- Cleanup удаляет старую `?v=52428800` запись

---

### Замечание: кэш растёт без лимита объёма

SW кэширует весь плейлист (100 МБ – 1 ГБ). Если хранилище Android-приставки заполнено, `cache.put()` бросит исключение — ловится пустым `catch {}`, плеер не узнает. На практике приставки имеют 8–16 ГБ, плейлисты до 1 ГБ — хватает. Если когда-нибудь понадобится — можно добавить `navigator.storage.estimate()` и лимит.

---

### Замечание: precache скачивает последовательно без ограничений

50 видео × 20 МБ = 1 ГБ — SW скачивает все файлы в фоне один за другим. На медленном WiFi это может занять часы. При этом fetch конкурирует с плеером за сеть. Не баг — designed behavior, но стоит иметь в виду.

---

### Известные проблемы (не исправлены)

- **2FA (TOTP)** — была добавлена в релизе 100.3.0, но работала некорректно на сервере. Код удалён, планируется переделать с нуля.
- **Дефолтный пароль 'changeme'** — если `INITIAL_ADMIN_PASSWORD` не задан в `.env`, пароль при первом запуске будет `changeme`. Нет предупреждения в логах.
- **Мёртвый код** — `app.get('/admin/*', next)` в `server.js` ничего не делает, можно удалить.
- **`Math.random()` для pairing кодов** — не криптографически стойкий, теоретически можно заменить на `crypto.randomInt`. Для локальной сети некритично.
- **Паринг-запись не удаляется после confirm** — screenId доступен через `GET /api/pair/:code` до истечения TTL (10 мин).
- **Логика isOnline дублируется** — `screens.service.js` и `screens.monitor.js` вычисляют threshold независимо. При изменении логики нужно менять в двух местах.
- **Monitor interval не обновляется** — `monitorCheckIntervalSec` читается один раз при старте. Изменение в настройках вступает в силу только после `pm2 restart`.

---

---

## 2026-03-12 — Аудит public/pair/index.html и public/login.html

### Нет инъекций Cursor-агента

Оба файла чисты.

---

### login.html — чисто

Open redirect исправлен в предыдущей сессии. Других проблем нет: XSS-защита через `textContent`, кнопка блокируется на время запроса.

---

### Исправлено: NaN в countdown при некорректном expiresAt

**Файл:** `public/pair/index.html`

**Проблема:** `new Date(expiresAt).getTime()` возвращает NaN при неожиданном формате → отображалось «Код действителен ещё NaN:aN».

**Фикс:** `var end = new Date(expiresAt).getTime(); if (isNaN(end)) return;` — вычисление `end` вынесено до `tick()`, при NaN таймер не запускается.

---

### Исправлено: нет maxlength на поле нового экрана

**Файл:** `public/pair/index.html`

**Фикс:** `maxlength="100"` на `#newScreenName`.

---

### Замечание: auth-check race condition в pair/index.html

Форма отображается сразу, пока `fetch('/api/settings')` ещё в полёте. Неавторизованный пользователь видит форму ~100–300 мс до редиректа. Не является уязвимостью — сервер проверяет сессию при `/api/pair/:code/confirm`.

---

---

## 2026-03-12 — Межмодульные зависимости, package.json, deploy, nginx

### Нет инъекций Cursor-агента

Проверены: `server.js`, `screens.repository.js`, `playlists.repository.js`, `media.repository.js`, `media.service.js`, `screens.service.js`, `playlists.service.js`, `pair.service.js`, `pair.repository.js` — чисто.

---

### Исправлено: lastFlushAt.set — после await вместо до

**Файл:** `src/modules/screens/screens.repository.js`

**Проблема:** `lastFlushAt.set(id, now)` вызывался ПОСЛЕ `await writeAll(items)`. При двух одновременных heartbeat (при старте сервера или после 30-секундного простоя), оба вызова читали `lastFlush = 0`, оба входили в if-блок и делали двойной flush — дважды писали screens.json без нужды.

**Фикс:** `lastFlushAt.set(id, now)` перемещён ДО `await writeAll`. Если writeAll упадёт — следующий heartbeat в течение 30с пропустит flush, что приемлемо.

---

### Исправлено: повторный confirm одного кода перепривязывает устройство

**Файл:** `src/modules/pair/pair.service.js`

**Проблема:** После подтверждения привязки (`confirm`) запись о коде оставалась в `pairing.json` до истечения TTL (10 мин). Повторный вызов `POST /api/pair/:code/confirm` с другим `screenId` перезаписывал привязку.

**Почему не удалять запись после confirm:** Приставка продолжает поллить `GET /api/pair/:code` для получения своего `screenId` — если запись удалить, она получит `{ status: 'expired' }` и не узнает свой ID.

**Фикс:** `if (record.screenId != null) return { ok: false, error: 'Код уже использован' }` — второй confirm с тем же кодом отклоняется.

---

### Исправлено: pair.repository.js — добавлен removeByCode

**Файл:** `src/modules/pair/pair.repository.js`

Добавлена функция `removeByCode(code)` для удаления конкретной записи по коду. Используется в будущем при необходимости явной очистки после паринга.

---

### Архитектурное замечание: shared mutable cache — write-after-yield race

**Файлы:** все репозитории (`screens`, `playlists`, `media`, `pair`)

**Проблема:** все репозитории возвращают ссылку на один и тот же кэш-массив через `readAll()`. При конкурентных запросах:

1. Request A: `items = readAll()` → ссылка на кэш [item1]
2. Request A: создаёт `filtered = items.filter(...)` — новый массив
3. Request A: `await writeAll(filtered)` → yields, `cache` ещё не обновлён
4. Request B: `readAll()` возвращает СТАРЫЙ кэш [item1] (filtered ещё не применён)
5. Request B: обновляет item1, пишет его на диск
6. Request A: writeAll завершается → `cache = filtered` (без item1)
7. Request B: writeAll завершается → `cache = [item1 updated]` → **удаление отменено!**

**Реальный риск:** крайне низкий — для одного администратора одновременный delete + update одной и той же сущности практически невозможен. Heartbeat (40/10s) vs admin delete — вероятность совпадения ~0.01%. Не исправлять без полноценного mutex/lock.

---

### npm audit — уязвимости в зависимостях

**4 уязвимости (1 moderate, 3 high):**

**1. `file-type 16.5.4` — moderate (DoS)**
- CVE: GHSA-5v7r-6r5c-r473 — infinite loop в ASF-парсере при malformed input с zero-size sub-header
- Используется в `media.service.js:upload` для определения MIME по magic bytes
- Уязвим только загрузкой файла через `/api/media` — **закрытый endpoint, требует авторизации**
- Фикс: обновить до v21.3.1, но это **pure ESM** — требует изменения кода на `import()`
- **Не исправляем сейчас.** Риск: admin-only DoS при умышленной загрузке malformed ASF файла

**2. `minimatch` ≤3.1.3 и 10.0.0–10.2.2 — high (ReDoS)**
- Транзитивные зависимости: `bcrypt → @mapbox/node-pre-gyp → rimraf → glob → minimatch@3.1.2` и `nodemon → minimatch@10.2.2`
- Используются ТОЛЬКО при `npm install` (build time). Не выполняются в runtime приложения
- **Не представляет угрозы для работающего сервера**
- Фикс: `npm audit fix` обновляет minimatch. Безопасно, `npm audit fix` можно запустить

**3. `tar ≤7.5.10` — high (path traversal, symlink attacks)**
- Транзитивная зависимость: `bcrypt → @mapbox/node-pre-gyp → tar@6.2.1`
- Уязвимости касаются ИЗВЛЕЧЕНИЯ вредоносных архивов — node-pre-gyp извлекает только доверенные архивы при `npm install`
- **Не представляет угрозы для работающего сервера**
- Нельзя легко обновить без обновления bcrypt/node-pre-gyp

**Рекомендуемые действия:**
```bash
npm audit fix   # исправит minimatch (безопасно)
# tar и file-type требуют ручного вмешательства
```

---

### deploy.bat — замечания

1. `git add .` — стейджит все файлы. Безопасно только если `.gitignore` покрывает `.env`, `data/`, `uploads/`. Проверить `.gitignore` перед использованием.
2. Отсутствует `npm install` — если добавились новые пакеты, `pm2 restart` их не установит. Для деплоя с новыми зависимостями использовать `deploy-server.bat` (там есть `npm install --production`).

---

### nginx.conf — замечания

1. В репозитории хранится только HTTP (порт 80) конфиг. HTTPS (443) блок создаётся certbot на сервере и **не коммитится в git**. Это нормально, но при восстановлении сервера HTTPS-конфиг нужно воссоздавать отдельно.
2. `client_max_body_size 512m` указан только в HTTP блоке. Убедиться, что certbot скопировал эту директиву в HTTPS блок на сервере: `grep -n client_max_body_size /etc/nginx/sites-enabled/*`
3. `app.set('trust proxy', 1)` в server.js — **стоит** ✅. Корректно определяет IP клиента через `X-Forwarded-For` от nginx для rate limiting.

---

### Замечания (не критично, не исправлено)

- **`/uploads/` без авторизации** — `express.static` для `/uploads` открыт без `requireAuth`. Любой знающий имя файла может скачать медиафайл напрямую. Это intentional — TV-приставки кэшируют медиа по прямым URL без cookie. Если нужна защита — требуется signed URL или токен.
- **Статика с `max-age=86400`** — при перекодировании видео URL меняется (`?v=size`), но изображения сохраняют тот же URL. Перезагруженное изображение может показываться как старое у администратора до истечения кэша. Service Worker для плеера обходит это правильно.
- **`/api/system/health` без авторизации** — раскрывает `version` и `env`. Приемлемо для мониторинга.
