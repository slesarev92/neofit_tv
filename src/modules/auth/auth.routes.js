const { Router } = require('express');
const { body } = require('express-validator');
const authService = require('./auth.service');
const { loginLimiter } = require('../../middleware/rateLimit');
const { requireAuth } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const logger = require('../../utils/logger');

const router = Router();

router.post('/login', loginLimiter, validate([
  body('password').notEmpty().withMessage('Пароль обязателен'),
]), async (req, res, next) => {
  try {
    const { password } = req.body;
    const valid = await authService.verifyPassword(password || '');

    if (!valid) {
      logger.warn('Failed login attempt', { ip: req.ip });
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    const totpEnabled = await authService.isTotpEnabled();
    if (!totpEnabled) {
      req.session.authenticated = true;
      logger.info('Successful login (no 2FA)', { ip: req.ip });
      return res.json({ ok: true, step: 'done' });
    }

    req.session.preAuth = true;
    logger.info('Password accepted, waiting for TOTP', { ip: req.ip });
    return res.json({ ok: true, step: 'totp' });
  } catch (err) {
    next(err);
  }
});

router.post('/verify-totp', loginLimiter, async (req, res, next) => {
  try {
    if (!req.session || !req.session.preAuth) {
      return res.status(401).json({ error: 'Сначала введите пароль' });
    }
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ error: 'Код обязателен' });
    }

    const valid = await authService.verifyTotp(token);
    if (!valid) {
      logger.warn('Failed TOTP attempt', { ip: req.ip });
      return res.status(401).json({ error: 'Неверный код' });
    }

    req.session.preAuth = false;
    req.session.authenticated = true;
    logger.info('Successful login (2FA)', { ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.json({ ok: true });
  });
});

router.put('/password', requireAuth, validate([
  body('currentPassword').notEmpty().withMessage('Текущий пароль обязателен'),
  body('newPassword').notEmpty().withMessage('Новый пароль обязателен').isLength({ min: 8 }).withMessage('Новый пароль не менее 8 символов'),
]), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(currentPassword, newPassword);

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    logger.info('Password changed', { ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/totp/setup', requireAuth, async (req, res, next) => {
  try {
    const result = await authService.setupTotp();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/totp/enable', requireAuth, validate([
  body('secret').notEmpty().withMessage('Секрет обязателен'),
  body('token').notEmpty().withMessage('Код обязателен'),
]), async (req, res, next) => {
  try {
    const { secret, token } = req.body;

    const result = await authService.enableTotp(secret, token);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    logger.info('2FA enabled', { ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/totp/disable', requireAuth, validate([
  body('password').notEmpty().withMessage('Пароль обязателен'),
]), async (req, res, next) => {
  try {
    const { password } = req.body;
    const result = await authService.disableTotp(password);
    if (!result.ok) {
      return res.status(401).json({ error: result.error });
    }
    logger.info('2FA disabled', { ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/totp/status', requireAuth, async (req, res, next) => {
  try {
    const enabled = await authService.isTotpEnabled();
    res.json({ enabled });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
