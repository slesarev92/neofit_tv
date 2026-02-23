const bcrypt = require('bcrypt');
const authRepository = require('./auth.repository');

async function verifyPassword(password) {
  const hash = await authRepository.getPasswordHash();
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

async function changePassword(currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, status: 400, error: 'Новый пароль слишком короткий (минимум 8 символов)' };
  }

  const valid = await verifyPassword(currentPassword);
  if (!valid) {
    return { ok: false, status: 401, error: 'Неверный текущий пароль' };
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await authRepository.savePasswordHash(hash);
  return { ok: true };
}

module.exports = { verifyPassword, changePassword };
