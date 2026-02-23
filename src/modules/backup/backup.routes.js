const { Router } = require('express');
const backupService = require('./backup.service');

const router = Router();

router.post('/run', async (req, res, next) => {
  try {
    const result = backupService.runBackup();
    if (result.ok) {
      res.json({ ok: true, message: 'Бэкап создан' });
    } else {
      res.status(500).json({ ok: false, error: result.error });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
