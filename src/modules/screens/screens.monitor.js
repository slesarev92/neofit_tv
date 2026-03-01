const screensRepository = require('./screens.repository');
const settingsRepository = require('../settings/settings.repository');
const playlistsRepository = require('../playlists/playlists.repository');
const config = require('../../config');
const logger = require('../../utils/logger');
const { escapeForTelegramHtml, sendTelegram } = require('../../utils/telegram');

const previousStates = new Map();
let initialized = false;

function getIsOnline(screen, thresholdSec) {
  if (!screen.lastSeenAt) return false;
  return (Date.now() - new Date(screen.lastSeenAt).getTime()) <= thresholdSec * 1000;
}

function shortId(id) {
  if (!id || typeof id !== 'string') return '—';
  return id.length > 8 ? id.slice(-8) : id;
}

async function getPlaylistName(playlistId) {
  if (!playlistId) return null;
  try {
    const p = await playlistsRepository.findById(playlistId);
    return p ? p.name : null;
  } catch {
    return null;
  }
}

function adminLinkLine() {
  const base = (config.baseUrl || '').trim();
  if (!base) return '';
  const url = base.replace(/\/$/, '') + '/admin/screens.html';
  return `\n\n🔗 <a href="${escapeForTelegramHtml(url)}">Открыть экраны в админке</a>`;
}

async function checkScreens() {
  try {
    const settings = await settingsRepository.get();
    const screens = await screensRepository.findAll();
    let thresholdSec;
    if (settings.onlineThresholdMultiplier != null && Number(settings.onlineThresholdMultiplier) > 0) {
      thresholdSec = (settings.pollInterval || 10) * Number(settings.onlineThresholdMultiplier);
    } else {
      thresholdSec = settings.onlineThreshold || (settings.pollInterval || 10) + 5;
    }

    const offlineScreens = [];
    const onlineScreens = [];

    for (const screen of screens) {
      const wasOnline = previousStates.get(screen.id);
      const isOnline = getIsOnline(screen, thresholdSec);

      if (!initialized) {
        previousStates.set(screen.id, isOnline);
        continue;
      }

      if (wasOnline !== isOnline) {
        logger.info('Screen status changed', {
          screen: screen.name,
          from: wasOnline ? 'online' : 'offline',
          to: isOnline ? 'online' : 'offline',
        });
        if (wasOnline && !isOnline) offlineScreens.push(screen);
        if (!wasOnline && isOnline) onlineScreens.push(screen);
      }

      previousStates.set(screen.id, isOnline);
    }

    if (settings.telegramEnabled && settings.telegramBotToken && settings.telegramChatId) {
      const linkLine = adminLinkLine();

      if (offlineScreens.length > 0) {
        const lines = [];
        for (const screen of offlineScreens) {
          const name = escapeForTelegramHtml(screen.name);
          const idShort = shortId(screen.id);
          const playlist = await getPlaylistName(screen.playlistId);
          const playlistStr = playlist ? escapeForTelegramHtml(playlist) : '—';
          const lastSeen = screen.lastSeenAt
            ? new Date(screen.lastSeenAt).toLocaleString('ru-RU')
            : 'никогда';
          lines.push(`📺 ${name}\n   ID: <code>${idShort}</code>   Плейлист: ${playlistStr}\n   🕐 Последняя активность: ${lastSeen}`);
        }
        const title = offlineScreens.length === 1
          ? '⚠️ <b>Экран оффлайн</b>'
          : `⚠️ <b>Экраны оффлайн (${offlineScreens.length})</b>`;
        const msg = title + '\n\n' + lines.join('\n\n') + linkLine;
        try {
          await sendTelegram(settings.telegramBotToken, settings.telegramChatId, msg, { retries: 2 });
          logger.info('Telegram: screen offline alert sent', { count: offlineScreens.length, screens: offlineScreens.map((s) => s.name) });
        } catch (err) {
          logger.error('Telegram send failed', { error: err.message });
        }
      }

      if (onlineScreens.length > 0) {
        const lines = [];
        for (const screen of onlineScreens) {
          const name = escapeForTelegramHtml(screen.name);
          const idShort = shortId(screen.id);
          const playlist = await getPlaylistName(screen.playlistId);
          const playlistStr = playlist ? escapeForTelegramHtml(playlist) : '—';
          lines.push(`📺 ${name}   ID: <code>${idShort}</code>   Плейлист: ${playlistStr}`);
        }
        const title = onlineScreens.length === 1
          ? '✅ <b>Экран онлайн</b>'
          : `✅ <b>Экраны онлайн (${onlineScreens.length})</b>`;
        const msg = title + '\n\n' + lines.join('\n') + linkLine;
        try {
          await sendTelegram(settings.telegramBotToken, settings.telegramChatId, msg, { retries: 2 });
          logger.info('Telegram: screen online alert sent', { count: onlineScreens.length, screens: onlineScreens.map((s) => s.name) });
        } catch (err) {
          logger.error('Telegram send failed', { error: err.message });
        }
      }
    }

    if (!initialized) {
      initialized = true;
      logger.info('Screen monitor initialized', {
        screens: screens.map((s) => `${s.name}: ${getIsOnline(s, thresholdSec) ? 'online' : 'offline'}`),
      });
    }
  } catch (err) {
    logger.error('Screen monitor error', { error: err.message });
  }
}

function start() {
  checkScreens();
  settingsRepository.get().then((settings) => {
    const sec = settings.monitorCheckIntervalSec != null ? Number(settings.monitorCheckIntervalSec) : 10;
    const intervalMs = Math.max(5, Math.min(120, sec)) * 1000;
    setInterval(checkScreens, intervalMs);
    logger.info('Screen monitor started (checks every ' + intervalMs / 1000 + 's)');
  });
}

module.exports = { start };
