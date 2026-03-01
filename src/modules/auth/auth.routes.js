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

    req.session.authenticated = true;
    logger.info('Successful login', { ip: req.ip });
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

module.exports = router;
