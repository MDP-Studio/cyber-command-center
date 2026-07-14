import { loadConfig } from '../config.js';
import { PostgresDatabase } from '../postgres.js';
import { encryptTotpSecret, isEncryptedTotpSecret } from '../security.js';

const apply = process.argv.includes('--apply');
const config = loadConfig();
const db = new PostgresDatabase(config.databaseUrl);

try {
  const { rows } = await db.query(
    `select id, mfa_totp_secret, mfa_pending_totp_secret
     from users
     where mfa_totp_secret is not null or mfa_pending_totp_secret is not null
     order by id`,
  );
  const pending = rows.map((row) => ({
    id: row.id,
    active: Boolean(row.mfa_totp_secret && !isEncryptedTotpSecret(row.mfa_totp_secret)),
    setup: Boolean(row.mfa_pending_totp_secret && !isEncryptedTotpSecret(row.mfa_pending_totp_secret)),
  })).filter((row) => row.active || row.setup);

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    usersWithMfaMaterial: rows.length,
    usersRequiringMigration: pending.length,
  }));

  if (!apply || pending.length === 0) process.exitCode = 0;
  else {
    await db.transaction(async (tx) => {
      for (const migration of pending) {
        const source = rows.find((row) => row.id === migration.id);
        await tx.query(
          `update users
           set mfa_totp_secret = $2,
               mfa_pending_totp_secret = $3,
               updated_at = now()
           where id = $1`,
          [
            source.id,
            migration.active
              ? encryptTotpSecret(source.mfa_totp_secret, config.totpEncryptionKey)
              : source.mfa_totp_secret,
            migration.setup
              ? encryptTotpSecret(source.mfa_pending_totp_secret, config.totpEncryptionKey)
              : source.mfa_pending_totp_secret,
          ],
        );
      }
    });
    console.log(JSON.stringify({ migratedUsers: pending.length, envelopeVersion: 'v1' }));
  }
} finally {
  await db.close();
}
