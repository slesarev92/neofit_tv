const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
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

async function isTotpEnabled() {
  const secret = await authRepository.getTotpSecret();
  return !!secret;
}

async function setupTotp() {
  // Issuer is what authenticator apps group entries by — setting it explicitly
  // makes the entry appear as "NeoFit TV" with a clear namespace, instead of
  // a bare label that collides with other "NeoFit"-named entries from past
  // setups. Also future-proofs against authenticator apps that need explicit
  // algorithm/digits/period — speakeasy will encode the URL with defaults
  // (SHA1/6/30) once issuer is present.
  const secret = speakeasy.generateSecret({ name: 'NeoFit TV', issuer: 'NeoFit TV', length: 20 });
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
  return { secret: secret.base32, qrCodeUrl };
}

async function enableTotp(secret, token) {
  const code = String(token || '').replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) return { ok: false, error: 'Введите 6-значный код' };
  // window: 1 (±30 sec) is the industry norm. Wider windows extend the lifetime
  // of a leaked code without buying real reliability when NTP works.
  const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
  if (!valid) return { ok: false, error: 'Неверный код' };
  await authRepository.saveTotpSecret(secret);
  return { ok: true };
}

async function verifyTotp(token) {
  const secret = await authRepository.getTotpSecret();
  if (!secret) return true;
  const code = String(token || '').replace(/\D/g, '').slice(0, 6);
  return speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
}

async function disableTotp(password) {
  const valid = await verifyPassword(password);
  if (!valid) return { ok: false, error: 'Неверный пароль' };
  await authRepository.saveTotpSecret(null);
  return { ok: true };
}

module.exports = { verifyPassword, changePassword, isTotpEnabled, setupTotp, enableTotp, verifyTotp, disableTotp };
