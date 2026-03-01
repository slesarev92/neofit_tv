const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const config = require('../../config');
const logger = require('../../utils/logger');

const AUTH_FILE = () => path.resolve(config.dataDir, 'auth.json');

async function readData() {
  try {
    const raw = await fs.readFile(AUTH_FILE(), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeData(data) {
  await fs.writeFile(AUTH_FILE(), JSON.stringify(data, null, 2), 'utf-8');
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

module.exports = { initAuth, getPasswordHash, savePasswordHash };
