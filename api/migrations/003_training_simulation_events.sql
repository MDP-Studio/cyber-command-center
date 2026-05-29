create table if not exists training_simulation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  event_type text not null,
  outcome text not null,
  title text not null,
  risk_delta integer not null default 0 check (risk_delta between -25 and 50),
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint training_simulation_event_type_check check (event_type in (
    'phishing-email',
    'sms-phishing',
    'voice-social-engineering',
    'credential-hygiene',
    'incident-response',
    'awareness-drill',
    'manual-observation'
  )),
  constraint training_simulation_outcome_check check (outcome in (
    'completed',
    'reported',
    'reviewed',
    'ignored',
    'clicked',
    'failed',
    'credential_submitted'
  ))
);

create index if not exists training_simulation_events_user_occurred_idx
  on training_simulation_events(user_id, occurred_at desc);

create index if not exists training_simulation_events_user_outcome_idx
  on training_simulation_events(user_id, outcome);
