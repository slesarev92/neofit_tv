# Задача: доработка Android APK приложения NeoFit TV

## Контекст

Проведён полный аудит APK. Результаты — в файле `android-app/AUDIT_APK.md`. Используй их как основу: не анализируй заново, работай по аудиту.

Выполняй задачи **строго по порядку** — от критичных к желательным. После каждого пункта показывай, что изменил, и жди команды «следующий».

---

## Правила для всех пунктов

- Не переписывать работающий код — только исправлять и добавлять.
- Все строки для пользователя — только через `strings.xml`.
- Не трогать серверную часть проекта.
- После каждого изменения убедиться, что проект собирается: `./gradlew assembleDebug`.

---

# 🔴 КРИТИЧНЫЕ ИСПРАВЛЕНИЯ

---

## Пункт 1 — onDestroy в MainActivity

**Файл:** `MainActivity.kt`

Добавить переопределение `onDestroy()`:

```kotlin
override fun onDestroy() {
    super.onDestroy()
    longPressRunnable?.let { handler.removeCallbacks(it) }
    longPressRunnable = null
    webView.stopLoading()
    webView.clearHistory()
    webView.removeAllViews()
    webView.destroy()
}
```

Цель: предотвратить краш и утечку памяти при уничтожении Activity.

---

## Пункт 2 — Формат конфига с флешки

**Файл:** `UsbReceiver.kt`

Сейчас код читает только `signage.txt` в формате Properties (key=value). Документация описывает «один .txt файл с одной строкой — URL плеера». Привести код в соответствие с документацией.

**Логика чтения файла:**

1. Искать файл `signage.txt` в корне флешки.
2. Прочитать содержимое.
3. Попробовать формат **Properties** (`player_url=...` или `server_url=` + `screen_id=`).
4. Если не подошёл — попробовать формат **«одна строка = полный URL плеера»** (строка начинается с `http://` или `https://`).
5. Если ни один формат не распознан — показать Toast с ошибкой.

**Формат «одна строка»:**

```
https://s9a.ru/player/?id=abc-123-def
```

**Формат Properties (поддержать оба):**

```
player_url=https://s9a.ru/player/?id=abc-123-def
```

или

```
server_url=https://s9a.ru
screen_id=abc-123-def
```

После успешного применения показать Toast: **«✅ Конфигурация применена. Запуск плеера...»** (строка из `strings.xml`).

---

# 🟡 ВАЖНЫЕ ИСПРАВЛЕНИЯ

---

## Пункт 3 — Доступ к флешке на Android 10+

**Файлы:** `UsbReceiver.kt`, `AndroidManifest.xml`

Проблема: прямой доступ по пути может не работать на Android 10+.

Изменить логику чтения файла — пробовать несколько типичных путей к флешке:

```kotlin
val pathFromIntent = intent.data?.path
val possiblePaths = listOfNotNull(
    pathFromIntent,
    "/mnt/usb",
    "/mnt/usb_storage",
    "/mnt/media_rw",
    "/storage/usb",
    "/storage/usbdisk"
).distinct()

val configFile = possiblePaths
    .map { File("$it/signage.txt") }
    .firstOrNull { it.exists() && it.canRead() }
```

Если файл не найден ни по одному пути — показать Toast: **«❌ Файл signage.txt не найден на флешке»** (строка из `strings.xml`).

В `AndroidManifest.xml` при необходимости добавить (только если без этого не работает на целевых устройствах):

```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
```

---

## Пункт 4 — HTC_QUICKBOOT_POWERON в BootReceiver

**Файлы:** `BootReceiver.kt`, `AndroidManifest.xml`

В `AndroidManifest.xml` добавить в intent-filter BootReceiver:

```xml
<action android:name="android.intent.action.HTC_QUICKBOOT_POWERON" />
```

В `BootReceiver.kt` добавить в условие:

```kotlin
intent.action == "android.intent.action.HTC_QUICKBOOT_POWERON"
```

(вместе с `ACTION_BOOT_COMPLETED` и `QUICKBOOT_POWERON`).

---

## Пункт 5 — Все строки в strings.xml

**Файлы:** `SettingsActivity.kt`, `MainActivity.kt`, `activity_settings.xml`, `res/values/strings.xml`

Найти все хардкоженные строки и вынести в `strings.xml`. Добавить и использовать через `getString()`:

```xml
<string name="hint_server_url">https://s9a.ru</string>
<string name="hint_screen_id">ID экрана</string>
<string name="hint_current_pin">Текущий PIN</string>
<string name="new_pin_hint">Новый PIN (минимум 4 цифры)</string>
<string name="msg_pin_changed">PIN изменён</string>
<string name="pin_too_short">PIN не менее 4 цифр</string>
<string name="msg_server_url_required">Укажите адрес сервера</string>
<string name="msg_screen_id_required">Укажите ID экрана</string>
<string name="msg_invalid_url">Неверный формат URL (должен начинаться с http:// или https://)</string>
<string name="msg_connection_ok">✅ Соединение установлено</string>
<string name="msg_connection_fail">❌ Не удалось подключиться</string>
<string name="label_settings_hint">ID экрана можно найти в разделе «Экраны» в админ-панели</string>
<string name="msg_no_connection">Нет соединения с сервером</string>
<string name="msg_retry">Повторить</string>
<string name="msg_open_settings">Настройки</string>
<string name="msg_loading">Загрузка...</string>
<string name="msg_usb_config_applied">✅ Конфигурация применена. Запуск плеера...</string>
<string name="msg_usb_file_not_found">❌ Файл signage.txt не найден на флешке</string>
<string name="msg_usb_invalid_format">❌ Неверный формат файла конфигурации</string>
```

В `activity_settings.xml` заменить все хардкоженные `hint` и `text` на ссылки на `strings.xml`. Дефолтный URL оставить только в `strings.xml` (например `hint_server_url`).

---

## Пункт 6 — Валидация URL при сохранении

**Файл:** `SettingsActivity.kt`

В `saveAndLaunch()` добавить валидацию перед сохранением:

```kotlin
private fun isValidUrl(url: String): Boolean {
    return try {
        val parsed = URL(url)
        parsed.protocol == "http" || parsed.protocol == "https"
    } catch (e: Exception) {
        false
    }
}
```

Перед сохранением: если `serverUrl.isEmpty()` — Toast `msg_server_url_required` и return; если `!isValidUrl(serverUrl)` — Toast `msg_invalid_url` и return; если `screenId.isEmpty()` — Toast `msg_screen_id_required` и return.

---

## Пункт 7 — Закрыть Executor в SettingsActivity

**Файл:** `SettingsActivity.kt`

Добавить:

```kotlin
override fun onDestroy() {
    super.onDestroy()
    executor.shutdown()
}
```

---

# 🟢 УЛУЧШЕНИЯ UX И ДИЗАЙНА

---

## Пункт 8 — Экран загрузки в MainActivity

**Файлы:** `MainActivity.kt`, `activity_main.xml`, при необходимости `res/values/colors.xml`

Добавить overlay поверх WebView, видимый до загрузки страницы:

- В `activity_main.xml`: контейнер (например `LinearLayout` с `id="loadingOverlay"`) с фоном #000000, по центру текст «NeoFit TV», `ProgressBar`, текст с `id="loadingText"` и строкой `msg_loading`.
- В `MainActivity.kt` в `WebViewClient.onPageFinished`: скрыть overlay (например анимация alpha 0 и `visibility = GONE`).
- В `onReceivedError` для main frame: установить в `loadingText` текст `msg_no_connection`.

Все тексты — из `strings.xml`.

---

## Пункт 9 — Overlay ошибки сети

**Файлы:** `MainActivity.kt`, `activity_main.xml`

Добавить overlay ошибки сети:

- Контейнер с `id="errorOverlay"`, по умолчанию `visibility="gone"`.
- Текст ошибки (`msg_no_connection`), обратный отсчёт до повтора (например «Повтор через 8 сек...»), кнопки «Повторить» (`msg_retry`) и «Настройки» (`msg_open_settings`).
- При ошибке загрузки: скрыть loadingOverlay, показать errorOverlay; запустить обратный отсчёт 10 секунд; по истечении — перезагрузка страницы.
- Кнопка «Повторить» — немедленная перезагрузка.
- Кнопка «Настройки» — переход в SettingsActivity (с запросом PIN, как сейчас при долгом нажатии).

---

## Пункт 10 — Иконка приложения

**Файлы:** `res/drawable/`, при необходимости `res/mipmap-*`, `AndroidManifest.xml`

Создать простую иконку NeoFit TV (например векторный drawable: тёмный фон, буква N или стилизованный экран в светлом цвете). Подключить в манифесте вместо `@android:drawable/ic_media_play`. Название приложения в `strings.xml`: `app_name` = «NeoFit TV».

---

## Пункт 11 — Дизайн SettingsActivity для TV

**Файлы:** `activity_settings.xml`, при необходимости `res/values/dimens.xml`, `themes.xml`

- Увеличить размер шрифтов для чтения с расстояния 2–3 м (например 18–22sp для полей и кнопок).
- Тёмный фон (#0f0f0f или #1a1a2e), светлый текст.
- Кнопки достаточной высоты (например 56dp), акцентная кнопка «Сохранить и запустить» — цвет #4f46e5.
- Под полем «ID экрана» добавить подсказку: «ID экрана можно найти в разделе «Экраны» в админ-панели» (строка из `strings.xml`).

---

## Пункт 12 — Исправить рекурсивный PIN-диалог

**Файл:** `MainActivity.kt`

В `showChangePinDialogThenOpenSettings()` при длине PIN < 4 не вызывать рекурсивно тот же диалог. Вместо этого показать Toast `msg_pin_too_short` (или `pin_too_short`) и оставить текущий диалог открытым (не закрывать, не вызывать снова `showChangePinDialogThenOpenSettings()`).

---

# ФИНАЛЬНАЯ ПРОВЕРКА

После всех пунктов:

1. Собрать debug APK: `cd android-app && ./gradlew assembleDebug` — сборка без ошибок.
2. Убедиться, что в коде нет хардкоженных пользовательских строк (все через `getString(R.string.*)` или layout).
3. В `strings.xml` нет дублей имён.

---

# ФИНАЛЬНЫЙ КОММИТ

```bash
git add .
git commit -m "feat(apk): stability, UX, TV design, error handling"
git push
```

---

## Что не трогать

- Серверную часть проекта.
- Логику WebView кроме указанных мест (ошибки, загрузка, overlay).
- Логику BootReceiver кроме добавления HTC action.
- LaunchService — не менять.
