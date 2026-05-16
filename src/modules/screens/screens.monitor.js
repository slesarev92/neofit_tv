const cron = require('node-cron');
const screensRepository = require('./screens.repository');
const settingsRepository = require('../settings/settings.repository');
const playlistsRepository = require('../playlists/playlists.repository');
const config = require('../../config');
const logger = require('../../utils/logger');
const { escapeForTelegramHtml, sendTelegram } = require('../../utils/telegram');

const previousStates = new Map();
let initialized = false;
let isRunning = false;
let runningSince = 0;
let runningToken = 0;
let dailyReportTask = null;
// sendTelegram has 8s timeout × 3 attempts + backoff, ~32s worst case per call,
// and checkScreens may call it twice (offline + online), so up to ~64s.
// 90s gives headroom while still allowing recovery if a check truly hangs.
const MAX_CHECK_DURATION_MS = 90 * 1000;

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
  if (isRunning) {
    if (runningSince && Date.now() - runningSince > MAX_CHECK_DURATION_MS) {
      logger.warn('Previous screen monitor check appears stuck, forcing release', {
        stuckForMs: Date.now() - runningSince,
      });
      // fall through to start a fresh check; orphan check is abandoned
    } else {
      return;
    }
  }
  isRunning = true;
  runningSince = Date.now();
  const myToken = ++runningToken;
  try {
    const settings = await settingsRepository.get();
    const screens = await screensRepository.findAll();
    const pollInterval = settings.pollInterval || 10;
    const requestedThreshold = settings.onlineThreshold || pollInterval + 5;
    const thresholdSec = Math.max(requestedThreshold, pollInterval * 2);

    const offlineScreens = [];

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
      }

      previousStates.set(screen.id, isOnline);
    }

    if (offlineScreens.length > 0 && settings.telegramEnabled && settings.telegramBotToken && settings.telegramChatId) {
      const linkLine = adminLinkLine();
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

    if (!initialized) {
      initialized = true;
      logger.info('Screen monitor initialized', {
        screens: screens.map((s) => `${s.name}: ${getIsOnline(s, thresholdSec) ? 'online' : 'offline'}`),
      });
    }
  } catch (err) {
    logger.error('Screen monitor error', { error: err.message });
  } finally {
    // Only the current check releases the lock — if a stuck previous check
    // resolves after timeout-forced release, its token no longer matches and
    // it must not clobber a newer check that took over.
    if (myToken === runningToken) {
      isRunning = false;
      runningSince = 0;
    }
  }
}

async function sendDailyReport() {
  try {
    const settings = await settingsRepository.get();
    if (!settings.telegramEnabled || !settings.telegramBotToken || !settings.telegramChatId) return;

    const screens = await screensRepository.findAll();
    const pollInterval = settings.pollInterval || 10;
    const requestedThreshold = settings.onlineThreshold || pollInterval + 5;
    const thresholdSec = Math.max(requestedThreshold, pollInterval * 2);

    let online = 0;
    let offline = 0;
    for (const screen of screens) {
      if (getIsOnline(screen, thresholdSec)) online += 1;
      else offline += 1;
    }

    const msg = `📊 <b>Утренний отчёт</b>\n\nОнлайн: ${online}\nОфлайн: ${offline}`;
    await sendTelegram(settings.telegramBotToken, settings.telegramChatId, msg, { retries: 2 });
    logger.info('Telegram: daily report sent', { online, offline });
  } catch (err) {
    logger.error('Daily report failed', { error: err.message });
  }
}

function rescheduleDailyReport(settings) {
  if (dailyReportTask) {
    dailyReportTask.stop();
    dailyReportTask = null;
  }
  if (!settings || !settings.telegramEnabled || !settings.telegramBotToken || !settings.telegramChatId) return;
  const timezone = settings.timezone || 'Europe/Moscow';
  dailyReportTask = cron.schedule('0 9 * * *', () => sendDailyReport(), { timezone });
  logger.info('Daily report scheduled', { time: '09:00', timezone });
}

function start() {
  checkScreens();
  settingsRepository.get().then((settings) => {
    const sec = settings.monitorCheckIntervalSec != null ? Number(settings.monitorCheckIntervalSec) : 10;
    const intervalMs = Math.max(5, Math.min(120, sec)) * 1000;
    setInterval(checkScreens, intervalMs);
    logger.info('Screen monitor started (checks every ' + intervalMs / 1000 + 's)');
    rescheduleDailyReport(settings);
  });
}

module.exports = { start, rescheduleDailyReport };
