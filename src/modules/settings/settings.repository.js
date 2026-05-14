const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const { writeJsonAtomic } = require('../../utils/atomicWrite');

const SETTINGS_FILE = () => path.resolve(config.dataDir, 'settings.json');

const DEFAULTS = {
  imageDuration: 10,
  pollInterval: 10,
  onlineThreshold: 30,
  requestTimeout: 10,
  maxRetries: 3,
  prefetchEnabled: true,
  showLastOnError: true,
  telegramBotToken: '',
  telegramChatId: '',
  telegramEnabled: false,
  autoReloadAt: '04:00',
  workScheduleEnabled: false,
  workScheduleFrom: null,
  workScheduleTo: null,
  workScheduleOffImageUrl: null,
  systemName: 'NeoFit TV',
  logoUrl: null,
  timezone: 'Europe/Moscow',
  videoCrf: 23,
  videoMaxWidth: 1920,
  monitorCheckIntervalSec: 10,
  maxFileSizeMb: config.maxFileSizeMb || 500,
  backupKeepCount: 30,
  backupScheduleEnabled: false,
  backupScheduleTime: '03:00',
  backupScheduleFrequency: 'daily',
  backupScheduleWeekday: 0,
  backupScheduleMonthDays: '1,10,20',
  cacheMaxSizeMb: 2048,
};

let cache = null;

async function get() {
  if (cache !== null) {
    const merged = { ...DEFAULTS, ...cache };
    if (merged.maxFileSizeMb == null) merged.maxFileSizeMb = config.maxFileSizeMb || 500;
    return merged;
  }
  try {
    const raw = await fs.readFile(SETTINGS_FILE(), 'utf-8');
    cache = JSON.parse(raw);
    // One-shot migration: onlineThresholdMultiplier was removed. If the data
    // file still has a non-null multiplier, convert it into an absolute
    // onlineThreshold so the user's intent survives the change. Persist
    // asynchronously; if the write fails the same migration runs next start.
    if (cache && cache.onlineThresholdMultiplier != null && Number(cache.onlineThresholdMultiplier) > 0) {
      const pollInterval = Number(cache.pollInterval) || 10;
      const converted = Math.round(pollInterval * Number(cache.onlineThresholdMultiplier));
      cache.onlineThreshold = Math.max(5, Math.min(300, converted));
      delete cache.onlineThresholdMultiplier;
      writeJsonAtomic(SETTINGS_FILE(), cache).catch(() => {});
    } else if (cache && cache.onlineThresholdMultiplier !== undefined) {
      // Stale null/0 multiplier — just drop the key on next write
      delete cache.onlineThresholdMultiplier;
    }
    const merged = { ...DEFAULTS, ...cache };
    if (merged.maxFileSizeMb == null) merged.maxFileSizeMb = config.maxFileSizeMb || 500;
    return merged;
  } catch {
    cache = {};
    const out = { ...DEFAULTS };
    if (out.maxFileSizeMb == null) out.maxFileSizeMb = config.maxFileSizeMb || 500;
    return out;
  }
}

let saveQueue = Promise.resolve();

async function save(settings) {
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    const current = await get();
    const merged = { ...current, ...settings };
    await writeJsonAtomic(SETTINGS_FILE(), merged);
    cache = merged;
    return merged;
  });
  return saveQueue;
}

module.exports = { get, save, DEFAULTS };
