const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const settingsService = require('./settings.service');

const router = Router();
const uploadDir = path.join(os.tmpdir(), 'signage-logo-uploads');
const uploadLogoFile = multer({
  dest: uploadDir,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype && file.mimetype.startsWith('image/');
    cb(null, !!ok);
  },
}).single('logo');

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

module.exports = router;
