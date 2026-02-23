const { Router } = require('express');
const { body } = require('express-validator');
const screensService = require('./screens.service');
const { validate } = require('../../middleware/validate');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const items = await screensService.list();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate([
  body('name').trim().notEmpty().withMessage('Название экрана обязательно'),
]), async (req, res, next) => {
  try {
    const result = await screensService.create(req.body);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(201).json({ item: result.item });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await screensService.getById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Экран не найден' });
    }
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validate([
  body('name').optional().trim().notEmpty().withMessage('Название не может быть пустым'),
  body('playlistId').optional({ values: 'null' }),
]), async (req, res, next) => {
  try {
    const result = await screensService.update(req.params.id, req.body);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({ item: result.item });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await screensService.remove(req.params.id);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
