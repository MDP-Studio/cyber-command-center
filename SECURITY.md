# Security Policy

Last updated: 2026-05-15

Cyber Command Center is a free cybersecurity training tracker. This policy documents the current security model, data lifecycle, incident reporting process, and known limits so the product's security posture is explicit instead of implied.

This is a portfolio and training workflow project. It is not currently a certified enterprise platform, a managed SOC service, or a system for storing sensitive client data, lab credentials, exploit material, payment details, or production incident evidence.

## Supported Scope

Security reports are in scope for:

- The React/Vite web app in this repository.
- The Supabase schema in `supabase/schema.sql`.
- Authentication, guest mode, account sync, progress tracking, task notes, and study session logging.
- Deployment configuration in `netlify.toml`, `Dockerfile`, and static policy pages under `public/`.

Out of scope:

- Third-party learning platforms linked from the curriculum.
- Denial-of-service testing, spam, social engineering, physical attacks, or attacks against accounts you do not own.
- Findings that require storing real secrets, client data, malware, payment data, or private incident data in the app.

## Security Model

### Assets Protected

- Account identity: Supabase Auth user ID, email address, and optional display name.
- Training progress: completed task IDs and completion timestamps.
- Task notes: free-text notes entered by the user.
- Study sessions: timer labels, duration, dates, and created timestamps.
- Guest data: local browser keys `ccc_progress`, `ccc_notes`, and `ccc_sessions`.

### Trust Boundaries

- Browser guest mode is local-only. Guest progress, notes, and session data stay in `localStorage` and are not synced by the app.
- Signed-in mode sends account progress, notes, and session logs to Supabase using the public Supabase anon key.
- Supabase Auth handles passwords, OAuth sessions, reset links, and token storage. The app must never ship a Supabase service-role key or other server-side secret to the browser.
- Netlify serves the static frontend and applies the security headers configured in `netlify.toml`.

### Current Controls

- Optional guest mode lets users avoid account creation.
- Row Level Security is enabled on `profiles`, `task_progress`, `task_notes`, and `study_sessions`.
- RLS policies restrict select, insert, update, and delete operations to `auth.uid()`.
- Frontend account queries filter by the signed-in user's ID.
- Supabase Auth handles email/password, password reset, and Google OAuth.
- Notes are rendered through React text nodes and textarea values, not raw HTML injection paths.
- External curriculum links use `target="_blank"` with `rel="noopener noreferrer"`.
- Netlify security headers set frame denial, MIME sniffing protection, strict referrer policy, and a restrictive permissions policy.
- A `Content-Security-Policy-Report-Only` header is shipped from `netlify.toml` and `nginx.conf` (see "Content Security Policy" below).
- The signed-in dashboard surfaces a Privacy Controls panel with self-service "Export My Data" and "Delete My Account" actions (see "Self-service privacy actions" below).
- `.env` is ignored by Git. Only the public example file should be tracked.

### Known Gaps

- There is no formal compliance certification, uptime SLA, DPA, SSO/SAML, audit-log export, or enterprise admin console.
- Self-service deletion clears every application row (profile, progress, notes, sessions) but the Supabase Auth sign-in record remains until a service-role deletion runs. Until the planned self-hosted backend ships, full sign-in removal is still email-based via `meidie@mdpstudio.com.au`.
- The CSP is currently report-only. Enforcement is gated on a 7-day violation review that started 2026-05-15.
- The CSP report sink is the browser DevTools console - no `report-uri` / `report-to` endpoint yet. The planned sink lives on the self-hosted backend that will replace Supabase.
- The app has no dedicated backend incident automation. Incident response is currently manual.
- Task notes are free text. Users should not store passwords, API keys, customer data, private lab flags, payment data, or live incident evidence in notes.

### Content Security Policy

The current policy is shipped as `Content-Security-Policy-Report-Only` from both `netlify.toml` (production) and `nginx.conf` (Docker). Directive summary:

- `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`.
- `script-src 'self'` - Vite emits self-hosted hashed bundles only.
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` - required because the React app uses inline `style={{}}` props throughout and `index.html` ships a small inline `<style>` block; Google Fonts CSS is loaded from `fonts.googleapis.com`.
- `font-src 'self' https://fonts.gstatic.com data:` - Google Fonts file domain plus `data:` for any inline glyphs.
- `img-src 'self' data: https:` - generous during the experiment; tighten once violations are reviewed.
- `connect-src 'self' https://*.supabase.co https://*.supabase.in` - Supabase API. Replace with the self-hosted backend host after migration.
- `form-action 'self' https://accounts.google.com` - Google OAuth redirect.

**Rollout plan.** Browse signed-in flows, guest flows, and the static policy pages for seven days starting 2026-05-15. Collect DevTools console reports for any blocked resource. When the violation list is clean (or only contains intentional changes), promote the header to enforcing `Content-Security-Policy` and add a `report-uri` / `report-to` pointing at the self-hosted endpoint once it exists.

### Self-service privacy actions

The signed-in dashboard exposes a "Privacy Controls" section with two actions, implemented in `src/PrivacyPanel.jsx`:

- **Export My Data** - downloads a JSON snapshot of the user's profile, task progress, task notes, and study sessions. In guest mode, the same button dumps the `ccc_progress`, `ccc_notes`, and `ccc_sessions` localStorage keys.
- **Delete My Account** - opens a "type DELETE to confirm" modal. On confirmation it deletes every row scoped to the user from `task_progress`, `task_notes`, `study_sessions`, and `profiles` (RLS lets the user delete their own rows), clears the guest localStorage keys defensively, signs the user out, and reloads. In guest mode the same flow clears localStorage and reloads.

The Supabase Auth sign-in record is **not** removed by this flow because the browser anon key cannot reach `auth.users`. That step still requires either an email request to `meidie@mdpstudio.com.au` or a service-role deletion run, and will become self-service once the planned self-hosted backend replaces Supabase.

## Data Lifecycle

### Guest Mode

- Stored data: progress, notes, and session logs in browser `localStorage`.
- Storage location: the user's browser only.
- Retention: until the user clears site data, browser storage, or the browser profile.
- Deletion path: clear browser storage for `https://c3.mdpstudio.com.au` or use browser site-data controls.
- Sync: none.

### Signed-In Mode

- Stored data: Supabase Auth account, profile display name, task progress, task notes, and study sessions.
- Storage location: Supabase-managed PostgreSQL database and Supabase Auth.
- Retention: kept until the user requests deletion or the Supabase project owner removes the account/data.
- Deletion path: email a deletion request to `meidie@mdpstudio.com.au`. Deleting the Supabase Auth user cascades application rows through the schema's `on delete cascade` relationships.
- Backup note: deleted records may remain in provider-managed backups for the provider's normal backup retention window.

### Data Minimization Rules

- Do not request or store payment details.
- Do not request or store client-private material.
- Do not request or store lab credentials, API keys, passwords, seed phrases, SSH keys, cloud secrets, or exchange keys.
- Do not use task notes as an incident evidence repository.
- Keep the Supabase anon key as the only browser-exposed Supabase key.

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

## Abuse Cases Reviewed

This checklist was reviewed against the current repository on 2026-05-08:

- Cross-user data access: Supabase RLS policies scope profile, progress, note, and session rows to `auth.uid()`.
- Guest data exposure: guest data is local browser storage only and is not sent to Supabase by guest-mode paths.
- Secret leakage: `.env` is ignored and no service-role key should be committed or shipped to the browser.
- Stored script injection: notes are not rendered as raw HTML.
- Tabnabbing: external links use `rel="noopener noreferrer"`.
- Data deletion: self-service data deletion is available in the dashboard; full sign-in (auth.users) removal still requires an email request.
- Incident handling: reporting path is documented, but response is manual and best effort.
- Sensitive-data misuse: the policy tells users not to store secrets, client data, payment details, or incident evidence in notes.

## Release Checklist

Before shipping security-sensitive changes:

- Confirm `.env` and any secrets are untracked.
- Run `npm run build`.
- Run `npm audit`.
- Review `supabase/schema.sql` if tables or access patterns changed.
- Check `netlify.toml` headers if new external scripts, frames, sensors, or third-party services are added.
- Update this file, `README.md`, and public policy pages when data collection, retention, auth, or reporting behavior changes.
- Re-check the CSP directive list in `netlify.toml` and `nginx.conf` when adding any new external script, style, font, image host, API host, OAuth provider, or form action.
