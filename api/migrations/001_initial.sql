create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  password_hash text,
  google_subject text unique,
  old_supabase_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_auth_method_check check (password_hash is not null or google_subject is not null or old_supabase_id is not null)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  csrf_token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table task_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  task_id text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, task_id)
);

create table task_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  task_id text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique(user_id, task_id)
);

create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  label text not null default 'Untitled session',
  duration_seconds integer not null check (duration_seconds > 0),
  session_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table csp_reports (
  id bigserial primary key,
  body jsonb not null,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index sessions_user_expires_idx on sessions(user_id, expires_at desc);
create index task_progress_user_idx on task_progress(user_id);
create index task_notes_user_idx on task_notes(user_id);
create index study_sessions_user_date_idx on study_sessions(user_id, session_date desc);
create index csp_reports_created_idx on csp_reports(created_at desc);
