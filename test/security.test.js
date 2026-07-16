import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../api/config.js';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  isEncryptedTotpSecret,
} from '../api/security.js';
import { inspectTotpRows } from '../api/totp-key-rotation.js';

const KEY = 'test-only-totp-encryption-key-with-32-characters';
const PREVIOUS_KEY = 'previous-test-only-totp-key-with-32-characters';
const SECRET = 'JBSWY3DPEHPK3PXP';

test('TOTP secret envelope encrypts and authenticates the stored value', () => {
  const encrypted = encryptTotpSecret(SECRET, KEY);

  assert.equal(isEncryptedTotpSecret(encrypted), true);
  assert.notEqual(encrypted.includes(SECRET), true);
  assert.deepEqual(decryptTotpSecret(encrypted, KEY), {
    secret: SECRET,
    version: 'v1',
    legacy: false,
    keyIndex: 0,
    needsRewrap: false,
  });
});

test('TOTP key ring reads a previous key and marks the envelope for re-wrapping', () => {
  const encrypted = encryptTotpSecret(SECRET, PREVIOUS_KEY);

  assert.deepEqual(decryptTotpSecret(encrypted, [KEY, PREVIOUS_KEY]), {
    secret: SECRET,
    version: 'v1',
    legacy: false,
    keyIndex: 1,
    needsRewrap: true,
  });
  assert.throws(
    () => decryptTotpSecret(encrypted, KEY),
    /could not be decrypted with the configured key ring/,
  );
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
    keyIndex: null,
    needsRewrap: true,
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
  const primary = 'production-test-key-with-at-least-32-characters';
  const previous = 'previous-production-key-with-at-least-32-characters';
  const config = loadConfig({
    NODE_ENV: 'production',
    TOTP_ENCRYPTION_KEY: primary,
    TOTP_PREVIOUS_ENCRYPTION_KEYS: previous,
  });
  assert.equal(config.totpEncryptionKey, primary);
  assert.deepEqual(config.totpEncryptionKeys, [primary, previous]);
  assert.throws(
    () => loadConfig({
      NODE_ENV: 'production',
      TOTP_ENCRYPTION_KEY: primary,
      TOTP_PREVIOUS_ENCRYPTION_KEYS: 'too-short',
    }),
    /Every TOTP_PREVIOUS_ENCRYPTION_KEYS entry must contain at least 32 characters/,
  );
  assert.throws(
    () => loadConfig({
      NODE_ENV: 'production',
      TOTP_ENCRYPTION_KEY: primary,
      TOTP_PREVIOUS_ENCRYPTION_KEYS: primary,
    }),
    /TOTP encryption keys must be unique/,
  );
});

test('TOTP rotation inspection reports primary, previous, plaintext, and blocked material', () => {
  const rows = [
    {
      id: 'previous',
      mfa_totp_secret: encryptTotpSecret(SECRET, PREVIOUS_KEY),
      mfa_pending_totp_secret: encryptTotpSecret(SECRET, KEY),
    },
    {
      id: 'plaintext',
      mfa_totp_secret: SECRET,
      mfa_pending_totp_secret: null,
    },
    {
      id: 'blocked',
      mfa_totp_secret: 'v1.invalid.invalid.invalid',
      mfa_pending_totp_secret: null,
    },
  ];

  const { summary } = inspectTotpRows(rows, [KEY, PREVIOUS_KEY]);
  assert.deepEqual(summary, {
    usersWithMfaMaterial: 3,
    usersRequiringRotation: 2,
    usersBlocked: 1,
    materials: {
      primary: 1,
      previous: 1,
      plaintext: 1,
      undecryptable: 1,
    },
  });
});
