const { Router } = require('express');
const { body } = require('express-validator');
const pairService = require('./pair.service');
const { requireAuth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');

const router = Router();

router.post('/init', async (req, res, next) => {
  try {
    const result = await pairService.init();
    if (result.ok === false) {
      return res.status(503).json({ error: result.error });
    }
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    const result = await pairService.getStatus(req.params.code);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:code/confirm', requireAuth, validate([
  body().custom((val, { req }) => {
    const hasScreenId = req.body.screenId != null && String(req.body.screenId).trim() !== '';
    const hasNewName = req.body.newScreenName != null && String(req.body.newScreenName).trim() !== '';
    if (!hasScreenId && !hasNewName) {
      throw new Error('Укажите screenId или newScreenName');
    }
    return true;
  }),
]), async (req, res, next) => {
  try {
    const result = await pairService.confirm(req.params.code, req.body);
    if (!result.ok) {
      const status = result.error === 'Экран не найден' ? 404 : 400;
      return res.status(status).json({ error: result.error });
    }
    res.json({
      ok: true,
      screenId: result.screenId,
      screenName: result.screenName,
      playlistId: result.playlistId || null,
      playlistName: result.playlistName || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
