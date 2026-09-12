const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/secrets');

const PUBLIC_PATHS = [
  '/instagram/oauth/start',
  '/instagram/oauth/callback',
  '/instagram/deauthorize',
  '/instagram/data-deletion',
  '/instagram/lookup-profile',
  '/billing/plans',
  '/billing/webhook',
  '/site/public-settings',
];

async function requireAuth(req, res, next) {
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
      // Check session revocation in database
      const crypto = require('crypto');
      const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
      const revokedSession = await getDb().prepare('SELECT is_revoked FROM user_sessions WHERE token_hash = ?').get(tokenHash);
      if (!revokedSession || !revokedSession.is_revoked) {
        req.user = payload; // { id, email, name, plan }
      }
    } catch (err) {}
  }

  // Allow public Meta / Instagram callbacks and lookup endpoints
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p))) {
    return next();
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
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

  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'sumitbhardwaj2227@gmail.com')
    .toLowerCase()
    .split(',')
    .map(e => e.trim());

  const isEmailAdmin = req.user.email && adminEmails.includes(req.user.email.toLowerCase().trim());
  let isRoleAdmin = req.user.role === 'admin' || req.user.admin_role;

  // Check admin_users table in DB if not determined by token
  try {
    const adminRow = await getDb().prepare('SELECT * FROM admin_users WHERE LOWER(TRIM(email)) = ?').get(req.user.email?.toLowerCase()?.trim());
    if (adminRow) {
      if (adminRow.status === 'inactive' || adminRow.status === 'suspended') {
        return res.status(403).json({ error: 'Forbidden: Admin account is inactive or suspended' });
      }
      isRoleAdmin = true;
      req.user.admin_role = adminRow.role;
      req.user.permissions = JSON.parse(adminRow.permissions || '[]');
    }
  } catch (err) {
    console.warn('[AuthMiddleware] admin_users lookup note:', err.message);
  }

  if (!isRoleAdmin && !isEmailAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin privileges required' });
  }

  // Ensure default superadmin permissions for root admins
  if (!req.user.permissions || !req.user.admin_role) {
    if (isEmailAdmin || req.user.role === 'admin') {
      req.user.admin_role = req.user.admin_role || 'superadmin';
      req.user.permissions = req.user.permissions || ['*'];
    }
  }

  // Session revocation validation if session_id is encoded in token
  if (req.user.session_id) {
    try {
      // 1. Check user_sessions (used by unified authentication)
      const userSession = await getDb().prepare(`
        SELECT id, is_revoked, expires_at 
        FROM user_sessions 
        WHERE id = ?
      `).get(req.user.session_id);

      if (userSession) {
        if (userSession.is_revoked === 1 || (userSession.expires_at && new Date(userSession.expires_at) < new Date())) {
          return res.status(401).json({ 
            error: 'Admin session has expired or been revoked. Please log in again.' 
          });
        }
      } else {
        // 2. Fallback check admin_sessions table
        const activeSession = await getDb().prepare(`
          SELECT id, is_active, is_revoked, expires_at 
          FROM admin_sessions 
          WHERE id = ?
        `).get(req.user.session_id);

        if (activeSession) {
          const isRevoked = activeSession.is_revoked === 1 || activeSession.is_active === 0;
          if (isRevoked || (activeSession.expires_at && new Date(activeSession.expires_at) < new Date())) {
            return res.status(401).json({ 
              error: 'Admin session has expired or been revoked. Please log in again.' 
            });
          }
        }
      }
    } catch (err) {
      console.warn('[AuthMiddleware] Session check warning:', err.message);
    }
  }

  next();
}

/**
 * Granular Permission Enforcement middleware
 * Checks if the admin has the specific power or is a superadmin/wildcard
 */
function requirePermission(permissionKey) {
  return async (req, res, next) => {
    requireAdmin(req, res, () => {
      const userRole = req.user.admin_role || (req.user.role === 'admin' ? 'superadmin' : null);
      let permissions = req.user.permissions || [];
      if (typeof permissions === 'string') {
        try {
          permissions = JSON.parse(permissions);
        } catch (e) {
          permissions = [];
        }
      }

      // Super Admin or wildcard permission has universal access
      if (userRole === 'superadmin' || permissions.includes('*')) {
        return next();
      }

      if (permissionKey && permissions.includes(permissionKey)) {
        return next();
      }

      return res.status(403).json({ 
        error: `Forbidden: You do not have permission to access this resource. Required power: [${permissionKey}]. Please contact your Super Admin.` 
      });
    });
  };
}

/**
 * Granular Role-Based Access Control (RBAC) middleware for admin operations
 * Supported roles: 'superadmin', 'subadmin', 'admin', 'support', 'auditor'
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

/**
 * Sanitize a string or structured input to neutralize potential XSS / script injections
 */
function sanitizeInput(input) {
  if (typeof input === 'string') {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (input !== null && typeof input === 'object') {
    const cleaned = {};
    for (const [k, v] of Object.entries(input)) {
      cleaned[k] = sanitizeInput(v);
    }
    return cleaned;
  }
  return input;
}

function sanitizeParamsMiddleware(req, _res, next) {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeInput(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeInput(req.params);
  }
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireAdminRole,
  requirePermission,
  sanitizeInput,
  sanitizeParamsMiddleware,
  JWT_SECRET
};


