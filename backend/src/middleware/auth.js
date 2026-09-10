const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'instautodm_jwt_secret_change_in_production_2026';

const PUBLIC_PATHS = [
  '/instagram/oauth/start',
  '/instagram/oauth/callback',
  '/instagram/deauthorize',
  '/instagram/data-deletion',
  '/instagram/lookup-profile',
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

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: authentication required' });
  }

  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'sumitbhardwaj2227@gmail.com')
    .toLowerCase()
    .split(',')
    .map(e => e.trim());

  const isEmailAdmin = req.user.email && adminEmails.includes(req.user.email.toLowerCase().trim());
  const isRoleAdmin = req.user.role === 'admin';

  if (!isRoleAdmin && !isEmailAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin privileges required' });
  }

  next();
}

module.exports = { requireAuth, requireAdmin, JWT_SECRET };

