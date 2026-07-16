import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { PostgresDatabase } from '../api/postgres.js';
import { decryptTotpSecret, encryptTotpSecret } from '../api/security.js';

const databaseUrl = process.env.C3_RUN_POSTGRES_TESTS === '1'
  ? process.env.TEST_DATABASE_URL
  : '';

test('Postgres stores and rotates TOTP envelopes and expires CSP reports', {
  skip: databaseUrl ? false : 'set C3_RUN_POSTGRES_TESTS=1 and TEST_DATABASE_URL to run',
}, async () => {
  const db = new PostgresDatabase(databaseUrl);
  const email = `postgres-${crypto.randomUUID()}@example.test`;
  const key = 'postgres-integration-totp-key-with-32-characters';
  let user;
  let blockedUser;
  try {
    await db.health();
    user = await db.createUser({
      email,
      displayName: 'Postgres integration',
      passwordHash: 'integration-test-password-hash',
    });
    const secret = 'JBSWY3DPEHPK3PXP';
    const encrypted = encryptTotpSecret(secret, key);
    await db.setPendingMfaSecret(user.id, encrypted, new Date(Date.now() + 60000));
    const stored = await db.findUserById(user.id);
    assert.match(stored.mfa_pending_totp_secret, /^v1\./);
    assert.equal(stored.mfa_pending_totp_secret.includes('JBSWY3DPEHPK3PXP'), false);

    const previousKey = 'postgres-previous-totp-key-with-32-characters';
    await db.query(
      `update users
       set mfa_totp_secret = $2,
           mfa_enabled_at = now(),
           mfa_pending_totp_secret = null,
           mfa_pending_expires_at = null
       where id = $1`,
      [user.id, encryptTotpSecret(secret, previousKey)],
    );
    const rotationEnv = {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: databaseUrl,
      TOTP_ENCRYPTION_KEY: key,
      TOTP_PREVIOUS_ENCRYPTION_KEYS: previousKey,
    };
    const dryRun = spawnSync(process.execPath, ['api/scripts/encrypt-totp-secrets.js'], {
      cwd: process.cwd(),
      env: rotationEnv,
      encoding: 'utf8',
    });
    assert.equal(dryRun.status, 0, dryRun.stderr);
    const drySummary = JSON.parse(dryRun.stdout.trim());
    assert.equal(drySummary.materials.previous, 1);
    assert.equal(drySummary.usersBlocked, 0);

    const apply = spawnSync(
      process.execPath,
      ['api/scripts/encrypt-totp-secrets.js', '--apply'],
      { cwd: process.cwd(), env: rotationEnv, encoding: 'utf8' },
    );
    assert.equal(apply.status, 0, apply.stderr);
    const rotated = await db.findUserById(user.id);
    assert.equal(decryptTotpSecret(rotated.mfa_totp_secret, key).secret, secret);
    assert.throws(() => decryptTotpSecret(rotated.mfa_totp_secret, previousKey));

    const previousEnvelope = encryptTotpSecret(secret, previousKey);
    await db.query('update users set mfa_totp_secret = $2 where id = $1', [user.id, previousEnvelope]);
    blockedUser = await db.createUser({
      email: `blocked-${crypto.randomUUID()}@example.test`,
      displayName: 'Blocked rotation',
      passwordHash: 'integration-test-password-hash',
    });
    await db.query(
      `update users
       set mfa_totp_secret = 'v1.invalid.invalid.invalid', mfa_enabled_at = now()
       where id = $1`,
      [blockedUser.id],
    );
    const blockedApply = spawnSync(
      process.execPath,
      ['api/scripts/encrypt-totp-secrets.js', '--apply'],
      { cwd: process.cwd(), env: rotationEnv, encoding: 'utf8' },
    );
    assert.notEqual(blockedApply.status, 0);
    assert.match(blockedApply.stderr, /blocked because some material is undecryptable/);
    const unchanged = await db.findUserById(user.id);
    assert.equal(unchanged.mfa_totp_secret, previousEnvelope);

    await db.insertCspReport({ body: { test: true }, userAgent: 'integration', ipHash: 'hash' });
    const { rows } = await db.query(
      `select expires_at > now() + interval '29 days' as future,
              expires_at <= now() + interval '31 days' as bounded
       from csp_reports
       where user_agent = 'integration'
       order by id desc
       limit 1`,
    );
    assert.deepEqual(rows[0], { future: true, bounded: true });
  } finally {
    if (blockedUser) await db.query('delete from users where id = $1', [blockedUser.id]);
    if (user) await db.query('delete from users where id = $1', [user.id]);
    await db.query("delete from csp_reports where user_agent = 'integration'");
    await db.close();
  }
});
