const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const logger = require('../../utils/logger');
const { writeFileAtomic } = require('../../utils/atomicWrite');
const videoQueue = require('./video.queue');
const settingsRepository = require('../settings/settings.repository');

async function processImage(filePath, mimeType) {
  const origStat = await fs.stat(filePath);
  const originalSize = origStat.size;
  let compressedBuf;

  try {
    if (mimeType === 'image/jpeg') {
      compressedBuf = await sharp(filePath)
        .jpeg({ mozjpeg: true, quality: 85, progressive: true })
        .toBuffer();
    } else if (mimeType === 'image/png') {
      compressedBuf = await sharp(filePath)
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();
    } else if (mimeType === 'image/webp') {
      compressedBuf = await sharp(filePath)
        .webp({ quality: 85, effort: 6 })
        .toBuffer();
    } else {
      return { compressedSize: originalSize };
    }
  } catch (err) {
    logger.error('Image processing error', { filePath, error: err.message });
    return { compressedSize: originalSize };
  }

  if (compressedBuf.length < originalSize) {
    await writeFileAtomic(filePath, compressedBuf);
    logger.info('Image optimized', {
      file: path.basename(filePath),
      before: originalSize,
      after: compressedBuf.length,
      saved: `${Math.round((1 - compressedBuf.length / originalSize) * 100)}%`,
    });
    return { compressedSize: compressedBuf.length };
  }

  return { compressedSize: originalSize };
}

function getVideoDuration(inputPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) {
        logger.warn('Could not get video duration', { file: path.basename(inputPath), error: err.message });
        return resolve(null);
      }
      const sec = data.format && data.format.duration;
      resolve(Number(sec) && isFinite(sec) ? Math.round(sec) : null);
    });
  });
}

async function compressVideo(inputPath) {
  const settings = await settingsRepository.get();
  const crf = settings.videoCrf != null && Number.isInteger(settings.videoCrf) ? settings.videoCrf : 23;
  const maxWidth = settings.videoMaxWidth != null && Number.isInteger(settings.videoMaxWidth) ? settings.videoMaxWidth : null;

  return new Promise((resolve, reject) => {
    const tmpOutput = inputPath + '.tmp.mp4';

    getVideoDuration(inputPath).then((durationSeconds) => {
      const done = (compressedSize) => resolve({ compressedSize, durationSeconds });

      const chain = ffmpeg(inputPath)
        .videoCodec('libx264')
        .addOptions(['-crf', String(crf), '-preset', 'veryfast', '-an', '-threads', '2', '-movflags', '+faststart']);
      if (maxWidth) chain.size(`${maxWidth}x?`);
      chain
        .output(tmpOutput)
        .on('end', async () => {
          try {
            const stat = await fs.stat(tmpOutput);
            const origStat = await fs.stat(inputPath);

            if (stat.size < origStat.size) {
              await fs.rename(tmpOutput, inputPath);
              logger.info('Video optimized', {
                file: path.basename(inputPath),
                before: origStat.size,
                after: stat.size,
                saved: `${Math.round((1 - stat.size / origStat.size) * 100)}%`,
              });
              done(stat.size);
            } else {
              await fs.unlink(tmpOutput);
              logger.info('Video already optimal, keeping original', { file: path.basename(inputPath) });
              done(origStat.size);
            }
          } catch (err) {
            reject(err);
          }
        })
        .on('error', async (err) => {
          await fs.unlink(tmpOutput).catch(() => {});
          reject(new Error(err.message + (err.stderr ? '\n' + err.stderr : '')));
        })
        .run();
    });
  });
}

function enqueueVideo(mediaId, filePath, onComplete) {
  videoQueue.add({
    mediaId,
    filePath,
    onComplete,
    addedAt: new Date().toISOString(),
  });
}

videoQueue.init(async (task) => {
  return compressVideo(task.filePath);
});

module.exports = { processImage, enqueueVideo, compressVideo, getVideoDuration };
