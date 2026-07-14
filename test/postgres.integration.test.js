import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { PostgresDatabase } from '../api/postgres.js';
import { encryptTotpSecret } from '../api/security.js';

const databaseUrl = process.env.C3_RUN_POSTGRES_TESTS === '1'
  ? process.env.TEST_DATABASE_URL
  : '';

test('Postgres stores a versioned TOTP envelope and expires CSP reports', {
  skip: databaseUrl ? false : 'set C3_RUN_POSTGRES_TESTS=1 and TEST_DATABASE_URL to run',
}, async () => {
  const db = new PostgresDatabase(databaseUrl);
  const email = `postgres-${crypto.randomUUID()}@example.test`;
  const key = 'postgres-integration-totp-key-with-32-characters';
  let user;
  try {
    await db.health();
    user = await db.createUser({ email, displayName: 'Postgres integration' });
    const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP', key);
    await db.setPendingMfaSecret(user.id, encrypted, new Date(Date.now() + 60000));
    const stored = await db.findUserById(user.id);
    assert.match(stored.mfa_pending_totp_secret, /^v1\./);
    assert.equal(stored.mfa_pending_totp_secret.includes('JBSWY3DPEHPK3PXP'), false);

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
    if (user) await db.query('delete from users where id = $1', [user.id]);
    await db.query("delete from csp_reports where user_agent = 'integration'");
    await db.close();
  }
});
