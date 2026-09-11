const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/secrets');

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

let db = null;
function getDb() {
  if (!db) {
    db = require('../db');
  }
  return db;
}

async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: authentication required' });
  }

  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'sumitbhardwaj2227@gmail.com,admin@airvix.com')
    .toLowerCase()
    .split(',')
    .map(e => e.trim());

  const isEmailAdmin = req.user.email && adminEmails.includes(req.user.email.toLowerCase().trim());
  const isRoleAdmin = req.user.role === 'admin';

  if (!isRoleAdmin && !isEmailAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin privileges required' });
  }

  // Session revocation validation if session_id is encoded in token
  if (req.user.session_id) {
    try {
      const activeSession = await getDb().prepare(`
        SELECT id, is_active, expires_at 
        FROM admin_sessions 
        WHERE id = ?
      `).get(req.user.session_id);

      if (!activeSession || !activeSession.is_active || new Date(activeSession.expires_at) < new Date()) {
        return res.status(401).json({ 
          error: 'Admin session has expired or been revoked. Please log in again.' 
        });
      }
    } catch (err) {
      console.warn('[AuthMiddleware] Session check warning:', err.message);
    }
  }

  next();
}

/**
 * Granular Role-Based Access Control (RBAC) middleware for admin operations
 * Supported roles: 'superadmin', 'admin', 'support', 'auditor'
 */
function requireAdminRole(...allowedRoles) {
  return async (req, res, next) => {
    requireAdmin(req, res, () => {
      const userRole = req.user.admin_role || (req.user.role === 'admin' ? 'superadmin' : 'support');
      
      // Superadmin has full access across all operations
      if (userRole === 'superadmin') {
        return next();
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
          error: `Forbidden: Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${userRole}` 
        });
      }

      next();
    });
  };
}

module.exports = { requireAuth, requireAdmin, requireAdminRole, JWT_SECRET };


