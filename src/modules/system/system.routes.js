const { Router } = require('express');
const systemService = require('./system.service');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const stats = await systemService.getSystemStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
