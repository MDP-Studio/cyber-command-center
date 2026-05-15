import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outputPath = process.env.C3_SUPABASE_EXPORT_FILE
  || path.join(os.tmpdir(), `c3-supabase-export-${new Date().toISOString().slice(0, 10)}.json`);

if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. The service role key is never printed.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function listAllUsers() {
  const users = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

async function selectAll(table) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return data || [];
}

function summarize(payload) {
  return {
    users: payload.auth_users.length,
    profiles: payload.profiles.length,
    task_progress: payload.task_progress.length,
    task_notes: payload.task_notes.length,
    study_sessions: payload.study_sessions.length,
  };
}

const payload = {
  exported_at: new Date().toISOString(),
  source: 'supabase',
  auth_users: await listAllUsers(),
  profiles: await selectAll('profiles'),
  task_progress: await selectAll('task_progress'),
  task_notes: await selectAll('task_notes'),
  study_sessions: await selectAll('study_sessions'),
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(payload, null, 2));
console.log(JSON.stringify({ outputPath, counts: summarize(payload) }, null, 2));
