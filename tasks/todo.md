# C3 Self-Hosted Backend Migration

**Date opened:** 2026-05-15

## Completed Locally

- [x] Added a Fastify API with PostgreSQL-backed auth, sessions, CSRF protection, Google OAuth, password reset, progress, notes, sessions, export, deletion, and CSP reporting.
- [x] Replaced browser Supabase SDK calls with a single API client while preserving guest/localStorage mode.
- [x] Added PostgreSQL migration, remote Docker Compose, API Dockerfile, backup container, and deployment handoff docs.
- [x] Added Supabase export and import scripts and preserved all 5 Supabase auth users found during export.
- [x] Updated README, security policy, privacy policy, Netlify CSP, and nginx CSP to target `https://c3-api.mdpstudio.com.au`.
- [x] Promoted CSP to enforcing after remote production smoke tests passed.

## Remote Production Gate

- [x] Create remote `.env.production` with Postgres, API, Google OAuth, SMTP, and CSP salt secrets.
- [x] Start `c3-postgres`, `c3-api`, and `c3-postgres-backup` with `docker compose --env-file .env.production -f docker-compose.remote.yml up -d`.
- [x] Run `npm run api:migrate` inside the API container.
- [x] Verify the remote API health check through `https://c3-api.mdpstudio.com.au/api/health`.
- [x] Route `c3-api.mdpstudio.com.au` through Cloudflare Tunnel to `http://100.110.79.52:8089`.
- [x] Run Supabase export locally with service-role key in process env only.
- [x] Run import dry-run and compare row counts.
- [x] Run production import and verify row counts.
- [x] Restore one backup into a temporary Postgres container and verify row counts.
- [x] Set Netlify `VITE_C3_API_URL=https://c3-api.mdpstudio.com.au`.
- [x] Redeploy Netlify and smoke test progress, notes, sessions, export, deletion, bad-origin rejection, password-reset request, and CSP reports.
- [x] Promote CSP from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.

## Remaining Manual Checks

- [ ] Have one migrated Google user complete a real browser Google login and confirm their progress is present.
- [ ] Have the migrated email/password user complete password reset from the delivered email and confirm their progress is present.
- [ ] Keep Supabase as rollback/archive for 14 days after cutover, then remove Supabase env vars and rollback notes.

## Notes

- Keep Supabase as rollback/archive for 14 days after cutover.
- Do not expose the Postgres port publicly.
- Do not print `.env.production`, Supabase service-role keys, Google secrets, SMTP secrets, or Cloudflare tokens.
