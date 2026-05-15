import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgresDatabase } from './postgres.js';
import { loadConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

async function ensureTable(db) {
  await db.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

export async function runMigrations(db) {
  await ensureTable(db);
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const { rows } = await db.query('select id from schema_migrations');
  const applied = new Set(rows.map((row) => row.id));
  const appliedNow = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    await db.transaction(async (tx) => {
      await tx.query(sql);
      await tx.query('insert into schema_migrations (id) values ($1)', [file]);
    });
    appliedNow.push(file);
  }

  return appliedNow;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  const db = new PostgresDatabase(config.databaseUrl);
  try {
    const applied = await runMigrations(db);
    console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'No migrations to apply.');
  } finally {
    await db.close();
  }
}
