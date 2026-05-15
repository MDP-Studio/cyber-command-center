import fs from 'node:fs/promises';
import { PostgresDatabase } from '../postgres.js';
import { loadConfig } from '../config.js';
import { normalizeEmail } from '../security.js';

const inputPath = process.env.C3_SUPABASE_EXPORT_FILE;
const apply = process.argv.includes('--apply');

if (!inputPath) {
  console.error('C3_SUPABASE_EXPORT_FILE is required.');
  process.exit(1);
}

function googleSubjectFromUser(user) {
  const identities = Array.isArray(user.identities) ? user.identities : [];
  const google = identities.find((identity) => identity.provider === 'google');
  return google?.identity_data?.sub || google?.id || null;
}

function providerForUser(user) {
  const identities = Array.isArray(user.identities) ? user.identities : [];
  if (identities.some((identity) => identity.provider === 'google')) return 'google';
  return 'email';
}

function displayNameFor(user, profile) {
  return profile?.display_name
    || user.user_metadata?.display_name
    || user.user_metadata?.name
    || user.email?.split('@')[0]
    || null;
}

function increment(map, userId, table) {
  if (!userId) return;
  if (!map.has(userId)) {
    map.set(userId, {
      task_progress: 0,
      task_notes: 0,
      study_sessions: 0,
    });
  }
  map.get(userId)[table] += 1;
}

function perUserCounts(payload) {
  const rowCounts = new Map();
  for (const row of payload.task_progress || []) increment(rowCounts, row.user_id, 'task_progress');
  for (const row of payload.task_notes || []) increment(rowCounts, row.user_id, 'task_notes');
  for (const row of payload.study_sessions || []) increment(rowCounts, row.user_id, 'study_sessions');
  const profilesById = new Map((payload.profiles || []).map((profile) => [profile.id, profile]));

  return (payload.auth_users || []).map((user) => {
    const userCounts = rowCounts.get(user.id) || { task_progress: 0, task_notes: 0, study_sessions: 0 };
    return {
      old_supabase_id: user.id,
      email: normalizeEmail(user.email),
      provider: providerForUser(user),
      has_profile: profilesById.has(user.id),
      ...userCounts,
    };
  });
}

function counts(payload) {
  return {
    auth_users: payload.auth_users?.length || 0,
    profiles: payload.profiles?.length || 0,
    task_progress: payload.task_progress?.length || 0,
    task_notes: payload.task_notes?.length || 0,
    study_sessions: payload.study_sessions?.length || 0,
  };
}

async function targetCounts(db, oldSupabaseIds) {
  if (!oldSupabaseIds.length) return { tables: {}, by_user: [] };
  const { rows } = await db.query(
    `select u.old_supabase_id::text as old_supabase_id,
            u.email,
            case when u.google_subject is null then 'email' else 'google' end as provider,
            (select count(*)::int from task_progress tp where tp.user_id = u.id) as task_progress,
            (select count(*)::int from task_notes tn where tn.user_id = u.id) as task_notes,
            (select count(*)::int from study_sessions ss where ss.user_id = u.id) as study_sessions
     from users u
     where u.old_supabase_id = any($1::uuid[])
     order by u.email`,
    [oldSupabaseIds],
  );
  return {
    tables: {
      users: rows.length,
      task_progress: rows.reduce((sum, row) => sum + row.task_progress, 0),
      task_notes: rows.reduce((sum, row) => sum + row.task_notes, 0),
      study_sessions: rows.reduce((sum, row) => sum + row.study_sessions, 0),
    },
    by_user: rows,
  };
}

async function importPayload(db, payload) {
  const profilesById = new Map((payload.profiles || []).map((profile) => [profile.id, profile]));
  const newIds = new Map();

  return db.transaction(async (tx) => {
    for (const user of payload.auth_users || []) {
      const profile = profilesById.get(user.id);
      const googleSubject = googleSubjectFromUser(user);
      const { rows } = await tx.query(
        `insert into users (email, display_name, google_subject, old_supabase_id, created_at, updated_at)
         values ($1, $2, $3, $4, coalesce($5::timestamptz, now()), now())
         on conflict (old_supabase_id)
         do update set email = excluded.email,
                       display_name = excluded.display_name,
                       google_subject = coalesce(users.google_subject, excluded.google_subject),
                       updated_at = now()
         returning id`,
        [normalizeEmail(user.email), displayNameFor(user, profile), googleSubject, user.id, user.created_at],
      );
      newIds.set(user.id, rows[0].id);
    }

    for (const row of payload.task_progress || []) {
      const userId = newIds.get(row.user_id);
      if (!userId) continue;
      await tx.query(
        `insert into task_progress (user_id, task_id, completed, completed_at, updated_at)
         values ($1, $2, $3, $4, coalesce($5::timestamptz, now()))
         on conflict (user_id, task_id)
         do update set completed = excluded.completed,
                       completed_at = excluded.completed_at,
                       updated_at = excluded.updated_at`,
        [userId, row.task_id, row.completed, row.completed_at, row.updated_at],
      );
    }

    for (const row of payload.task_notes || []) {
      const userId = newIds.get(row.user_id);
      if (!userId) continue;
      await tx.query(
        `insert into task_notes (user_id, task_id, content, updated_at)
         values ($1, $2, $3, coalesce($4::timestamptz, now()))
         on conflict (user_id, task_id)
         do update set content = excluded.content,
                       updated_at = excluded.updated_at`,
        [userId, row.task_id, row.content || '', row.updated_at],
      );
    }

    for (const row of payload.study_sessions || []) {
      const userId = newIds.get(row.user_id);
      if (!userId) continue;
      await tx.query(
        `insert into study_sessions (user_id, label, duration_seconds, session_date, created_at)
         values ($1, $2, $3, $4, coalesce($5::timestamptz, now()))`,
        [userId, row.label || 'Untitled session', row.duration_seconds, row.session_date, row.created_at],
      );
    }

    return { users: newIds.size };
  });
}

const payload = JSON.parse(await fs.readFile(inputPath, 'utf8'));
console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  source_counts: counts(payload),
  source_by_user: perUserCounts(payload),
}, null, 2));

if (!apply) {
  console.log('Dry run only. Re-run with --apply to write to Postgres.');
  process.exit(0);
}

const config = loadConfig();
const db = new PostgresDatabase(config.databaseUrl);
try {
  const result = await importPayload(db, payload);
  const oldSupabaseIds = (payload.auth_users || []).map((user) => user.id).filter(Boolean);
  console.log(JSON.stringify({ imported: result, target: await targetCounts(db, oldSupabaseIds) }, null, 2));
} finally {
  await db.close();
}
