const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const { writeJsonAtomic } = require('../../utils/atomicWrite');

const PAIRING_FILE = () => path.resolve(config.dataDir, 'pairing.json');

let cache = null;

async function readAll() {
  if (cache !== null) return cache;
  try {
    const raw = await fs.readFile(PAIRING_FILE(), 'utf-8');
    cache = JSON.parse(raw);
    return cache;
  } catch (err) {
    if (err.code === 'ENOENT') {
      cache = [];
      return cache;
    }
    throw err;
  }
}

async function writeAll(items) {
  await writeJsonAtomic(PAIRING_FILE(), items);
  cache = items;
}

async function findAll() {
  return readAll();
}

async function findByCode(code) {
  const items = await readAll();
  return items.find((r) => r.code === code) || null;
}

async function create(record) {
  const items = await readAll();
  items.push(record);
  await writeAll(items);
  return record;
}

async function updateScreenId(code, screenId) {
  const items = await readAll();
  const idx = items.findIndex((r) => r.code === code);
  if (idx === -1) return null;
  items[idx].screenId = screenId;
  await writeAll(items);
  return items[idx];
}

async function removeByCode(code) {
  const items = await readAll();
  const filtered = items.filter((r) => r.code !== code);
  if (filtered.length !== items.length) {
    await writeAll(filtered);
  }
}

async function removeExpired() {
  const items = await readAll();
  const now = new Date().toISOString();
  const kept = items.filter((r) => r.expiresAt && r.expiresAt > now);
  if (kept.length !== items.length) {
    await writeAll(kept);
  }
}

module.exports = { findAll, findByCode, create, updateScreenId, removeByCode, removeExpired };
