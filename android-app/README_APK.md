# NeoFit TV Player — Android APK

Нативная оболочка над веб-плеером. Открывает `https://сервер/player/index.html?id=SCREEN_ID` в WebView. Вся логика воспроизведения — в `player.js` на сервере.

## Получить проект на свой компьютер

- **Архив:** на сервере в корне проекта лежит `android-app.tar.gz` (папка `digital-signage`). Скачать с сервера:
  ```bash
  scp USER@СЕРВЕР:/opt/digital-signage/android-app.tar.gz .
  tar xzf android-app.tar.gz
  ```
  В Android Studio: **Open** → выбери папку `android-app`.

- **Git:** если репозиторий на сервере уже подключён к GitHub/GitLab — сделай `git pull` в папке проекта, затем открой `android-app` в Android Studio.

## Сборка

- Требуется: Android SDK, JDK 17 (рекомендуется для Gradle — в Android Studio: **File → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK**). Переменная `ANDROID_HOME` должна быть задана.
- Проект настроен на **Gradle 8.5** и **Android Gradle Plugin 8.3.2** (совместимы с Java 21).
- В проекте включён **gradle.properties** с принудительным **TLS 1.2** для загрузки зависимостей — это часто убирает ошибку **SSL (bad_record_mac) / Tag mismatch** (JDK 21 или прокси/антивирус портят TLS 1.3). После обновления проекта: **File → Invalidate Caches → Invalidate and Restart** (или закрой Android Studio, удали `%USERPROFILE%\.gradle\caches`, снова открой проект и выполни Sync).
- Если ошибка остаётся: 1) в настройках Gradle выбери **JDK 17** вместо 21 (**Gradle JDK**); 2) временно отключи проверку HTTPS для Java в антивирусе/файрволе; 3) убедись, что запущен не старый daemon: в терминале `gradlew --stop`, затем снова Sync.
- В корне `android-app/` выполнить:
  ```bash
  ./gradlew assembleRelease
  ```
- APK: `app/build/outputs/apk/release/app-release-unsigned.apk`
- Для установки на устройство подписывать ключом (release keystore) или собрать debug: `./gradlew assembleDebug`.

## Возможности

- **WebView** — полный экран, JS включён, автовоспроизведение видео без жеста.
- **Экран не гаснет** — `FLAG_KEEP_SCREEN_ON`.
- **Киоск-режим** — Back не выходит; приложение может быть лаунчером (HOME).
- **Автозапуск после загрузки** — `BootReceiver` + `LaunchService` (задержка 3 с).
- **Настройки по длинному нажатию** — удержание 5 с по экрану → ввод PIN (по умолчанию `1234`) → настройки. При первом запуске обязательная смена PIN.
- **Конфиг с USB-флешки** — при монтировании ищется файл `signage.txt` в корне. Форматы:
  - `screen_id=ID` — сервер из текущих настроек.
  - `server_url=URL` + `screen_id=ID` — задать сервер и экран.
  - `player_url=полный URL` — подставить готовый URL плеера.
  После применения показывается Toast и перезапуск плеера.

## Настройки (SettingsActivity)

- URL сервера, ID экрана.
- Кнопка «Проверить соединение» — GET `{server_url}/player/index.html`, вывод кода ответа и времени.
- Смена PIN, «Сохранить и запустить».

## Ограничения (по ТЗ)

- Нет своей логики воспроизведения, Firebase, аналитики, push.
- Не используется `SCREEN_BRIGHT_WAKE_LOCK`.
- Запуск после boot — только через ForegroundService, не через Handler в BroadcastReceiver.
- Зависимости: только AndroidX Core и AppCompat.
