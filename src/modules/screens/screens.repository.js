const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const { writeJsonAtomic } = require('../../utils/atomicWrite');

const SCREENS_FILE = () => path.resolve(config.dataDir, 'screens.json');

let cache = null;

async function readAll() {
  if (cache !== null) return cache;
  try {
    const raw = await fs.readFile(SCREENS_FILE(), 'utf-8');
    cache = JSON.parse(raw);
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

async function writeAll(items) {
  await writeJsonAtomic(SCREENS_FILE(), items);
  cache = items;
}

async function findAll() {
  return readAll();
}

async function findById(id) {
  const items = await readAll();
  return items.find((s) => s.id === id) || null;
}

async function create(screen) {
  const items = await readAll();
  items.push(screen);
  await writeAll(items);
  return screen;
}

async function update(id, data) {
  const items = await readAll();
  const idx = items.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...data };
  await writeAll(items);
  return items[idx];
}

async function updateLastSeen(id, timestamp) {
  const items = await readAll();
  const idx = items.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  items[idx].lastSeenAt = timestamp;
  await writeAll(items);
  return items[idx];
}

async function remove(id) {
  const items = await readAll();
  const filtered = items.filter((s) => s.id !== id);
  if (filtered.length === items.length) return false;
  await writeAll(filtered);
  return true;
}

module.exports = { findAll, findById, create, update, updateLastSeen, remove };
