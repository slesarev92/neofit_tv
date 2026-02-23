const { validationResult } = require('express-validator');

/**
 * Middleware: runs validations and returns 400 with first error message if invalid.
 */
function validate(validations) {
  return async (req, res, next) => {
    await Promise.all(validations.map((v) => v.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    const first = errors.array()[0];
    const message = first.msg || 'Некорректные данные';
    return res.status(400).json({ error: message });
  };
}

module.exports = { validate };
