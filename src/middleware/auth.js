function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated && !req.session.preAuth) {
    return next();
  }
  return res.status(401).json({ error: 'Требуется авторизация' });
}

module.exports = { requireAuth };
