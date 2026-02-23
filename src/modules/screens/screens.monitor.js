const https = require('https');
const screensRepository = require('./screens.repository');
const settingsRepository = require('../settings/settings.repository');
const logger = require('../../utils/logger');

const previousStates = new Map();
let initialized = false;

function sendTelegram(token, chatId, text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(body);
        else reject(new Error(`Telegram API ${res.statusCode}: ${body}`));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getIsOnline(screen, thresholdSec) {
  if (!screen.lastSeenAt) return false;
  return (Date.now() - new Date(screen.lastSeenAt).getTime()) <= thresholdSec * 1000;
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
      }

      if (settings.telegramEnabled && settings.telegramBotToken && settings.telegramChatId) {
        if (wasOnline && !isOnline) {
          const lastSeen = screen.lastSeenAt
            ? new Date(screen.lastSeenAt).toLocaleString('ru-RU')
            : 'никогда';
          const msg = `⚠️ <b>Экран оффлайн</b>\n\n📺 ${screen.name}\n🕐 Последняя активность: ${lastSeen}`;
          try {
            await sendTelegram(settings.telegramBotToken, settings.telegramChatId, msg);
            logger.info('Telegram: screen offline alert sent', { screen: screen.name });
          } catch (err) {
            logger.error('Telegram send failed', { error: err.message });
          }
        }

        if (!wasOnline && isOnline) {
          const msg = `✅ <b>Экран онлайн</b>\n\n📺 ${screen.name}`;
          try {
            await sendTelegram(settings.telegramBotToken, settings.telegramChatId, msg);
            logger.info('Telegram: screen online alert sent', { screen: screen.name });
          } catch (err) {
            logger.error('Telegram send failed', { error: err.message });
          }
        }
      }

      previousStates.set(screen.id, isOnline);
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
