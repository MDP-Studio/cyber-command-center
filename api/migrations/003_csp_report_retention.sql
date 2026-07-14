alter table csp_reports
  add column if not exists expires_at timestamptz;

update csp_reports
set expires_at = created_at + interval '30 days'
where expires_at is null;

alter table csp_reports
  alter column expires_at set default (now() + interval '30 days'),
  alter column expires_at set not null;

create index if not exists csp_reports_expires_idx
  on csp_reports(expires_at);
