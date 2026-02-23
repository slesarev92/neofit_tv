const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');

const SCREENS_FILE = () => path.resolve(config.dataDir, 'screens.json');

async function readAll() {
  try {
    const raw = await fs.readFile(SCREENS_FILE(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeAll(items) {
  await fs.writeFile(SCREENS_FILE(), JSON.stringify(items, null, 2), 'utf-8');
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
