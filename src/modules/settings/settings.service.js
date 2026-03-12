const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const settingsRepository = require('./settings.repository');

async function copyFileAtomic(srcPath, destPath) {
  const tmpPath = destPath + '.' + process.pid + '.' + Date.now() + '.tmp';
  try {
    await fs.copyFile(srcPath, tmpPath);
    await fs.rename(tmpPath, destPath);
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 МБ для логотипа
const LOGO_BASE_NAME = 'system-logo';
const OFF_HOURS_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 МБ для заставки
const OFF_HOURS_IMAGE_BASE_NAME = 'work-schedule-off';

function extFromMime(mime) {
  if (!mime) return '.png';
  const m = mime.toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return '.jpg';
  if (m === 'image/png') return '.png';
  if (m === 'image/webp') return '.webp';
  if (m === 'image/svg+xml') return '.svg';
  return '.png';
}

function validate(data) {
  const errors = [];
  if (data.imageDuration !== undefined) {
    const v = Number(data.imageDuration);
    if (!Number.isInteger(v) || v < 1 || v > 3600) errors.push('imageDuration: 1–3600');
  }
  if (data.pollInterval !== undefined) {
    const v = Number(data.pollInterval);
    if (!Number.isInteger(v) || v < 5 || v > 3600) errors.push('pollInterval: 5–3600');
  }
  if (data.onlineThreshold !== undefined) {
    const v = Number(data.onlineThreshold);
    if (!Number.isInteger(v) || v < 5 || v > 300) errors.push('onlineThreshold: 5–300');
  }
  if (data.requestTimeout !== undefined) {
    const v = Number(data.requestTimeout);
    if (!Number.isInteger(v) || v < 1 || v > 120) errors.push('requestTimeout: 1–120');
  }
  if (data.maxRetries !== undefined) {
    const v = Number(data.maxRetries);
    if (!Number.isInteger(v) || v < 0 || v > 10) errors.push('maxRetries: 0–10');
  }
  const timeRegex = /^\d{1,2}:\d{2}$/;
  if (data.autoReloadAt !== undefined && data.autoReloadAt !== null && data.autoReloadAt !== '') {
    if (!timeRegex.test(String(data.autoReloadAt).trim())) errors.push('autoReloadAt: формат ЧЧ:ММ');
  }
  if (data.workScheduleEnabled) {
    const fromStr = data.workScheduleFrom != null && data.workScheduleFrom !== '' ? String(data.workScheduleFrom).trim() : '';
    const toStr = data.workScheduleTo != null && data.workScheduleTo !== '' ? String(data.workScheduleTo).trim() : '';
    if (!fromStr || !timeRegex.test(fromStr)) errors.push('workScheduleFrom: укажите время в формате ЧЧ:ММ');
    if (!toStr || !timeRegex.test(toStr)) errors.push('workScheduleTo: укажите время в формате ЧЧ:ММ');
  } else {
    if (data.workScheduleFrom !== undefined && data.workScheduleFrom !== null && data.workScheduleFrom !== '') {
      if (!timeRegex.test(String(data.workScheduleFrom).trim())) errors.push('workScheduleFrom: формат ЧЧ:ММ');
    }
    if (data.workScheduleTo !== undefined && data.workScheduleTo !== null && data.workScheduleTo !== '') {
      if (!timeRegex.test(String(data.workScheduleTo).trim())) errors.push('workScheduleTo: формат ЧЧ:ММ');
    }
  }
  if (data.videoCrf !== undefined) {
    const v = Number(data.videoCrf);
    if (!Number.isInteger(v) || v < 18 || v > 28) errors.push('videoCrf: 18–28');
  }
  if (data.videoMaxWidth !== undefined && data.videoMaxWidth !== null && data.videoMaxWidth !== '' && Number(data.videoMaxWidth) !== 0) {
    const v = Number(data.videoMaxWidth);
    if (!Number.isInteger(v) || v < 320 || v > 4096) errors.push('videoMaxWidth: 320–4096');
  }
  if (data.monitorCheckIntervalSec !== undefined) {
    const v = Number(data.monitorCheckIntervalSec);
    if (!Number.isInteger(v) || v < 5 || v > 120) errors.push('monitorCheckIntervalSec: 5–120');
  }
  if (data.onlineThresholdMultiplier !== undefined && data.onlineThresholdMultiplier !== null && data.onlineThresholdMultiplier !== '') {
    const v = Number(data.onlineThresholdMultiplier);
    if (!Number.isFinite(v) || v < 1 || v > 5) errors.push('onlineThresholdMultiplier: 1–5');
  }
  if (data.maxFileSizeMb !== undefined) {
    const v = Number(data.maxFileSizeMb);
    if (!Number.isInteger(v) || v < 10 || v > 2000) errors.push('maxFileSizeMb: 10–2000');
  }
  if (data.backupKeepCount !== undefined) {
    const v = Number(data.backupKeepCount);
    if (!Number.isInteger(v) || v < 10 || v > 90) errors.push('backupKeepCount: 10–90');
  }
  if (data.backupScheduleTime !== undefined && data.backupScheduleTime !== null && data.backupScheduleTime !== '') {
    if (!timeRegex.test(String(data.backupScheduleTime).trim())) errors.push('backupScheduleTime: формат ЧЧ:ММ');
  }
  const freqOk = ['daily', 'weekly', 'monthly'].includes(data.backupScheduleFrequency);
  if (data.backupScheduleFrequency !== undefined && !freqOk) errors.push('backupScheduleFrequency: daily, weekly или monthly');
  if (data.backupScheduleWeekday !== undefined) {
    const w = Number(data.backupScheduleWeekday);
    if (!Number.isInteger(w) || w < 0 || w > 6) errors.push('backupScheduleWeekday: 0–6 (0 = вс)');
  }
  if (data.backupScheduleMonthDays !== undefined && data.backupScheduleMonthDays !== null && data.backupScheduleMonthDays !== '') {
    const str = String(data.backupScheduleMonthDays).trim();
    const parts = str.split(',').map((p) => parseInt(p.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 31);
    if (parts.length === 0) errors.push('backupScheduleMonthDays: числа 1–31 через запятую');
  }
  return errors;
}

async function get() {
  return settingsRepository.get();
}

async function update(data) {
  const errors = validate(data);
  if (errors.length > 0) {
    return { ok: false, status: 400, error: errors.join('; ') };
  }

  const sanitized = {};
  function setNum(key, val, min, max) {
    const v = Number(val);
    if (!Number.isFinite(v)) return;
    if (min != null && v < min) return;
    if (max != null && v > max) return;
    sanitized[key] = min != null && max != null && Number.isInteger(min) && Number.isInteger(max) ? Math.round(v) : v;
  }
  if (data.imageDuration !== undefined) setNum('imageDuration', data.imageDuration, 1, 3600);
  if (data.pollInterval !== undefined) setNum('pollInterval', data.pollInterval, 5, 3600);
  if (data.onlineThreshold !== undefined) setNum('onlineThreshold', data.onlineThreshold, 5, 300);
  if (data.requestTimeout !== undefined) setNum('requestTimeout', data.requestTimeout, 1, 120);
  if (data.maxRetries !== undefined) setNum('maxRetries', data.maxRetries, 0, 10);
  if (data.prefetchEnabled !== undefined) sanitized.prefetchEnabled = Boolean(data.prefetchEnabled);
  if (data.cacheEnabled !== undefined) sanitized.cacheEnabled = Boolean(data.cacheEnabled);
  if (data.showLastOnError !== undefined) sanitized.showLastOnError = Boolean(data.showLastOnError);
  if (data.telegramEnabled !== undefined) sanitized.telegramEnabled = Boolean(data.telegramEnabled);
  if (data.telegramBotToken !== undefined) sanitized.telegramBotToken = String(data.telegramBotToken || '');
  if (data.telegramChatId !== undefined) sanitized.telegramChatId = String(data.telegramChatId || '');
  if (data.autoReloadAt !== undefined) sanitized.autoReloadAt = data.autoReloadAt === null || data.autoReloadAt === '' ? null : String(data.autoReloadAt).trim();
  if (data.workScheduleEnabled !== undefined) sanitized.workScheduleEnabled = Boolean(data.workScheduleEnabled);
  if (data.workScheduleFrom !== undefined) sanitized.workScheduleFrom = data.workScheduleFrom === null || data.workScheduleFrom === '' ? null : String(data.workScheduleFrom).trim();
  if (data.workScheduleTo !== undefined) sanitized.workScheduleTo = data.workScheduleTo === null || data.workScheduleTo === '' ? null : String(data.workScheduleTo).trim();
  if (data.workScheduleOffImageUrl !== undefined) sanitized.workScheduleOffImageUrl = data.workScheduleOffImageUrl === null || data.workScheduleOffImageUrl === '' ? null : String(data.workScheduleOffImageUrl).trim();
  if (data.systemName !== undefined) sanitized.systemName = String(data.systemName || '').trim() || 'NeoFit TV';
  if (data.logoUrl !== undefined) sanitized.logoUrl = data.logoUrl === null || data.logoUrl === '' ? null : String(data.logoUrl).trim();
  if (data.timezone !== undefined) sanitized.timezone = String(data.timezone || '').trim() || 'Europe/Moscow';
  if (data.videoCrf !== undefined) setNum('videoCrf', data.videoCrf, 18, 28);
  if (data.videoMaxWidth !== undefined) {
    if (data.videoMaxWidth === null || data.videoMaxWidth === '' || Number(data.videoMaxWidth) === 0) {
      sanitized.videoMaxWidth = null;
    } else {
      const v = Number(data.videoMaxWidth);
      if (Number.isInteger(v) && v >= 320 && v <= 4096) sanitized.videoMaxWidth = v;
    }
  }
  if (data.monitorCheckIntervalSec !== undefined) setNum('monitorCheckIntervalSec', data.monitorCheckIntervalSec, 5, 120);
  if (data.onlineThresholdMultiplier !== undefined) {
    if (data.onlineThresholdMultiplier === null || data.onlineThresholdMultiplier === '') {
      sanitized.onlineThresholdMultiplier = null;
    } else {
      const v = Number(data.onlineThresholdMultiplier);
      if (Number.isFinite(v) && v >= 1 && v <= 5) sanitized.onlineThresholdMultiplier = v;
    }
  }
  if (data.maxFileSizeMb !== undefined) setNum('maxFileSizeMb', data.maxFileSizeMb, 10, 2000);
  if (data.backupKeepCount !== undefined) sanitized.backupKeepCount = Math.min(90, Math.max(10, Math.round(Number(data.backupKeepCount)) || 30));
  if (data.backupScheduleEnabled !== undefined) sanitized.backupScheduleEnabled = Boolean(data.backupScheduleEnabled);
  if (data.backupScheduleTime !== undefined) sanitized.backupScheduleTime = (data.backupScheduleTime === null || data.backupScheduleTime === '') ? '03:00' : String(data.backupScheduleTime).trim();
  if (data.backupScheduleFrequency !== undefined) sanitized.backupScheduleFrequency = ['daily', 'weekly', 'monthly'].includes(data.backupScheduleFrequency) ? data.backupScheduleFrequency : 'daily';
  if (data.backupScheduleWeekday !== undefined) sanitized.backupScheduleWeekday = Math.min(6, Math.max(0, parseInt(data.backupScheduleWeekday, 10) || 0));
  if (data.backupScheduleMonthDays !== undefined && data.backupScheduleMonthDays !== null && data.backupScheduleMonthDays !== '') {
    const parts = String(data.backupScheduleMonthDays).trim().split(',').map((p) => parseInt(p.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 31);
    sanitized.backupScheduleMonthDays = [...new Set(parts)].sort((a, b) => a - b).join(',') || '1,10,20';
  }

  const settings = await settingsRepository.save(sanitized);
  return { ok: true, settings };
}

async function uploadLogo(file) {
  if (!file || !file.path) {
    return { ok: false, status: 400, error: 'Файл не загружен' };
  }
  const stat = await fs.stat(file.path).catch(() => null);
  if (stat && stat.size > LOGO_MAX_BYTES) {
    await fs.unlink(file.path).catch(() => {});
    return { ok: false, status: 413, error: 'Логотип не более 2 МБ' };
  }
  const ext = extFromMime(file.mimetype);
  const uploadsDir = path.resolve(config.uploadsDir);
  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = LOGO_BASE_NAME + ext;
  const destPath = path.join(uploadsDir, filename);

  try {
    const current = await settingsRepository.get();
    const oldUrl = current.logoUrl;
    if (oldUrl && typeof oldUrl === 'string' && oldUrl.includes(LOGO_BASE_NAME)) {
      const oldName = path.basename(oldUrl.split('?')[0]);
      if (oldName !== filename) {
        const oldPath = path.join(uploadsDir, oldName);
        await fs.unlink(oldPath).catch(() => {});
      }
    }
    await copyFileAtomic(file.path, destPath);
    await fs.unlink(file.path).catch(() => {});
    const url = '/uploads/' + filename;
    await settingsRepository.save({ ...current, logoUrl: url });
    return { ok: true, url };
  } catch (err) {
    await fs.unlink(file.path).catch(() => {});
    throw err;
  }
}

async function uploadOffHoursImage(file) {
  if (!file || !file.path) {
    return { ok: false, status: 400, error: 'Файл не загружен' };
  }
  const stat = await fs.stat(file.path).catch(() => null);
  if (stat && stat.size > OFF_HOURS_IMAGE_MAX_BYTES) {
    await fs.unlink(file.path).catch(() => {});
    return { ok: false, status: 413, error: 'Изображение не более 5 МБ' };
  }
  const ext = extFromMime(file.mimetype);
  const uploadsDir = path.resolve(config.uploadsDir);
  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = OFF_HOURS_IMAGE_BASE_NAME + ext;
  const destPath = path.join(uploadsDir, filename);

  try {
    const current = await settingsRepository.get();
    const oldUrl = current.workScheduleOffImageUrl;
    if (oldUrl && typeof oldUrl === 'string' && oldUrl.includes(OFF_HOURS_IMAGE_BASE_NAME)) {
      const oldName = path.basename(oldUrl.split('?')[0]);
      if (oldName !== filename) {
        const oldPath = path.join(uploadsDir, oldName);
        await fs.unlink(oldPath).catch(() => {});
      }
    }
    await copyFileAtomic(file.path, destPath);
    await fs.unlink(file.path).catch(() => {});
    const url = '/uploads/' + filename;
    await settingsRepository.save({ ...current, workScheduleOffImageUrl: url });
    return { ok: true, url };
  } catch (err) {
    await fs.unlink(file.path).catch(() => {});
    throw err;
  }
}

module.exports = { get, update, uploadLogo, uploadOffHoursImage };
