import { decryptTotpSecret } from './security.js';

const MATERIAL_FIELDS = [
  'mfa_totp_secret',
  'mfa_pending_totp_secret',
];

function inspectMaterial(value, keyRing) {
  if (!value) return { status: 'absent', secret: null };
  try {
    const decoded = decryptTotpSecret(value, keyRing);
    if (decoded.legacy) return { status: 'plaintext', secret: decoded.secret };
    if (decoded.keyIndex === 0) return { status: 'primary', secret: decoded.secret };
    return { status: 'previous', secret: decoded.secret };
  } catch (error) {
    console.warn('TOTP material is undecryptable by the configured key ring; rotation is blocked', {
      reason: error.message,
    });
    return { status: 'undecryptable', secret: null };
  }
}

export function inspectTotpRows(rows, keyRing) {
  const materials = {
    primary: 0,
    previous: 0,
    plaintext: 0,
    undecryptable: 0,
  };
  const usersRequiringRotation = new Set();
  const usersBlocked = new Set();
  const plan = [];

  for (const row of rows) {
    const fields = {};
    for (const field of MATERIAL_FIELDS) {
      const inspected = inspectMaterial(row[field], keyRing);
      fields[field] = inspected;
      if (inspected.status !== 'absent') materials[inspected.status] += 1;
      if (['plaintext', 'previous'].includes(inspected.status)) {
        usersRequiringRotation.add(row.id);
      }
      if (inspected.status === 'undecryptable') usersBlocked.add(row.id);
    }
    plan.push({ id: row.id, fields });
  }

  return {
    plan,
    summary: {
      usersWithMfaMaterial: rows.length,
      usersRequiringRotation: usersRequiringRotation.size,
      usersBlocked: usersBlocked.size,
      materials,
    },
  };
}

export function materialNeedsRotation(material) {
  return ['plaintext', 'previous'].includes(material.status);
}
