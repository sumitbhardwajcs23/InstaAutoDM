// backend/src/services/authService.js
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const googleClientId = process.env.GOOGLE_CLIENT_ID || '955250447660-e6rendb53k479p4iksau83vf8b4svrdl.apps.googleusercontent.com';
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

function isConfiguredAdminEmail(email) {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .toLowerCase()
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase().trim());
}

/**
 * UNIFIED ACCOUNT RESOLUTION:
 * Find or create a single canonical user record in the `users` table
 * and link the authentication provider identity in `auth_accounts`.
 * 
 * CORE REQUIREMENT: A user has ONLY ONE Airvix account regardless of auth method.
 */
async function findOrCreateCanonicalUser({ email, name, password, emailVerified = 0, provider, providerAccountId }) {
  if (!email) {
    throw new Error('Email address is required for user account resolution.');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Check if provider_account_id is already explicitly linked to any user
  if (provider && providerAccountId) {
    const existingIdentity = await db.prepare(`
      SELECT user_id FROM auth_accounts 
      WHERE provider = ? AND provider_account_id = ?
    `).get(provider, providerAccountId);

    if (existingIdentity && existingIdentity.user_id) {
      const linkedUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(existingIdentity.user_id);
      if (linkedUser) {
        // If emails match, return user directly
        if (linkedUser.email.toLowerCase() === normalizedEmail) {
          return linkedUser;
        }
        // Case D: Provider is linked to a different Airvix user account!
        throw new Error(`This ${provider} account is already linked to a different Airvix account (${linkedUser.email}). Unlink it first to reassign.`);
      }
    }
  }

  // Look up user by canonical normalized email in `users` table
  let user = await db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

  if (user) {
    // User already exists! Update missing attributes (e.g. password_hash, email_verified)
    let needsUpdate = false;
    let newPasswordHash = user.password_hash;
    let newVerified = user.email_verified || 0;

    if (password && !user.password_hash) {
      newPasswordHash = await bcrypt.hash(password, 12);
      needsUpdate = true;
    }

    if (emailVerified && !user.email_verified) {
      newVerified = 1;
      needsUpdate = true;
    }

    if (isConfiguredAdminEmail(normalizedEmail) && user.role !== 'admin') {
      user.role = 'admin';
      needsUpdate = true;
    }

    if (needsUpdate) {
      await db.prepare(`
        UPDATE users 
        SET password_hash = ?, email_verified = ?, role = ?, updated_at = ? 
        WHERE id = ?
      `).run(newPasswordHash, newVerified, user.role || 'user', nowStr, user.id);
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }
  } else {
    // User does NOT exist! Create a new canonical user record in `users` table
    const userId = uuidv4();
    const displayName = name || normalizedEmail.split('@')[0];
    const initialRole = isConfiguredAdminEmail(normalizedEmail) ? 'admin' : 'user';
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const isVerified = emailVerified ? 1 : 0;
    const todayStr = new Date().toISOString().slice(0, 10);

    await db.prepare(`
      INSERT INTO users (id, email, name, plan, role, status, password_hash, email_verified, dm_usage_this_period, usage_period_start, created_at, updated_at)
      VALUES (?, ?, ?, 'free', ?, 'active', ?, ?, 0, ?, ?, ?)
    `).run(userId, normalizedEmail, displayName, initialRole, passwordHash, isVerified, todayStr, nowStr, nowStr);

    user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  }

  // Link provider in `auth_accounts` if provider is specified
  if (provider) {
    const accId = providerAccountId || normalizedEmail;
    const authAccId = uuidv4();
    try {
      await db.prepare(`
        INSERT INTO auth_accounts (id, user_id, provider, provider_account_id, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT DO NOTHING
      `).run(authAccId, user.id, provider, accId, nowStr);
    } catch (authErr) {
      // Ignore unique constraint conflict if provider link already exists
    }
  }

  return user;
}

/**
 * Safe Account Linking: Link additional auth provider to existing logged-in user
 */
async function linkAuthProviderToUser({ userId, provider, providerAccountId }) {
  if (!userId || !provider || !providerAccountId) {
    throw new Error('User ID, provider name, and provider account ID are required.');
  }

  const existingIdentity = await db.prepare(`
    SELECT user_id FROM auth_accounts 
    WHERE provider = ? AND provider_account_id = ?
  `).get(provider, providerAccountId);

  if (existingIdentity && existingIdentity.user_id) {
    if (existingIdentity.user_id === userId) {
      return { success: true, message: `${provider} is already linked to your account.` };
    }
    throw new Error(`This ${provider} account is already linked to another Airvix user account.`);
  }

  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const existingUserProvider = await db.prepare(`
    SELECT provider_account_id FROM auth_accounts 
    WHERE user_id = ? AND provider = ?
  `).get(userId, provider);

  if (existingUserProvider) {
    await db.prepare(`
      UPDATE auth_accounts SET provider_account_id = ?, created_at = ?
      WHERE user_id = ? AND provider = ?
    `).run(String(providerAccountId), nowStr, userId, provider);
    return { success: true, message: `Updated ${provider} identity for your Airvix account.` };
  }

  const authAccId = uuidv4();
  await db.prepare(`
    INSERT INTO auth_accounts (id, user_id, provider, provider_account_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(authAccId, userId, provider, String(providerAccountId), nowStr);

  return { success: true, message: `Successfully linked ${provider} to your Airvix account.` };
}

/**
 * Verify Google ID Token / OAuth Token / Access Token
 */
async function verifyGoogleIdToken(token) {
  if (!token) throw new Error('Google token is required.');

  // For dev testing mode when token is simulated mock token
  if (typeof token === 'string' && token.startsWith('mock_google_token_')) {
    const mockEmail = token.replace('mock_google_token_', '');
    return {
      sub: `google_mock_sub_${mockEmail}`,
      email: mockEmail,
      email_verified: true,
      name: mockEmail.split('@')[0],
      picture: null,
    };
  }

  const isJwt = typeof token === 'string' && token.split('.').length === 3;

  // 1. If it's a JWT (ID Token), verify with google-auth-library
  if (isJwt && googleClient && googleClientId) {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: googleClientId,
      });
      const payload = ticket.getPayload();
      return {
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        name: payload.name,
        picture: payload.picture,
      };
    } catch (err) {
      console.warn('[Google OAuth] Local library verify error, trying HTTP verification:', err.message);
    }
  }

  // 2. If it's a JWT, verify via Google OpenID TokenInfo HTTP endpoint
  if (isJwt) {
    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.email) {
          return {
            sub: data.sub,
            email: data.email,
            email_verified: data.email_verified === 'true' || data.email_verified === true,
            name: data.name || data.given_name || data.email.split('@')[0],
            picture: data.picture,
          };
        }
      }
    } catch (err) {
      console.warn('[Google OAuth] ID tokeninfo endpoint failed:', err.message);
    }
  }

  // 3. If it's an OAuth access_token, verify via Google UserInfo API
  try {
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (userinfoRes.ok) {
      const info = await userinfoRes.json();
      if (info.email) {
        return {
          sub: info.sub,
          email: info.email,
          email_verified: info.email_verified === 'true' || info.email_verified === true,
          name: info.name || info.given_name || info.email.split('@')[0],
          picture: info.picture,
        };
      }
    }
  } catch (err) {
    console.warn('[Google OAuth] UserInfo API failed:', err.message);
  }

  // 4. Try access_token via tokeninfo endpoint
  try {
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (tokenInfoRes.ok) {
      const data = await tokenInfoRes.json();
      if (data.email) {
        return {
          sub: data.sub || data.user_id,
          email: data.email,
          email_verified: data.email_verified === 'true' || data.email_verified === true,
          name: data.email.split('@')[0],
          picture: null,
        };
      }
    }
  } catch (err) {
    console.warn('[Google OAuth] Access tokeninfo failed:', err.message);
  }

  throw new Error('Invalid or expired Google authentication token. Please sign in again.');
}

/**
 * Create secure authenticated user session & JWT token
 */
async function createUserSession(user, req = {}) {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
  const ipAddress = (req.ip || (req.headers && req.headers['x-forwarded-for']) || '127.0.0.1').toString();
  const userAgent = (req.headers && req.headers['user-agent']) || 'Airvix Client';
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Check admin role and permissions if admin or present in admin_users
  let adminRole = user.admin_role;
  let permissions = user.permissions;
  if (!adminRole && (user.role === 'admin' || user.email)) {
    try {
      const adminRow = await db.prepare('SELECT * FROM admin_users WHERE LOWER(TRIM(email)) = ?').get(user.email?.toLowerCase()?.trim());
      if (adminRow && adminRow.status === 'active') {
        adminRole = adminRow.role;
        permissions = JSON.parse(adminRow.permissions || '[]');
      } else if (user.role === 'admin') {
        adminRole = 'superadmin';
        permissions = ['*'];
      }
    } catch (e) {}
  }

  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan || 'free',
    role: user.role || 'user',
    admin_role: adminRole,
    permissions: permissions,
    session_id: sessionId,
    status: user.status || 'active',
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await db.prepare(`
    INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, is_revoked, expires_at, created_at, last_active_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(sessionId, user.id, tokenHash, ipAddress, userAgent, expiresAt, nowStr, nowStr);

  const userData = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    plan: user.plan,
    role: user.role,
    admin_role: adminRole,
    permissions: permissions,
    status: user.status,
    email_verified: user.email_verified || 0,
  };

  return { token, user: userData, sessionId };
}

/**
 * Revoke a session / token upon logout
 */
async function revokeUserSession(token) {
  if (!token) return;
  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  await db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE token_hash = ?').run(tokenHash);
}

/**
 * Check if a token/session has been revoked
 */
async function isSessionRevoked(token) {
  if (!token) return true;
  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const session = await db.prepare('SELECT is_revoked FROM user_sessions WHERE token_hash = ?').get(tokenHash);
  return session ? Boolean(session.is_revoked) : false;
}

module.exports = {
  findOrCreateCanonicalUser,
  linkAuthProviderToUser,
  verifyGoogleIdToken,
  createUserSession,
  revokeUserSession,
  isSessionRevoked,
  isConfiguredAdminEmail,
};
