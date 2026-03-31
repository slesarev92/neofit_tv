const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const logger = require('../../utils/logger');
const { writeJsonAtomic } = require('../../utils/atomicWrite');

const QUEUE_FILE = () => path.resolve(config.dataDir, 'processing-queue.json');

let queue = [];
let processing = false;
let workerFn = null;
let cancelled = false;
let currentCancelled = false;

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
  cancelled = false;
  currentCancelled = false;
  const task = queue[0];
  logger.info('Video processing started', { mediaId: task.mediaId, file: task.filePath });

  try {
    const result = await workerFn(task);
    if (!cancelled && !currentCancelled && task.onComplete) await task.onComplete(result);
  } catch (err) {
    if (cancelled) {
      logger.info('Video processing cancelled (queue cleared)', { mediaId: task.mediaId });
    } else if (currentCancelled) {
      logger.info('Video processing cancelled (single)', { mediaId: task.mediaId });
    } else {
      logger.error('Video processing failed', { mediaId: task.mediaId, error: err.message });
      if (task.onComplete) await task.onComplete({ error: err.message });
    }
  } finally {
    var wasCancelled = cancelled;
    currentCancelled = false;
    if (!wasCancelled) {
      await removeTask(task.mediaId).catch((err) =>
        logger.error('Failed to remove task from queue', { mediaId: task.mediaId, error: err.message })
      );
    }
    processing = false;
    if (!wasCancelled) processNext();
  }
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

function getCurrentId() {
  return processing && queue.length > 0 ? queue[0].mediaId : null;
}

function cancelCurrent() {
  if (!processing || queue.length === 0) return null;
  currentCancelled = true;
  return queue[0].mediaId;
}

async function removePending(mediaId) {
  const idx = queue.findIndex((t) => t.mediaId === mediaId);
  if (idx <= 0) return false; // -1 = not found, 0 = currently processing
  queue.splice(idx, 1);
  await saveQueue();
  logger.info('Removed pending task from queue', { mediaId });
  return true;
}

async function clearQueue() {
  cancelled = true;
  const currentId = processing && queue.length > 0 ? queue[0].mediaId : null;
  const pendingIds = queue.slice(processing ? 1 : 0).map((t) => t.mediaId);
  const allIds = currentId ? [currentId, ...pendingIds] : pendingIds;

  queue = [];
  processing = false;
  await saveQueue();

  logger.info('Video queue cleared', { cancelled: allIds.length });
  return allIds;
}

module.exports = { init, add, resumeUnfinished, getStatus, getCurrentId, cancelCurrent, removePending, clearQueue };
