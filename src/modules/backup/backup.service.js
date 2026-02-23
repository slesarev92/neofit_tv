const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(path.join(__dirname, '..', '..', '..'));
const BACKUP_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'backup.js');
const RUN_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут
const MAX_BUFFER = 10 * 1024 * 1024; // 10 МБ

/**
 * Запускает скрипт резервного копирования (тот же, что и npm run backup).
 * Возвращает { ok: true, fileName?, sizeBytes? } или { ok: false, error: string }.
 */
function runBackup() {
  const result = spawnSync(process.execPath, [BACKUP_SCRIPT], {
    cwd: PROJECT_ROOT,
    env: process.env,
    timeout: RUN_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
    encoding: 'utf-8',
  });

  if (result.error) {
    if (result.error.code === 'ETIMEDOUT' || result.error.code === 'SPAWN_TIMEOUT') {
      return { ok: false, error: 'Превышено время ожидания (5 мин)' };
    }
    return { ok: false, error: result.error.message || 'Ошибка запуска скрипта' };
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const msg = stderr || result.signal || 'Скрипт завершился с ошибкой';
    return { ok: false, error: msg.slice(0, 500) };
  }

  return { ok: true };
}

module.exports = { runBackup };
