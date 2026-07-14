# GO — старт новой сессии

> Этот файл — **самый свежий** срез состояния проекта. Перед началом работы прочитать **первым**, потом `CLAUDE.md` → `docs/AUDIT.md` → `CHANGELOG.md` секцию `[Unreleased]`. Обновляется в конце каждой сессии.

---

## Текущая версия

**`v3.6.0`** (релиз 2026-05-18). Git tag `v3.6.0` запушен. `package.json` + `package-lock.json` синхронизированы.

Главное содержимое релиза — оффлайн-загрузка плеера. См. `CHANGELOG.md` → `[3.6.0]`.

---

## Прошлая сессия — 2026-07-14

**Тема:** Soham — фикс обработки видео + диагностика перебоев доступа к панели.

**Что сделано:**
1. **Баг «Cannot find ffmpeg» на Soham.** Root cause: при деплое (one-off скрипт из scratchpad) выпал `apt install ffmpeg`. `fluent-ffmpeg` ищет системный бинарник в PATH — его не было (`which ffmpeg ffprobe` → NOT FOUND, в логах `Cannot find ffmpeg`/`Cannot find ffprobe`). Фикс: `apt install -y ffmpeg` → ffmpeg 6.1.1 (`/usr/bin/ffmpeg`+`ffprobe`), self-test libx264 OK, `pm2 restart signage`, health `{"ok":true,"version":"3.6.0"}`. Упавшие загрузки нужно **перезалить** (помечены failed, авто-ретрая нет). Зафиксировано в `docs/DEPLOYMENT.md` (шаг apt + строка в «Типовые проблемы»).
2. **Перебои доступа к панели («иногда нет соединения, с того же компа»).** Серверная сторона чистая: PM2 online (2 рестарта), RAM 1.4 ГБ free, OOM нет, load низкий; nginx только IPv4 (AAAA-записи нет → IPv6-гипотеза отпала), без limit-зон, cert до 2026-10-04; fail2ban банит только sshd, ufw off; 10/10 внешних HTTPS-проб успешны ~50 мс. Вывод: **не падение сервера**, перебои на сетевом пути (провайдер/DPI/локальная сеть). Пользователю выданы шаги самодиагностики на момент сбоя (ping/tracert к IP, проверка DNS, другой браузер/сеть). Не воспроизвелось со стороны сервера.

---

## Прошлая сессия — 2026-07-06

**Тема:** развернуть проект на третий сервер — **Soham (`tv.soham-fit.ru`, 62.113.105.146)**.

**Что сделано:**
1. Локальный `main` был на ~40 коммитов позади `origin/main` (устаревший чекаут). Синхронизировали `reset --hard origin/main` → `v3.6.0` (2200612), локальные redundant-коммиты сохранены в backup-ветку `backup/local-stale-2026-07-06` (никуда не пушились).
2. SSH: ключ `signage_prod` (`claude-signage`) добавлен пользователем на Soham через консоль хостера (пароль от VPS был невалиден). Далее — доступ по ключу.
3. Деплой одним скриптом `scratchpad/soham-deploy.sh`: apt base, Node 20.20.2, PM2, клон репо в `/opt/signage`, certbot standalone (cert `tv.soham-fit.ru` до 2026-10-04, deploy-hook на `/etc/ssl/tv.soham-fit.ru/`), nginx site (`sed` из `nginx.conf`), `.env` (сгенерён SESSION_SECRET + INITIAL_ADMIN_PASSWORD), `npm install`, PM2 start + startup + logrotate. Health `{"ok":true,"version":"3.6.0"}`, public HTTPS 302.
4. `data/settings.json` → `systemName: "Soham TV"` (штатным `settings.repository.save()`, atomic write), PM2 restart. Активирует брендинг + раздачу `app-soham-debug.apk` (маппинг `BRAND_TO_APK` в `server.js`).

**Мультитенантность:** один код на всех, per-club отличает только `settings.systemName` (задаётся после деплоя). APK все три собраны и лежат в корне репо.

---

## Статус деплоя на 2026-07-06

| Сервер | Серверный код | Брендинг | APK в репо | Примечание |
|--------|---------------|----------|-----------|------------|
| `tv.n-fit.ru` (NeoFit, **38 экранов prod**) | ✅ `v3.6.0` | NeoFit TV | ✅ | SSH `~/.ssh/signage_prod` |
| `tv.labgym.ru` (LabGym) | ✅ `v3.6.0` | Labgym TV | ✅ | offline-boot подтверждён |
| `tv.soham-fit.ru` (Soham, 62.113.105.146) | ✅ `v3.6.0` (PM2 online, задеплоен 2026-07-06) | ✅ Soham TV | ✅ | SSH `~/.ssh/signage_prod`. **ffmpeg доустановлен 2026-07-14** (при деплое пропустили). Экранов пока нет — приставки не подключены |

---

## Что pending

1. **Soham: подключить приставки.** Сервер готов. Дальше руками: установить `app-soham-debug.apk` на Android-приставки Soham (раздаётся с `https://tv.soham-fit.ru/app-debug.apk` под auth), в админке создать экраны/плейлисты, привязать устройства по pair-коду.
2. **Soham: сменить initial admin-пароль.** Сгенерённый при деплое пароль — временный bootstrap. Залогиниться в `https://tv.soham-fit.ru/admin`, настроить 2FA, при желании сменить пароль (`npm run reset-password` на сервере).
3. **APK upgrade на приставках NeoFit.** Серверный фикс на месте, но устройства всё ещё с APK от старых релизов (без boot-stage telemetry). Раскатить `/app-debug.apk` руками по графику клуба. Без этого `pm2 logs signage | grep boot-stage` на NeoFit будет пустой.
4. **Проверить boot-stage logs.** На labgym (`LabGym Test1`) — `ssh root@tv.labgym.ru "pm2 logs signage --lines 200 --nostream | grep boot-stage"`.
5. **ENOENT-ошибки atomicWrite на NeoFit — наблюдение.** До деплоя v3.6.0 были `ENOENT ... rename ... screens.json.tmp`. После рестарта — ни одной (починилось `tmpSeq++` в `atomicWrite.js`). Если увидим с **новыми** timestamps — баг вернулся.

---

## Что НЕ делали и почему

- Не подключали приставки Soham — это ручной шаг на стороне клуба (установка APK, pair-коды).
- Не пересобирали APK сами через Gradle — пользователь делал это локально, мы только копировали в корень репо и пушили (`b6e678e`).

---

## Ключевые точки внимания для следующей сессии

- Если пользователь скажет «оффлайн-боот всё ещё не работает на конкретном экране» → **первым делом** `pm2 logs signage | grep "screenName: ИМЯ"` на соответствующем сервере. Boot-history покажет, на какой стадии застряло. Таблица стадий — `CLAUDE.md::Оффлайн-загрузка плеера — каскад кешей`.
- Если симптом на массе экранов — проверить, что на сервере свежий код: `ssh ... "git log -1 --oneline"` должен быть `b2fbf4b` или новее (`chore(release): v3.6.0`).
- **Не путать с глобальным `~/.claude/CLAUDE.md`** — там Kutt-проект, к этому отношения не имеет.

---

## Обновление этого файла

В конце каждой сессии:
1. Обновить «Текущая версия» и «Статус деплоя».
2. Заменить «Прошлая сессия» на свежий разбор.
3. Обновить «Что pending».
4. При следующем релизе — заголовок «Текущая версия» сменится на новый, остальное пересобрать.
