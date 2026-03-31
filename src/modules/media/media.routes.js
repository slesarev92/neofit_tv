const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const config = require('../../config');
const mediaService = require('./media.service');
const settingsRepository = require('../settings/settings.repository');

const router = Router();
const uploadDest = path.join(os.tmpdir(), 'signage-uploads');

async function uploadSingle(req, res, next) {
  try {
    const settings = await settingsRepository.get();
    const rawMb = settings.maxFileSizeMb != null ? settings.maxFileSizeMb : config.maxFileSizeMb;
    const limitMb = Math.min(2000, Math.max(10, Number(rawMb) || config.maxFileSizeMb || 500));
    const upload = multer({
      dest: uploadDest,
      limits: { fileSize: limitMb * 1024 * 1024 },
    });
    upload.single('file')(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  } catch (err) {
    next(err);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const items = await mediaService.list();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/status', async (req, res, next) => {
  try {
    const status = await mediaService.getStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ error: 'Медиафайл не найден' });
    }
    res.json(status);
  } catch (err) {
    next(err);
  }
});

router.post('/', uploadSingle, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    const result = await mediaService.upload(req.file);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(201).json({ item: result.item });
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Файл слишком большой' });
    }
    next(err);
  }
});

router.delete('/queue', async (req, res, next) => {
  try {
    const result = await mediaService.cancelQueue();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await mediaService.remove(req.params.id);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
