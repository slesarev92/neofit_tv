/**
 * Контент и инициализация страницы документации NeoFit TV.
 * Все разделы заданы в DOCS_SECTIONS; рендер и поиск — в initDocsPage().
 */
(function () {
  var DEBOUNCE_MS = 300;

  window.DOCS_SECTIONS = [
    {
      id: 'about',
      title: 'О проекте',
      icon: '🏠',
      group: 'Начало работы',
      content: '<p>NeoFit TV — система управления контентом на цифровых экранах. Администратор загружает медиафайлы, собирает плейлисты и назначает их на экраны; устройства (браузер или Android APK) воспроизводят контент по кругу.</p>' +
        '<h4>Схема работы</h4>' +
        '<p>Администратор загружает медиафайлы в разделе «Медиа» → собирает плейлисты в разделе «Плейлисты» → создаёт экраны и назначает им плейлисты в разделе «Экраны» → на каждом устройстве открывается ссылка плеера; Android-приставки или браузер воспроизводят контент.</p>' +
        '<h4>Две роли</h4>' +
        '<ul><li><strong>Администратор</strong> — эта панель: вход по паролю, управление медиа, плейлистами, экранами и настройками.</li>' +
        '<li><strong>Плеер</strong> — страница на TV или приставке: без входа, только воспроизведение контента по назначенному плейлисту.</li></ul>' +
        '<h4>Тёмная тема</h4>' +
        '<p>Переключатель светлой/тёмной темы находится в левой панели (внизу, над кнопкой «Выйти»). Выбор сохраняется и применяется ко всем страницам админки, включая эту инструкцию.</p>'
    },
    {
      id: 'quickstart',
      title: 'Быстрый старт',
      icon: '🚀',
      group: 'Начало работы',
      content: '<p>Минимальный сценарий запуска за 5 шагов:</p>' +
        '<div class="docs-steps">' +
        '<div class="docs-step"><div class="docs-step-content">Загрузите медиафайлы в разделе <strong>Медиа</strong> (изображения или видео). Дождитесь статуса «Готово» у видео, если включена оптимизация.</div></div>' +
        '<div class="docs-step"><div class="docs-step-content">Создайте плейлист в разделе <strong>Плейлисты</strong>, добавьте в него файлы и при необходимости измените порядок перетаскиванием.</div></div>' +
        '<div class="docs-step"><div class="docs-step-content">Создайте экран в разделе <strong>Экраны</strong> и назначьте ему только что созданный плейлист.</div></div>' +
        '<div class="docs-step"><div class="docs-step-content">Откройте ссылку плеера на устройстве (кнопка «Скопировать ссылку» на карточке экрана). Вставьте URL в браузер на приставке или откройте через APK.</div></div>' +
        '<div class="docs-step"><div class="docs-step-content">Убедитесь, что в разделе «Экраны» у этого экрана отображается статус 🟢 Онлайн — значит плеер успешно подключился.</div></div>' +
        '</div>'
    },
    {
      id: 'media',
      title: 'Медиафайлы',
      icon: '🎬',
      group: 'Контент',
      content: '<h4>Поддерживаемые форматы</h4>' +
        '<p>Изображения: JPEG, PNG, GIF, WebP. Видео: MP4, WebM.</p>' +
        '<h4>Загрузка</h4>' +
        '<p>Одиночная и множественная загрузка через кнопку или перетаскивание файлов в область загрузки (drag-and-drop).</p>' +
        '<h4>Оптимизация</h4>' +
        '<div class="docs-table-wrap"><table class="docs-table"><thead><tr><th>Тип</th><th>Что делает система</th></tr></thead><tbody>' +
        '<tr><td>Изображение</td><td>Сжимает через sharp, сохраняет формат (JPEG/PNG/WebP)</td></tr>' +
        '<tr><td>Видео</td><td>Перекодирует через ffmpeg (H.264), удаляет звук, уменьшает размер при необходимости</td></tr>' +
        '</tbody></table></div>' +
        '<p>Статусы файла: <strong>processing</strong> — обрабатывается; <strong>ready</strong> — готов к показу; <strong>error</strong> — ошибка обработки (можно посмотреть в интерфейсе).</p>' +
        '<h4>Поиск и фильтрация</h4>' +
        '<p>Поиск по имени, фильтр по типу (все / изображения / видео), сортировка по дате, имени или размеру.</p>' +
        '<h4>Удаление</h4>' +
        '<p>Удалить можно любой файл. Если файл используется в плейлистах, система автоматически уберёт его из всех плейлистов при удалении.</p>'
    },
    {
      id: 'playlists',
      title: 'Плейлисты',
      icon: '▶️',
      group: 'Контент',
      content: '<h4>Создание</h4>' +
        '<p>Кнопка «Создать плейлист» → введите название → в режиме редактирования добавьте файлы из медиатеки.</p>' +
        '<h4>Редактирование</h4>' +
        '<p>Добавление файлов через кнопку «Добавить», изменение порядка перетаскиванием (drag-and-drop).</p>' +
        '<h4>Дублирование элемента</h4>' +
        '<p>Кнопка ⧉ на элементе вставляет копию этого же файла сразу после оригинала. Если один файл встречается в плейлисте несколько раз, отображается бейдж ×2, ×3 и т.д.</p>' +
        '<h4>Дублирование плейлиста</h4>' +
        '<p>Кнопка «Дублировать» на карточке плейлиста создаёт копию с тем же набором файлов и суффиксом «(копия)» в названии.</p>' +
        '<h4>Назначение на экран</h4>' +
        '<p>Назначение плейлиста на экран выполняется в разделе <strong>Экраны</strong>: откройте экран для редактирования и выберите плейлист в выпадающем списке.</p>' +
        '<h4>Удаление</h4>' +
        '<p>Плейлист нельзя удалить, если он назначен хотя бы одному экрану. Сначала назначьте экранам другой плейлист или уберите назначение.</p>'
    },
    {
      id: 'screens',
      title: 'Экраны',
      icon: '🖥️',
      group: 'Контент',
      content: '<h4>Создание</h4>' +
        '<p>Кнопка «Создать экран» → введите название. Затем в карточке экрана выберите плейлист.</p>' +
        '<h4>Статусы</h4>' +
        '<ul><li>🟢 <strong>Онлайн</strong> — плеер недавно обращался к серверу (в пределах порога онлайна из настроек).</li>' +
        '<li>🔴 <strong>Офлайн</strong> — давно не было обращений (превышен порог онлайна).</li>' +
        '<li>⚫ <strong>Никогда не подключался</strong> — у экрана нет записи о последней активности.</li></ul>' +
        '<h4>Ссылка плеера</h4>' +
        '<p>На карточке экрана нажмите «Скопировать ссылку» — в буфер попадёт URL вида <code>https://ваш-сервер/player/index.html?id=ID_ЭКРАНА</code>. Откройте его на устройстве (браузер или APK).</p>' +
        '<h4>Фильтр</h4>' +
        '<p>Вверху списка экранов переключатели: <strong>Все</strong> / <strong>Онлайн</strong> / <strong>Офлайн</strong>. Можно также перейти по ссылке с параметром <code>?filter=offline</code> или <code>?filter=online</code>.</p>'
    },
    {
      id: 'player',
      title: 'Плеер',
      icon: '📺',
      group: 'Устройства',
      content: '<h4>Polling и heartbeat</h4>' +
        '<p>Плеер каждые N секунд (параметр «Интервал опроса» в настройках, по умолчанию 10) запрашивает у сервера актуальный плейлист и настройки. При каждом запросе обновляется время последней активности экрана (heartbeat, <code>lastSeenAt</code>) — по нему определяется статус «Онлайн» в админке.</p>' +
        '<h4>Watchdog</h4>' +
        '<p>Если текущий элемент (картинка или видео) не сменился в течение <code>duration × 2</code> секунд, плеер принудительно переходит к следующему. Это защищает от зависших роликов и незагрузившихся изображений.</p>' +
        '<h4>Service Worker и офлайн</h4>' +
        '<p>Медиафайлы кэшируются по стратегии Cache First; запросы к API плеера не кэшируются (Network Only). После первой загрузки плейлиста контент доступен из кэша — плеер работает при потере интернета.</p>' +
        '<h4>Автоперезагрузка</h4>' +
        '<p>Каждую ночь в заданное время (по умолчанию 04:00) страница плеера перезагружается. Это снижает накопление утечек памяти. Контент восстанавливается из кэша за 1–2 секунды.</p>' +
        '<h4>Расписание работы</h4>' +
        '<p>Если в настройках включено ограничение по времени («Начало работы» и «Конец работы»), вне этого окна экран показывает чёрный экран или заставку (если задано изображение). Проверка выполняется при каждом опросе и раз в минуту.</p>'
    },
    {
      id: 'android',
      title: 'Android APK',
      icon: '📱',
      group: 'Устройства',
      content: '<h4>Зачем нужен APK</h4>' +
        '<p>Нативное приложение обеспечивает автозапуск при включении питания, киоск-режим (блокировка кнопки «Назад»), надёжный Wake Lock (экран не гаснет) и загрузку URL с флешки.</p>' +
        '<h4>Установка</h4>' +
        '<p>Скачайте <code>NeoFit_TV.apk</code> из админки (ссылка «Загрузить APK» в меню) или скопируйте файл на флешку и установите на приставке через файловый менеджер.</p>' +
        '<h4>Первый запуск</h4>' +
        '<p>Откроется экран настроек (SettingsActivity): введите <strong>URL сервера</strong> (например <code>https://ваш-сервер</code>) и <strong>ID экрана</strong> (скопируйте из раздела «Экраны»). Сохраните и запустите плеер.</p>' +
        '<h4>Привязка через флешку</h4>' +
        '<p>Создайте на флешке текстовый файл <code>.txt</code> с одной строкой — полный URL плеера (например <code>https://ваш-сервер/player/index.html?id=uuid-экрана</code>). Вставьте флешку в приставку, откройте файл через файловый менеджер и выберите приложение NeoFit TV — URL применится автоматически.</p>' +
        '<h4>Автозапуск</h4>' +
        '<p>После настройки приложение автоматически запускается при включении питания (если на приставке включён автозапуск при загрузке системы).</p>' +
        '<h4>Киоск-режим</h4>' +
        '<p>Кнопка «Назад» заблокирована, приложение работает как единственный активный экран.</p>' +
        '<h4>PIN и вход в настройки</h4>' +
        '<p>Приложение используется на ТВ (приставка выводит изображение на экран по HDMI). У ТВ нет сенсорного экрана, поэтому способ «удержание пальца 5 секунд» на таком устройстве недоступен.</p>' +
        '<p><strong>Как попасть в настройки на ТВ/приставке:</strong></p>' +
        '<ul>' +
        '<li><strong>Через ADB</strong> — подключитесь к приставке по USB или по сети и выполните: <code>adb shell am start -n com.signage.player/.SettingsActivity</code>. Откроется экран настроек (URL сервера, ID экрана, смена PIN).</li>' +
        '<li><strong>Через сброс</strong> — удалите данные приложения NeoFit TV в настройках Android или переустановите APK. При следующем запуске откроется экран настроек (приложение не найдёт сохранённый URL). После ввода URL и screenId можно снова сохранить и запустить плеер.</li>' +
        '</ul>' +
        '<p><strong>Про PIN:</strong></p>' +
        '<ul>' +
        '<li><strong>PIN по умолчанию</strong>: <code>1234</code>. Хранится только на устройстве, на сервер не передаётся. Нужен для входа в настройки при открытии через ADB (если ранее уже заходили и сменили PIN).</li>' +
        '<li><strong>При первом входе в настройки</strong> (например после сброса или первого запуска через ADB) приложение может потребовать сменить PIN (минимум 4 цифры).</li>' +
        '<li><strong>Смена PIN</strong>: в экране настроек есть кнопка «Сменить PIN» — вводится текущий PIN, затем новый (не короче 4 цифр).</li>' +
        '<li><strong>Если PIN забыт</strong> — снова откройте настройки через ADB (команда выше) или удалите данные приложения / переустановите APK; после этого PIN станет 1234.</li>' +
        '</ul>'
    },
    {
      id: 'pairing',
      title: 'Привязка через QR',
      icon: '🔗',
      group: 'Устройства',
      content: '<p>Привязка устройства к экрану по QR-коду без ручного ввода URL и ID:</p>' +
        '<div class="docs-steps">' +
        '<div class="docs-step"><div class="docs-step-content">Откройте в админ-панели страницу <strong>Привязка</strong> (или перейдите по ссылке из раздела «Экраны»).</div></div>' +
        '<div class="docs-step"><div class="docs-step-content">Система сгенерирует шестизначный код и покажет QR. Код действует <strong>10 минут</strong>.</div></div>' +
        '<div class="docs-step"><div class="docs-step-content">Отсканируйте QR-код телефоном — откроется страница привязки.</div></div>' +
        '<div class="docs-step"><div class="docs-step-content">Если потребуется — войдите в панель (логин по паролю).</div></div>' +
        '<div class="docs-step"><div class="docs-step-content">Выберите существующий экран из списка или создайте новый, введя название.</div></div>' +
        '<div class="docs-step"><div class="docs-step-content">Нажмите «Привязать» — устройство будет связано с выбранным экраном. На приставке откройте полученную ссылку плеера.</div></div>' +
        '</div>' +
        '<div class="docs-warning"><strong>Если код истёк</strong> — обновите страницу привязки в админке, чтобы получить новый код и новый QR.</div>'
    },
    {
      id: 'settings',
      title: 'Настройки',
      icon: '⚙️',
      group: 'Система',
      content: '<h4>Воспроизведение</h4>' +
        '<div class="docs-table-wrap"><table class="docs-table"><thead><tr><th>Параметр</th><th>Описание</th><th>По умолчанию</th></tr></thead><tbody>' +
        '<tr><td>Длительность картинок</td><td>Секунды показа одного изображения</td><td>10</td></tr>' +
        '<tr><td>Интервал опроса</td><td>Как часто плеер запрашивает обновления (сек)</td><td>10</td></tr>' +
        '<tr><td>Порог онлайна</td><td>Через сколько секунд без ответа экран считается офлайн</td><td>15</td></tr>' +
        '<tr><td>Таймаут запроса</td><td>Таймаут HTTP-запроса плеера (сек)</td><td>10</td></tr>' +
        '<tr><td>Макс. повторов</td><td>Попыток при ошибке сети</td><td>3</td></tr>' +
        '<tr><td>Предзагрузка</td><td>Загружать следующий файл заранее</td><td>Вкл</td></tr>' +
        '<tr><td>Кэширование</td><td>Service Worker кэш</td><td>Вкл</td></tr>' +
        '<tr><td>Показ при ошибке</td><td>Показывать последний успешный кадр при ошибке</td><td>Вкл</td></tr>' +
        '</tbody></table></div>' +
        '<h4>Расписание</h4>' +
        '<div class="docs-table-wrap"><table class="docs-table"><thead><tr><th>Параметр</th><th>Описание</th><th>По умолчанию</th></tr></thead><tbody>' +
        '<tr><td>Время перезагрузки</td><td>Ночная перезагрузка страницы плеера (ЧЧ:ММ)</td><td>04:00</td></tr>' +
        '<tr><td>Начало работы</td><td>Экран «включается» в это время</td><td>—</td></tr>' +
        '<tr><td>Конец работы</td><td>Экран «выключается» в это время</td><td>—</td></tr>' +
        '<tr><td>Часовой пояс</td><td>Для расчёта расписания (IANA)</td><td>Europe/Moscow</td></tr>' +
        '</tbody></table></div>' +
        '<h4>Медиа</h4>' +
        '<div class="docs-table-wrap"><table class="docs-table"><thead><tr><th>Параметр</th><th>Описание</th><th>По умолчанию</th></tr></thead><tbody>' +
        '<tr><td>CRF видео</td><td>Качество сжатия (18 = лучше качество, 28 = меньше размер)</td><td>23</td></tr>' +
        '<tr><td>Макс. размер файла</td><td>МБ</td><td>500</td></tr>' +
        '</tbody></table></div>' +
        '<h4>Система</h4>' +
        '<div class="docs-table-wrap"><table class="docs-table"><thead><tr><th>Параметр</th><th>Описание</th><th>По умолчанию</th></tr></thead><tbody>' +
        '<tr><td>Название системы</td><td>Отображается в шапке админки</td><td>NeoFit TV</td></tr>' +
        '<tr><td>Логотип</td><td>URL или загрузка файла</td><td>—</td></tr>' +
        '</tbody></table></div>'
    },
    {
      id: 'telegram',
      title: 'Уведомления Telegram',
      icon: '🔔',
      group: 'Система',
      content: '<h4>Создание бота</h4>' +
        '<p>В Telegram найдите <strong>@BotFather</strong> → отправьте <code>/newbot</code> → следуйте подсказкам и скопируйте выданный токен.</p>' +
        '<h4>Получение chat ID</h4>' +
        '<p>Напишите боту любое сообщение. Затем откройте в браузере: <code>https://api.telegram.org/botВАШ_ТОКЕН/getUpdates</code>. В ответе найдите <code>"chat":{"id":123456789}</code> — это ваш chat ID.</p>' +
        '<h4>Какие события отправляются</h4>' +
        '<ul><li>Экран перешёл в офлайн — уведомление с названием экрана и временем последней активности.</li>' +
        '<li>Экран снова онлайн — уведомление о восстановлении связи.</li></ul>' +
        '<p>Формат сообщения: «🔴 NeoFit TV: Экран „Зал 1“ офлайн» / «🟢 Экран „Зал 1“ онлайн».</p>' +
        '<h4>Тестовое сообщение</h4>' +
        '<p>В настройках во вкладке «Telegram» после ввода токена и chat ID можно нажать кнопку отправки тестового сообщения, чтобы проверить настройку.</p>'
    },
    {
      id: 'backup',
      title: 'Резервное копирование',
      icon: '💾',
      group: 'Система',
      content: '<h4>Что копируется</h4>' +
        '<p>Папка <code>data/</code> (все JSON: настройки, медиа-метаданные, плейлисты, экраны, авторизация, очередь обработки, привязки) и файлы логотипа и заставки «вне часов» из <code>uploads/</code>.</p>' +
        '<h4>Ручной запуск</h4>' +
        '<div class="docs-code-wrap"><pre class="docs-code">npm run backup</pre></div>' +
        '<p>Создаётся архив в папке <code>backups/</code> с именем <code>backup-YYYY-MM-DD-HH-mm.tar.gz</code>.</p>' +
        '<h4>Автоматический бэкап</h4>' +
        '<p>В настройках во вкладке «Бэкапы» можно включить расписание: время запуска, частота (ежедневно / еженедельно / по дням месяца). Используется часовой пояс из раздела «Расписание». Расписание выполняется пока запущен сервер (например под PM2).</p>' +
        '<h4>Хранение</h4>' +
        '<p>Архивы лежат в папке <code>backups/</code>. Количество хранимых архивов настраивается (10–90). Старые удаляются автоматически.</p>' +
        '<h4>Восстановление</h4>' +
        '<p>Из панели: Настройки → Бэкапы → «Загрузить бэкап» → выбрать архив → восстановить. Либо на сервере: <code>tar -xzf backups/backup-YYYY-MM-DD-HH-mm.tar.gz -C /путь/к/проекту</code>. После восстановления перезапустите приложение.</p>'
    },
    {
      id: 'reset-password',
      title: 'Сброс пароля',
      icon: '🔑',
      group: 'Система',
      content: '<div class="docs-warning"><strong>Команда выполняется на сервере</strong> (по SSH). Сервис может быть запущен — пароль сменится сразу.</div>' +
        '<div class="docs-code-wrap"><pre class="docs-code">npm run reset-password НовыйПароль</pre></div>' +
        '<p>Минимальная длина пароля: <strong>6 символов</strong>. После успешного выполнения выведется сообщение об успешной смене пароля.</p>'
    },
    {
      id: 'security',
      title: 'Безопасность',
      icon: '🔒',
      group: 'Система',
      content: '<h4>Пароль</h4>' +
        '<p>Хранится в виде bcrypt-хеша (cost factor 10). Восстановить пароль по хешу нельзя.</p>' +
        '<h4>Rate limit на вход</h4>' +
        '<p>Не более 10 попыток входа с одного IP за 15 минут. При превышении возвращается ошибка без указания причины.</p>' +
        '<h4>Сессии</h4>' +
        '<p>Используется httpOnly cookie — JavaScript не может прочитать сессию. Установлен SameSite=Lax (запросы с других сайтов не отправляют cookie). В production при работе по HTTPS включается флаг secure.</p>' +
        '<h4>Загрузка файлов</h4>' +
        '<p>Тип файла проверяется по содержимому (magic bytes), а не по расширению. Имена на диске заменяются на UUID + безопасное имя. Допускаются только типы из whitelist (изображения и видео).</p>' +
        '<h4>HTTP-заголовки</h4>' +
        '<p>Применяется middleware Helmet для установки безопасных заголовков.</p>' +
        '<h4>Публичные маршруты (без авторизации)</h4>' +
        '<p><code>/api/auth/login</code>, <code>/api/player/*</code>, <code>/api/pair/init</code>, <code>GET /api/pair/:code</code>. Подтверждение привязки <code>POST /api/pair/:code/confirm</code> требует авторизации.</p>'
    },
    {
      id: 'resilience',
      title: 'Отказоустойчивость',
      icon: '🛡️',
      group: 'Система',
      content: '<h4>Watchdog плеера</h4>' +
        '<p>Зависший элемент (картинка или видео) автоматически пропускается через <code>duration × 2</code> секунд.</p>' +
        '<h4>Service Worker</h4>' +
        '<p>При потере интернета плеер продолжает показ из кэша. После восстановления связи подтягивает обновления при следующем опросе.</p>' +
        '<h4>Автоперезагрузка</h4>' +
        '<p>Ночная перезагрузка страницы плеера снижает накопление утечек памяти в браузере.</p>' +
        '<h4>Очередь видео</h4>' +
        '<p>Незавершённые задачи оптимизации видео сохраняются в <code>data/processing-queue.json</code>. После рестарта сервера обработка возобновляется.</p>' +
        '<h4>Резервное копирование</h4>' +
        '<p>Автобэкап по расписанию из панели позволяет восстанавливать данные при сбоях.</p>'
    },
    {
      id: 'architecture',
      title: 'Техническая архитектура',
      icon: '🔧',
      group: 'Разработчику',
      content: '<h4>Схема</h4>' +
        '<p>Браузер или APK → Nginx (порт 443, HTTPS) → Node.js (порт 3000).</p>' +
        '<h4>Три слоя бэкенда</h4>' +
        '<ul><li><strong>Routes</strong> — валидация входных данных, вызов сервисов, формирование ответа.</li>' +
        '<li><strong>Services</strong> — бизнес-логика (проверки, расчёты, оркестрация).</li>' +
        '<li><strong>Repositories</strong> — чтение и запись JSON-файлов на диске.</li></ul>' +
        '<h4>Модули</h4>' +
        '<p>auth, media, playlists, screens, player, pair, settings, system, backup.</p>'
    },
    {
      id: 'file-structure',
      title: 'Структура файлов',
      icon: '📁',
      group: 'Разработчику',
      content: '<p>Ключевые файлы и папки:</p>' +
        '<ul>' +
        '<li><code>server.js</code> — точка входа Express</li>' +
        '<li><code>src/config/index.js</code> — конфигурация (единственное место чтения process.env)</li>' +
        '<li><code>src/middleware/</code> — auth, rateLimit, validate, errorHandler</li>' +
        '<li><code>src/modules/auth/</code> — аутентификация (routes, service, repository)</li>' +
        '<li><code>src/modules/media/</code> — медиафайлы, media.processor.js (sharp, ffmpeg), video.queue.js</li>' +
        '<li><code>src/modules/playlists/</code> — плейлисты</li>' +
        '<li><code>src/modules/screens/</code> — экраны, screens.monitor.js (мониторинг и Telegram)</li>' +
        '<li><code>src/modules/player/</code> — публичный API плеера</li>' +
        '<li><code>src/modules/pair/</code> — привязка устройств (QR, коды)</li>' +
        '<li><code>src/modules/settings/</code> — глобальные настройки</li>' +
        '<li><code>src/modules/system/</code> — системная статистика (память, диск, бэкап)</li>' +
        '<li><code>src/modules/backup/</code> — резервное копирование (routes, service, scheduler)</li>' +
        '<li><code>data/</code> — auth.json, media.json, playlists.json, screens.json, settings.json, pairing.json, processing-queue.json, backup-status.json</li>' +
        '<li><code>uploads/</code> — загруженные медиа и служебные изображения (логотип, заставка)</li>' +
        '<li><code>public/</code> — статика: admin/, player/, pair/, login.html, js/, css/</li>' +
        '<li><code>scripts/</code> — backup.js, reset-password.js, setup-cron.sh</li>' +
        '</ul>'
    },
    {
      id: 'faq',
      title: 'Часто задаваемые вопросы',
      icon: '❓',
      group: 'Помощь',
      content: '<ul class="docs-faq-list">' +
        '<li class="docs-faq-item"><button type="button" class="docs-faq-q" aria-expanded="false">Экран показывает «Нет контента»<span class="docs-faq-chevron">▼</span></button><div class="docs-faq-a"><div class="docs-faq-a-inner">Плейлист не назначен экрану или в URL плеера указан неверный ID экрана. Проверьте в разделе «Экраны», что у экрана выбран плейлист, и что в ссылке плеера параметр <code>id</code> совпадает с ID этого экрана.</div></div></li>' +
        '<li class="docs-faq-item"><button type="button" class="docs-faq-q" aria-expanded="false">Экран офлайн, хотя плеер открыт<span class="docs-faq-chevron">▼</span></button><div class="docs-faq-a"><div class="docs-faq-a-inner">Проверьте, что в URL плеера правильный <code>id</code> экрана. Увеличьте «Порог онлайна» в настройках (раздел Мониторинг), если сеть медленная.</div></div></li>' +
        '<li class="docs-faq-item"><button type="button" class="docs-faq-q" aria-expanded="false">Видео оптимизируется очень долго<span class="docs-faq-chevron">▼</span></button><div class="docs-faq-a"><div class="docs-faq-a-inner">Для больших файлов это нормально. Обработка идёт в одном потоке. Статус «Обрабатывается» можно обновлять вручную на странице медиафайла.</div></div></li>' +
        '<li class="docs-faq-item"><button type="button" class="docs-faq-q" aria-expanded="false">Как назначить один плейлист на несколько экранов?<span class="docs-faq-chevron">▼</span></button><div class="docs-faq-a"><div class="docs-faq-a-inner">Откройте каждый экран для редактирования и в выпадающем списке выберите один и тот же плейлист.</div></div></li>' +
        '<li class="docs-faq-item"><button type="button" class="docs-faq-q" aria-expanded="false">Что происходит при обновлении плейлиста?<span class="docs-faq-chevron">▼</span></button><div class="docs-faq-a"><div class="docs-faq-a-inner">Плеер получает изменения при следующем опросе сервера (интервал задаётся в настройках, по умолчанию 10 секунд). Смена контента происходит после текущего элемента.</div></div></li>' +
        '<li class="docs-faq-item"><button type="button" class="docs-faq-q" aria-expanded="false">Как работает офлайн-режим?<span class="docs-faq-chevron">▼</span></button><div class="docs-faq-a"><div class="docs-faq-a-inner">Service Worker отдаёт медиа из кэша браузера. После восстановления интернета плеер при следующем запросе получает обновлённый плейлист и при необходимости подгружает новые файлы.</div></div></li>' +
        '<li class="docs-faq-item"><button type="button" class="docs-faq-q" aria-expanded="false">Не приходят уведомления в Telegram<span class="docs-faq-chevron">▼</span></button><div class="docs-faq-a"><div class="docs-faq-a-inner">Проверьте токен бота и chat ID в настройках (вкладка Telegram). Нажмите «Тестовое сообщение» — если оно не пришло, исправьте данные или убедитесь, что боту уже писали (для получения chat ID).</div></div></li>' +
        '<li class="docs-faq-item"><button type="button" class="docs-faq-q" aria-expanded="false">Как изменить время перезагрузки плеера?<span class="docs-faq-chevron">▼</span></button><div class="docs-faq-a"><div class="docs-faq-a-inner">Настройки → Расписание → поле «Время перезагрузки плеера» (формат ЧЧ:ММ).</div></div></li>' +
        '<li class="docs-faq-item"><button type="button" class="docs-faq-q" aria-expanded="false">Экран не включается по расписанию<span class="docs-faq-chevron">▼</span></button><div class="docs-faq-a"><div class="docs-faq-a-inner">Проверьте часовой пояс в настройках и что время начала/окончания работы указано в формате ЧЧ:ММ. Убедитесь, что расписание включено и границы времени заданы корректно.</div></div></li>' +
        '<li class="docs-faq-item"><button type="button" class="docs-faq-q" aria-expanded="false">Как сбросить PIN в APK?<span class="docs-faq-chevron">▼</span></button><div class="docs-faq-a"><div class="docs-faq-a-inner">Подключите приставку по ADB и выполните: <code>adb shell am start -n com.signage.player/.SettingsActivity</code> — откроется экран настроек, где можно сменить PIN. Либо переустановите APK.</div></div></li>' +
        '</ul>'
    }
  ];

  function renderDocs() {
    var container = document.getElementById('docsContent');
    var sidebarInner = document.getElementById('docsSidebarInner');
    if (!container || !sidebarInner) return;

    var groups = {};
    window.DOCS_SECTIONS.forEach(function (s) {
      var g = s.group || '';
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    });

    var groupOrder = ['Начало работы', 'Контент', 'Устройства', 'Система', 'Разработчику', 'Помощь'];
    groupOrder.forEach(function (groupName) {
      var items = groups[groupName];
      if (!items || items.length === 0) return;
      var groupTitle = document.createElement('div');
      groupTitle.className = 'docs-sidebar-group-title';
      groupTitle.textContent = groupName;
      sidebarInner.appendChild(groupTitle);
      items.forEach(function (s) {
        var a = document.createElement('a');
        a.href = '#' + s.id;
        a.setAttribute('data-id', s.id);
        a.innerHTML = (s.icon ? '<span class="docs-nav-icon">' + s.icon + '</span>' : '') + s.title;
        sidebarInner.appendChild(a);
      });
    });

    window.DOCS_SECTIONS.forEach(function (s) {
      var section = document.createElement('section');
      section.id = s.id;
      section.className = 'docs-section';
      var textForSearch = (s.title + ' ' + s.content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
      section.setAttribute('data-search', textForSearch);
      var titleHtml = '<h2 class="docs-section-title">' +
        (s.icon ? '<span class="docs-nav-icon">' + s.icon + '</span>' : '') +
        '<a href="#' + s.id + '" id="anchor-' + s.id + '">' + s.title + '</a>' +
        '<a href="#' + s.id + '" class="docs-anchor" aria-label="Ссылка на раздел">#</a></h2>';
      section.innerHTML = titleHtml + s.content;
      container.appendChild(section);
    });
  }

  function initCopyButtons() {
    document.querySelectorAll('.docs-code-wrap').forEach(function (wrap) {
      var pre = wrap.querySelector('.docs-code');
      if (!pre) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'docs-code-copy';
      btn.setAttribute('aria-label', 'Копировать');
      btn.textContent = '📋';
      btn.addEventListener('click', function () {
        var text = pre.textContent || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            btn.textContent = '✅';
            btn.classList.add('copied');
            setTimeout(function () {
              btn.textContent = '📋';
              btn.classList.remove('copied');
            }, 2000);
          });
        }
      });
      wrap.insertBefore(btn, pre);
    });
  }

  function initSearch() {
    var input = document.getElementById('docsSearch');
    var countEl = document.getElementById('docsSearchCount');
    var sections = document.querySelectorAll('#docsContent .docs-section');
    var sidebarLinks = document.querySelectorAll('#docsSidebar a[data-id]');

    function clearHighlights(container) {
      if (!container) return;
      container.querySelectorAll('mark').forEach(function (m) {
        var p = m.parentNode;
        p.replaceChild(document.createTextNode(m.textContent), m);
        p.normalize();
      });
    }

    function highlightText(node, query) {
      if (!query || !node || node.nodeType !== 3) return;
      var text = node.textContent;
      var i = text.toLowerCase().indexOf(query.toLowerCase());
      if (i === -1) return;
      var before = text.slice(0, i);
      var match = text.slice(i, i + query.length);
      var after = text.slice(i + query.length);
      var span = document.createElement('span');
      span.innerHTML = before + '<mark>' + match + '</mark>' + after;
      node.parentNode.replaceChild(span, node);
    }

    function runSearch() {
      var q = (input.value || '').trim().toLowerCase();
      var visibleCount = 0;
      sections.forEach(function (sec) {
        clearHighlights(sec);
        var searchable = sec.getAttribute('data-search') || '';
        var show = !q || searchable.indexOf(q) !== -1;
        sec.classList.toggle('hidden-by-search', !show);
        if (show) visibleCount++;
        if (q && show) {
          var walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT, null, false);
          var nodes = [];
          while (walker.nextNode()) nodes.push(walker.currentNode);
          nodes.forEach(function (n) {
            if (n.textContent.toLowerCase().indexOf(q) !== -1) highlightText(n, q);
          });
        }
      });
      sidebarLinks.forEach(function (a) {
        var id = a.getAttribute('data-id');
        var sec = document.getElementById(id);
        a.classList.toggle('hidden-by-search', !sec || sec.classList.contains('hidden-by-search'));
      });
      if (countEl) {
        if (q) countEl.textContent = 'Найдено в ' + visibleCount + ' разделах';
        else countEl.textContent = '';
      }
    }

    var debounceTimer;
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, DEBOUNCE_MS);
    });
  }

  function initSidebarHighlight() {
    var sections = document.querySelectorAll('#docsContent .docs-section');
    var sidebarLinks = document.querySelectorAll('#docsSidebar a[data-id]');

    function setActive(id) {
      sidebarLinks.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('data-id') === id);
      });
    }

    if (typeof IntersectionObserver !== 'undefined') {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) setActive(e.target.id);
          });
        },
        { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
      );
      sections.forEach(function (s) {
        observer.observe(s);
      });
    }

    window.addEventListener('hashchange', function () {
      var id = window.location.hash.slice(1);
      if (id) setActive(id);
    });
    if (window.location.hash) setActive(window.location.hash.slice(1));
  }

  function initAccordion() {
    document.querySelectorAll('.docs-faq-item').forEach(function (item) {
      var q = item.querySelector('.docs-faq-q');
      var a = item.querySelector('.docs-faq-a');
      if (!q || !a) return;
      q.addEventListener('click', function () {
        var open = item.classList.toggle('open');
        q.setAttribute('aria-expanded', open);
      });
    });
  }

  function initMobileSidebar() {
    var toggle = document.getElementById('docsNavToggle');
    var sidebar = document.getElementById('docsSidebar');
    if (!toggle || !sidebar) return;
    if (window.matchMedia('(max-width: 768px)').matches) {
      toggle.style.display = 'inline-flex';
    }
    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
    document.querySelectorAll('#docsSidebar a[data-id]').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.matchMedia('(max-width: 768px)').matches) {
          sidebar.classList.remove('open');
        }
      });
    });
    document.addEventListener('click', function (e) {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  window.initDocsPage = function () {
    renderDocs();
    initCopyButtons();
    initSearch();
    initSidebarHighlight();
    initAccordion();
    initMobileSidebar();
  };
})();
