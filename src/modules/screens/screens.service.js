const { v4: uuidv4 } = require('uuid');
const screensRepository = require('./screens.repository');
const settingsRepository = require('../settings/settings.repository');
const playlistsRepository = require('../playlists/playlists.repository');

function getThresholdSec(settings) {
  const pollInterval = settings.pollInterval || 10;
  let thresholdSec;
  if (settings.onlineThresholdMultiplier != null && Number(settings.onlineThresholdMultiplier) > 0) {
    thresholdSec = pollInterval * Number(settings.onlineThresholdMultiplier);
  } else {
    thresholdSec = settings.onlineThreshold || pollInterval + 5;
  }
  const minThreshold = pollInterval * 2;
  return Math.max(thresholdSec, minThreshold);
}

function isOnline(screen, settings) {
  if (!screen.lastSeenAt) return false;
  const thresholdSec = getThresholdSec(settings);
  return (Date.now() - new Date(screen.lastSeenAt).getTime()) <= thresholdSec * 1000;
}

async function enrichScreen(screen) {
  const settings = await settingsRepository.get();
  return { ...screen, isOnline: isOnline(screen, settings) };
}

async function list() {
  const screens = await screensRepository.findAll();
  const settings = await settingsRepository.get();
  return screens.map((s) => ({ ...s, isOnline: isOnline(s, settings) }));
}

async function getById(id) {
  const screen = await screensRepository.findById(id);
  if (!screen) return null;
  return enrichScreen(screen);
}

async function create(data) {
  const name = data.name != null ? String(data.name).trim() : '';
  if (!name) {
    return { ok: false, status: 400, error: 'Название обязательно' };
  }

  const screen = {
    id: uuidv4(),
    name,
    playlistId: data.playlistId || null,
    createdAt: new Date().toISOString(),
    lastSeenAt: null,
  };

  await screensRepository.create(screen);
  return { ok: true, item: { ...screen, isOnline: false } };
}

async function update(id, data) {
  const existing = await screensRepository.findById(id);
  if (!existing) {
    return { ok: false, status: 404, error: 'Экран не найден' };
  }

  if (data.playlistId != null && data.playlistId !== '') {
    const playlist = await playlistsRepository.findById(data.playlistId);
    if (!playlist) {
      return { ok: false, status: 400, error: 'Плейлист не найден' };
    }
  }

  const updated = await screensRepository.update(id, {
    name: data.name !== undefined ? (String(data.name || '').trim() || existing.name) : existing.name,
    playlistId: data.playlistId !== undefined ? (data.playlistId || null) : existing.playlistId,
  });

  return { ok: true, item: await enrichScreen(updated) };
}

async function remove(id) {
  const existing = await screensRepository.findById(id);
  if (!existing) {
    return { ok: false, status: 404, error: 'Экран не найден' };
  }
  await screensRepository.remove(id);
  return { ok: true };
}

async function updateHeartbeat(screenId) {
  await screensRepository.updateLastSeen(screenId, new Date().toISOString());
}

module.exports = { list, getById, create, update, remove, updateHeartbeat };
