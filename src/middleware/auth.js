function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated && !req.session.pendingAuth) {
    return next();
  }
  res.setHeader('X-Auth-Session-Received', req.session && req.sessionID ? 'yes' : 'no');
  return res.status(401).json({ error: 'Требуется авторизация' });
}

module.exports = { requireAuth };
