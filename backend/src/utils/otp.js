// backend/src/utils/otp.js
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

/**
 * Generate a cryptographically secure 6-digit numeric OTP
 */
function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Compute SHA-256 hash of raw OTP
 */
function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp.toString().trim()).digest('hex');
}

/**
 * Create a new OTP token record with single-use, rate-limiting & hash storage
 */
async function createOtpToken({ email, purpose, ttlMinutes = 10 }) {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  // Rate limiting check: prevent requesting new OTP within 60 seconds of previous active request
  const recentOtp = await db.prepare(`
    SELECT created_at FROM otp_tokens 
    WHERE email = ? AND purpose = ? AND consumed_at IS NULL 
    ORDER BY created_at DESC LIMIT 1
  `).get(normalizedEmail, purpose);

  if (recentOtp && recentOtp.created_at) {
    const rawStr = String(recentOtp.created_at).trim();
    const dateStr = rawStr.includes('T') ? rawStr : rawStr.replace(' ', 'T') + 'Z';
    const lastCreated = new Date(dateStr);
    if (!isNaN(lastCreated.getTime())) {
      const diffSeconds = (now.getTime() - lastCreated.getTime()) / 1000;
      if (diffSeconds >= 0 && diffSeconds < 60) {
        const waitTime = Math.ceil(60 - diffSeconds);
        throw new Error(`Please wait ${waitTime} seconds before requesting a new verification code.`);
      }
    }
  }

  // Invalidate any previous unconsumed OTPs for this email and purpose
  const nowIso = now.toISOString();
  await db.prepare(`
    UPDATE otp_tokens 
    SET consumed_at = ? 
    WHERE email = ? AND purpose = ? AND consumed_at IS NULL
  `).run(nowIso, normalizedEmail, purpose);

  const rawOtp = generateOtp();
  const otpHash = hashOtp(rawOtp);
  const id = uuidv4();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

  await db.prepare(`
    INSERT INTO otp_tokens (id, email, otp_hash, purpose, attempts, max_attempts, expires_at, created_at)
    VALUES (?, ?, ?, ?, 0, 3, ?, ?)
  `).run(id, normalizedEmail, otpHash, purpose, expiresAt, nowIso);

  return { id, rawOtp, expiresAt, email: normalizedEmail };
}

/**
 * Verify an OTP token against single-use, attempt limits, and expiration
 */
async function verifyOtpToken({ email, purpose, otp }) {
  if (!email || !otp) {
    return { valid: false, error: 'Email and verification code are required' };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const cleanOtp = otp.toString().trim();
  const nowIso = new Date().toISOString();

  const record = await db.prepare(`
    SELECT * FROM otp_tokens 
    WHERE email = ? AND purpose = ? AND consumed_at IS NULL 
    ORDER BY created_at DESC LIMIT 1
  `).get(normalizedEmail, purpose);

  if (!record) {
    return { valid: false, error: 'No active verification code found or code has already been used.' };
  }

  // Check if expired
  if (new Date(record.expires_at) < new Date()) {
    await db.prepare('UPDATE otp_tokens SET consumed_at = ? WHERE id = ?').run(nowIso, record.id);
    return { valid: false, error: 'Verification code has expired. Please request a new code.' };
  }

  // Check attempt limit
  if (record.attempts >= record.max_attempts) {
    return { valid: false, error: 'Too many incorrect attempts. Please request a new verification code.' };
  }

  const inputHash = hashOtp(cleanOtp);
  if (inputHash === record.otp_hash) {
    // Single-use: consume token immediately upon successful verification
    await db.prepare('UPDATE otp_tokens SET consumed_at = ? WHERE id = ?').run(nowIso, record.id);
    return { valid: true, tokenId: record.id };
  } else {
    // Increment failed attempts
    const newAttempts = record.attempts + 1;
    await db.prepare('UPDATE otp_tokens SET attempts = ? WHERE id = ?').run(newAttempts, record.id);
    if (newAttempts >= record.max_attempts) {
      return { valid: false, error: 'Invalid verification code. Maximum attempts reached. Please request a new code.' };
    }
    return { valid: false, error: `Invalid verification code. ${record.max_attempts - newAttempts} attempt(s) remaining.` };
  }
}

module.exports = {
  generateOtp,
  hashOtp,
  createOtpToken,
  verifyOtpToken,
};
