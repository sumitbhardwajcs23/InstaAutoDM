// backend/src/services/crypto.js
const crypto = require('crypto');
const { ENCRYPTION_KEY } = require('../config/secrets');

const GCM_IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const CBC_IV_LENGTH = 16; // Legacy 128-bit IV for AES-CBC

function getKeyBuffer(keyStr) {
  if (!keyStr) return null;
  const keyBuf = Buffer.alloc(32);
  Buffer.from(keyStr).copy(keyBuf, 0, 0, Math.min(32, Buffer.byteLength(keyStr)));
  return keyBuf;
}

/**
 * Encrypts text using authenticated AES-256-GCM.
 * Output format: <ivHex>:<authTagHex>:<ciphertextHex>
 */
function encrypt(text) {
  if (!text) return '';
  const key = getKeyBuffer(process.env.ENCRYPTION_KEY || ENCRYPTION_KEY);
  if (!key) throw new Error('[Crypto] Cannot encrypt: ENCRYPTION_KEY is missing.');

  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Attempts AES-256-GCM authenticated decryption.
 */
function tryDecryptGcm(ivHex, authTagHex, encryptedHex, keyStr) {
  try {
    const key = getKeyBuffer(keyStr);
    if (!key) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

/**
 * Attempts legacy AES-256-CBC decryption for backward compatibility with existing rows.
 */
function tryDecryptCbc(ivHex, encryptedHex, keyStr) {
  try {
    const key = getKeyBuffer(keyStr);
    if (!key) return null;
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

/**
 * Decrypts ciphertext.
 * Automatically handles AES-256-GCM (3 parts) and legacy AES-256-CBC (2 parts).
 */
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  // Plain unencrypted token pass-through
  if (encryptedText.startsWith('EAA') || encryptedText.startsWith('IGQ')) return encryptedText;
  if (!encryptedText.includes(':')) return encryptedText;

  const parts = encryptedText.split(':');
  const candidateKeys = [];

  if (process.env.ENCRYPTION_KEY) candidateKeys.push(process.env.ENCRYPTION_KEY);
  if (process.env.ENCRYPTION_KEY_PREVIOUS) candidateKeys.push(process.env.ENCRYPTION_KEY_PREVIOUS);
  if (process.env.NODE_ENV !== 'production' && ENCRYPTION_KEY && !candidateKeys.includes(ENCRYPTION_KEY)) {
    candidateKeys.push(ENCRYPTION_KEY);
  }

  // Case 1: AES-256-GCM (iv:authTag:ciphertext)
  if (parts.length === 3) {
    const [ivHex, authTagHex, encryptedHex] = parts;
    for (const key of candidateKeys) {
      const dec = tryDecryptGcm(ivHex, authTagHex, encryptedHex, key);
      if (dec !== null) return dec;
    }
  }

  // Case 2: Legacy AES-256-CBC (iv:ciphertext)
  if (parts.length === 2) {
    const [ivHex, encryptedHex] = parts;
    for (const key of candidateKeys) {
      const dec = tryDecryptCbc(ivHex, encryptedHex, key);
      if (dec !== null) return dec;
    }
  }

  return encryptedText;
}

function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret) return false;
  const [algo, expectedSig] = signatureHeader.split('=');
  if (algo !== 'sha256' || !expectedSig) return false;
  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(rawBody);
  const calculatedSig = hmac.digest('hex');
  try {
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    const calculatedBuf = Buffer.from(calculatedSig, 'hex');
    if (expectedBuf.length !== calculatedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, calculatedBuf);
  } catch {
    return false;
  }
}

function generateMetaSignature(payload, appSecret) {
  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Parses and verifies Meta's signed_request parameter (used in Data Deletion & Canvas callbacks)
 * Format: <encoded_sig>.<encoded_payload> (base64url)
 */
function parseSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || typeof signedRequest !== 'string') return null;
  const parts = signedRequest.split('.');
  if (parts.length !== 2) return null;

  const [encodedSig, encodedPayload] = parts;
  if (!encodedSig || !encodedPayload) return null;

  try {
    const sig = Buffer.from(encodedSig, 'base64url');
    const expectedSig = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest();

    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(sig, expectedSig)) {
      return null;
    }

    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const data = JSON.parse(payloadJson);
    if (!data || typeof data !== 'object') return null;
    if (data.algorithm && data.algorithm.toUpperCase() !== 'HMAC-SHA256') return null;

    return data;
  } catch {
    return null;
  }
}

/**
 * Generates a valid Meta-compatible signed_request (for testing and verification)
 */
function createSignedRequest(payload, appSecret) {
  const payloadWithAlgo = {
    algorithm: 'HMAC-SHA256',
    issued_at: Math.floor(Date.now() / 1000),
    ...(typeof payload === 'object' ? payload : { user_id: String(payload) })
  };
  const encodedPayload = Buffer.from(JSON.stringify(payloadWithAlgo)).toString('base64url');
  const encodedSig = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest('base64url');
  return `${encodedSig}.${encodedPayload}`;
}

module.exports = {
  encrypt,
  decrypt,
  tryDecryptCbc,
  verifyMetaSignature,
  generateMetaSignature,
  parseSignedRequest,
  createSignedRequest
};
