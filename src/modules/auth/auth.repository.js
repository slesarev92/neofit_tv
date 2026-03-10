const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const config = require('../../config');
const logger = require('../../utils/logger');
const { writeJsonAtomic } = require('../../utils/atomicWrite');

const AUTH_FILE = () => path.resolve(config.dataDir, 'auth.json');

let cache = null;
let loaded = false;

async function readData() {
  if (loaded) return cache;
  try {
    const raw = await fs.readFile(AUTH_FILE(), 'utf-8');
    cache = JSON.parse(raw);
    loaded = true;
    return cache;
  } catch {
    cache = null;
    loaded = true;
    return cache;
  }
}

async function writeData(data) {
  await writeJsonAtomic(AUTH_FILE(), data);
  cache = data;
  loaded = true;
}

async function initAuth() {
  const data = await readData();
  if (data && data.passwordHash) return;

  const hash = await bcrypt.hash(config.initialAdminPassword, 10);
  await writeData({ passwordHash: hash });
  logger.info('Initialized admin password from INITIAL_ADMIN_PASSWORD');
}

async function getPasswordHash() {
  const data = await readData();
  return data ? data.passwordHash : null;
}

async function savePasswordHash(hash) {
  const data = (await readData()) || {};
  await writeData({ ...data, passwordHash: hash });
}

async function getTotpSecret() {
  const data = await readData();
  return data && Object.prototype.hasOwnProperty.call(data, 'totpSecret')
    ? data.totpSecret
    : null;
}

async function saveTotpSecret(secret) {
  const data = (await readData()) || {};
  await writeData({ ...data, totpSecret: secret });
}

module.exports = {
  initAuth,
  getPasswordHash,
  savePasswordHash,
  getTotpSecret,
  saveTotpSecret,
};
