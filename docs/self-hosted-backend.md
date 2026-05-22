# Self-Hosted Backend Deployment

Last updated: 2026-05-22

Cyber Command Center now uses Netlify for the static frontend and a self-hosted Docker backend for signed-in accounts. Guest mode still works without any backend.

## Production Topology

- Frontend: `https://c3.mdpstudio.com.au` on Netlify.
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

4. Verify health locally on the remote:

```bash
curl -fsS http://127.0.0.1:8089/api/health
curl -fsS http://100.110.79.52:8089/api/health
```

5. Add the Cloudflare Tunnel route:

```txt
c3-api.mdpstudio.com.au -> http://100.110.79.52:8089
```

6. Verify through the public API domain:

```bash
curl -fsS https://c3-api.mdpstudio.com.au/api/health
```

7. Set Netlify environment variable:

```txt
VITE_C3_API_URL=https://c3-api.mdpstudio.com.au
```

8. Redeploy Netlify and run the smoke tests in the README.

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

The apply run prints target counts from Postgres for the migrated Supabase IDs. Compare source and target counts before changing Netlify.

Keep Supabase as rollback/archive for 14 days after cutover. Remove Supabase env vars only after the new API has passed smoke tests and the migrated users can access their data.

## Smoke Tests

- `GET /api/health` returns `{ "ok": true }`.
- Email/password login works for the migrated email user after password reset.
- Optional authenticator MFA can be enabled for an email/password account, blocks password login until a valid code is submitted, and requires a code for account deletion.
- Google login works for the 3 migrated Google users.
- Dashboard loads progress, notes, and study sessions.
- Export downloads all user-scoped data.
- Delete removes the account and returns to signed-out state.
- Browser devtools show no `*.supabase.co` requests.
- CSP reports post to `/api/csp-report`.

## Backup Restore Gate

Before cutover, restore the latest backup into a temporary Postgres container and verify the table list plus row counts. Do not switch Netlify to the production API until a restore has been proven once.
