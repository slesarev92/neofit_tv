# Аудит и очистка проекта NeoFit TV — отчёт

**Режим:** только анализ. Ничего не удалено и не изменено.  
**Дата:** 2026-02-23

---

## Шаг 1 — Карта проекта (что есть)

### Корень
- `.env`, `.env.example`, `.gitignore`
- `package.json`, `package-lock.json`
- `server.js`, `ecosystem.config.js`, `nginx.conf`
- `DEPLOY.md`, `PROJECT_SUMMARY.md`, `AUDIT_CLEANUP_REPORT.md` (этот файл)
- `FRONTEND_AUDIT_REPORT.md`, `ROLLBACK.md`
- `deploy.bat`
- `android-app.tar.gz` (архив в корне)

### src/
- `config/index.js`
- `middleware/`: auth.js, errorHandler.js, rateLimit.js, validate.js
- `modules/`: auth, media (processor, queue, routes, repository, service), pair, player, playlists, screens (monitor, repository, routes, service), settings, system
- `utils/`: fileUtils.js, logger.js

### data/
- auth.json, media.json, pairing.json, playlists.json, processing-queue.json, screens.json, settings.json

### public/
- login.html
- favicon.png, logo.png
- admin/: index.html, media.html, playlists.html, screens.html, settings.html, docs.html
- player/: index.html, sw.js
- pair/index.html
- css/: style.css, docs.css
- js/: api.js, nav.js, theme.js, admin-media.js, admin-playlists.js, admin-screens.js, admin-settings.js, admin-mobile.js, docs-content.js, player.js

### android-app/
- Kotlin: MainActivity, SettingsActivity, BootReceiver, LaunchService, UsbReceiver (нет PairingActivity)
- README_APK.md, макеты, ресурсы

### uploads/
- Медиафайлы (по заданию не трогать)

---

## Раздел А — Файлы и папки для полного удаления

| Путь | Причина | Риск |
|------|---------|------|
| *(нет)* | Папки `views/` и файлы `.ejs` отсутствуют — остатков EJS не найдено | — |

**Опционально (на усмотрение):**
- `android-app.tar.gz` — архив в корне; может быть артефактом сборки/раздачи APK. Удалять, если не используется для деплоя.
- `FRONTEND_AUDIT_REPORT.md` — старый отчёт аудита фронтенда; оставить как справочник или удалить.

---

## Раздел Б — Код для удаления внутри файлов

| Файл | Строка | Что | Причина |
|------|--------|-----|---------|
| *(нет)* | — | В server.js нет `view engine`, `res.render` | EJS полностью убран |

**Примечания:**
- **public/js/player.js** — все `console.log`/`console.warn`/`console.error` обёрнуты в `if (DEBUG)`. Это отладочный вывод, не мусор; удалять только при желании отказаться от отладки.
- Глубокий анализ неиспользуемых функций и `require()` не проводился; при необходимости — отдельная задача.

---

## Раздел В — Зависимости

| Пакет | Статус | Действие |
|-------|--------|----------|
| ejs | В package.json **нет** | Ничего не делать |
| Остальные зависимости | bcrypt, check-disk-space, dotenv, express, express-rate-limit, express-session, express-validator, file-type, fluent-ffmpeg, helmet, multer, sharp, uuid, winston — используются в коде | — |

**Исправление версии (не зависимость):**
- В `package.json` поле `"version": "9999.0.0"` — заменить на `"1.4.0"` (или на актуальную версию v1.4+).

---

## Раздел Г — Документация, требующая обновления

| Файл | Проблема | Что исправить |
|------|----------|----------------|
| DEPLOY.md | — | Упоминаний EJS и views/ нет, актуален |
| PROJECT_SUMMARY.md | — | Уже приведён в соответствие со структурой |
| ROLLBACK.md | Упоминаются теги v3.0, v4.0, v11, v12, v13, v20, v21, v999, v9999.0 | Привести список тегов к реальным в репозитории или пометить, что это примеры |
| README.md | В корне отсутствует | При желании добавить краткий README (название, запуск, ссылка на DEPLOY.md и PROJECT_SUMMARY.md) |
| .gitignore | — | Содержит node_modules/, .env, uploads/*, data/*, *.log и исключения для .gitkeep — достаточно |

---

## Раздел Д — Прочие находки

| Файл/тема | Проблема | Действие |
|-----------|----------|----------|
| package.json | `"version": "9999.0.0"` | Заменить на `1.4.0` (или текущую версию) |
| server.js, строки 99–102 | Комментарий «SPA fallback — redirect to login», обработчик только вызывает `next()` | Либо реализовать редирект на login для неавторизованных при запросе /admin/*, либо поправить комментарий/удалить лишний обработчик |
| data/screens.json | Один экран с именем `"000"` | Тестовые данные; по заданию данные не удалять — только к сведению |
| data/playlists.json | Плейлист с именем `"TEST"` | Аналогично |
| data/processing-queue.json | `[]` | Корректно |
| data/pairing.json | `[]` | Корректно |

---

## Раздел Е — Остатки старых имён модулей

- Упоминаний **config-settings** (модуль/путь) в коде и в DEPLOY.md **нет**.
- Упоминаний **pairing** как модуля (пути `pairing/`, `modules/pairing`) **нет**.
- В PROJECT_SUMMARY.md и в data/ упоминается **pairing.json** — это имя файла данных, по заданию оставляем, менять не нужно.

---

## Раздел Ж — APK (android-app/)

- Упоминаний **PairingActivity** в коде **нет**.
- README_APK.md описывает SettingsActivity, USB, BootReceiver, LaunchService — соответствует коду.
- Закомментированных старых классов не найдено.

---

## Итоговая сводка

| Категория | Количество |
|-----------|------------|
| Файлов/папок к удалению (обязательно) | 0 |
| Файлов/папок к удалению (опционально) | 1–2 (android-app.tar.gz, FRONTEND_AUDIT_REPORT.md) |
| Строк мёртвого кода к удалению | 0 |
| Зависимостей к удалению | 0 |
| Файлов документации к обновлению | 1–2 (ROLLBACK.md, при желании README) |
| Прочих правок | 2 (version в package.json; комментарий/обработчик SPA в server.js) |

---

## Вывод

Проект после переименования модулей и удаления EJS приведён в порядок: остатков EJS и старых путей (config-settings, pairing как модуль) не обнаружено. Мусорных файлов типа .bak, .old, test.js и т.п. нет. Основные действия по «очистке»:

1. Заменить в **package.json** версию `9999.0.0` на `1.4.0`.
2. По желанию обновить **ROLLBACK.md** и добавить **README.md**.
3. По желанию удалить **android-app.tar.gz** и/или **FRONTEND_AUDIT_REPORT.md**.
4. По желанию уточнить или упростить обработчик **/admin/*** и комментарий в **server.js**.

Отчёт готов. Жду команды, что удалять и что править (в т.ч. по опциональным пунктам).
