const { Router } = require('express');
const { body } = require('express-validator');
const playlistsService = require('./playlists.service');
const { validate } = require('../../middleware/validate');

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const items = await playlistsService.list();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate([
  body('name').trim().notEmpty().withMessage('Название плейлиста обязательно'),
  body('items').optional().isArray().withMessage('items должен быть массивом'),
]), async (req, res, next) => {
  try {
    const result = await playlistsService.create(req.body);
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
    const item = await playlistsService.getById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Плейлист не найден' });
    }
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validate([
  body('name').optional().trim().notEmpty().withMessage('Название не может быть пустым'),
  body('items').optional().isArray().withMessage('items должен быть массивом'),
]), async (req, res, next) => {
  try {
    const result = await playlistsService.update(req.params.id, req.body);
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
    const result = await playlistsService.remove(req.params.id);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
