const pairRepository = require('./pair.repository');
const screensService = require('../screens/screens.service');
const playlistsService = require('../playlists/playlists.service');

const CODE_ALPHABET = 'ABCDEFGHJKLMN PQRSTUVWXYZ23456789'.replace(/\s/g, '');
const CODE_LENGTH = 6;
const TTL_SEC = 600;

function generateCode() {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

async function cleanExpired() {
  await pairRepository.removeExpired();
}

const MAX_CODE_ATTEMPTS = 50;

async function init() {
  await cleanExpired();
  const existing = await pairRepository.findAll();
  let code;
  let attempts = 0;
  do {
    code = generateCode();
    if (existing.some((r) => r.code === code)) code = null;
    attempts++;
  } while (!code && attempts < MAX_CODE_ATTEMPTS);
  if (!code) {
    return { ok: false, error: 'Не удалось сгенерировать код, попробуйте позже' };
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_SEC * 1000).toISOString();
  const record = {
    code,
    screenId: null,
    createdAt: now.toISOString(),
    expiresAt,
  };
  await pairRepository.create(record);
  return { code, expiresIn: TTL_SEC };
}

async function getStatus(code) {
  await cleanExpired();
  const record = await pairRepository.findByCode(code);
  if (!record) {
    return { status: 'expired' };
  }
  const now = new Date().toISOString();
  if (record.expiresAt && record.expiresAt < now) {
    await pairRepository.removeExpired();
    return { status: 'expired' };
  }
  if (record.screenId == null) {
    return { status: 'waiting', expiresAt: record.expiresAt };
  }
  const screen = await screensService.getById(record.screenId);
  if (!screen) {
    return { status: 'expired' };
  }
  return {
    status: 'paired',
    screenId: screen.id,
    screenName: screen.name,
  };
}

async function confirm(code, body) {
  await cleanExpired();
  const record = await pairRepository.findByCode(code);
  if (!record) {
    return { ok: false, error: 'Код не найден или истёк' };
  }
  const now = new Date().toISOString();
  if (record.expiresAt && record.expiresAt < now) {
    await pairRepository.removeExpired();
    return { ok: false, error: 'Код не найден или истёк' };
  }
  let screenId;
  let screenName;
  if (body.newScreenName != null && String(body.newScreenName).trim()) {
    const createResult = await screensService.create({ name: body.newScreenName.trim() });
    if (!createResult.ok) {
      return { ok: false, error: createResult.error || 'Не удалось создать экран' };
    }
    screenId = createResult.item.id;
    screenName = createResult.item.name;
  } else if (body.screenId) {
    const screen = await screensService.getById(body.screenId);
    if (!screen) {
      return { ok: false, error: 'Экран не найден' };
    }
    screenId = screen.id;
    screenName = screen.name;
  } else {
    return { ok: false, error: 'Укажите screenId или newScreenName' };
  }
  await pairRepository.updateScreenId(code, screenId);
  let playlistId = null;
  let playlistName = null;
  const screen = await screensService.getById(screenId);
  if (screen && screen.playlistId) {
    playlistId = screen.playlistId;
    const playlist = await playlistsService.getById(screen.playlistId);
    if (playlist) playlistName = playlist.name;
  }
  return { ok: true, screenId, screenName, playlistId, playlistName };
}

module.exports = { init, getStatus, confirm, cleanExpired };
