#!/usr/bin/env node
/**
 * Резервное копирование папки data/ в backups/backup-YYYY-MM-DD-HH-mm.tar.gz
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
const BACKUPS_DIR = path.join(PROJECT_ROOT, 'backups');
const BACKUP_STATUS_FILE = path.join(DATA_DIR, 'backup-status.json');
const DEFAULT_KEEP_LAST = 30;

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

async function main() {
  const now = new Date().toISOString();

  try {
    await fs.mkdir(BACKUPS_DIR, { recursive: true });
  } catch (err) {
    console.error('Ошибка создания папки backups:', err.message);
    writeBackupStatusSync({ lastRun: now, success: false, error: err.message });
    process.exit(1);
  }

  try {
    await fs.access(DATA_DIR);
  } catch {
    console.error('Папка data не найдена:', DATA_DIR);
    writeBackupStatusSync({ lastRun: now, success: false, error: 'Папка data не найдена' });
    process.exit(1);
  }

  const keepLast = await getKeepLast();
  const archiveName = getBackupFilename();
  const archivePath = path.join(BACKUPS_DIR, archiveName);
  const parentDir = path.dirname(DATA_DIR);
  const dataFolderName = path.basename(DATA_DIR);

  try {
    const tar = spawnSync('tar', ['-czf', archivePath, '-C', parentDir, dataFolderName], {
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024,
    });
    if (tar.status !== 0) {
      const msg = (tar.stderr && tar.stderr.toString()) || 'tar завершился с ошибкой';
      console.error('Ошибка создания архива:', msg.trim() || 'Ошибка tar');
      writeBackupStatusSync({ lastRun: now, success: false, error: msg.trim() || 'Ошибка tar' });
      process.exit(1);
    }
  } catch (err) {
    console.error('Ошибка создания архива:', err.message);
    writeBackupStatusSync({ lastRun: now, success: false, error: err.message });
    process.exit(1);
  }

  let size = 0;
  try {
    const stat = await fs.stat(archivePath);
    size = stat.size;
  } catch (_) {}

  const entries = await fs.readdir(BACKUPS_DIR);
  const backups = entries
    .filter((n) => n.startsWith('backup-') && n.endsWith('.tar.gz'))
    .map((n) => path.join(BACKUPS_DIR, n));
  const sorted = backups.sort((a, b) => {
    const at = path.basename(a);
    const bt = path.basename(b);
    return at.localeCompare(bt);
  });

  if (sorted.length > keepLast) {
    const toRemove = sorted.slice(0, sorted.length - keepLast);
    for (const file of toRemove) {
      try {
        await fs.unlink(file);
      } catch (_) {}
    }
  }

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
  console.error('Ошибка:', err.message);
  process.exit(1);
});
