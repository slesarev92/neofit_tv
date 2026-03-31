# Резюме проекта: Digital Signage System (NeoFit TV)

## Общая информация

**Проект:** Система цифровых вывесок (Digital Signage), продукт — NeoFit TV  
**Домен:** https://s9a.ru  
**Хостинг:** Timeweb Cloud (VPS, Ubuntu)  
**Сервер:** 2 x 3.3 ГГц CPU · 2 ГБ RAM · 40 ГБ NVMe · 1 Гбит/с канал  
**Текущая версия:** v2.0.0-NEO

---

## Что такое проект

Централизованная система управления контентом на удалённых экранах.

**Сценарий:** Администратор загружает видео/картинки → собирает плейлисты → назначает на экраны → Android приставки с браузером воспроизводят контент по кругу.

**Масштаб:** 4 здания, 38 экранов (4 + 10 + 12 + 12), до 40 в ближайшем будущем.  
**Устройства:** Android приставки с Chrome или нативное APK (WebView).  
**Контент:** Видео 1–6 минут + картинки/баннеры.  
**Каналы в зданиях:** 100 и 200 Мбит/с.

---

## Технологический стек

| Компонент | Технология |
|-----------|-------------|
| Backend | Node.js 20+ + Express.js |
| Безопасность HTTP | helmet |
| Хранилище данных | JSON файлы (через репозиторий-слой) |
| Хранилище файлов | Локальная файловая система |
| Загрузка файлов | multer |
| Оптимизация изображений | sharp |
| Оптимизация видео | ffmpeg (системный) + fluent-ffmpeg |
| Сессии | express-session (memory или file store) |
| Пароли | bcrypt |
| 2FA / TOTP | speakeasy + qrcode |
| Валидация | express-validator |
| Логирование | winston |
| Диск/система | check-disk-space (модуль system) |
| Типы файлов | file-type (при необходимости) |
| Процесс-менеджер | PM2 |
| Прокси | Nginx + Let's Encrypt (HTTPS) |
| Фронтенд | Нативный HTML + CSS + Vanilla JS |
| Конфиг | dotenv |

---

## Структура проекта

```
/project-root
├── .env                          # Переменные окружения (не в git)
├── .env.example                  # Шаблон
├── package.json
├── server.js                     # Точка входа
├── ecosystem.config.js           # Конфиг PM2
├── nginx.conf                    # Конфиг Nginx (копируется на сервер)
├── DEPLOY.md                     # Инструкция по деплою
├── PROJECT_SUMMARY.md            # Это резюме
│
├── src/
│   ├── config/
│   │   └── index.js              # Все env-переменные (единственное место чтения process.env)
│   │
│   ├── middleware/
│   │   ├── auth.js               # requireAuth
│   │   ├── rateLimit.js          # Rate limit (login, player, pair)
│   │   ├── validate.js           # Валидация express-validator
│   │   └── errorHandler.js       # Глобальный обработчик ошибок
│   │
│   ├── modules/
│   │   ├── auth/                 # Аутентификация
│   │   ├── media/                # Медиафайлы + оптимизация
│   │   │   ├── media.processor.js  # sharp + ffmpeg
│   │   │   └── video.queue.js      # Очередь обработки видео
│   │   ├── playlists/            # Плейлисты
│   │   ├── screens/              # Экраны + мониторинг (screens.monitor.js)
│   │   ├── player/               # Публичный API плеера
│   │   ├── pair/                 # Привязка устройств (веб: QR-код для админа)
│   │   ├── settings/             # Глобальные настройки
│   │   └── system/               # Системная статистика (память, диск, сеть)
│   │
│   └── utils/
│       ├── logger.js
│       ├── atomicWrite.js        # Атомарная запись JSON (защита от потери данных при краше)
│       └── telegram.js           # Отправка уведомлений в Telegram
│
├── data/                         # JSON хранилище
│   ├── auth.json
│   ├── media.json
│   ├── playlists.json
│   ├── screens.json
│   ├── settings.json
│   ├── pairing.json
│   ├── processing-queue.json
│   ├── backup-status.json        # Статус последнего бэкапа (для дашборда)
│   └── sessions/                 # Файловые сессии (если SESSION_USE_MEMORY≠1)
│
├── uploads/                      # Медиафайлы
│
├── public/                       # Статика фронтенда
│   ├── admin/
│   │   ├── index.html            # Дашборд
│   │   ├── media.html            # Медиафайлы
│   │   ├── playlists.html        # Плейлисты
│   │   ├── screens.html           # Экраны
│   │   ├── settings.html         # Настройки
│   │   └── docs.html             # Документация
│   ├── player/
│   │   ├── index.html             # Плеер
│   │   └── sw.js                 # Service Worker
│   ├── pair/
│   │   └── index.html            # Страница привязки устройства (QR для телефона админа)
│   ├── css/
│   │   ├── style.css
│   │   └── docs.css
│   ├── login.html
│   └── js/
│       ├── api.js                # Общие fetch-обёртки
│       ├── nav.js                # Навигация (рендерится JS)
│       ├── theme.js               # Тёмная тема
│       ├── admin-media.js
│       ├── admin-playlists.js
│       ├── admin-screens.js
│       ├── admin-settings.js
│       ├── admin-mobile.js
│       ├── docs-content.js
│       └── player.js
│
└── android-app/                  # Android APK проект
    └── app/src/main/kotlin/com/signage/player/
        ├── MainActivity.kt       # WebView плеер
        ├── SettingsActivity.kt   # Настройки: URL сервера, screenId, PIN; долгое нажатие для входа
        ├── BootReceiver.kt       # Автозапуск при включении
        ├── LaunchService.kt      # Сервис запуска
        └── UsbReceiver.kt        # Загрузка URL через флешку (.txt с URL плеера)
```

Примечание: отдельной PairingActivity в APK нет; привязка через веб-страницу `/pair` (админ сканирует QR с телефона) или ручной ввод URL/screenId в SettingsActivity, либо URL с флешки.

---

## Архитектурные правила (ОБЯЗАТЕЛЬНО соблюдать)

**Три слоя — строго:**
```
routes → services → repositories
```
- В routes: только валидация входных данных и вызов сервиса
- В services: вся бизнес-логика
- В repositories: только чтение/запись JSON файлов

**Лимит строк:** максимум 400 строк на файл, целевой объём 250–300.

**Новая фича = новый модуль** в `src/modules/`. Подключается одной строкой в `server.js`.

**Переменные окружения:** только через `src/config/index.js`. Нигде в коде не читать `process.env` напрямую.

**Безопасность:**
- Все `/api/*` требуют `requireAuth`, кроме:
  - `/api/auth/login` (rate limit)
  - `/api/auth/verify-totp` (требует `pendingAuth` в сессии, не полный auth)
  - `/api/player/*`
  - `/api/pair/*` (init и get status — публичные; confirm — с auth)
- Публичные исключения документировать явно в коде.

---

## Юзабилити и UX (обязательно для всех изменений)

**Цель:** любой новый функционал и правки интерфейса должны быть user-friendly и повышать удобство использования.

**Принципы:**

1. **Обратная связь**
   - Сохранение/удаление/загрузка — показывать тост или сообщение об успехе/ошибке.
   - Длительные операции — индикатор загрузки или прогресс (например, загрузка файла).
   - Кнопки с действием — при запросе отключать или показывать состояние «загрузка», чтобы не было двойного клика.

2. **Понятность**
   - У каждой настройки и кнопки — ясная подпись и при необходимости краткая подсказка (hint).
   - Формат ввода указывать в placeholder или под полем (например, «ЧЧ:ММ», «URL или base64»).
   - Ошибки валидации — рядом с полем или в заметном месте, формулировки понятные пользователю.

3. **Консистентность**
   - Одни и те же действия в разных разделах — одинаковые названия и поведение (например, «Сохранить», «Отмена»).
   - Стиль кнопок и форм не менять без причины: primary для основного действия, secondary для отмены/возврата.

4. **Доступность и удобство**
   - Важные элементы доступны с клавиатуры (фокус, Enter для отправки формы).
   - Критичные кнопки не должны быть слишком мелкими; область нажатия — достаточная для тача на мобильных.

5. **Предсказуемость**
   - Деструктивные действия (удаление, сброс) — подтверждение (confirm/модалка) с явной формулировкой.
   - При смене настроек, влияющих на все экраны/плееры, — коротко пояснять эффект в подсказке или тексте.

При добавлении новых экранов, форм и кнопок проверять: есть ли обратная связь, понятны ли подписи и подсказки, нет ли лишних шагов без причины.

---

## API эндпоинты

### Auth (auth обязателен кроме login и verify-totp)
```
POST /api/auth/login              — вход (публичный, rate limit); при 2FA возвращает step:'totp'
POST /api/auth/verify-totp        — подтверждение TOTP кода (публичный, требует pendingAuth в сессии)
POST /api/auth/logout             — выход
PUT  /api/auth/password           — смена пароля
GET  /api/auth/totp/status        — включена ли 2FA
POST /api/auth/totp/setup         — генерация secret + QR-кода для настройки
POST /api/auth/totp/enable        — включение 2FA (подтверждение кодом)
POST /api/auth/totp/disable       — отключение 2FA (требует текущий пароль)
```

### Media
```
GET    /api/media             — список файлов
POST   /api/media             — загрузка файла
DELETE /api/media/:id         — удаление (проверка использования)
GET    /api/media/:id/status  — статус оптимизации
GET    /uploads/*             — раздача файлов (express.static, публичный, Range support через Nginx)
```

### Playlists
```
GET    /api/playlists         — список
POST   /api/playlists         — создание
GET    /api/playlists/:id     — один плейлист
PUT    /api/playlists/:id     — обновление
DELETE /api/playlists/:id     — удаление (проверка назначения)
```

### Screens
```
GET    /api/screens           — список (с полем isOnline)
POST   /api/screens           — создание
GET    /api/screens/:id       — один экран
PUT    /api/screens/:id       — обновление
DELETE /api/screens/:id       — удаление
```

### Player (публичный, без auth)
```
GET  /api/player/:screenId          — плейлист для плеера + настройки + heartbeat (lastSeenAt)
POST /api/player/:screenId/metrics  — телеметрия воспроизведения (droppedFrames, canplayTimeMs и др.)
```

### Pair (привязка устройств)
```
POST /api/pair/init           — получить код (публичный)
GET  /api/pair/:code          — статус привязки (публичный)
POST /api/pair/:code/confirm  — подтвердить привязку (auth required)
GET  /pair/                   — страница привязки для телефона (статика)
```

### Settings
```
GET /api/settings             — текущие настройки
PUT /api/settings             — обновление настроек
```

### System (требует auth)
```
GET /api/system               — системная статистика (память, CPU, диск, сеть, uptime)
```

---

## Модели данных

### Settings (data/settings.json)

Базовые и расширенные поля (в коде могут быть дополнительные):

```json
{
  "imageDuration": 10,
  "pollInterval": 30,
  "onlineThreshold": 75,
  "requestTimeout": 10,
  "maxRetries": 3,
  "prefetchEnabled": true,
  "cacheEnabled": true,
  "showLastOnError": true,
  "autoReloadAt": "04:00",
  "workScheduleEnabled": false,
  "workScheduleFrom": null,
  "workScheduleTo": null,
  "workScheduleOffImageUrl": null,
  "systemName": "NeoFit TV",
  "timezone": "Europe/Moscow",
  "videoCrf": 23,
  "videoMaxWidth": null,
  "monitorCheckIntervalSec": 10,
  "maxFileSizeMb": 500,
  "cacheMaxSizeMb": 2048,
  "telegramEnabled": false,
  "telegramBotToken": null,
  "telegramChatId": null
}
```

### Screen (data/screens.json)
```json
{
  "id": "uuid-v4",
  "name": "Зал 1",
  "playlistId": "uuid | null",
  "lastSeenAt": "ISO8601 | null",
  "createdAt": "ISO8601",
  "playbackMetrics": {
    "droppedFrames": 0, "totalFrames": 5400, "dropPercent": 0,
    "blobTimeMs": 0, "canplayTimeMs": 150, "fromCache": false,
    "fileSizeKb": 0, "videoUrl": "/uploads/...", "ts": "ISO8601"
  }
}
```

**isOnline** вычисляется на лету: `(Date.now() - lastSeenAt) <= thresholdSec * 1000`, где  
`thresholdSec = settings.onlineThreshold || (settings.pollInterval || 10) + 5`.

### Media (data/media.json)
```json
{
  "id": "uuid-v4",
  "filename": "uuid_name.jpg",
  "originalName": "Баннер.jpg",
  "mimeType": "image/jpeg",
  "size": 204800,
  "originalSize": 204800,
  "compressedSize": 145000,
  "status": "ready | processing | error",
  "statusMessage": null,
  "path": "uploads/uuid_name.jpg",
  "createdAt": "ISO8601"
}
```

### Playlist (data/playlists.json)
```json
{
  "id": "uuid-v4",
  "name": "Основной",
  "items": [
    { "id": "uuid", "mediaId": "uuid", "duration": 10, "order": 0 }
  ],
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### Pairing (data/pairing.json)
```json
{
  "code": "A3X7K2",
  "screenId": null,
  "createdAt": "ISO8601",
  "expiresAt": "ISO8601"
}
```
Код: 6 символов, заглавные буквы + цифры, без O/0/I/1. TTL: 10 минут.

---

## Оптимизация медиа

### Изображения (синхронно через sharp)
- JPEG: `mozjpeg: true, quality: 85, progressive: true`
- PNG: `compressionLevel: 9, adaptiveFiltering: true`
- WebP: `quality: 85, effort: 6`
- GIF: пропускается

### Видео (асинхронно через ffmpeg, очередь concurrency: 1)
- Параметры задаются в коде (media.processor.js), CRF и maxWidth — из settings (videoCrf, videoMaxWidth).
- Текущие: `-c:v libx264 -crf 23 -preset medium -r 30 -maxrate 8M -bufsize 16M -an -movflags +faststart -profile:v high -level 4.0`
- `-an` — без звука. `-movflags +faststart` — метаданные в начале. `-r 30` — принудительно 30fps. `-profile:v high -level 4.0` — для 1080p аппаратного декодирования.

Результат: крупные файлы (300–400 МБ) могут сжиматься до 30–80 МБ в зависимости от исходника.

---

## Плеер — ключевые механизмы

### Watchdog таймер
Если элемент не переключился за `duration × 2` секунд — принудительное переключение. Защита от зависших видео и незагрузившихся картинок.

### Service Worker (sw.js)
- Медиафайлы (`/uploads/`): Cache First (Range-запросы пропускаются — Nginx обслуживает напрямую)
- API запросы (`/api/player/`): Network only (свежие данные)
- По сообщению PRECACHE: предкэширование медиа плейлиста и очистка устаревших записей кэша
- `sizeMap` (Map) — размеры файлов из Content-Length при cache.put(), `enforceLimit()` использует Map вместо resp.blob()
- **Онлайн:** `video.src = url` — Nginx стримит через Range, SW не участвует в воспроизведении
- **Офлайн:** `toBlobUrl()` — полный файл из кэша → blob URL → нативное воспроизведение

### Автоперезагрузка
Время задаётся в настройках (`autoReloadAt`, по умолчанию 04:00). Раз в сутки в это время — `location.reload()`. Service Worker восстанавливает контент из кэша. Цель: снижение утечек памяти Chrome на Android.

### Polling
Интервал из настроек (`pollInterval`, например 30 секунд) — `GET /api/player/:screenId`. Обновляет `lastSeenAt` (heartbeat для мониторинга).

---

## Android APK

**Тип:** WebView-обёртка над веб-плеером.  
**Язык:** Kotlin.  
**Минимальная версия:** Android 5.0 (API 21).

### Компоненты
- **MainActivity** — плеер (WebView), при отсутствии URL переходит в SettingsActivity.
- **SettingsActivity** — сервер URL, screenId, проверка соединения, смена PIN, сохранение и запуск.
- **BootReceiver** — автозапуск при включении.
- **LaunchService** — сервис запуска.
- **UsbReceiver** — обработка .txt с флешки (одна строка — URL плеера).

### Возможности APK
- Автозапуск при включении питания (BootReceiver)
- Киоск-режим: блокировка кнопки Back, приложение как лаунчер
- Wake Lock: экран не гаснет
- При ошибке сети: автоперезагрузка страницы каждые 10 секунд

### Привязка устройства
- **Веб:** страница `/pair` — админ открывает на телефоне по QR (код получается через `POST /api/pair/init` с устройства или вручную), выбирает/создаёт экран, нажимает «Привязать».
- **APK:** привязка через SettingsActivity (ручной ввод URL сервера и screenId) или через флешку: .txt с одной строкой — URL плеера (например `https://s9a.ru/player/?id=...`).

### Настройки APK
Долгое нажатие 5 сек → ввод PIN (по умолчанию 1234) → SettingsActivity. Смена URL/screenId, сброс привязки (новый ввод), смена PIN.

### Загрузка URL через флешку
APK обрабатывает .txt: одна строка — URL плеера. Открыть файл через файловый менеджер → выбрать приложение → URL применяется.

---

## Развёртывание на сервере

### Стек на сервере
```
Браузер/APK → Nginx (443 HTTPS) → Node.js (порт 3000)
```

### Управление процессом
```bash
pm2 start ecosystem.config.js
pm2 restart signage
pm2 logs signage
pm2 status
```

### Nginx
`client_max_body_size 512m` — для загрузки больших видео.  
`proxy_read_timeout 300s` — для длинных загрузок.

### SSL
Let's Encrypt через certbot, автообновление каждые 90 дней.

---

## История версий и ключевые решения

| Версия | Что сделано |
|--------|-------------|
| v1.0 | Базовый проект: auth, media, playlists, screens, player, settings |
| v1.1 | Оптимизация медиа (sharp + ffmpeg), статус processing/ready/error |
| v1.2 | Service Worker, watchdog, автоперезагрузка (время из настроек) |
| v1.3 | Pair (QR привязка), тёмная тема, валидация |
| v1.4 | Статические HTML + nav.js (без EJS), переименование модулей |
| v1.5 | Аудит и очистка: правки документации, уточнение комментариев |
| v1.6 | Настройки бэкапов (backupKeepCount), статус бэкапа на дашборде, кнопка «Сделать бэкап», модуль backup API |
| v1.7 | Автобэкап из панели (node-cron). Расписание работы экранов: часы работы, заставка вне часов, список часовых поясов |
| v2.0–2.3 | Брендинг (systemName + логотип), кэш-бастер, темная тема, бэкап с именем/восстановлением, дублирование элементов плейлиста |
| **v1.3-NEO** | Android-исправления (USB thread, LaunchService, WebView). Admin UX: превью медиа, навигация плейлисты/экраны, фильтр по типу |
| **v1.4-NEO** | **2FA (Google Authenticator)**: speakeasy + qrcode, TOTP setup/enable/disable/verify. Удаление Cursor agent injection из auth.js и auth.routes.js |
| **v1.5-NEO** | UX-улучшения: undo-toast удаление (медиа/плейлисты/экраны), bulk-delete медиа, поиск в modal выбора медиа, Ctrl+S для форм, кастомный confirm для restore. Визуальный редизайн: Inter, градиентные иконки, segmented tabs. Мобильная оптимизация. npm: minimatch ReDoS пофикшен |
| **v1.8-NEO** | Офлайн-кэширование: SW кэширует все медиа в Cache API, configurable лимит (`cacheMaxSizeMb`) |
| **v2.0-NEO** | ffmpeg: High Level 4.0 + `-r 30 -maxrate 8M -preset medium`. Blob URL вместо blob.slice(). Телеметрия воспроизведения (droppedFrames, canplayTimeMs). Онлайн: прямой URL (Nginx streaming), офлайн: blob URL fallback. SW: sizeMap для enforceLimit без resp.blob() |

### Почему JSON, а не БД
Сознательное решение для простоты. Репозиторий-слой изолирует хранилище — замена на SQLite/PostgreSQL не требует правок в сервисах. При одновременной записи из нескольких запросов возможна потеря данных; при 40 экранах обычно не критично, при росте — целесообразен переход на SQLite.

---

## Текущий прогресс улучшений (NeoFit TV)

Реализация — **строго по одному пункту**. После каждого — проверка, затем команда «следующий».

**Общее правило:** все изменения — user-friendly: тосты, подсказки, подтверждение деструктивных действий (см. раздел «Юзабилити и UX»).

| # | Пункт | Статус | Примечание |
|---|--------|--------|------------|
| 1 | **Брендинг под клиента** | ✅ Сделано | `systemName` + загрузка логотипа файлом (Настройки). Лого в сайдбаре и `document.title` на всех страницах. Cache-buster для лого в `nav.js` и при сохранении формы. |
| 2 | **Сброс пароля (CLI)** | ✅ Сделано | `npm run reset-password НовыйПароль`, описание в DEPLOY.md. |
| 3 | **Резервное копирование** | ✅ Сделано | Бэкап: `npm run backup`, кнопка «Сделать бэкап», настройки в панели (хранить N архивов, автобэкап: ежедневно/еженедельно/в выбранные дни месяца + время), статус на дашборде, DEPLOY.md. |
| 4 | **Расписание работы экранов** | ✅ Сделано | Чекбокс «Включить расписание», поля «Начало/Конец работы» (type=time), таймзона; плеер — чёрный оверлей вне окна (поддержка перехода через полночь), проверка при poll и раз в минуту. |
| 5 | **Уведомления в Telegram** | ✅ Сделано | `telegram.js`, screens.monitor.js, тестовое сообщение в настройках |
| 6 | **Часы на экране плеера** | — | `showClock`, `clockPosition` в settings; overlay в плеере. |
| 7 | **Быстрая замена файла** | — | POST `/api/media/:id/replace`, кнопка «Заменить» в админке медиа. |
| 8 | **Журнал действий** | — | Модуль `activity`, запись событий в `data/activity.json`. |

**Для продолжения в новом чате:** вставь этот файл (PROJECT_SUMMARY.md), преамбул из раздела «Как работать с проектом в Cursor» и напиши, например: «Сделай пункт 5 — уведомления в Telegram по PROJECT_SUMMARY.md».

---

## Известные проблемы и технический долг

| Проблема | Приоритет | Решение |
|----------|-----------|---------|
| JSON без защиты от одновременной записи | Средний | Переход на SQLite |
| Нет массового назначения плейлиста | Низкий | Групповые операции в UI |
| Нет GET /api/media/usage-summary | Низкий | При необходимости — добавить эндпоинт |
| Нет POST /api/playlists/:id/duplicate | Низкий | При необходимости — добавить дублирование плейлиста |
| Cursor agent injection в admin-playlists.js | Низкий (код не работает в prod) | Удалить 3 блока `fetch('http://127.0.0.1:7245/ingest/...')` |
| file-type DoS уязвимость (moderate) | Низкий (только auth users) | npm audit fix --force с тестами |
| tar/bcrypt уязвимость (high) | Низкий (только при npm install) | bcrypt@6 breaking change, отложено |

---

## Переменные окружения (.env)

См. `.env.example`:

```env
PORT=3000
NODE_ENV=production
BASE_URL=https://s9a.ru

UPLOADS_DIR=./uploads
DATA_DIR=./data

SESSION_SECRET=replace-with-random-string-32-chars
SESSION_MAX_AGE_MS=86400000

MAX_FILE_SIZE_MB=500
INITIAL_ADMIN_PASSWORD=changeme
```

Все переменные читаются только в `src/config/index.js`.

---

## Как работать с проектом в Cursor

### Перед любой задачей вставляй этот преамбул

```
Прочитай PROJECT_SUMMARY.md и изучи указанные файлы
перед тем как писать код.

Ключевые правила:
1. Архитектура: routes → services → repositories (строго)
2. Максимум 400 строк на файл
3. Новая фича = новый модуль в src/modules/
4. Конфиг только через src/config/index.js
5. Все /api/* требуют requireAuth кроме явно публичных
6. Не переписывать работающий код — только добавлять
7. Юзабилити: обратная связь (тосты, загрузка), понятные подписи и подсказки, консистентность, подтверждение деструктивных действий (см. раздел «Юзабилити и UX»)

Перед началом:
- Прочитай файлы, которые будешь менять
- Перечисли все зависимости этих файлов
- Опиши план изменений
- Жди подтверждения
- Только потом пиши код
```

### Структура хорошего промта

```
## Задача: [название]

### Контекст
[что уже есть, что работает]

### Что нужно сделать
[конкретно и по шагам]

### Что не трогать
[список модулей/файлов]

### Проверка
[как убедиться, что работает]
```

### Красные флаги — когда останавливать Cursor

- Предлагает новую зависимость, которую не просили
- Хочет переписать существующий модуль вместо добавления нового
- Создаёт файл больше 400 строк
- Меняет структуру JSON в data/ без согласования
- Добавляет шаблонизатор, ORM или другие крупные библиотеки без необходимости

### Полезные команды после изменений

```bash
# Проверить лимит строк
find src public -name "*.js" -o -name "*.html" | xargs wc -l | sort -rn | head -20

# Запуск сервера
npm start

# Проверка API
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"yourpassword"}'

# На сервере
pm2 status
pm2 logs signage --lines 50
```

---

## Ключевые изменения по версиям

### v2.0-NEO (текущая)
**Воспроизведение — архитектурное исправление:**
- Онлайн: `video.src = url` — Nginx стримит через Range, без RAM-аллокаций на устройстве
- Офлайн: `toBlobUrl()` из SW Cache — blob URL как fallback
- Телеметрия: `getVideoPlaybackQuality()` → POST `/api/player/:screenId/metrics` → отображение в админке

**SW (sw.js):**
- `sizeMap` (Map) для `enforceLimit()` — размеры из Content-Length, без `resp.blob()` аллокаций
- Range-запросы от `<video>` пропускаются (Nginx обслуживает), non-Range → cacheFirst (заполняет кеш для офлайна)

**ffmpeg:**
- `-profile:v high -level 4.0` (было baseline 3.1 — не поддерживает 1080p)
- `-r 30 -maxrate 8M -bufsize 16M -preset medium`

**Android:** `WebView.setWebContentsDebuggingEnabled(true)` для remote debug

### v1.8-NEO
- SW кэширует ВСЕ медиа в Cache API для офлайн-воспроизведения
- Настройка `cacheMaxSizeMb` (по умолчанию 2048 МБ) в админке
- `navigator.storage.persist()` для защиты кеша от eviction

### v1.7.1-NEO
**player.js:** `getPlaylistSignature()` без URL, `isTransitioning` guard, `itemErrorCount`, one-shot canplay, preload fallback timer 3 сек

**Админ-панель:** XSS-защита (`escapeAttr`), валидация размера файла, авто-обновление экранов

**Telegram:** exponential backoff, валидация token/chatId. **Backup:** async spawn, lock-файл. **Android:** `onTrimMemory`, `setRendererPriorityPolicy`, блокировка Back

---

## Контекст для новых чатов

При продолжении работы в новом чате вставь:

1. Этот файл (PROJECT_SUMMARY.md) или его актуальную версию
2. Текущую задачу
3. Преамбул из раздела «Как работать с проектом в Cursor»

Этого достаточно, чтобы ИИ работал в правильном контексте.
