const { Router } = require('express');
const backupService = require('./backup.service');

const router = Router();

router.post('/run', async (req, res, next) => {
  try {
    const name = req.body && typeof req.body.name === 'string' ? req.body.name.trim() : null;
    const result = backupService.runBackup(name || undefined);
    if (result.ok) {
      res.json({ ok: true, message: 'Бэкап создан' });
    } else {
      res.status(400).json({ ok: false, error: result.error });
    }
  } catch (err) {
    next(err);
  }
});

router.get('/list', async (req, res, next) => {
  try {
    const list = await backupService.listBackups();
    res.json({ items: list });
  } catch (err) {
    next(err);
  }
});

router.post('/restore', async (req, res, next) => {
  try {
    const fileName = req.body && typeof req.body.fileName === 'string' ? req.body.fileName.trim() : null;
    if (!fileName) {
      return res.status(400).json({ ok: false, error: 'Укажите fileName' });
    }
    const result = backupService.restoreBackup(fileName);
    if (result.ok) {
      res.json({ ok: true, message: 'Настройки восстановлены. Сервер перезапускается для сброса кэша...' });
      // Exit so PM2 restarts the process — resets all in-memory caches.
      // Without restart, heartbeat writes would immediately overwrite the restored data.
      setTimeout(() => process.exit(0), 300);
    } else {
      res.status(400).json({ ok: false, error: result.error });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
