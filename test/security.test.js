import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../api/config.js';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  isEncryptedTotpSecret,
} from '../api/security.js';

const KEY = 'test-only-totp-encryption-key-with-32-characters';
const SECRET = 'JBSWY3DPEHPK3PXP';

test('TOTP secret envelope encrypts and authenticates the stored value', () => {
  const encrypted = encryptTotpSecret(SECRET, KEY);

  assert.equal(isEncryptedTotpSecret(encrypted), true);
  assert.notEqual(encrypted.includes(SECRET), true);
  assert.deepEqual(decryptTotpSecret(encrypted, KEY), {
    secret: SECRET,
    version: 'v1',
    legacy: false,
  });
});

test('TOTP secret envelope rejects tampering and supports legacy migration reads', () => {
  const encrypted = encryptTotpSecret(SECRET, KEY);
  const parts = encrypted.split('.');
  parts[2] = `${parts[2].startsWith('A') ? 'B' : 'A'}${parts[2].slice(1)}`;
  const tampered = parts.join('.');

  assert.throws(() => decryptTotpSecret(tampered, KEY));
  assert.deepEqual(decryptTotpSecret(SECRET, KEY), {
    secret: SECRET,
    version: 'legacy-plaintext',
    legacy: true,
  });
  assert.throws(
    () => decryptTotpSecret('v2.iv.ciphertext.tag', KEY),
    /Unsupported TOTP secret envelope/,
  );
});

test('production configuration fails closed without a distinct TOTP encryption key', () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: 'production' }),
    /TOTP_ENCRYPTION_KEY must contain at least 32 characters in production/,
  );
  assert.equal(
    loadConfig({
      NODE_ENV: 'production',
      TOTP_ENCRYPTION_KEY: 'production-test-key-with-at-least-32-characters',
    }).totpEncryptionKey,
    'production-test-key-with-at-least-32-characters',
  );
});
