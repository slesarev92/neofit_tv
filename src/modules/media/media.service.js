const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileType = require('file-type');
const config = require('../../config');
const mediaRepository = require('./media.repository');
const playlistsRepository = require('../playlists/playlists.repository');
const { sanitizeFilename, isAllowedMimeType, decodeFilename } = require('../../utils/fileUtils');
const logger = require('../../utils/logger');
const processor = require('./media.processor');
const videoQueue = require('./video.queue');

function isImage(mime) {
  return mime && mime.startsWith('image/');
}

async function list() {
  return mediaRepository.findAll();
}

async function getStatus(id) {
  const media = await mediaRepository.findById(id);
  if (!media) return null;
  const result = {
    id: media.id,
    status: media.status || 'ready',
    originalSize: media.originalSize || media.size,
    compressedSize: media.compressedSize || media.size,
    statusMessage: media.statusMessage || null,
  };
  if (media.status === 'processing') {
    result.progress = videoQueue.getCurrentId() === id ? processor.getCurrentProgress() : 0;
  }
  return result;
}

async function upload(file) {
  const fd = await fs.open(file.path, 'r');
  const header = Buffer.alloc(4100);
  await fd.read(header, 0, 4100, 0);
  await fd.close();
  const typeResult = await FileType.fromBuffer(header);
  const detectedMime = typeResult ? typeResult.mime : file.mimetype;

  if (!isAllowedMimeType(detectedMime)) {
    await fs.unlink(file.path).catch(() => {});
    return { ok: false, status: 400, error: 'Недопустимый тип файла' };
  }

  const id = uuidv4();
  const originalName = decodeFilename(file.originalname);
  const sanitized = sanitizeFilename(originalName);
  const ext = path.extname(sanitized) || (typeResult ? `.${typeResult.ext}` : '');
  const filename = `${id}_${path.basename(sanitized, path.extname(sanitized))}${ext}`;
  const destPath = path.join(path.resolve(config.uploadsDir), filename);

  await fs.rename(file.path, destPath);

  const media = {
    id,
    filename,
    originalName,
    mimeType: detectedMime,
    size: file.size,
    originalSize: file.size,
    compressedSize: file.size,
    status: 'processing',
    statusMessage: null,
    path: `uploads/${filename}`,
    createdAt: new Date().toISOString(),
  };

  await mediaRepository.create(media);
  logger.info('Media uploaded', { id, filename: media.originalName, size: file.size });

  if (isImage(detectedMime)) {
    try {
      const result = await processor.processImage(destPath, detectedMime);
      const stat = await fs.stat(destPath);
      await mediaRepository.update(id, {
        status: 'ready',
        compressedSize: result.compressedSize,
        size: stat.size,
      });
      media.status = 'ready';
      media.compressedSize = result.compressedSize;
      media.size = stat.size;
    } catch (err) {
      logger.error('Image processing failed', { id, error: err.message });
      await mediaRepository.update(id, { status: 'ready' });
      media.status = 'ready';
    }
  } else {
    processor.enqueueVideo(id, destPath, async (result) => {
      if (result.error) {
        await mediaRepository.update(id, {
          status: 'error',
          statusMessage: result.error,
        });
        logger.error('Video optimization failed', { id, error: result.error });
      } else {
        const stat = await fs.stat(destPath).catch(() => null);
        await mediaRepository.update(id, {
          status: 'ready',
          compressedSize: result.compressedSize,
          size: stat ? stat.size : result.compressedSize,
          ...(result.durationSeconds != null && { durationSeconds: result.durationSeconds }),
        });
        logger.info('Video optimization complete', { id, compressedSize: result.compressedSize });
      }
    });
  }

  return { ok: true, item: media };
}

async function remove(id) {
  const media = await mediaRepository.findById(id);
  if (!media) {
    return { ok: false, status: 404, error: 'Медиафайл не найден' };
  }
  if (media.status === 'processing') {
    return { ok: false, status: 409, error: 'Файл обрабатывается, подождите завершения' };
  }

  const playlists = await playlistsRepository.findAll();
  for (const pl of playlists) {
    const hadItem = pl.items && pl.items.some((item) => item.mediaId === id);
    if (hadItem) {
      const filtered = pl.items.filter((item) => item.mediaId !== id);
      await playlistsRepository.update(pl.id, { items: filtered });
      logger.info('Removed media from playlist', { mediaId: id, playlistId: pl.id, playlistName: pl.name });
    }
  }

  const filePath = path.join(path.resolve(config.uploadsDir), media.filename);
  await fs.unlink(filePath).catch(() => {});
  await fs.unlink(filePath + '.tmp.mp4').catch(() => {});
  await mediaRepository.remove(id);
  logger.info('Media deleted', { id, filename: media.originalName });
  return { ok: true };
}

async function cancelQueue() {
  const ids = await videoQueue.clearQueue();
  processor.cancelCurrentJob();

  for (const id of ids) {
    const media = await mediaRepository.findById(id);
    if (media) {
      await mediaRepository.update(id, { status: 'ready', statusMessage: null });
      // Clean up .tmp file in case on('error') handler didn't run yet
      const tmpPath = path.join(path.resolve(config.uploadsDir), media.filename + '.tmp.mp4');
      await fs.unlink(tmpPath).catch(() => {});
    }
  }

  if (ids.length > 0) {
    logger.info('Video queue cancelled', { count: ids.length, mediaIds: ids });
  }
  return { cancelled: ids.length };
}

async function cancelMediaProcessing(id) {
  const media = await mediaRepository.findById(id);
  if (!media || media.status !== 'processing') {
    return { ok: false, status: 404, error: 'Файл не в очереди обработки' };
  }

  const currentId = videoQueue.getCurrentId();

  if (currentId === id) {
    videoQueue.cancelCurrent();
    processor.cancelCurrentJob();
    await mediaRepository.update(id, { status: 'ready', statusMessage: null });
    const tmpPath = path.join(path.resolve(config.uploadsDir), media.filename + '.tmp.mp4');
    await fs.unlink(tmpPath).catch(() => {});
    logger.info('Cancelled current video processing', { id });
    return { ok: true };
  }

  const removed = await videoQueue.removePending(id);
  if (removed) {
    await mediaRepository.update(id, { status: 'ready', statusMessage: null });
    logger.info('Removed pending video from queue', { id });
    return { ok: true };
  }

  return { ok: false, status: 404, error: 'Файл не в очереди обработки' };
}

module.exports = { list, getStatus, upload, remove, cancelQueue, cancelMediaProcessing };
