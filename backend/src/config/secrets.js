// backend/src/config/secrets.js
const crypto = require('crypto');

const REQUIRED_SECRETS = ['JWT_SECRET', 'ENCRYPTION_KEY', 'META_APP_SECRET', 'META_VERIFY_TOKEN'];

function validateSecrets() {
  const isProd = process.env.NODE_ENV === 'production';
  const missing = REQUIRED_SECRETS.filter(k => !process.env[k]);

  if (isProd && missing.length > 0) {
    console.error(`\n[FATAL] Missing required production security environment variables: ${missing.join(', ')}`);
    console.error('Airvix will not start in production with missing or fallback security credentials.\n');
    process.exit(1);
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
  META_VERIFY_TOKEN
};
