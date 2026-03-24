const path = require('path');
const { spawn } = require('child_process');
const cron = require('node-cron');
const logger = require('../../utils/logger');

const PROJECT_ROOT = path.resolve(path.join(__dirname, '..', '..', '..'));
const BACKUP_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'backup.js');

let scheduledTask = null;

/**
 * Парсит "HH:MM" в { minute, hour }.
 * @param {string} timeStr - время в формате ЧЧ:ММ (24ч)
 * @returns {{ minute: number, hour: number }|null}
 */
function parseTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return null;
  const hour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minute = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return { minute, hour };
}

/**
 * Строит cron-выражение по настройкам (frequency, time, weekday, monthDays).
 * @param {object} settings
 * @returns {string|null}
 */
function buildCronExpression(settings) {
  const timeStr = (settings && settings.backupScheduleTime) || '03:00';
  const t = parseTime(timeStr);
  if (!t) return null;
  const freq = (settings && settings.backupScheduleFrequency) || 'daily';

  if (freq === 'daily') {
    return `${t.minute} ${t.hour} * * *`;
  }
  if (freq === 'weekly') {
    const w = Math.min(6, Math.max(0, parseInt(settings.backupScheduleWeekday, 10) || 0));
    return `${t.minute} ${t.hour} * * ${w}`;
  }
  if (freq === 'monthly') {
    const daysStr = (settings && settings.backupScheduleMonthDays) || '1,10,20';
    const days = daysStr.split(',').map((d) => parseInt(d.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 31);
    if (days.length === 0) return `${t.minute} ${t.hour} 1 * *`;
    const dayPart = [...new Set(days)].sort((a, b) => a - b).join(',');
    return `${t.minute} ${t.hour} ${dayPart} * *`;
  }
  return `${t.minute} ${t.hour} * * *`;
}

/**
 * Запускает скрипт бэкапа в фоне (не блокирует event loop).
 */
function runScheduledBackup() {
  const child = spawn(process.execPath, [BACKUP_SCRIPT], {
    cwd: PROJECT_ROOT,
    env: process.env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('close', (code) => {
    if (code !== 0) {
      logger.error('Scheduled backup failed', { code, stderr: stderr.trim().slice(0, 500) });
    } else {
      logger.info('Scheduled backup completed');
    }
  });
  child.on('error', (err) => {
    logger.error('Scheduled backup spawn error', { error: err.message });
  });

  child.unref();
}

/**
 * Применяет расписание из настроек: включает или выключает ежедневный бэкап.
 * @param {object} settings - объект настроек (backupScheduleEnabled, backupScheduleTime, timezone)
 */
function startScheduler(settings) {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  const enabled = settings && settings.backupScheduleEnabled === true;
  if (!enabled) return;

  const cronExpr = buildCronExpression(settings);
  if (!cronExpr) return;

  const timezone = (settings && settings.timezone) || 'Europe/Moscow';

  scheduledTask = cron.schedule(
    cronExpr,
    () => runScheduledBackup(),
    { timezone }
  );
}

/**
 * Перечитывает настройки и применяет расписание (вызвать после сохранения настроек).
 * @param {object} settings - актуальные настройки после сохранения
 */
function reschedule(settings) {
  startScheduler(settings || {});
}

module.exports = { startScheduler, reschedule };
