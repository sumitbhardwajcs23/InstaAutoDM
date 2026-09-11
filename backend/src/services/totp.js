/**
 * RFC 6238 TOTP Engine
 * Pure Node.js implementation without external dependencies.
 * Provides Base32 encoding/decoding, HMAC-SHA1 dynamic truncation,
 * window tolerance (+/- 1 step), and hashed backup codes.
 */

const crypto = require('crypto');

// Base32 character set (RFC 4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode a buffer to Base32 string
 */
function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;

        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
}

/**
 * Decode a Base32 string to Buffer
 */
function base32Decode(input) {
    const cleanInput = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const output = [];

    for (let i = 0; i < cleanInput.length; i++) {
        const val = BASE32_ALPHABET.indexOf(cleanInput[i]);
        if (val === -1) {
            throw new Error(`Invalid Base32 character: ${cleanInput[i]}`);
        }

        value = (value << 5) | val;
        bits += 5;

        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return Buffer.from(output);
}

/**
 * Generate a random Base32 secret for TOTP (160-bit key)
 */
function generateSecret(length = 20) {
    const bytes = crypto.randomBytes(length);
    return base32Encode(bytes);
}

/**
 * Generate OTP for a specific counter step using HMAC-SHA1
 */
function generateOtpForCounter(secretBase32, counter) {
    const key = base32Decode(secretBase32);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key);
    hmac.update(counterBuffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
}

/**
 * Verify a 6-digit TOTP code against a secret
 * Allows +/- window drift (default 1 step = +/- 30s)
 */
function verifyTotp(secretBase32, token, window = 1, stepSeconds = 30) {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = token.trim();
    if (!/^\d{6}$/.test(cleanToken)) return false;

    const currentEpoch = Math.floor(Date.now() / 1000);
    const currentCounter = Math.floor(currentEpoch / stepSeconds);

    for (let i = -window; i <= window; i++) {
        const expectedOtp = generateOtpForCounter(secretBase32, currentCounter + i);
        if (crypto.timingSafeEqual(Buffer.from(expectedOtp), Buffer.from(cleanToken))) {
            return true;
        }
    }

    return false;
}

/**
 * Generate an otpauth:// URI for authenticator app QR codes
 */
function getOtpAuthUrl(accountName, issuer, secretBase32) {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedAccount = encodeURIComponent(accountName);
    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate 8 secure backup codes
 * Each code is 8 alphanumeric characters (e.g. 'a1b2-c3d4')
 */
function generateBackupCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        const hex = crypto.randomBytes(4).toString('hex');
        const formatted = `${hex.slice(0, 4)}-${hex.slice(4)}`;
        codes.push(formatted);
    }
    return codes;
}

/**
 * Hash a backup code with SHA-256 for secure verification
 */
function hashBackupCode(code) {
    const normalized = code.trim().toLowerCase().replace(/-/g, '');
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Verify and consume a backup code from an array of hashed backup codes
 * Returns { valid: boolean, remainingHashedCodes: string[] }
 */
function verifyAndConsumeBackupCode(rawCode, hashedCodesArray) {
    if (!rawCode || !Array.isArray(hashedCodesArray)) {
        return { valid: false, remainingHashedCodes: hashedCodesArray || [] };
    }

    const testHash = hashBackupCode(rawCode);
    const foundIndex = hashedCodesArray.findIndex(h => h === testHash);

    if (foundIndex !== -1) {
        const updated = [...hashedCodesArray];
        updated.splice(foundIndex, 1);
        return { valid: true, remainingHashedCodes: updated };
    }

    return { valid: false, remainingHashedCodes: hashedCodesArray };
}

module.exports = {
    generateSecret,
    generateOtpForCounter,
    verifyTotp,
    getOtpAuthUrl,
    generateBackupCodes,
    hashBackupCode,
    verifyAndConsumeBackupCode,
    base32Encode,
    base32Decode
};
