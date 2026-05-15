# C3 Self-Hosted Backend Migration

**Date opened:** 2026-05-15

## Completed Locally

- [x] Added a Fastify API with PostgreSQL-backed auth, sessions, CSRF protection, Google OAuth, password reset, progress, notes, sessions, export, deletion, and CSP reporting.
- [x] Replaced browser Supabase SDK calls with a single API client while preserving guest/localStorage mode.
- [x] Added PostgreSQL migration, remote Docker Compose, API Dockerfile, backup container, and deployment handoff docs.
- [x] Added Supabase export and import scripts for the 4 existing users and their app data.
- [x] Updated README, security policy, privacy policy, Netlify CSP, and nginx CSP to target `https://c3-api.mdpstudio.com.au`.
- [x] Kept CSP in report-only mode until remote production smoke tests pass.

## Remote Production Gate

- [ ] Create remote `.env.production` with Postgres, API, Google OAuth, SMTP, and CSP salt secrets.
- [ ] Start `c3-postgres`, `c3-api`, and `c3-postgres-backup` with `docker compose --env-file .env.production -f docker-compose.remote.yml up -d`.
- [ ] Run `npm run api:migrate` inside the API container.
- [ ] Verify `http://127.0.0.1:8089/api/health` on the remote host.
- [ ] Route `c3-api.mdpstudio.com.au` through Cloudflare Tunnel to `http://127.0.0.1:8089`.
- [ ] Verify `https://c3-api.mdpstudio.com.au/api/health`.
- [ ] Run Supabase export locally with service-role key in process env only.
- [ ] Run `npm run migration:import-supabase` dry-run and compare row counts.
- [ ] Run `npm run migration:import-supabase -- --apply` during a short write-freeze window.
- [ ] Restore one backup into a temporary Postgres container and verify row counts.
- [ ] Set Netlify `VITE_C3_API_URL=https://c3-api.mdpstudio.com.au`.
- [ ] Redeploy Netlify and smoke test email/password reset, Google login, progress, notes, sessions, export, deletion, and CSP reports.
- [ ] Promote CSP from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` only after smoke tests are clean.

## Notes

- Keep Supabase as rollback/archive for 14 days after cutover.
- Do not expose the Postgres port publicly.
- Do not print `.env.production`, Supabase service-role keys, Google secrets, SMTP secrets, or Cloudflare tokens.
