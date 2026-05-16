const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const settingsService = require('./settings.service');
const settingsRepository = require('./settings.repository');
const backupScheduler = require('../backup/backup.scheduler');
const screenMonitor = require('../screens/screens.monitor');
const { sendTelegram } = require('../../utils/telegram');

const router = Router();
const uploadDir = path.join(os.tmpdir(), 'signage-logo-uploads');
const uploadLogoFile = multer({
  dest: uploadDir,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype && file.mimetype.startsWith('image/');
    if (!ok) req._fileRejectedWrongType = true;
    cb(null, !!ok);
  },
}).single('logo');

const uploadOffHoursImageFile = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype && file.mimetype.startsWith('image/');
    if (!ok) req._fileRejectedWrongType = true;
    cb(null, !!ok);
  },
}).single('offHoursImage');

router.get('/', async (req, res, next) => {
  try {
    const settings = await settingsService.get();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const result = await settingsService.update(req.body);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    try { backupScheduler.reschedule(result.settings); } catch (_) {}
    try { screenMonitor.rescheduleDailyReport(result.settings); } catch (_) {}
    res.json({ settings: result.settings });
  } catch (err) {
    next(err);
  }
});

router.post('/logo', (req, res, next) => {
  uploadLogoFile(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Логотип не более 2 МБ' });
      }
      return next(err);
    }
    if (req._fileRejectedWrongType) {
      return res.status(400).json({ error: 'Недопустимый тип файла. Выберите изображение (PNG, JPG, WebP или SVG).' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    const result = await settingsService.uploadLogo(req.file);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({ url: result.url });
  } catch (err) {
    next(err);
  }
});

router.post('/off-hours-image', (req, res, next) => {
  uploadOffHoursImageFile(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Изображение не более 5 МБ' });
      }
      return next(err);
    }
    if (req._fileRejectedWrongType) {
      return res.status(400).json({ error: 'Недопустимый тип файла. Выберите изображение (PNG, JPG или WebP).' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    const result = await settingsService.uploadOffHoursImage(req.file);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({ url: result.url });
  } catch (err) {
    next(err);
  }
});

router.post('/telegram-test', async (req, res, next) => {
  try {
    const settings = await settingsRepository.get();
    const token = (settings.telegramBotToken || '').trim();
    const chatId = (settings.telegramChatId || '').trim();
    if (!token || !chatId) {
      return res.status(400).json({ error: 'Укажите токен бота и Chat ID и сохраните настройки.' });
    }
    const brand = (String(settings.systemName || '').trim()) || 'NeoFit TV';
    // HTML escape for the bold tag — systemName is user-controlled so an
    // unescaped < or & would break Telegram's parser or inject tags.
    const safeBrand = brand
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const text = '✅ <b>' + safeBrand + '</b>: тест уведомлений.\n\nЕсли вы видите это сообщение, настройка работает.';
    await sendTelegram(token, chatId, text, { retries: 1 });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({
      error: err.message || 'Не удалось отправить сообщение. Проверьте токен, Chat ID и что бот добавлен в канал как администратор (для каналов).',
    });
  }
});

module.exports = router;
