const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'instautodm_jwt_secret_change_in_production_2026';

const PUBLIC_PATHS = [
  '/instagram/oauth/callback',
  '/instagram/deauthorize',
  '/instagram/data-deletion'
];

function requireAuth(req, res, next) {
  // Allow public Meta / Instagram callbacks that cannot carry user JWTs
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p))) {
    return next();
  }

  const header = req.headers['authorization'] || req.headers['Authorization'];
  let token = null;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, name, plan }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
  }
}

module.exports = { requireAuth, JWT_SECRET };

