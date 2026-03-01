# Проверка приложения NeoFit TV (APK)

## Где лежат файлы приложения

**Корень проекта (весь signage):**  
`c:\Users\msksl\projects\signage`

**Исходники Android-приложения:**  
`c:\Users\msksl\projects\signage\android-app`

Структура:
- `android-app\app\src\main\kotlin\com\signage\player\` — весь Kotlin-код (MainActivity, BindingActivity, SettingsActivity, App, BootReceiver, UsbReceiver, LaunchService)
- `android-app\app\src\main\res\` — ресурсы (layout, values, drawable)
- `android-app\app\src\main\AndroidManifest.xml` — манифест
- `android-app\app\build.gradle` — зависимости и настройки сборки приложения
- `android-app\build.gradle` — корневой Gradle проекта
- `android-app\settings.gradle` — имя проекта и модуль `:app`

В Android Studio открывать нужно папку **`android-app`** (File → Open → выбрать `c:\Users\msksl\projects\signage\android-app`).

---

## Что проверено и исправлено

### 1. Структура и конфигурация
- **Манифест:** все Activity, Receiver, Service объявлены; у MainActivity и LAUNCHER указан `android:exported="true"`; у остальных Activity `exported="false"`. Разрешения INTERNET, CAMERA, RECEIVE_BOOT_COMPLETED, FOREGROUND_SERVICE, POST_NOTIFICATIONS, READ_EXTERNAL_STORAGE заданы.
- **Application:** зарегистрирован `android:name=".App"` в манифесте; класс `App` есть в пакете `com.signage.player`.
- **Темы:** Theme.NeoFitTV, Theme.NeoFitTV.FullScreen, Theme.SettingsTV объявлены в `res/values/themes.xml`, все ссылки в манифесте корректны.
- **Ресурсы:** все используемые в layout и коде строки, цвета и размеры есть в `strings.xml`, `colors.xml`, `dimens.xml`. Иконка `@drawable/ic_launcher` есть.

### 2. Логика запуска
- **Первый запуск:** MainActivity в `onCreate` проверяет `player_url` до `setContentView`. Если пусто — сразу `startActivity(BindingActivity)` и `finish()`. Отрисовка MainActivity при первом запуске не выполняется.
- **Повторный запуск:** при наличии `player_url` в prefs загружается WebView с плейлистом.
- **После перезагрузки:** BootReceiver → LaunchService → через 3 с запуск MainActivity (с сохранённым URL плейлист откроется сам).

### 3. Внесённые правки кода
- **BindingActivity:** вместо `ScanOptions.QR_CODE` (может отсутствовать в части версий библиотеки на устройстве) используется `BarcodeFormat.QR_CODE` в `setDesiredBarcodeFormats(listOf(BarcodeFormat.QR_CODE))`.
- **BindingActivity:** при переходе в «Ручная настройка» используется константа `SettingsActivity.EXTRA_CLEAR_FIELDS` вместо строки `"clear_fields"`.

### 4. Остальные компоненты
- **UsbReceiver:** показ тоста «signage.txt не найден» только при `pathFromIntent != null`. StorageManager для API 24+ и fallback-пути проверены.
- **SettingsActivity:** константа EXTRA_CLEAR_FIELDS, сохранение URL и ID экрана, переход в MainActivity с флагами — без замечаний.
- **LaunchService:** задержка вынесена в константу BOOT_LAUNCH_DELAY_MS, foregroundServiceType="shortService" корректен для целевого API.

### 5. Отладочное логирование
- В `App` настроен перехват необработанных исключений с записью в Logcat (тег `SignageDebug`).
- В MainActivity и BindingActivity добавлены точечные логи при старте и при переходе в BindingActivity (для разбора падений по logcat при необходимости). Их можно удалить после стабилизации сборки.

---

## Сборка в Android Studio

1. Открыть папку **`c:\Users\msksl\projects\signage\android-app`** (File → Open).
2. Дождаться синхронизации Gradle.
3. Build → Make Project или Run (подключённое устройство/эмулятор).

Если появятся ошибки компиляции или падение на устройстве — пришлите текст ошибки или вывод Logcat (фильтр по тегу `SignageDebug` или `AndroidRuntime`).
