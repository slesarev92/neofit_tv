const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const logger = require('../../utils/logger');
const { writeFileAtomic } = require('../../utils/atomicWrite');
const videoQueue = require('./video.queue');
const settingsRepository = require('../settings/settings.repository');

// =========================================================
//  Image processing
// =========================================================

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

// =========================================================
//  Video probe — ffprobe metadata extraction
// =========================================================

const COMPATIBLE_PROFILES = ['Baseline', 'Main', 'High', 'Constrained Baseline', 'Constrained High'];
const MAX_LEVEL = 40; // H.264 Level 4.0
const MAX_BITRATE = 8_000_000; // 8 Mbps
const MAX_FPS = 30;

function probeVideo(inputPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) {
        logger.warn('ffprobe failed', { file: path.basename(inputPath), error: err.message });
        return resolve(null);
      }

      const videoStream = (data.streams || []).find((s) => s.codec_type === 'video');
      const audioStream = (data.streams || []).find((s) => s.codec_type === 'audio');

      if (!videoStream) {
        logger.warn('No video stream found', { file: path.basename(inputPath) });
        return resolve(null);
      }

      // FPS: avg_frame_rate is "30/1" or "30000/1001" format
      let fps = 0;
      if (videoStream.avg_frame_rate) {
        const parts = videoStream.avg_frame_rate.split('/');
        if (parts.length === 2 && Number(parts[1])) {
          fps = Math.round(Number(parts[0]) / Number(parts[1]));
        }
      }

      // Bitrate: prefer stream, fallback to format
      const streamBitrate = Number(videoStream.bit_rate) || 0;
      const formatBitrate = Number(data.format && data.format.bit_rate) || 0;
      const bitrate = streamBitrate || formatBitrate;

      // Level: ffprobe returns as integer (40 = Level 4.0, 31 = Level 3.1)
      const level = Number(videoStream.level) || 0;

      // Duration
      const sec = data.format && data.format.duration;
      const duration = Number(sec) && isFinite(sec) ? Math.round(sec) : null;

      resolve({
        codec: (videoStream.codec_name || '').toLowerCase(),
        profile: videoStream.profile || '',
        level,
        width: Number(videoStream.width) || 0,
        height: Number(videoStream.height) || 0,
        fps,
        bitrate,
        hasAudio: !!audioStream,
        duration,
      });
    });
  });
}

/**
 * Backward-compatible wrapper — used by scripts/backfill-video-durations.js
 */
async function getVideoDuration(filePath) {
  const probe = await probeVideo(filePath);
  return probe ? probe.duration : null;
}

// =========================================================
//  Compatibility check — decide remux vs full transcode
// =========================================================

function checkCompatibility(probe, maxWidth) {
  const reasons = [];

  if (probe.codec !== 'h264') {
    reasons.push(`codec: ${probe.codec} (need h264)`);
  }
  if (!COMPATIBLE_PROFILES.includes(probe.profile)) {
    reasons.push(`profile: ${probe.profile}`);
  }
  if (probe.level > MAX_LEVEL) {
    reasons.push(`level: ${probe.level / 10} (max ${MAX_LEVEL / 10})`);
  }
  if (maxWidth && probe.width > maxWidth) {
    reasons.push(`width: ${probe.width} (max ${maxWidth})`);
  }
  if (probe.fps > MAX_FPS) {
    reasons.push(`fps: ${probe.fps} (max ${MAX_FPS})`);
  }
  if (!probe.bitrate) {
    reasons.push('bitrate: unknown');
  } else if (probe.bitrate > MAX_BITRATE) {
    reasons.push(`bitrate: ${Math.round(probe.bitrate / 1000)}kbps (max ${MAX_BITRATE / 1000}kbps)`);
  }

  return {
    compatible: reasons.length === 0,
    needsRemux: probe.hasAudio,
    reasons,
  };
}

// =========================================================
//  Active ffmpeg command — for cancellation
// =========================================================

let activeCommand = null;

function cancelCurrentJob() {
  if (activeCommand) {
    try { activeCommand.kill('SIGKILL'); } catch (e) { /* already dead */ }
    activeCommand = null;
  }
}

// =========================================================
//  Remux — copy video stream, strip audio, add faststart
// =========================================================

function remuxVideo(inputPath, durationSeconds) {
  return new Promise((resolve, reject) => {
    const tmpOutput = inputPath + '.tmp.mp4';

    const cmd = ffmpeg(inputPath)
      .videoCodec('copy')
      .addOptions(['-an', '-movflags', '+faststart'])
      .output(tmpOutput)
      .on('end', async () => {
        activeCommand = null;
        try {
          const stat = await fs.stat(tmpOutput);
          const origStat = await fs.stat(inputPath);

          if (stat.size <= origStat.size) {
            await fs.rename(tmpOutput, inputPath);
            logger.info('Video remuxed (copy)', {
              file: path.basename(inputPath),
              before: origStat.size,
              after: stat.size,
              saved: `${Math.round((1 - stat.size / origStat.size) * 100)}%`,
            });
            resolve({ compressedSize: stat.size, durationSeconds });
          } else {
            await fs.unlink(tmpOutput);
            logger.info('Video remux larger than original, keeping as-is', { file: path.basename(inputPath) });
            resolve({ compressedSize: origStat.size, durationSeconds });
          }
        } catch (err) {
          reject(err);
        }
      })
      .on('error', async (err) => {
        activeCommand = null;
        await fs.unlink(tmpOutput).catch(() => {});
        reject(new Error(err.message + (err.stderr ? '\n' + err.stderr : '')));
      });
    activeCommand = cmd;
    cmd.run();
  });
}

// =========================================================
//  Full transcode — incompatible video (current production logic)
// =========================================================

function fullTranscode(inputPath, settings, durationSeconds) {
  const crf = settings.videoCrf != null && Number.isInteger(settings.videoCrf) ? settings.videoCrf : 23;
  const maxWidth = settings.videoMaxWidth != null && Number.isInteger(settings.videoMaxWidth) ? settings.videoMaxWidth : null;

  return new Promise((resolve, reject) => {
    const tmpOutput = inputPath + '.tmp.mp4';

    const chain = ffmpeg(inputPath)
      .videoCodec('libx264')
      .addOptions(['-crf', String(crf), '-preset', 'medium', '-r', '30', '-maxrate', '8M', '-bufsize', '16M', '-an', '-movflags', '+faststart', '-profile:v', 'high', '-level', '4.0']);
    if (maxWidth) chain.size(`${maxWidth}x?`);
    chain
      .output(tmpOutput)
      .on('end', async () => {
        activeCommand = null;
        try {
          const stat = await fs.stat(tmpOutput);
          const origStat = await fs.stat(inputPath);

          if (stat.size < origStat.size) {
            await fs.rename(tmpOutput, inputPath);
            logger.info('Video transcoded', {
              file: path.basename(inputPath),
              before: origStat.size,
              after: stat.size,
              saved: `${Math.round((1 - stat.size / origStat.size) * 100)}%`,
            });
            resolve({ compressedSize: stat.size, durationSeconds });
          } else {
            await fs.unlink(tmpOutput);
            logger.info('Transcoded video larger than original, keeping as-is', { file: path.basename(inputPath) });
            resolve({ compressedSize: origStat.size, durationSeconds });
          }
        } catch (err) {
          reject(err);
        }
      })
      .on('error', async (err) => {
        activeCommand = null;
        await fs.unlink(tmpOutput).catch(() => {});
        reject(new Error(err.message + (err.stderr ? '\n' + err.stderr : '')));
      });
    activeCommand = chain;
    chain.run();
  });
}

// =========================================================
//  Main entry — smart routing: remux or full transcode
// =========================================================

async function compressVideo(inputPath) {
  const probe = await probeVideo(inputPath);
  const settings = await settingsRepository.get();
  const maxWidth = settings.videoMaxWidth != null && Number.isInteger(settings.videoMaxWidth) ? settings.videoMaxWidth : 1920;

  if (!probe) {
    logger.warn('Could not probe video, falling back to full transcode', { file: path.basename(inputPath) });
    return fullTranscode(inputPath, settings, null);
  }

  const compat = checkCompatibility(probe, maxWidth);

  if (compat.compatible) {
    logger.info('Video compatible — remux only', {
      file: path.basename(inputPath),
      codec: probe.codec,
      profile: probe.profile,
      level: probe.level / 10,
      resolution: `${probe.width}x${probe.height}`,
      fps: probe.fps,
      bitrate: `${Math.round(probe.bitrate / 1000)}kbps`,
      hasAudio: probe.hasAudio,
    });
    return remuxVideo(inputPath, probe.duration);
  }

  logger.info('Video incompatible — full transcode', {
    file: path.basename(inputPath),
    reasons: compat.reasons,
  });
  return fullTranscode(inputPath, settings, probe.duration);
}

// =========================================================
//  Queue integration
// =========================================================

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

module.exports = { processImage, enqueueVideo, compressVideo, getVideoDuration, cancelCurrentJob };
