const { Router } = require('express');
const settingsService = require('./settings.service');

const router = Router();

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

module.exports = router;
