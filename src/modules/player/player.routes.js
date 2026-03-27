const { Router } = require('express');
const playerService = require('./player.service');
const screensRepository = require('../screens/screens.repository');
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

router.post('/:screenId/metrics', playerLimiter, async (req, res, next) => {
  try {
    const screenId = req.params.screenId && req.params.screenId.trim();
    const screen = await screensRepository.findById(screenId);
    if (!screen) return res.status(404).json({ error: 'Экран не найден' });

    const m = req.body || {};
    const metrics = {
      droppedFrames: Number(m.droppedFrames) || 0,
      totalFrames: Number(m.totalFrames) || 0,
      dropPercent: Number(m.dropPercent) || 0,
      blobTimeMs: Number(m.blobTimeMs) || 0,
      canplayTimeMs: Number(m.canplayTimeMs) || 0,
      fromCache: !!m.fromCache,
      fileSizeKb: Number(m.fileSizeKb) || 0,
      videoUrl: String(m.videoUrl || '').slice(0, 200),
      ts: new Date().toISOString(),
    };

    await screensRepository.update(screenId, { playbackMetrics: metrics });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
