alter table users
  add column if not exists mfa_totp_secret text,
  add column if not exists mfa_enabled_at timestamptz,
  add column if not exists mfa_pending_totp_secret text,
  add column if not exists mfa_pending_expires_at timestamptz;

create table if not exists mfa_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mfa_challenges_purpose_check check (purpose in ('login'))
);

create index if not exists mfa_challenges_user_idx on mfa_challenges(user_id, expires_at desc);
create index if not exists mfa_challenges_token_idx on mfa_challenges(token_hash);
