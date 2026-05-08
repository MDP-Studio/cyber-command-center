# Security Policy

Last updated: 2026-05-08

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
- `.env` is ignored by Git. Only the public example file should be tracked.

### Known Gaps

- There is no formal compliance certification, uptime SLA, DPA, SSO/SAML, audit-log export, or enterprise admin console.
- Account deletion is request-based. The app does not yet provide self-service account export or deletion.
- Content Security Policy is not configured yet. Add and test a CSP before collecting more sensitive data or marketing the app as enterprise-ready.
- The app has no dedicated backend incident automation. Incident response is currently manual.
- Task notes are free text. Users should not store passwords, API keys, customer data, private lab flags, payment data, or live incident evidence in notes.

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
- Data deletion: deletion is documented, but self-service deletion remains a gap.
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
