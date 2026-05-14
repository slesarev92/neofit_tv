# DEPLOYMENT

Процедуры деплоя, обновления, отката и резервного копирования.

> **Текущий prod-инстанс:** `https://tv.n-fit.ru` (5.35.91.125), путь на сервере `/opt/signage/`, PM2 process name `signage`. Если на сервере окажется старый путь `/opt/digital-signage/` или старый домен `s9a.ru` — это историческое состояние, актуальное значение — здесь.

---

## Первичная установка на новый сервер

### 1. DNS

A-запись `tv.n-fit.ru` → `5.35.91.125`. Проверить: `ping tv.n-fit.ru` → IP сервера.

### 2. Подключение

```bash
ssh root@5.35.91.125
```

### 3. Nginx

```bash
sudo apt update
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx

sudo cp /opt/signage/nginx.conf /etc/nginx/sites-available/signage
sudo ln -s /etc/nginx/sites-available/signage /etc/nginx/sites-enabled/signage
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

⚠️ В `nginx.conf` используется `proxy_pass http://127.0.0.1:3000` — **не** `localhost`. На некоторых серверах `localhost` резолвится в IPv6 `::1`, что даёт 502.

⚠️ `/uploads/` раздаётся напрямую через `sendfile`, минуя Node.js. `alias` должен указывать на `/opt/signage/uploads/`.

### 4. SSL

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d tv.n-fit.ru
```

Сертификат продлевается автоматически каждые 90 дней.

### 5. PM2 и приложение

```bash
sudo apt install -y nodejs npm
sudo npm install -g pm2

cd /opt/signage
cp .env.example .env
nano .env   # PORT=3000, NODE_ENV=production, BASE_URL=https://tv.n-fit.ru, SESSION_SECRET=<random>
# ⚠️ НЕ задавать SESSION_USE_MEMORY=1 в prod — сессии в файлах должны переживать pm2 restart

npm install --production
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# скопировать команду, которую выдаст PM2, и выполнить
```

### 6. Проверка

```bash
pm2 status
pm2 logs signage --lines 50
curl -I https://tv.n-fit.ru   # HTTP/2 200
```

В браузере:
- Сайт: https://tv.n-fit.ru
- Админка: https://tv.n-fit.ru/admin
- Плеер: `https://tv.n-fit.ru/player/index.html?id=<screenId>`

---

## Регулярное обновление

```bash
cd /opt/signage
git pull
npm install --production          # обязательно, если менялся package-lock.json
pm2 restart signage
pm2 logs signage --lines 20       # убедиться что нет MODULE_NOT_FOUND
```

> ⚠️ Если пропустить `npm install` после добавления зависимостей — новые API-маршруты вернут 404, потому что модули не загрузятся.

### Если менялся `nginx.conf`

```bash
sudo cp /opt/signage/nginx.conf /etc/nginx/sites-available/signage
sudo nginx -t && sudo nginx -s reload
```

### Если менялся APK

APK лежит в корне репо как `neofit_tv.apk` и раздаётся через `GET /neofit_tv.apk` (под `requireAuth`).

1. Собрать APK в Android Studio (`Build → Build APK(s)`).
2. Скопировать собранный файл в корень репо как `neofit_tv.apk`.
3. `git add neofit_tv.apk && git commit -m "chore: APK X.Y" && git push`.
4. На сервере — обычное обновление (`git pull && pm2 restart`).

После деплоя `player.js` — перезапустить приложение на приставке (или дождаться auto-reload в 04:00).

---

## Откат

Все версии запинены git-тегами: `git tag -l`.

### Откатить весь проект

```bash
cd /opt/signage
git fetch --tags
git checkout v3.1
npm install --production
pm2 restart signage
```

Возврат к актуальной версии: `git checkout main`.

### Восстановить отдельный файл

```bash
git checkout v3.1 -- путь/к/файлу
```

### Особенности отката между крупными версиями

**С v3.x на v2.x:**
- `VideoPlayerManager.kt` / `PlayerView` отсутствуют — нужен старый APK.
- SW Cache API снова отвечает за видео — потребуется сбросить SW на приставках (DevTools → Application → Service Workers → Unregister, либо очистка данных приложения).

**С v2.x на v1.x:**
- Версия SW-кэша менялась (`signage-media-v2` → `v3`) — тот же сброс SW.
- ffmpeg параметры были другие (Baseline Level 3.1) — старые видео работают, новые загрузки потребуют перезалить, если нужно фактическое качество High.
- `pollInterval` минимум вернётся с 10 на 5 сек.

---

## Резервное копирование

Архив `data/` (настройки, медиа-метаданные, плейлисты, экраны, авторизация) кладётся в `backups/`. Зависимости — только встроенные Node-модули.

### Вручную

```bash
cd /opt/signage
npm run backup
```

Создаст `backups/backup-YYYY-MM-DD-HH-mm.tar.gz`. Хранятся последние 30 архивов, старые удаляются автоматически.

### По расписанию

**Через админку (рекомендуется):** Настройки → «Бэкапы» → включить, задать время → сохранить. Используется TZ из «Расписания». Работает пока запущен PM2.

**Через cron (независимо от PM2):**

```bash
cd /opt/signage
mkdir -p logs
bash scripts/setup-cron.sh
```

Лог пишется в `logs/backup.log`.

### Восстановление

```bash
cd /opt/signage
pm2 stop signage
tar -xzf backups/backup-2026-02-23-03-00.tar.gz -C .
pm2 start signage
```

Восстановится содержимое `data/`.

---

## Сброс пароля администратора

Если забыли пароль (нужен SSH):

```bash
cd /opt/signage
npm run reset-password НовыйПароль
```

Минимум 8 символов. Успех: `✅ Пароль успешно изменён`. Сервер можно не останавливать.

---

## Тегирование релизов

```bash
git tag v3.3-NEO
git push origin v3.3-NEO

# принудительное обновление тега (редко нужно)
git tag -f v3.3-NEO <commit-hash>
git push origin v3.3-NEO --force
```

---

## Типовые проблемы

| Симптом | Причина | Лечение |
|---------|---------|---------|
| 404 на новых API-маршрутах | Пропустили `npm install` после pull | `npm install --production && pm2 restart signage` |
| 502 Bad Gateway | Node не запущен или упал | `pm2 status`; если `errored` — `pm2 logs signage` посмотреть причину, `pm2 restart signage` |
| Файлы не загружаются (413) | В nginx.conf не задан `client_max_body_size` | Проверить, что в `nginx.conf` `client_max_body_size 512m` (или больше) |
| Сертификат не выпускается | DNS ещё не обновился | Подождать, повторить |
| Открывается по IP, не по домену | DNS | `nslookup tv.n-fit.ru` |
| `MODULE_NOT_FOUND` в pm2 logs | Не доустановлены зависимости | `npm install --production` |
| Rate limit залип после рестарта | Старый процесс Node жив | `ps aux \| grep node` или `pm2 list` — убить лишнее |

---

## Что НЕ трогать на сервере

- Бизнес-логику — только через `git pull` из репо.
- `data/`, `uploads/`, `backups/` — данные клиента.
- `/etc/nginx/sites-enabled/` — только через `cp` из `nginx.conf` в репо.
- `.env` — менять руками только по веской причине, и не коммитить.
