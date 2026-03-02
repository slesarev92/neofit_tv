#!/usr/bin/env node
/**
 * Проставляет durationSeconds для видео в media.json, у которых его ещё нет.
 * Использование: node scripts/backfill-video-durations.js
 * Сервер приложения может быть не запущен. Требуется ffprobe (ffmpeg).
 */
require('dotenv').config();
const path = require('path');
const config = require('../src/config');
const mediaRepository = require('../src/modules/media/media.repository');
const { getVideoDuration } = require('../src/modules/media/media.processor');

async function main() {
  const uploadsDir = path.resolve(config.uploadsDir);
  const all = await mediaRepository.findAll();
  const videos = all.filter(
    (m) => m.mimeType && m.mimeType.startsWith('video/') && (m.durationSeconds == null || m.durationSeconds === '')
  );
  if (videos.length === 0) {
    console.log('Нет видео без длительности. Выход.');
    return;
  }
  console.log('Найдено видео без длительности:', videos.length);
  let updated = 0;
  for (const m of videos) {
    const filePath = path.join(uploadsDir, m.filename || m.path || '');
    const durationSeconds = await getVideoDuration(filePath);
    if (durationSeconds != null && durationSeconds > 0) {
      await mediaRepository.update(m.id, { durationSeconds });
      updated++;
      console.log('  OK', m.originalName || m.filename, '→', durationSeconds, 'с');
    } else {
      console.log('  Пропуск (не удалось получить длительность):', m.originalName || m.filename);
    }
  }
  console.log('Обновлено записей:', updated);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
