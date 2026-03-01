const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const { writeJsonAtomic } = require('../../utils/atomicWrite');

const MEDIA_FILE = () => path.resolve(config.dataDir, 'media.json');

let cache = null;

async function readAll() {
  if (cache !== null) return cache;
  try {
    const raw = await fs.readFile(MEDIA_FILE(), 'utf-8');
    cache = JSON.parse(raw);
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

async function writeAll(items) {
  await writeJsonAtomic(MEDIA_FILE(), items);
  cache = items;
}

async function findAll() {
  return readAll();
}

async function findById(id) {
  const items = await readAll();
  return items.find((m) => m.id === id) || null;
}

async function create(media) {
  const items = await readAll();
  items.push(media);
  await writeAll(items);
  return media;
}

async function update(id, data) {
  const items = await readAll();
  const idx = items.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...data };
  await writeAll(items);
  return items[idx];
}

async function remove(id) {
  const items = await readAll();
  const filtered = items.filter((m) => m.id !== id);
  if (filtered.length === items.length) return false;
  await writeAll(filtered);
  return true;
}

module.exports = { findAll, findById, create, update, remove };
