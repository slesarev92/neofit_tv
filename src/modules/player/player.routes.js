const { Router } = require('express');
const playerService = require('./player.service');
const { playerLimiter } = require('../../middleware/rateLimit');

const router = Router();

router.get('/:screenId', playerLimiter, async (req, res, next) => {
  try {
    const rawScreenId = req.params.screenId;
    const screenId = rawScreenId && rawScreenId.trim();
    const data = await playerService.getPlayerData(screenId);
    if (!data) {
      return res.status(404).json({ error: 'Экран не найден' });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
