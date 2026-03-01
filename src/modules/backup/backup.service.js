const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { spawnSync } = require('child_process');
const config = require('../../config');

const PROJECT_ROOT = path.resolve(path.join(__dirname, '..', '..', '..'));
const BACKUP_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'backup.js');
const BACKUPS_DIR = path.join(PROJECT_ROOT, 'backups');
const DATA_DIR = path.resolve(config.dataDir);
const RUN_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут
const MAX_BUFFER = 10 * 1024 * 1024; // 10 МБ

/**
 * Запускает скрипт резервного копирования.
 * @param {string} [customName] - имя архива (без пути); если не задано — авто backup-YYYY-MM-DD-HH-mm.tar.gz
 * Возвращает { ok: true, fileName? } или { ok: false, error: string }.
 */
function runBackup(customName) {
  const env = { ...process.env };
  if (customName && typeof customName === 'string' && customName.trim()) {
    env.BACKUP_NAME = customName.trim();
  }
  const result = spawnSync(process.execPath, [BACKUP_SCRIPT], {
    cwd: PROJECT_ROOT,
    env,
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
  });

  if (tar.status !== 0) {
    const msg = (tar.stderr && tar.stderr.toString()) || 'Ошибка распаковки';
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
