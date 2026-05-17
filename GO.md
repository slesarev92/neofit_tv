# GO — старт новой сессии

> Этот файл — **самый свежий** срез состояния проекта. Перед началом работы прочитать **первым**, потом `CLAUDE.md` → `docs/AUDIT.md` → `CHANGELOG.md` секцию `[Unreleased]`. Обновляется в конце каждой сессии.

---

## Прошлая сессия — 2026-05-17

**Тема:** оффлайн-загрузка плеера показывала статический «Нет контента / Плейлист не назначен» вместо воспроизведения из кеша, несмотря на ранее добавленный native playlist-кэш.

**Корневая причина:** `/js/player.js` отдавался Express'ом без `Cache-Control` (ранний `return` в `setHeaders` для не-HTML), а SW кэшировал только `/uploads/*` и `/api/player/*`. WebView полагался на эвристическую свежесть Chromium — после force-stop / эвикции скрипт пропадал из HTTP-кэша. HTML грузился, скрипт нет, исходный placeholder застывал — и все три предыдущих fallback'а (SW API cache, localStorage, native SharedPreferences) были недоступны, потому что они живут **внутри** `player.js`.

**Что сделано (коммит `abe01f9` + APK `b6e678e`):**
1. `server.js` — явные `Cache-Control` для `.js/.css/.png/.svg/.ico/.woff*` (`public, max-age=86400`); `sw.js` → `no-cache`.
2. `public/sw.js` — отдельный `SHELL_CACHE = 'signage-shell-v1'`, pre-cache shell на `install`, stale-while-revalidate в fetch-handler.
3. `public/sw.js::precacheUrls` — пропускает `/api/player/*` и shell в eviction-loop. **Это был отдельный баг:** успешный poll каждый раз удалял закэшированный API-ответ из media-кэша, потому что URL API не входил в `currentFullSet`.
4. `VideoPlayerManager.kt` — два новых `@JavascriptInterface`: `markBootStage(stage)` / `consumeBootHistory()` для boot-stage телеметрии.
5. `public/js/player.js` — расставлены маркеры стадий, на первый онлайн-poll буфер дренируется и POSTится в `/metrics`.
6. `src/modules/player/player.routes.js` — приём `bootHistory` + winston-лог + `hasPlaybackData` гейт чтобы boot-only POST'ы не затирали `playbackMetrics`.

**Подробности:** см. `CHANGELOG.md` → `[Unreleased]` (две записи в `Added` и `Fixed`) и `CLAUDE.md` → раздел «Оффлайн-загрузка плеера — каскад кешей».

---

## Статус деплоя на 2026-05-17 18:50

| Сервер | Серверный код | APK | Тест offline-boot |
|--------|---------------|-----|--------------------|
| `tv.labgym.ru` | ✅ `abe01f9 + b6e678e` | ✅ свежий, в `/opt/signage/app-*-debug.apk` | ✅ подтверждён пользователем |
| `tv.n-fit.ru` (NeoFit, **38 экранов prod**) | ❌ старый код | ❌ старый APK | — |
| `tv.soham-fit.ru` (Soham) | ❌ старый код | ❌ старый APK | — |

---

## Что pending

1. **Деплой server-фикса на NeoFit и Soham.** Команды по [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md):
   ```bash
   ssh root@tv.n-fit.ru "cd /opt/signage && git pull && pm2 restart signage && pm2 status"
   ssh root@tv.soham-fit.ru "cd /opt/signage && git pull && pm2 restart signage && pm2 status"
   ```
   В прошлой сессии **намеренно** не делалось — пользователь хотел сначала убедиться на labgym (1 тест-экран), прежде чем катить на 38 prod-экранов NeoFit.
2. **APK на устройствах** заменяются вручную через `https://<server>/app-debug.apk` (под auth) или `scripts/upload-apk.ps1`. После деплоя сервера приставки нужно либо перезагружать руками, либо ждать `04:00` auto-reload.
3. **Boot-stage telemetry на NeoFit/Soham** заработает только когда туда дойдут и сервер, и APK. Без обоих — `pm2 logs signage | grep boot-stage` будет пустой.
4. **Релиз `[Unreleased]` → `[3.6.0]`.** В `[Unreleased]` накоплены: оффлайн-фикс, native playlist cache, SW scope fix, telemetry. Когда релизить — решение пользователя (см. workflow в `CLAUDE.md`).

---

## Что НЕ делали и почему

- Не пересобирали APK через Gradle сами — пользователь делал локально и положил в репо. Если в следующей сессии нужно — `./gradlew assembleDebug` из `android-app/`, потом скопировать в корень репо.
- Не трогали `data/`, `uploads/`, `backups/` ни локально, ни на сервере.
- Не делали радикальное P2 (shell как Android asset в APK) — пока фикс P1 работает, не нужно. Если в будущем оффлайн-боот окажется хрупким — см. план P2 в истории коммитов / архитектурном разборе сессии.

---

## Ключевые точки внимания для следующей сессии

- Если пользователь скажет «оффлайн-боот всё ещё не работает на конкретном экране» → **первым делом** `pm2 logs signage | grep "screenName: ИМЯ_ЭКРАНА"` — boot-history сразу покажет, на какой стадии застряло. См. таблицу стадий в `CLAUDE.md::Оффлайн-загрузка плеера — каскад кешей`.
- Если симптом на массе экранов — проверить, на сервере ли свежий код (`ssh ... "git log -1 --oneline"` должен показывать `b6e678e` или новее).
- **Не путать с глобальным `~/.claude/CLAUDE.md`** — там Kutt-проект, к этому отношения не имеет. Соответствующая «защитная» секция стоит в верху локального `CLAUDE.md`.

---

## Обновление этого файла

В конце каждой сессии:
1. Перенести шапку «Прошлая сессия» в новое содержание.
2. Обновить таблицу «Статус деплоя».
3. Обновить «Что pending».
4. При релизе — переписать с нуля, сжать историю.
