# Security Policy

Last updated: 2026-05-22

Cyber Command Center is a free cybersecurity training tracker. This policy documents the current security model, data lifecycle, incident reporting process, and known limits so the product's security posture is explicit instead of implied.

This is a portfolio and training workflow project. It is not currently a certified enterprise platform, a managed SOC service, or a system for storing sensitive client data, lab credentials, exploit material, payment details, or production incident evidence.

## Supported Scope

Security reports are in scope for:

- The React/Vite web app in this repository.
- The self-hosted Fastify API under `api/`.
- The PostgreSQL schema under `api/migrations/`.
- Authentication, guest mode, account sync, progress tracking, task notes, study session logging, export, and deletion.
- Deployment configuration in `netlify.toml`, `Dockerfile`, `api/Dockerfile`, `docker-compose.remote.yml`, and static policy pages under `public/`.

Out of scope:

- Third-party learning platforms linked from the curriculum.
- Denial-of-service testing, spam, social engineering, physical attacks, or attacks against accounts you do not own.
- Findings that require storing real secrets, client data, malware, payment data, or private incident data in the app.

## Security Model

### Assets Protected

- Account identity: user ID, email address, optional display name, and optional Google OAuth subject.
- Session state: hashed session tokens and CSRF token hashes in the backend database.
- Account MFA state: authenticator secret, pending setup secret, MFA enabled timestamp, and hashed short-lived login challenge tokens.
- Training progress: completed task IDs and completion timestamps.
- Task notes: free-text notes entered by the user.
- Study sessions: timer labels, duration, dates, and created timestamps.
- Guest data: local browser keys `ccc_progress`, `ccc_notes`, and `ccc_sessions`.

### Trust Boundaries

- Browser guest mode is local-only. Guest progress, notes, and session data stay in `localStorage` and are not synced by the app.
- Signed-in mode sends account progress, notes, and session logs to the self-hosted API at `https://c3-api.mdpstudio.com.au`.
- PostgreSQL is reachable only from the private Docker network. It must not expose a public host port.
- The browser never receives database credentials, Google client secrets, SMTP secrets, service-role keys, or backup credentials.
- Netlify serves the static frontend and applies the security headers configured in `netlify.toml`.

### Current Controls

- Optional guest mode lets users avoid account creation.
- Email/password auth and Google OAuth are handled by the self-hosted API.
- Email/password accounts can opt in to authenticator MFA. Once enabled, password login returns a short-lived MFA challenge instead of a session until a valid 6-digit TOTP code is submitted.
- High-risk account actions are explicitly marked in the dashboard. Account deletion requires an MFA step-up code when MFA is enabled.
- Google-only accounts should use Google Account 2-Step Verification for sign-in. App-level authenticator MFA is currently enabled only for email/password accounts.
- Passwords are stored only as bcrypt hashes.
- Session cookies are `HttpOnly`, `Secure` in production, `SameSite=Lax`, and backed by hashed server-side session tokens.
- State-changing signed-in routes require a valid session, an allowed `Origin`, and a CSRF token.
- API data routes derive the user from the session, not from client-provided user IDs.
- Account deletion runs server-side and deletes the user row, cascading app data through PostgreSQL foreign keys.
- Password reset tokens are hashed in the database, short-lived, and single-use.
- Google OAuth validates state, nonce, issuer, audience, expiry, and verified email before login.
- Notes are rendered through React text nodes and textarea values, not raw HTML injection paths.
- External curriculum links use `target="_blank"` with `rel="noopener noreferrer"`.
- Netlify security headers set frame denial, MIME sniffing protection, strict referrer policy, and a restrictive permissions policy.
- A `Content-Security-Policy` header is shipped from `netlify.toml` and `nginx.conf`, restricted to the frontend, Google Fonts, and `https://c3-api.mdpstudio.com.au`.

### Known Gaps

- There is no formal compliance certification, uptime SLA, DPA, SSO/SAML, audit-log export, or enterprise admin console.
- The remote Docker health check, Cloudflare Tunnel route, backup restore test, Supabase import, and API smoke tests have passed. The MFA pilot still needs browser validation with the first small user group, including sign-in friction and recovery handling.
- SMTP is required for production password reset emails. `AUTH_LOG_RESET_LINKS=true` is development-only.
- Incident response is currently manual.
- Task notes are free text. Users should not store passwords, API keys, customer data, private lab flags, payment data, or live incident evidence in notes.

## Content Security Policy

The current policy is shipped as enforcing `Content-Security-Policy` from both `netlify.toml` and `nginx.conf`.

- `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`.
- `script-src 'self'`.
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`.
- `font-src 'self' https://fonts.gstatic.com data:`.
- `img-src 'self' data: https:`.
- `connect-src 'self' https://c3-api.mdpstudio.com.au`.
- `form-action 'self' https://accounts.google.com`.
- `report-uri https://c3-api.mdpstudio.com.au/api/csp-report`.

## Self-Service Privacy Actions

The signed-in dashboard exposes Account Security and Privacy Controls sections:

- **Export My Data**: downloads a JSON snapshot of the user's profile, task progress, task notes, and study sessions. In guest mode, the same button dumps the `ccc_progress`, `ccc_notes`, and `ccc_sessions` localStorage keys.
- **Authenticator MFA**: email/password users can generate a TOTP setup key, verify one code, and later disable MFA only after entering a valid code.
- **Delete My Account**: opens a "type DELETE to confirm" modal. If MFA is enabled, the modal also requires a current MFA code. On confirmation it calls the backend deletion route, deletes the account and user-scoped app data, clears guest localStorage keys defensively, and reloads. In guest mode the same flow clears localStorage and reloads.

Deleted records may remain in provider-managed backups for the normal backup retention window.

## Data Lifecycle

### Guest Mode

- Stored data: progress, notes, and session logs in browser `localStorage`.
- Storage location: the user's browser only.
- Retention: until the user clears site data, browser storage, or the browser profile.
- Deletion path: clear browser storage for `https://c3.mdpstudio.com.au` or use the Privacy Controls panel in guest mode.
- Sync: none.

### Signed-In Mode

- Stored data: account identity, hashed password if email/password is used, Google subject if OAuth is used, authenticator MFA state if enabled, task progress, task notes, study sessions, sessions, reset tokens, MFA login challenge hashes, and CSP reports.
- Storage location: self-hosted PostgreSQL in Docker on the remote PC.
- Retention: kept until the user deletes the account or the project owner removes the account/data.
- Deletion path: Privacy Controls panel or manual owner action.
- Backup note: deleted records may remain in backups for the configured backup retention window.

### Data Minimization Rules

- Do not request or store payment details.
- Do not request or store client-private material.
- Do not request or store lab credentials, API keys, passwords, seed phrases, SSH keys, cloud secrets, or exchange keys.
- Do not use task notes as an incident evidence repository.

## Incident Reporting

Report security issues to `meidie@mdpstudio.com.au` with the subject:

`Security report: Cyber Command Center`

Include:

- Affected URL or file path.
- Steps to reproduce.
- Expected result and actual result.
- Browser/device details if relevant.
- Screenshots or logs with secrets removed.
- Whether you tested in guest mode or a signed-in account you own.

Do not include passwords, API keys, private account data, payment details, client data, or third-party platform secrets. Do not publicly disclose an unfixed issue until it has been triaged.

Response is best effort for a portfolio project. Security reports are prioritized over feature requests, and the current target is to acknowledge actionable reports within five business days.

## Release Checklist

Before shipping security-sensitive changes:

- Confirm `.env`, `.env.production`, migration exports, and secrets are untracked.
- Run `npm test`.
- Run `npm run build`.
- Run `npm audit`.
- Run `npm run api:migrate` against the target database.
- Verify MFA setup, MFA password login, MFA disable, and MFA-protected account deletion with an email/password account.
- Verify `/api/health` locally and through `https://c3-api.mdpstudio.com.au`.
- Verify migrated Google and email users can access their data.
- Verify backup creation and one restore dry run.
- Re-check the CSP directive list in `netlify.toml` and `nginx.conf` when adding any new external script, style, font, image host, API host, OAuth provider, or form action.
