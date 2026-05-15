import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export const SESSION_COOKIE = 'c3_session';
export const CSRF_COOKIE = 'c3_csrf';
export const OAUTH_STATE_COOKIE = 'c3_oauth_state';
export const OAUTH_NONCE_COOKIE = 'c3_oauth_nonce';
export const OAUTH_RETURN_COOKIE = 'c3_oauth_return';

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
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
