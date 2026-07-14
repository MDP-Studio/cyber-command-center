# Self-Hosted Backend Deployment

Last updated: 2026-07-13

Cyber Command Center uses a Coolify/nginx static frontend and a self-hosted Docker backend for signed-in accounts. The former Netlify frontend is retained only as a rollback path. Guest mode still works without any backend.

## Production Topology

- Frontend: `https://c3.mdpstudio.com.au` on the Coolify static nginx application.
- API: `https://c3-api.mdpstudio.com.au` through Cloudflare Tunnel.
- Remote host: the always-on MDP Studio remote PC.
- Docker services: `c3-api`, `c3-postgres`, `c3-postgres-backup`.
- Database exposure: Postgres is on the private Docker network only. Do not publish a public database port.

## Required Secrets

Create `.env.production` on the remote host. Do not commit it.

```env
POSTGRES_PASSWORD=replace-with-long-random-password
DATABASE_URL=postgres://c3_app:replace-with-long-random-password@c3-postgres:5432/c3
API_ORIGIN=https://c3-api.mdpstudio.com.au
APP_ORIGIN=https://c3.mdpstudio.com.au
COOKIE_SECURE=true
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
GOOGLE_REDIRECT_URI=https://c3-api.mdpstudio.com.au/api/auth/google/callback
SMTP_URL=smtp://user:password@smtp-host:587
MAIL_FROM=Cyber Command Center <security@mdpstudio.com.au>
PASSWORD_RESET_BASE_URL=https://c3.mdpstudio.com.au
CSP_REPORT_IP_SALT=replace-with-long-random-salt
TOTP_ENCRYPTION_KEY=replace-with-a-distinct-random-secret-of-at-least-32-characters
```

For a dedicated Cloudflare Tunnel container, also set `CLOUDFLARED_TUNNEL_TOKEN`. The preferred default is to reuse the existing remote tunnel.
For the current MDP Studio remote PC, the compose file binds the API to `100.110.79.52:8089` so the existing `cloudflared-tunnel` container can reach it from outside the C3 compose network.

## First Deploy

1. Copy the repo to the remote host.
2. Create `.env.production` on the remote host.
3. Start the database and API:

```bash
docker compose --env-file .env.production -f docker-compose.remote.yml up -d c3-postgres c3-api c3-backup
docker compose --env-file .env.production -f docker-compose.remote.yml exec c3-api node api/migrate.js
```

For an upgrade from the plaintext MFA schema, deploy the backward-compatible
API first, confirm `/api/health`, then migrate existing TOTP material without
printing it:

```bash
docker compose --env-file .env.production -f docker-compose.remote.yml exec c3-api npm run migration:encrypt-totp
docker compose --env-file .env.production -f docker-compose.remote.yml exec c3-api npm run migration:encrypt-totp -- --apply
```

The command is idempotent and reports counts only. Do not rotate or remove
`TOTP_ENCRYPTION_KEY` while MFA rows exist. New code can read legacy plaintext
rows during rollout, but old releases cannot read `v1` encrypted envelopes.

4. Verify health from the remote host on the address explicitly bound by
   `docker-compose.remote.yml`, and confirm the container health check:

```bash
curl -fsS http://100.110.79.52:8089/api/health
docker inspect --format '{{.State.Health.Status}}' c3-api
```

`127.0.0.1:8089` is intentionally not a valid host-side probe because the API
port is bound only to the remote PC's Tailscale address. Inside the container,
the Docker health check still probes `127.0.0.1:8080`.

5. Add the Cloudflare Tunnel route:

```txt
c3-api.mdpstudio.com.au -> http://100.110.79.52:8089
```

6. Verify through the public API domain:

```bash
curl -fsS https://c3-api.mdpstudio.com.au/api/health
```

7. Build the frontend with the public API target:

```bash
VITE_C3_API_URL=https://c3-api.mdpstudio.com.au npm run build
```

8. Deploy the resulting `dist/` through the existing Coolify static-app procedure in the shared MDP deployment runbook. Install `deploy/nginx.coolify.conf` as the app nginx configuration, rebuild the container, and run the smoke tests below. Do not replace the configuration with a generic SPA template.

## Supabase Migration

Use the export script locally with the Supabase service-role key in the process environment only. Never paste or commit the key.

```powershell
$env:SUPABASE_URL='https://project-ref.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY='service-role-key'
$env:C3_SUPABASE_EXPORT_FILE="$env:TEMP\c3-supabase-export-2026-05-15.json"
& 'C:\Program Files\nodejs\npm.cmd' run migration:export-supabase
```

Dry-run the import first:

```bash
export C3_SUPABASE_EXPORT_FILE=/path/to/c3-supabase-export-2026-05-15.json
npm run migration:import-supabase
```

The dry-run prints source row counts by table and by Supabase user ID. Apply only after those counts match expectations:

```bash
export C3_SUPABASE_EXPORT_FILE=/path/to/c3-supabase-export-2026-05-15.json
npm run migration:import-supabase -- --apply
```

The apply run prints target counts from Postgres for the migrated Supabase IDs. Compare source and target counts before changing the public frontend API target.

Keep Supabase as rollback/archive for 14 days after cutover. Remove Supabase env vars only after the new API has passed smoke tests and the migrated users can access their data.

## Smoke Tests

- `GET /api/health` returns `{ "ok": true }`.
- Email/password login works for the migrated email user after password reset.
- Optional authenticator MFA can be enabled for an email/password account, blocks password login until a valid code is submitted, and requires a code for account deletion.
- Google login works for the 3 migrated Google users.
- Dashboard loads progress, notes, study sessions, simulation-risk events, and derived per-drill assessment histories.
- Export downloads all user-scoped data.
- Delete removes the account, cascades simulation-risk events, and returns to signed-out state.
- Simulation-risk tracking remains audit-only: no outbound phishing sender, learner automation, or enterprise admin console. Assessment reports derive first/latest percentages and evidence-quality bands from compact score metadata and do not store raw lab evidence.
- Browser devtools show no `*.supabase.co` requests.
- CSP reports post to `/api/csp-report`.
- CSP reports receive a 30-day expiry and expired active-database rows are purged on report intake.

## Backup Restore Gate

Before cutover, restore the latest backup into a temporary Postgres container and verify the table list plus row counts. Do not point the public frontend at the production API until a restore has been proven once.

## Deployment and rollback gates

Pre-deploy:

- Record the current frontend bundle checksum, API commit, container image ID,
  database backup, and count of MFA-enabled users.
- Add the distinct `TOTP_ENCRYPTION_KEY` without printing it and confirm its
  file permissions.
- Apply SQL migrations, deploy the backward-compatible API, then run the TOTP
  migration dry-run before `--apply`.

Rollback immediately if API health fails twice, login or MFA setup fails, CSP
ingest returns non-2xx, the browser smoke test fails, or five-minute error rate
exceeds 2 percent. Before the TOTP data migration, restore the prior API image.
After any `v1` rows exist, keep this release's decryption code in service while
rolling back unrelated frontend/API changes. If the encryption key is lost,
the safe recovery is to disable affected users' MFA and require re-enrolment;
never copy encrypted values into logs or revert them to plaintext.
