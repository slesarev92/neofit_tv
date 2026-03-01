const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const logger = require('../../utils/logger');
const { writeJsonAtomic } = require('../../utils/atomicWrite');

const QUEUE_FILE = () => path.resolve(config.dataDir, 'processing-queue.json');

let queue = [];
let processing = false;
let workerFn = null;

async function loadQueue() {
  try {
    const raw = await fs.readFile(QUEUE_FILE(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveQueue() {
  await writeJsonAtomic(QUEUE_FILE(), queue);
}

async function add(task) {
  queue.push(task);
  await saveQueue();
  logger.info('Video queued', { mediaId: task.mediaId });
  processNext();
}

async function removeTask(mediaId) {
  queue = queue.filter((t) => t.mediaId !== mediaId);
  await saveQueue();
}

async function processNext() {
  if (processing || queue.length === 0 || !workerFn) return;

  processing = true;
  const task = queue[0];
  logger.info('Video processing started', { mediaId: task.mediaId, file: task.filePath });

  try {
    const result = await workerFn(task);
    if (task.onComplete) await task.onComplete(result);
  } catch (err) {
    logger.error('Video processing failed', { mediaId: task.mediaId, error: err.message });
    if (task.onComplete) await task.onComplete({ error: err.message });
  }

  await removeTask(task.mediaId);
  processing = false;
  processNext();
}

function init(worker) {
  workerFn = worker;
}

async function resumeUnfinished(onComplete) {
  const saved = await loadQueue();
  if (saved.length === 0) return;

  logger.info('Resuming unfinished video tasks', { count: saved.length });
  for (const task of saved) {
    task.onComplete = onComplete(task.mediaId);
    queue.push(task);
  }
  await saveQueue();
  processNext();
}

function getStatus(mediaId) {
  return queue.some((t) => t.mediaId === mediaId);
}

module.exports = { init, add, resumeUnfinished, getStatus };
