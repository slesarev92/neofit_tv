const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const { writeJsonAtomic } = require('../../utils/atomicWrite');

const PLAYLISTS_FILE = () => path.resolve(config.dataDir, 'playlists.json');

let cache = null;

async function readAll() {
  if (cache !== null) return cache;
  try {
    const raw = await fs.readFile(PLAYLISTS_FILE(), 'utf-8');
    cache = JSON.parse(raw);
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

async function writeAll(items) {
  await writeJsonAtomic(PLAYLISTS_FILE(), items);
  cache = items;
}

async function findAll() {
  return readAll();
}

async function findById(id) {
  const items = await readAll();
  return items.find((p) => p.id === id) || null;
}

async function create(playlist) {
  const items = await readAll();
  items.push(playlist);
  await writeAll(items);
  return playlist;
}

async function update(id, data) {
  const items = await readAll();
  const idx = items.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
  await writeAll(items);
  return items[idx];
}

async function remove(id) {
  const items = await readAll();
  const filtered = items.filter((p) => p.id !== id);
  if (filtered.length === items.length) return false;
  await writeAll(filtered);
  return true;
}

module.exports = { findAll, findById, create, update, remove };
