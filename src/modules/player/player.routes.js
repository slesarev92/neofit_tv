const { Router } = require('express');
const playerService = require('./player.service');
const screensRepository = require('../screens/screens.repository');
const { playerLimiter } = require('../../middleware/rateLimit');
const logger = require('../../utils/logger');

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

    // Boot-stage telemetry — player.js drains the native SharedPreferences
    // buffer on the first successful online poll after a reboot. Pure log:
    // there's no playback data here, so we MUST NOT touch playbackMetrics
    // (would overwrite real values with zeros on the next real metrics POST).
    if (m.bootHistory) {
      const bootHistory = String(m.bootHistory).slice(0, 2000);
      logger.info('Player boot-stage history', {
        screenId,
        screenName: screen.name,
        bootHistory,
      });
    }

    // Only persist playbackMetrics if the request actually carries playback
    // data — boot-stage-only POSTs leave the field untouched.
    const hasPlaybackData = m.videoUrl != null || m.totalFrames != null || m.canplayTimeMs != null;
    if (hasPlaybackData) {
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
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
