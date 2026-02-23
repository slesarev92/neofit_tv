const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, url: req.url });

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Файл слишком большой' });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некорректный JSON' });
  }

  const status = err.status || 500;
  const message = status === 500 ? 'Внутренняя ошибка сервера' : err.message;
  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
