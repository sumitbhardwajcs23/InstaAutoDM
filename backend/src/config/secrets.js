// backend/src/config/secrets.js
const crypto = require('crypto');

const REQUIRED_SECRETS = ['JWT_SECRET', 'ENCRYPTION_KEY', 'META_APP_SECRET', 'META_VERIFY_TOKEN'];
const INSECURE_DEFAULTS = [
  'dev_jwt_secret_insecure_local_development_only',
  'dev_insecure_encryption_key_32b',
  'dev_meta_app_secret',
  'dev_meta_verify_token',
  'password123',
  'secret',
  '1234567890'
];

function validateSecrets() {
  const isProd = process.env.NODE_ENV === 'production';
  const missing = REQUIRED_SECRETS.filter(k => !process.env[k]);

  if (isProd && missing.length > 0) {
    console.error(`\n[FATAL] Missing required production security environment variables: ${missing.join(', ')}`);
    console.error('Airvix will not start in production with missing or fallback security credentials.\n');
    process.exit(1);
  }

  // Key length / entropy checks in production
  if (isProd) {
    const encKey = process.env.ENCRYPTION_KEY || '';
    if (Buffer.byteLength(encKey) < 32) {
      console.error('\n[FATAL] ENCRYPTION_KEY must be at least 32 bytes (256 bits) in production.\n');
      process.exit(1);
    }
    for (const key of REQUIRED_SECRETS) {
      const val = process.env[key] || '';
      if (INSECURE_DEFAULTS.includes(val.toLowerCase())) {
        console.error(`\n[FATAL] Insecure default secret value detected for ${key} in production.\n`);
        process.exit(1);
      }
    }
  }

  if (missing.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn(`[Security Warning] Running in non-production mode with default development secrets for: ${missing.join(', ')}`);
  }
}

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' 
  ? undefined 
  : 'dev_jwt_secret_insecure_local_development_only');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
  ? process.env.ENCRYPTION_KEY.slice(0, 32)
  : (process.env.NODE_ENV === 'production' ? undefined : 'dev_insecure_encryption_key_32b');

// Support seamless zero-downtime key rotation:
// Active key = ENCRYPTION_KEY
// Fallback keys = ENCRYPTION_KEY_PREVIOUS and comma-separated PREVIOUS_ENCRYPTION_KEYS
function getCandidateEncryptionKeys() {
  const keys = [];
  if (process.env.ENCRYPTION_KEY) keys.push(process.env.ENCRYPTION_KEY);
  if (process.env.ENCRYPTION_KEY_PREVIOUS) keys.push(process.env.ENCRYPTION_KEY_PREVIOUS);
  if (process.env.PREVIOUS_ENCRYPTION_KEYS) {
    process.env.PREVIOUS_ENCRYPTION_KEYS
      .split(',')
      .map(k => k.trim())
      .filter(Boolean)
      .forEach(k => {
        if (!keys.includes(k)) keys.push(k);
      });
  }
  if (process.env.NODE_ENV !== 'production' && ENCRYPTION_KEY && !keys.includes(ENCRYPTION_KEY)) {
    keys.push(ENCRYPTION_KEY);
  }
  return keys;
}

const META_APP_SECRET = process.env.META_APP_SECRET || (process.env.NODE_ENV === 'production' 
  ? undefined 
  : 'dev_meta_app_secret');

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || (process.env.NODE_ENV === 'production' 
  ? undefined 
  : 'dev_meta_verify_token');

module.exports = {
  validateSecrets,
  REQUIRED_SECRETS,
  JWT_SECRET,
  ENCRYPTION_KEY,
  META_APP_SECRET,
  META_VERIFY_TOKEN,
  getCandidateEncryptionKeys
};
