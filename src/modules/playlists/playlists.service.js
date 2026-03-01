const { v4: uuidv4 } = require('uuid');
const playlistsRepository = require('./playlists.repository');
const mediaRepository = require('../media/media.repository');
const screensRepository = require('../screens/screens.repository');

async function list() {
  return playlistsRepository.findAll();
}

async function getById(id) {
  return playlistsRepository.findById(id);
}

async function validateItems(items) {
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    if (!item.mediaId) return `Не указан mediaId`;
    const media = await mediaRepository.findById(item.mediaId);
    if (!media) return `Медиафайл ${item.mediaId} не найден`;
  }
  return null;
}

function buildItems(items) {
  return (items || []).map((item, idx) => ({
    id: item.id || uuidv4(),
    mediaId: item.mediaId,
    duration: Number(item.duration) || 10,
    order: item.order !== undefined ? item.order : idx,
  }));
}

async function create(data) {
  if (!data.name || !data.name.trim()) {
    return { ok: false, status: 400, error: 'Название обязательно' };
  }

  const validationError = await validateItems(data.items || []);
  if (validationError) {
    return { ok: false, status: 404, error: validationError };
  }

  const playlist = {
    id: uuidv4(),
    name: data.name.trim(),
    items: buildItems(data.items || []),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await playlistsRepository.create(playlist);
  return { ok: true, item: playlist };
}

async function update(id, data) {
  const existing = await playlistsRepository.findById(id);
  if (!existing) {
    return { ok: false, status: 404, error: 'Плейлист не найден' };
  }

  if (data.name !== undefined && (!data.name || !String(data.name).trim())) {
    return { ok: false, status: 400, error: 'Название не может быть пустым' };
  }

  if (data.items) {
    const validationError = await validateItems(data.items);
    if (validationError) {
      return { ok: false, status: 404, error: validationError };
    }
  }

  const updated = await playlistsRepository.update(id, {
    name: data.name !== undefined ? (String(data.name || '').trim() || existing.name) : existing.name,
    items: data.items ? buildItems(data.items) : existing.items,
  });

  return { ok: true, item: updated };
}

async function remove(id) {
  const existing = await playlistsRepository.findById(id);
  if (!existing) {
    return { ok: false, status: 404, error: 'Плейлист не найден' };
  }

  const screens = await screensRepository.findAll();
  for (const screen of screens) {
    if (screen.playlistId === id) {
      return { ok: false, status: 409, error: `Плейлист назначен на экран «${screen.name}»` };
    }
  }

  await playlistsRepository.remove(id);
  return { ok: true };
}

module.exports = { list, getById, create, update, remove };
