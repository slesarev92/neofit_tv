const path = require('path');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
]);

function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^\.+/, '');
}

/**
 * Восстанавливает UTF-8 имя файла: multer часто приходит как Latin-1.
 * Безопасно для ASCII и уже корректных имён.
 */
function decodeFilename(originalname) {
  if (typeof originalname !== 'string' || !originalname) return originalname || '';
  try {
    return Buffer.from(originalname, 'latin1').toString('utf8');
  } catch (_) {
    return originalname;
  }
}

function isAllowedMimeType(mimeType) {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
  };
  return map[ext] || 'application/octet-stream';
}

function isPathSafe(filePath, baseDir) {
  const resolved = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);
  return resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase;
}

module.exports = {
  sanitizeFilename,
  decodeFilename,
  isAllowedMimeType,
  getMimeType,
  isPathSafe,
  ALLOWED_MIME_TYPES,
};
