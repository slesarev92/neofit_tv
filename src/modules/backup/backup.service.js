const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { spawn, spawnSync } = require('child_process');
const config = require('../../config');
const logger = require('../../utils/logger');

const PROJECT_ROOT = path.resolve(path.join(__dirname, '..', '..', '..'));
const BACKUP_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'backup.js');
const BACKUPS_DIR = path.join(PROJECT_ROOT, 'backups');
const DATA_DIR = path.resolve(config.dataDir);
const RUN_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут

let isRunning = false;

/**
 * Запускает скрипт резервного копирования (async, не блокирует event loop).
 * @param {string} [customName] - имя архива (без пути); если не задано — авто backup-YYYY-MM-DD-HH-mm.tar.gz
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
async function runBackup(customName) {
  if (isRunning) {
    return { ok: false, error: 'Резервное копирование уже выполняется' };
  }
  isRunning = true;

  const env = { ...process.env };
  if (customName && typeof customName === 'string' && customName.trim()) {
    env.BACKUP_NAME = customName.trim();
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [BACKUP_SCRIPT], {
        cwd: PROJECT_ROOT,
        env,
        stdio: 'pipe',
      });

      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk; });

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Превышено время ожидания (5 мин)'));
      }, RUN_TIMEOUT_MS);

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve({ ok: true });
        } else {
          const msg = stderr.trim() || `Скрипт завершился с кодом ${code}`;
          resolve({ ok: false, error: msg.slice(0, 500) });
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    return result;
  } catch (err) {
    return { ok: false, error: err.message || 'Ошибка запуска скрипта' };
  } finally {
    isRunning = false;
  }
}

/**
 * Список архивов в backups/.
 * @returns {Promise<Array<{ fileName: string, sizeBytes: number, mtime: string }>>}
 */
async function listBackups() {
  try {
    const names = await fsPromises.readdir(BACKUPS_DIR);
    const tar = names.filter((n) => n.endsWith('.tar.gz'));
    const list = await Promise.all(
      tar.map(async (fileName) => {
        const p = path.join(BACKUPS_DIR, fileName);
        const stat = await fsPromises.stat(p).catch(() => null);
        return {
          fileName,
          sizeBytes: stat ? stat.size : 0,
          mtime: stat && stat.mtime ? stat.mtime.toISOString() : null,
        };
      })
    );
    list.sort((a, b) => (b.mtime || '').localeCompare(a.mtime || ''));
    return list;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * Восстанавливает настройки из архива (распаковка в корень проекта).
 * Перед распаковкой копирует текущую data/ в data.pre-restore-{timestamp};
 * при ошибке распаковки откатывает data/ из этой копии.
 * @param {string} fileName - только имя файла (backup-xxx.tar.gz)
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function restoreBackup(fileName) {
  const base = path.basename(fileName);
  if (base !== fileName || !base.endsWith('.tar.gz')) {
    return { ok: false, error: 'Недопустимое имя файла' };
  }
  const archivePath = path.join(BACKUPS_DIR, base);
  const resolvedArchive = path.resolve(archivePath);
  const resolvedDir = path.resolve(BACKUPS_DIR) + path.sep;
  if (!resolvedArchive.startsWith(resolvedDir)) {
    return { ok: false, error: 'Недопустимое имя файла' };
  }

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const dataDirName = path.basename(DATA_DIR);
  const backupPath = path.join(path.dirname(DATA_DIR), `${dataDirName}.pre-restore-${timestamp}`);
  let backupCreated = false;

  if (fs.existsSync(DATA_DIR)) {
    try {
      fs.cpSync(DATA_DIR, backupPath, { recursive: true });
      backupCreated = true;
    } catch (err) {
      return { ok: false, error: 'Не удалось создать копию data перед восстановлением: ' + (err.message || '') };
    }
  }

  const tar = spawnSync('tar', ['-xzf', archivePath, '-C', PROJECT_ROOT], {
    stdio: 'pipe',
    maxBuffer: 50 * 1024 * 1024,
    timeout: RUN_TIMEOUT_MS,
  });

  if (tar.status !== 0 || tar.error) {
    const msg = tar.error
      ? (tar.error.code === 'ETIMEDOUT' ? 'Превышено время распаковки (5 мин)' : tar.error.message)
      : ((tar.stderr && tar.stderr.toString()) || 'Ошибка распаковки');
    if (backupCreated) {
      try {
        fs.rmSync(DATA_DIR, { recursive: true, force: true });
        fs.renameSync(backupPath, DATA_DIR);
      } catch (rollbackErr) {
        return { ok: false, error: msg.slice(0, 500) + '. Откат не удался: ' + (rollbackErr.message || '') };
      }
    }
    return { ok: false, error: msg.slice(0, 500) };
  }
  return { ok: true };
}

module.exports = { runBackup, listBackups, restoreBackup };
