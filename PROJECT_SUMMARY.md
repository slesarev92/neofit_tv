# Резюме проекта: Digital Signage System (NeoFit TV)

## Общая информация

**Проект:** Система цифровых вывесок (Digital Signage), продукт — NeoFit TV  
**Домен:** https://s9a.ru  
**Хостинг:** Timeweb Cloud (VPS, Ubuntu)  
**Сервер:** 2 x 3.3 ГГц CPU · 2 ГБ RAM · 40 ГБ NVMe · 1 Гбит/с канал  
**Текущая версия:** v1.6 (package.json: 1.6.0)

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
| Сессии | express-session |
| Пароли | bcrypt |
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
│   │   ├── rateLimit.js          # Rate limit на логин
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
│       └── fileUtils.js
│
├── data/                         # JSON хранилище
│   ├── auth.json
│   ├── media.json
│   ├── playlists.json
│   ├── screens.json
│   ├── settings.json
│   ├── pairing.json
│   └── processing-queue.json
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

### Auth (auth обязателен кроме login)
```
POST /api/auth/login          — вход (публичный, rate limit)
POST /api/auth/logout         — выход
PUT  /api/auth/password       — смена пароля
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
GET /api/player/:screenId     — плейлист для плеера + настройки + heartbeat (lastSeenAt)
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
  "workScheduleFrom": null,
  "workScheduleTo": null,
  "systemName": "NeoFit TV",
  "timezone": "Europe/Moscow",
  "videoCrf": 23,
  "videoMaxWidth": null,
  "monitorCheckIntervalSec": 10,
  "maxFileSizeMb": 500,
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
  "createdAt": "ISO8601"
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
- Пример: `-c:v libx264 -crf 23 -preset veryfast -an -movflags +faststart`
- `-an` — без звука. `-movflags +faststart` — метаданные в начале.

Результат: крупные файлы (300–400 МБ) могут сжиматься до 30–80 МБ в зависимости от исходника.

---

## Плеер — ключевые механизмы

### Watchdog таймер
Если элемент не переключился за `duration × 2` секунд — принудительное переключение. Защита от зависших видео и незагрузившихся картинок.

### Service Worker (sw.js)
- Медиафайлы (`/uploads/`): Cache First
- API запросы (`/api/player/`): Network only (свежие данные)
- По сообщению PRECACHE: предкэширование медиа плейлиста и очистка устаревших записей кэша

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
| v1.5 | Аудит и очистка: версия 1.5.0, правки документации (ROLLBACK.md), уточнение комментариев |
| v1.6 | Настройки бэкапов (backupKeepCount), статус бэкапа на дашборде, кнопка «Сделать бэкап», модуль backup API |

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
| 3 | **Резервное копирование** | ✅ Сделано | `npm run backup`, `scripts/setup-cron.sh`, раздел в DEPLOY.md, `backups/` в .gitignore. |
| 4 | **Расписание работы экранов** | ⏳ Следующий | Поля `workScheduleFrom`/`workScheduleTo` в settings; плеер — чёрный экран вне расписания; админка — два поля времени. |
| 5 | **Уведомления в Telegram** | — | Офлайн/онлайн экранов; `telegram.js`, тестовое сообщение в настройках. |
| 6 | **Часы на экране плеера** | — | `showClock`, `clockPosition` в settings; overlay в плеере. |
| 7 | **Быстрая замена файла** | — | POST `/api/media/:id/replace`, кнопка «Заменить» в админке медиа. |
| 8 | **Журнал действий** | — | Модуль `activity`, запись событий в `data/activity.json`. |

**Для продолжения в новом чате:** вставь этот файл (PROJECT_SUMMARY.md), преамбул из раздела «Как работать с проектом в Cursor» и напиши, например: «Сделай пункт 4 — расписание работы экранов по PROJECT_SUMMARY.md».

---

## Известные проблемы и технический долг

| Проблема | Приоритет | Решение |
|----------|-----------|---------|
| JSON без защиты от одновременной записи | Средний | Переход на SQLite |
| Нет уведомлений об офлайн-экранах | Средний | Telegram-бот (поля в settings уже есть) |
| Нет массового назначения плейлиста | Низкий | Групповые операции в UI |
| Нет GET /api/media/usage-summary | Низкий | При необходимости — добавить эндпоинт |
| Нет POST /api/playlists/:id/duplicate | Низкий | При необходимости — добавить дублирование плейлиста |

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

## Контекст для новых чатов

При продолжении работы в новом чате вставь:

1. Этот файл (PROJECT_SUMMARY.md) или его актуальную версию
2. Текущую задачу
3. Преамбул из раздела «Как работать с проектом в Cursor»

Этого достаточно, чтобы ИИ работал в правильном контексте.
