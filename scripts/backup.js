#!/usr/bin/env node
/**
 * Резервное копирование настроек: папка data/ + файлы логотипа и заставки «вне часов» (из uploads/)
 * в backups/backup-YYYY-MM-DD-HH-mm.tar.gz
 * Только встроенные модули Node.js (fs, path, child_process).
 * Использование: npm run backup
 * Читает backupKeepCount из data/settings.json (10–90), по умолчанию 30.
 * Пишет результат в data/backup-status.json для отображения на дашборде.
 */
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(path.join(__dirname, '..'));
const DATA_DIR = path.resolve(PROJECT_ROOT, process.env.DATA_DIR || 'data');
const UPLOADS_DIR = path.resolve(PROJECT_ROOT, process.env.UPLOADS_DIR || 'uploads');
const BACKUPS_DIR = path.join(PROJECT_ROOT, 'backups');
const BACKUP_STATUS_FILE = path.join(DATA_DIR, 'backup-status.json');
const LOCK_FILE = path.join(DATA_DIR, '.backup.lock');
const DEFAULT_KEEP_LAST = 30;
const TAR_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут

function writeBackupStatusSync(obj) {
  try {
    fsSync.writeFileSync(BACKUP_STATUS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (_) {}
}

async function getKeepLast() {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, 'settings.json'), 'utf-8');
    const s = JSON.parse(raw);
    const v = s && Number(s.backupKeepCount);
    if (Number.isInteger(v) && v >= 10 && v <= 90) return v;
  } catch (_) {}
  return DEFAULT_KEEP_LAST;
}

/** Возвращает массив относительных путей (от PROJECT_ROOT) файлов логотипа и заставки «вне часов», которые существуют. */
async function getExtraUploadPaths() {
  const out = [];
  let s;
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, 'settings.json'), 'utf-8');
    s = JSON.parse(raw);
  } catch (_) {
    return out;
  }
  const urls = [
    (s && s.logoUrl) || null,
    (s && s.workScheduleOffImageUrl) || null,
  ].filter(Boolean);
  for (const url of urls) {
    const rel = (typeof url === 'string' && url.trim()) ? url.replace(/^\//, '').trim() : '';
    if (!rel) continue;
    const fullPath = path.resolve(PROJECT_ROOT, rel);
    if (!fullPath.startsWith(PROJECT_ROOT)) continue;
    const relPath = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');
    if (relPath.startsWith('..')) continue;
    try {
      await fs.access(fullPath);
      out.push(relPath);
    } catch (_) {}
  }
  return out;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

function getBackupFilename() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `backup-${y}-${m}-${d}-${h}-${min}.tar.gz`;
}

/** Санитизация имени архива: только буквы, цифры, дефис, подчёркивание; макс 80 символов. */
function sanitizeBackupName(name) {
  if (typeof name !== 'string' || !name.trim()) return null;
  const s = name.trim().replace(/[^\w\u0400-\u04FF\-]/g, '-').replace(/-+/g, '-').slice(0, 80);
  return s || null;
}

function acquireLock() {
  try {
    fsSync.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') {
      console.error('Бэкап уже выполняется (lock-файл:', LOCK_FILE + ')');
      return false;
    }
    // Если ошибка не EEXIST — продолжаем без lock (data/ может не существовать ещё)
    return true;
  }
}

function releaseLock() {
  try { fsSync.unlinkSync(LOCK_FILE); } catch (_) {}
}

async function main() {
  const now = new Date().toISOString();

  if (!acquireLock()) {
    writeBackupStatusSync({ lastRun: now, success: false, error: 'Бэкап уже выполняется' });
    process.exit(1);
  }

  try {
    await fs.mkdir(BACKUPS_DIR, { recursive: true });
  } catch (err) {
    console.error('Ошибка создания папки backups:', err.message);
    writeBackupStatusSync({ lastRun: now, success: false, error: err.message });
    releaseLock();
    process.exit(1);
  }

  try {
    await fs.access(DATA_DIR);
  } catch {
    console.error('Папка data не найдена:', DATA_DIR);
    writeBackupStatusSync({ lastRun: now, success: false, error: 'Папка data не найдена' });
    releaseLock();
    process.exit(1);
  }

  const keepLast = await getKeepLast();
  const customName = sanitizeBackupName(process.env.BACKUP_NAME);
  const archiveName = customName
    ? (customName.endsWith('.tar.gz') ? customName : customName + '.tar.gz')
    : getBackupFilename();
  const archivePath = path.join(BACKUPS_DIR, archiveName);
  const parentDir = path.dirname(DATA_DIR);
  const dataFolderName = path.basename(DATA_DIR);
  const extraPaths = await getExtraUploadPaths();

  const tarArgs = ['-czf', archivePath, '-C', parentDir, dataFolderName];
  if (extraPaths.length) {
    tarArgs.push('-C', PROJECT_ROOT, ...extraPaths);
  }

  try {
    const tar = spawnSync('tar', tarArgs, {
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024,
      timeout: TAR_TIMEOUT_MS,
    });
    if (tar.status !== 0 || tar.error) {
      const msg = tar.error
        ? (tar.error.code === 'ETIMEDOUT' ? 'Превышено время tar (5 мин)' : tar.error.message)
        : ((tar.stderr && tar.stderr.toString()) || 'tar завершился с ошибкой');
      console.error('Ошибка создания архива:', msg.trim() || 'Ошибка tar');
      writeBackupStatusSync({ lastRun: now, success: false, error: msg.trim() || 'Ошибка tar' });
      releaseLock();
      process.exit(1);
    }
  } catch (err) {
    console.error('Ошибка создания архива:', err.message);
    writeBackupStatusSync({ lastRun: now, success: false, error: err.message });
    releaseLock();
    process.exit(1);
  }

  let size = 0;
  try {
    const stat = await fs.stat(archivePath);
    size = stat.size;
  } catch (_) {}

  const entries = await fs.readdir(BACKUPS_DIR);
  const backups = entries
    .filter((n) => n.endsWith('.tar.gz'))
    .map((n) => path.join(BACKUPS_DIR, n));
  const withStat = await Promise.all(
    backups.map(async (p) => ({ path: p, mtime: (await fs.stat(p).catch(() => null))?.mtime?.getTime() ?? 0 }))
  );
  const sorted = withStat
    .filter((x) => x.mtime)
    .sort((a, b) => a.mtime - b.mtime);

  if (sorted.length > keepLast) {
    const toRemove = sorted.slice(0, sorted.length - keepLast).map((x) => x.path);
    for (const file of toRemove) {
      try {
        await fs.unlink(file);
      } catch (_) {}
    }
  }

  releaseLock();
  writeBackupStatusSync({
    lastRun: now,
    success: true,
    fileName: archiveName,
    sizeBytes: size,
  });
  console.log('Архив создан:', archiveName);
  console.log('Размер:', formatBytes(size));
}

main().catch((err) => {
  releaseLock();
  console.error('Ошибка:', err.message);
  process.exit(1);
});
