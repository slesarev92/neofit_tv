#!/usr/bin/env node
/**
 * Сброс пароля администратора без веб-интерфейса.
 * Использование: node scripts/reset-password.js НовыйПароль
 * Требует прямой доступ к серверу (например по SSH). Сервер приложения может быть не запущен.
 */
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const { writeFileAtomic } = require('../src/utils/atomicWrite');

require('dotenv').config();

const DATA_DIR = process.env.DATA_DIR || './data';
const AUTH_FILE = path.resolve(DATA_DIR, 'auth.json');
const MIN_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

async function main() {
  const newPassword = process.argv[2];
  if (newPassword === undefined || newPassword === '') {
    console.log('Использование: node scripts/reset-password.js НовыйПароль');
    console.log('Пример: npm run reset-password МойНовыйПароль');
    process.exit(1);
  }

  if (newPassword.length < MIN_LENGTH) {
    console.error('Ошибка: пароль должен быть не короче ' + MIN_LENGTH + ' символов.');
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    let data = { passwordHash: hash };
    try {
      const raw = await fs.readFile(AUTH_FILE, 'utf-8');
      const existing = JSON.parse(raw);
      if (existing && typeof existing === 'object') {
        data = { ...existing, passwordHash: hash };
      }
    } catch {
      // Файла нет или пустой — создаём только passwordHash
    }
    await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });
    await writeFileAtomic(AUTH_FILE, JSON.stringify(data, null, 2));
    console.log('✅ Пароль успешно изменён');
  } catch (err) {
    console.error('Ошибка:', err.message);
    process.exit(1);
  }
}

main();
