# Откат к предыдущим версиям

Версии зафиксированы тегами Git. Актуальный список тегов: `git tag -l`.

**Откатить весь проект к состоянию нужной версии:**
```bash
cd /opt/digital-signage
git fetch --tags
git checkout v1.6-NEO
npm install --production
pm2 restart signage
```

После этого рабочая копия будет в состоянии на момент выбранной версии. Чтобы вернуться к последним изменениям: `git checkout main`.

**Восстановить только отдельные файлы из версии:**
```bash
git checkout v1.6-NEO -- путь/к/файлу
```

**Список всех версий (тегов):**
```bash
git tag -l
```

---

## Особенности отката с v1.7.1-NEO

### На v1.6-NEO или ранее

1. **Service Worker** — версия кэша изменилась (`signage-media-v2` → `signage-media-v3`). На приставках нужно сбросить SW вручную:
   - Через DevTools: Application → Service Workers → Unregister
   - Или очистить данные приложения на Android

2. **Видео H.264 Baseline** — видео загруженные после v1.7 закодированы в Baseline profile level 3.1. При откате на версию без этих параметров новые видео продолжат работать. Но если нужно перекодировать в High profile — перезалить через админку.

3. **nginx.conf** — в v1.7+ добавлен `location /uploads/` для прямой раздачи. При откате нужно обновить nginx конфиг:
   ```bash
   sudo cp /opt/digital-signage/nginx.conf /etc/nginx/sites-available/signage
   sudo nginx -t && sudo nginx -s reload
   ```

4. **videoMaxWidth** — default изменился с null на 1920. При откате новые загрузки снова будут без ограничения ширины. Существующие видео не затрагиваются.

5. **pollInterval** — минимум вернётся с 10 на 5 сек. Если в settings.json сохранено значение 5–9, оно снова станет валидным.

6. **Android APK** — если пересобирался APK с `largeHeap`, `onTrimMemory`, `R8 minify` — нужно пересобрать APK из старой версии и переустановить на приставках.
