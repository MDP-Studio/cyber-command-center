import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export const SESSION_COOKIE = 'c3_session';
export const CSRF_COOKIE = 'c3_csrf';
export const OAUTH_STATE_COOKIE = 'c3_oauth_state';
export const OAUTH_NONCE_COOKIE = 'c3_oauth_nonce';
export const OAUTH_RETURN_COOKIE = 'c3_oauth_return';
export const TOTP_SECRET_ENVELOPE_VERSION = 'v1';

function totpEncryptionKey(keyMaterial) {
  const value = String(keyMaterial || '');
  if (value.length < 32) {
    throw new Error('TOTP_ENCRYPTION_KEY must contain at least 32 characters');
  }
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

export function isEncryptedTotpSecret(value) {
  return String(value || '').startsWith(`${TOTP_SECRET_ENVELOPE_VERSION}.`);
}

export function encryptTotpSecret(secret, keyMaterial) {
  const plaintext = String(secret || '');
  if (!plaintext) throw new Error('TOTP secret is required');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', totpEncryptionKey(keyMaterial), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    TOTP_SECRET_ENVELOPE_VERSION,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

export function decryptTotpSecret(storedValue, keyMaterial) {
  const stored = String(storedValue || '');
  if (!stored) {
    return {
      secret: null,
      version: null,
      legacy: false,
      keyIndex: null,
      needsRewrap: false,
    };
  }
  if (!isEncryptedTotpSecret(stored)) {
    if (/^v\d+\./.test(stored)) {
      throw new Error('Unsupported TOTP secret envelope');
    }
    return {
      secret: stored,
      version: 'legacy-plaintext',
      legacy: true,
      keyIndex: null,
      needsRewrap: true,
    };
  }

  const parts = stored.split('.');
  if (parts.length !== 4 || parts[0] !== TOTP_SECRET_ENVELOPE_VERSION) {
    throw new Error('Unsupported TOTP secret envelope');
  }
  const keyRing = Array.isArray(keyMaterial) ? keyMaterial : [keyMaterial];
  if (keyRing.length === 0) throw new Error('At least one TOTP encryption key is required');

  for (const [keyIndex, candidate] of keyRing.entries()) {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        totpEncryptionKey(candidate),
        Buffer.from(parts[1], 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(parts[3], 'base64url'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(parts[2], 'base64url')),
        decipher.final(),
      ]).toString('utf8');
      return {
        secret: plaintext,
        version: TOTP_SECRET_ENVELOPE_VERSION,
        legacy: false,
        keyIndex,
        needsRewrap: keyIndex !== 0,
      };
    } catch (error) {
      if (keyIndex === keyRing.length - 1) {
        throw new Error('TOTP secret could not be decrypted with the configured key ring', {
          cause: error,
        });
      }
    }
  }

  throw new Error('TOTP key ring processing failed unexpectedly');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function generateTotpSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(secret || '').replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index === -1) throw new Error('Invalid TOTP secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function totpCounterBuffer(counter) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  return buffer;
}

export function generateTotpCode(secret, timeMs = Date.now()) {
  const key = base32Decode(secret);
  const counter = Math.floor(timeMs / 1000 / 30);
  const hmac = crypto.createHmac('sha1', key).update(totpCounterBuffer(counter)).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const value = (
    ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff)
  ) % 1000000;
  return String(value).padStart(6, '0');
}

export function verifyTotpCode(code, secret, options = {}) {
  const candidate = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(candidate) || !secret) return false;
  const window = Number.isInteger(options.window) ? options.window : 1;
  const now = options.timeMs || Date.now();
  const candidateBuffer = Buffer.from(candidate);

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateTotpCode(secret, now + offset * 30000);
    const expectedBuffer = Buffer.from(expected);
    if (
      candidateBuffer.length === expectedBuffer.length
      && crypto.timingSafeEqual(candidateBuffer, expectedBuffer)
    ) {
      return true;
    }
  }

  return false;
}

export function formatTotpSecret(secret) {
  return String(secret || '').replace(/(.{4})/g, '$1 ').trim();
}

export function totpUri({ issuer = 'Cyber Command Center', accountName, secret }) {
  const label = `${issuer}:${accountName}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashIp(value, salt) {
  return crypto.createHash('sha256').update(`${salt}:${value || 'unknown'}`).digest('hex');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export async function hashPassword(password, cost) {
  return bcrypt.hash(password, cost);
}

export async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export function sessionExpiresAt(days) {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name || user.displayName || '',
    authProvider: user.google_subject ? 'google' : 'email',
    mfaEnabled: Boolean(user.mfa_enabled_at),
  };
}

export function cookieOptions(config, maxAgeSeconds, httpOnly = true) {
  return {
    path: '/',
    httpOnly,
    secure: config.cookieSecure,
    sameSite: 'lax',
    domain: config.cookieDomain,
    maxAge: maxAgeSeconds,
  };
}

export function clearCookie(reply, config, name, httpOnly = true) {
  reply.clearCookie(name, {
    path: '/',
    httpOnly,
    secure: config.cookieSecure,
    sameSite: 'lax',
    domain: config.cookieDomain,
  });
}
