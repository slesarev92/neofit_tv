const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток. Попробуйте позже' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

// Лимит для плеера: ключ по screenId — 40 устройств в 4 клубах не мешают друг другу.
// Poll каждые 10 сек + 2 ретрая при сбое = запас 3 req / 10 сек на экран.
const playerLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 3,
  message: { error: 'Слишком много запросов' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.params.screenId || req.ip,
});

// Лимит для инициации паринга: 20 кодов в 10 минут с одного IP.
// 10 устройств × 2 попытки = запас при одновременной настройке в клубе.
const pairInitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { error: 'Слишком много запросов на паринг. Попробуйте позже' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

// Лимит для опроса статуса паринга: ключ по коду — каждое устройство поллит свой код.
// Опрос каждые ~2 сек во время настройки = 30 req / мин на код с запасом.
const pairStatusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Слишком много запросов' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.params.code || req.ip,
});

module.exports = { loginLimiter, playerLimiter, pairInitLimiter, pairStatusLimiter };
