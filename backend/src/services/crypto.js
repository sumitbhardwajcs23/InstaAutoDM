// backend/src/services/crypto.js
const crypto = require('crypto');
const ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY || '01234567890123456789012345678901').slice(0, 32);
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function tryDecryptWithKey(encryptedText, keyStr) {
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = Buffer.alloc(32);
    Buffer.from(keyStr).copy(key, 0, 0, Math.min(32, keyStr.length));
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  if (encryptedText.startsWith('EAA') || encryptedText.startsWith('IGQ')) return encryptedText;
  if (!encryptedText.includes(':')) return encryptedText;

  // 1. Try env key
  if (process.env.ENCRYPTION_KEY) {
    const dec = tryDecryptWithKey(encryptedText, process.env.ENCRYPTION_KEY);
    if (dec && (dec.startsWith('EAA') || dec.startsWith('IGQ') || dec.length > 20)) return dec;
  }

  // 2. Try default repo key
  const defaultDec = tryDecryptWithKey(encryptedText, '01234567890123456789012345678901');
  if (defaultDec) return defaultDec;

  return encryptedText;
}

function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret) return false;
  const [algo, expectedSig] = signatureHeader.split('=');
  if (algo !== 'sha256') return false;
  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(rawBody);
  const calculatedSig = hmac.digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(calculatedSig, 'hex'));
  } catch { return false; }
}

function generateMetaSignature(payload, appSecret) {
  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

module.exports = { encrypt, decrypt, verifyMetaSignature, generateMetaSignature };
