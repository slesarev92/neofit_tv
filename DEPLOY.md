# Развёртывание на сервере

## Шаг 1 — Настроить DNS (делаю я вручную)

В панели управления доменом s9a.ru добавить A-записи:

| Тип | Имя  | Значение        | TTL  |
|-----|------|------------------|------|
| A   | @    | **5.129.223.35** | 3600 |
| A   | www  | **5.129.223.35** | 3600 |

Удалить лишние A-записи для s9a.ru (оставить только 5.129.223.35).

Проверить, что DNS обновился:

```bash
ping s9a.ru
# Должен вернуть IP сервера (5.129.223.35)
```

---

## Шаг 2 — Подключиться к серверу

```bash
ssh root@5.129.223.35
```

---

## Шаг 3 — Установить Nginx

```bash
sudo apt update
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## Шаг 4 — Скопировать конфиг Nginx

```bash
sudo cp /opt/digital-signage/nginx.conf /etc/nginx/sites-available/signage
sudo ln -s /etc/nginx/sites-available/signage /etc/nginx/sites-enabled/signage

# Удалить дефолтный конфиг чтобы не конфликтовал
sudo rm -f /etc/nginx/sites-enabled/default

# Проверить конфиг на ошибки
sudo nginx -t

# Применить
sudo systemctl reload nginx
```

---

## Шаг 5 — Получить SSL-сертификат (бесплатно)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d s9a.ru -d www.s9a.ru
```

Certbot спросит:
- Email для уведомлений об истечении сертификата → ввести свой
- Согласие с условиями → Y
- Делиться ли email с EFF → N (по желанию)

После этого HTTPS настроен автоматически. Сертификат обновляется сам каждые 90 дней.

---

## Шаг 6 — Установить PM2 и запустить проект

```bash
npm install -g pm2

cd /opt/digital-signage

# Установить зависимости если ещё не установлены
npm install --production

# Запустить через PM2
pm2 start ecosystem.config.js

# Сохранить список процессов
pm2 save

# Настроить автозапуск при старте сервера
pm2 startup
# ⚠️ PM2 выдаст команду — скопировать и выполнить её
```

Перед первым запуском создать `.env` из примера и заполнить (PORT=3000, NODE_ENV=production, BASE_URL=https://s9a.ru, SESSION_SECRET=...):

```bash
cp .env.example .env
nano .env
```

---

## Шаг 7 — Проверить что всё работает

```bash
# Статус Node.js процесса
pm2 status

# Логи приложения
pm2 logs signage --lines 50

# Статус Nginx
sudo systemctl status nginx

# Проверить открывается ли сайт
curl -I https://s9a.ru
# Должен вернуть HTTP/2 200
```

В браузере:
- Сайт: https://s9a.ru
- Админка: https://s9a.ru/admin
- Плеер: https://s9a.ru/player/index.html?id=ID_ЭКРАНА

---

## Управление проектом после деплоя

```bash
# Перезапустить после изменений
pm2 restart signage

# Остановить
pm2 stop signage

# Посмотреть логи в реальном времени
pm2 logs signage
```

### Обновить проект (если используется git)

```bash
cd /opt/digital-signage
git pull
npm install --production   # ОБЯЗАТЕЛЬНО — устанавливает новые зависимости из package-lock.json
pm2 restart signage
pm2 logs signage --lines 20  # убедиться, что нет ошибок MODULE_NOT_FOUND
```

> ⚠️ Если пропустить `npm install` после добавления новых зависимостей — новые API-маршруты вернут 404 (модуль не загрузится из-за `MODULE_NOT_FOUND`).

Если в репозитории обновлялся **nginx.conf**, после `git pull` примените конфиг и перезагрузите Nginx:

```bash
sudo cp /opt/digital-signage/nginx.conf /etc/nginx/sites-available/signage
sudo nginx -t && sudo nginx -s reload
```

> ⚠️ **Nginx proxy:** в конфиге используется `proxy_pass http://127.0.0.1:3000` (не `localhost`). На некоторых серверах `localhost` резолвится в IPv6 `::1`, что приводит к 502. Всегда использовать `127.0.0.1`.

> ⚠️ **Nginx /uploads/:** раздаётся напрямую через `sendfile`, минуя Node.js. Путь `alias` в конфиге должен указывать на `/opt/digital-signage/uploads/`.

### Тегирование версий

```bash
# Создать новый тег
git tag v1.7.1-NEO
git push origin v1.7.1-NEO

# Обновить существующий тег (force)
git tag -f v1.7.1-NEO <commit-hash>
git push origin v1.7.1-NEO --force
```

### APK

APK пересобирать только если менялись файлы в `android-app/`. После деплоя `player.js` достаточно перезапустить приложение на приставке (или дождаться авто-перезагрузки в 04:00).

Файл **neofit_tv.apk** лежит в корне репозитория; после `git pull` на сервере подтягивается актуальная версия, и «Загрузить APK» в админке отдаёт её.

### Релиз новой версии (с обновлением APK)

Чтобы при пуше на GitHub на сервере автоматически оказывалась новая версия APK:

1. Соберите APK в Android Studio (Build → Build Bundle(s) / APK(s) → Build APK(s)).
2. Скопируйте собранный файл (например `android-app/app/build/outputs/apk/release/app-release.apk` или подписанный) в **корень проекта** и переименуйте в **neofit_tv.apk** (рядом с `server.js`).
3. Закоммитьте и запушьте:
   ```bash
   git add neofit_tv.apk
   git commit -m "chore: APK 3.0"
   git push
   ```
4. На сервере выполните обновление (см. выше): `git pull`, при необходимости `npm install --production`, `pm2 restart signage`.

После этого в админке по кнопке «Загрузить APK» будет раздаваться новый neofit_tv.apk.

### Сброс пароля администратора

Если забыли пароль — сбросьте его через CLI (нужен доступ по SSH к серверу). Сервер приложения может быть не запущен.

```bash
cd /opt/digital-signage
npm run reset-password НовыйПароль
```

Пароль должен быть не короче 8 символов. После успешного выполнения выведется: `✅ Пароль успешно изменён`.

---

## Резервное копирование

Бэкап создаёт архив папки `data/` (настройки, медиа-метаданные, плейлисты, экраны, авторизация) в папку `backups/`. Зависимости — только встроенные модули Node.js.

### Запуск вручную

```bash
cd /opt/digital-signage
npm run backup
```

Создаётся файл `backups/backup-YYYY-MM-DD-HH-mm.tar.gz`. Выводится размер архива. Хранятся последние 30 архивов, старые удаляются автоматически.

### Автоматический бэкап по расписанию

**Через панель (рекомендуется):** Настройки → вкладка «Бэкапы» → включите «Включить автобэкап по расписанию» и укажите время (например 03:00). Сохраните. Расписание применяется сразу, используется часовой пояс из раздела «Расписание». Бэкап выполняется, пока запущен сервер (PM2).

**Через cron (альтернатива):** если нужен бэкап независимо от работы Node (например, при падении приложения), настройте crontab:

```bash
cd /opt/digital-signage
mkdir -p logs
bash scripts/setup-cron.sh
```

Можно передать путь к проекту: `bash scripts/setup-cron.sh /opt/digital-signage`. Лог пишется в `logs/backup.log`.

### Где хранятся архивы

Папка `backups/` в корне проекта (в `.gitignore`, в репозиторий не попадает).

### Восстановление из архива

```bash
cd /opt/digital-signage
# Остановить приложение, если нужно
pm2 stop signage

# Распаковать нужный архив (подставить имя файла)
tar -xzf backups/backup-2026-02-23-03-00.tar.gz -C .

# Запустить снова
pm2 start signage
```

Восстановится содержимое папки `data/`.

---

## Возможные проблемы

**Ошибка 404 на новых API-маршрутах (например /api/auth/totp/setup)**
→ После `git pull` не был выполнен `npm install`. Выполнить: `npm install --production && pm2 restart signage`

**Ошибка 502 Bad Gateway**
→ Node.js не запущен. Выполнить: `pm2 start ecosystem.config.js`

**Сертификат не получается**  
→ DNS ещё не обновился. Подождать и повторить.

**Файлы не загружаются (ошибка 413)**  
→ В nginx.conf должен быть `client_max_body_size 512m`. Проверить конфиг.

**Сайт открывается по IP, но не по домену**  
→ DNS не обновился. Проверить A-запись: `nslookup s9a.ru`

---

## Что НЕ трогать

Всю бизнес-логику, модули, API — не изменять.  
Только добавить/обновить файлы: `nginx.conf`, `ecosystem.config.js`, `DEPLOY.md`, при необходимости `.env.example` и `src/config/index.js`.
