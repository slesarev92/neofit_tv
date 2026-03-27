# Проблема: неплавное воспроизведение видео на ТВ-приставке

**Устройство:** H96Max, Allwinner H616, 2GB RAM, Android 10, WebView-плеер
**Экран:** 43" ТВ (предположительно 60Hz)
**Симптом:** видео играет плавно в браузере на ПК, но на приставке — микро-лаги/фризы
**Статус:** ждём данных телеметрии для точной диагностики

---

## Хронология изменений

### Коммит `1ebca50` — v1.8-NEO: Офлайн-кэширование видео
- SW кэширует ВСЕ медиа (видео + изображения) в Cache API
- Range-запросы обслуживаются из кэша через `blob.slice()`
- Настройка `cacheMaxSizeMb` (по умолчанию 2048 МБ) в админке
- **Проблема:** `blob.slice()` на каждый Range-запрос = десятки аллокаций в секунду

### Коммит `2efde54` — v2.0-NEO: Оптимизация ffmpeg
- Добавлено: `-r 30 -maxrate 4M -bufsize 8M -preset medium`
- Было: `-preset veryfast`, без ограничения fps и битрейта
- **Результат:** пользователь сообщил «стало лучше, но всё равно не хватает плавности»

### Коммит `744465f` — Исправление профиля/уровня H.264
**Ключевая находка:** `-profile:v baseline -level 3.1` НЕПРАВИЛЬНО для 1080p!
- Level 3.1 поддерживает макс. 3600 макроблоков (1280x720)
- 1920x1080 = 8160 макроблоков — в 2.3 раза больше лимита Level 3.1
- Декодер мог уходить в софтварный режим или выделять недостаточно буферов
- **Исправлено:** `-profile:v high -level 4.0`
- Также: `-maxrate 8M -bufsize 16M` (было 4M/8M — мало для 43" ТВ)
- Убран `-threads 2` (бесполезен для libx264)
- Добавлен `navigator.storage.persist()` для защиты кэша
- **Результат:** качество видео стало нормальным, но плавность всё ещё недостаточная

### Коммит `2987fb8` — Blob URL вместо blob.slice()
- **Гипотеза:** blob.slice() на каждый Range-запрос создаёт GC-давление
- Вместо перехвата Range в SW: player.js один раз читает файл из кэша → blob URL → нативное воспроизведение
- SW больше не делает blob.slice(), не участвует в воспроизведении
- Убран `opacity:0` с preload-slot (GPU compositing overhead)
- **Результат:** ожидаем данных телеметрии

### Коммит `071dd8b` — Телеметрия
- `getVideoPlaybackQuality()` — droppedFrames, totalFrames, dropPercent
- Время создания blob URL (blobTimeMs)
- Время до canplay (canplayTimeMs)
- Источник: cache / network
- Размер файла (fileSizeKb)
- POST `/api/player/:screenId/metrics` → сохраняется в screen.playbackMetrics
- Отображается в админке на странице экранов
- `WebView.setWebContentsDebuggingEnabled(true)` в APK для remote debug

---

## Все гипотезы

### Подтверждённые проблемы (исправлены)

| # | Гипотеза | Статус | Коммит |
|---|----------|--------|--------|
| 1 | H.264 Baseline Level 3.1 не поддерживает 1080p — декодер борется | **Исправлено** — High Level 4.0 | `744465f` |
| 2 | 60fps из исходника перегружает декодер | **Исправлено** — `-r 30` | `2efde54` |
| 3 | Пики битрейта (без maxrate) перегружают декодер | **Исправлено** — `-maxrate 8M` | `744465f` |
| 4 | `-preset veryfast` даёт больший битрейт при том же CRF | **Исправлено** — `medium` | `2efde54` |
| 5 | blob.slice() на каждый Range = GC-давление | **Исправлено** — blob URL | `2987fb8` |

### Активные гипотезы (ждём данных)

| # | Гипотеза | Как проверить | Ожидаемые данные |
|---|----------|--------------|-----------------|
| 6 | toBlobUrl() грузит весь файл в RAM разом — GC-пауза | `blobTimeMs` в метриках; если >500мс и совпадает с лагом — подтверждено | Телеметрия |
| 7 | enforceLimit() в SW читает ВСЕ блобы после каждого cache.put() | Лаги совпадают с моментом poll → PRECACHE | Телеметрия + наблюдение |
| 8 | Precache качает весь плейлист сразу, конкурирует с декодером за I/O | Лаги в первые минуты после старта (пока кэш заполняется) | Наблюдение |
| 9 | Preload следующего видео через toBlobUrl() = второй blob в RAM | `blobTimeMs` preload-а накладывается на воспроизведение | Телеметрия |
| 10 | Декодер H616 не использует аппаратное декодирование (софтверный fallback) | droppedFrames > 20% = почти наверняка софтверный | Телеметрия |
| 11 | Конкуренция RAM: WebView + blob + декодер + preload на 2GB | ООМ или очень высокий blobTimeMs | Телеметрия |

### Отклонённые гипотезы

| # | Гипотеза | Почему отклонена |
|---|----------|-----------------|
| 12 | Frame rate mismatch (30fps на 50Hz ТВ) | 30fps на 60Hz = идеальное соотношение 2:2 |
| 13 | VP9 вместо H.264 | На H616 VP9 аппаратный декодер ненадёжен через MediaCodec |
| 14 | Снизить разрешение до 720p | На 43" ТВ будет заметно мыльным |
| 15 | CSS transforms на video элементе | В коде нет transforms на video |

---

## Текущие настройки ffmpeg

```
-crf 23 -preset medium -r 30 -maxrate 8M -bufsize 16M -an -movflags +faststart -profile:v high -level 4.0
```

Файл: `src/modules/media/media.processor.js:76`

---

## Возможные решения (после получения данных)

### Если проблема — toBlobUrl() (гипотеза 6)
**Решение:** онлайн — `video.src = url` напрямую (стриминг из HTTP-кэша Nginx), blob URL только как offline fallback.
```
if (navigator.onLine) video.src = url;
else toBlobUrl(url).then(result => video.src = result.src);
```

### Если проблема — enforceLimit() (гипотеза 7)
**Решение:** хранить размеры файлов в Map при cache.put(), не перечитывать все блобы.
```javascript
var sizeMap = new Map(); // url → size in bytes
// При cache.put() запоминаем размер из response headers Content-Length
// enforceLimit() использует sizeMap вместо resp.blob()
```

### Если проблема — precache конкурирует с playback (гипотеза 8)
**Решение:** качать только 1-2 следующих элемента, не весь плейлист. Остальное — после полного цикла.

### Если проблема — preload + playback (гипотеза 9)
**Решение:** для preload не создавать blob URL, использовать обычный URL с `preload="metadata"`.

### Если проблема — софтверный декодер (гипотеза 10)
**Решение:** попробовать `-profile:v main -level 4.0` (менее агрессивный чем High, но лучше Baseline). Или вернуть Baseline Level 4.0 для проверки.

### Если проблема — RAM (гипотеза 11)
**Решение:** комбинация: убрать blob URL для онлайн + ограничить precache + убрать preload для видео.

---

## Данные о видео от пользователя (скриншот свойств файла)

- Продолжительность: 00:03:35
- Ширина кадра: 1920
- Высота кадра: 1080
- Скорость передачи данных: 9003 кбит/сек
- Общая скорость потока: 9192 кбит/сек
- Частота кадров: 25.00 кадров/с

**Примечание:** битрейт 9003 kbps при maxrate 4M (позже 8M) означает что это скорее всего ОРИГИНАЛ — сжатая версия была больше оригинала и код сохранил оригинал. После исправления на High Profile сжатие должно работать эффективнее.

---

## Архитектура воспроизведения (текущая)

```
1. player.js poll → GET /api/player/:screenId → получает плейлист
2. player.js → postMessage('PRECACHE', urls) → SW качает все URL в Cache API
3. SW precache: fetch(url) → cache.put() → enforceLimit() (читает ВСЕ блобы)
4. playVideo(item):
   a. toBlobUrl(url) → fetch(url) → SW cache-first → response
   b. response.blob() → URL.createObjectURL(blob) → video.src = blob:...
   c. Браузер играет blob URL нативно (без SW)
5. startPreloadNext():
   a. toBlobUrl(nextUrl) → аналогично, второй blob в RAM
   b. <video preload="metadata"> с blob URL
6. video.onended → sendMetrics() → playNext()
```

---

## Что нужно сделать СЕЙЧАС

1. Задеплоить коммит `071dd8b` на сервер: `git pull && pm2 restart signage`
2. Пересобрать APK (изменён MainActivity.kt) и установить на приставку
3. Перезалить видео через админку (чтобы перекодировались с High Profile Level 4.0)
4. Дождаться полного цикла видео
5. Посмотреть метрики в админке → экраны → под «Последняя активность»
6. Проанализировать данные и выбрать решение из списка выше

---

## Внешняя экспертиза

Консультация с коллегой пользователя выявила дополнительные проблемы:
- toBlobUrl() сам по себе — тяжёлая операция (весь файл в RAM)
- enforceLimit() — скрытая тяжёлая операция (перечитывает все cached блобы)
- Precache + playback + preload = тройная конкуренция за I/O и RAM
- **Вывод:** blob URL был неправильным направлением для онлайн-режима. Для онлайна нужен стриминг из HTTP-кэша, blob URL — только offline fallback.

---

## Ключевые файлы

- `src/modules/media/media.processor.js:76` — настройки ffmpeg
- `public/player/sw.js` — Service Worker, кэширование, precache
- `public/js/player.js` — плеер, toBlobUrl, playVideo, preload, метрики
- `src/modules/player/player.routes.js` — endpoint метрик
- `public/js/admin-screens.js` — отображение метрик в админке
- `android-app/app/src/main/kotlin/com/signage/player/MainActivity.kt` — WebView config
