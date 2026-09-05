const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'instautodm_jwt_secret_change_in_production_2026';

const PUBLIC_PATHS = [
  '/instagram/oauth/callback',
  '/instagram/deauthorize',
  '/instagram/data-deletion',
  '/instagram/lookup-profile',
  '/instagram/connect-username'
];

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  let token = null;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload; // { id, email, name, plan }
    } catch (err) {}
  }

  // Allow public Meta / Instagram callbacks and lookup endpoints
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p))) {
    return next();
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }

  next();
}

module.exports = { requireAuth, JWT_SECRET };

