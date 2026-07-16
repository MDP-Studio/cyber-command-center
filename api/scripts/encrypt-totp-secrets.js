import { loadConfig } from '../config.js';
import { PostgresDatabase } from '../postgres.js';
import { encryptTotpSecret } from '../security.js';
import { inspectTotpRows, materialNeedsRotation } from '../totp-key-rotation.js';

const apply = process.argv.includes('--apply');
const unknownArgs = process.argv.slice(2).filter((argument) => argument !== '--apply');
if (unknownArgs.length > 0) throw new Error(`Unknown argument: ${unknownArgs[0]}`);
const config = loadConfig();
const db = new PostgresDatabase(config.databaseUrl);

const selectTotpRows = (client, lock = false) => client.query(
  `select id, mfa_totp_secret, mfa_pending_totp_secret
   from users
   where mfa_totp_secret is not null or mfa_pending_totp_secret is not null
   order by id${lock ? ' for update' : ''}`,
);

try {
  if (!apply) {
    const { rows } = await selectTotpRows(db);
    const { summary } = inspectTotpRows(rows, config.totpEncryptionKeys);
    console.log(JSON.stringify({ mode: 'dry-run', ...summary }));
    if (summary.usersBlocked > 0) {
      throw new Error('TOTP key operation blocked because some material is undecryptable');
    }
  } else {
    const applied = await db.transaction(async (tx) => {
      const { rows } = await selectTotpRows(tx, true);
      const { plan, summary } = inspectTotpRows(rows, config.totpEncryptionKeys);
      console.log(JSON.stringify({ mode: 'apply', ...summary }));
      if (summary.usersBlocked > 0) {
        throw new Error('TOTP key operation blocked because some material is undecryptable');
      }

      let rotatedMaterials = 0;
      let rotatedUsers = 0;
      for (const operation of plan) {
        const source = rows.find((row) => row.id === operation.id);
        const active = operation.fields.mfa_totp_secret;
        const pending = operation.fields.mfa_pending_totp_secret;
        if (!materialNeedsRotation(active) && !materialNeedsRotation(pending)) continue;
        await tx.query(
          `update users
           set mfa_totp_secret = $2,
               mfa_pending_totp_secret = $3,
               updated_at = now()
           where id = $1`,
          [
            source.id,
            materialNeedsRotation(active)
              ? encryptTotpSecret(active.secret, config.totpEncryptionKey)
              : source.mfa_totp_secret,
            materialNeedsRotation(pending)
              ? encryptTotpSecret(pending.secret, config.totpEncryptionKey)
              : source.mfa_pending_totp_secret,
          ],
        );
        rotatedMaterials += Number(materialNeedsRotation(active));
        rotatedMaterials += Number(materialNeedsRotation(pending));
        rotatedUsers += 1;
      }
      return { rotatedMaterials, rotatedUsers };
    });
    console.log(JSON.stringify({ ...applied, envelopeVersion: 'v1' }));
  }
} finally {
  await db.close();
}
