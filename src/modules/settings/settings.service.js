const settingsRepository = require('./settings.repository');

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
  if (data.workScheduleFrom !== undefined && data.workScheduleFrom !== null && data.workScheduleFrom !== '') {
    if (!timeRegex.test(String(data.workScheduleFrom).trim())) errors.push('workScheduleFrom: формат ЧЧ:ММ');
  }
  if (data.workScheduleTo !== undefined && data.workScheduleTo !== null && data.workScheduleTo !== '') {
    if (!timeRegex.test(String(data.workScheduleTo).trim())) errors.push('workScheduleTo: формат ЧЧ:ММ');
  }
  if (data.videoCrf !== undefined) {
    const v = Number(data.videoCrf);
    if (!Number.isInteger(v) || v < 18 || v > 28) errors.push('videoCrf: 18–28');
  }
  if (data.videoMaxWidth !== undefined && data.videoMaxWidth !== null && data.videoMaxWidth !== '') {
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
  if (data.imageDuration !== undefined) sanitized.imageDuration = Number(data.imageDuration);
  if (data.pollInterval !== undefined) sanitized.pollInterval = Number(data.pollInterval);
  if (data.onlineThreshold !== undefined) sanitized.onlineThreshold = Number(data.onlineThreshold);
  if (data.requestTimeout !== undefined) sanitized.requestTimeout = Number(data.requestTimeout);
  if (data.maxRetries !== undefined) sanitized.maxRetries = Number(data.maxRetries);
  if (data.prefetchEnabled !== undefined) sanitized.prefetchEnabled = Boolean(data.prefetchEnabled);
  if (data.cacheEnabled !== undefined) sanitized.cacheEnabled = Boolean(data.cacheEnabled);
  if (data.showLastOnError !== undefined) sanitized.showLastOnError = Boolean(data.showLastOnError);
  if (data.telegramEnabled !== undefined) sanitized.telegramEnabled = Boolean(data.telegramEnabled);
  if (data.telegramBotToken !== undefined) sanitized.telegramBotToken = String(data.telegramBotToken || '');
  if (data.telegramChatId !== undefined) sanitized.telegramChatId = String(data.telegramChatId || '');
  if (data.autoReloadAt !== undefined) sanitized.autoReloadAt = data.autoReloadAt === null || data.autoReloadAt === '' ? null : String(data.autoReloadAt).trim();
  if (data.workScheduleFrom !== undefined) sanitized.workScheduleFrom = data.workScheduleFrom === null || data.workScheduleFrom === '' ? null : String(data.workScheduleFrom).trim();
  if (data.workScheduleTo !== undefined) sanitized.workScheduleTo = data.workScheduleTo === null || data.workScheduleTo === '' ? null : String(data.workScheduleTo).trim();
  if (data.systemName !== undefined) sanitized.systemName = String(data.systemName || '').trim() || 'NeoFit TV';
  if (data.timezone !== undefined) sanitized.timezone = String(data.timezone || '').trim() || 'Europe/Moscow';
  if (data.videoCrf !== undefined) sanitized.videoCrf = Number(data.videoCrf);
  if (data.videoMaxWidth !== undefined) sanitized.videoMaxWidth = data.videoMaxWidth === null || data.videoMaxWidth === '' ? null : Number(data.videoMaxWidth);
  if (data.monitorCheckIntervalSec !== undefined) sanitized.monitorCheckIntervalSec = Number(data.monitorCheckIntervalSec);
  if (data.onlineThresholdMultiplier !== undefined) sanitized.onlineThresholdMultiplier = data.onlineThresholdMultiplier === null || data.onlineThresholdMultiplier === '' ? null : Number(data.onlineThresholdMultiplier);
  if (data.maxFileSizeMb !== undefined) sanitized.maxFileSizeMb = Number(data.maxFileSizeMb);

  const settings = await settingsRepository.save(sanitized);
  return { ok: true, settings };
}

module.exports = { get, update };
