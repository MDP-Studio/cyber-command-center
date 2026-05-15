# C3 Trust Gap Slice - Report-Only CSP + Self-Service Privacy

**Date opened:** 2026-05-15
**Source:** Audit finding "P2 Cyber Command Center trust gap: policy is clear, but no CSP yet and no self-service account export/deletion."
**Scope decision:** Phase 1 + Phase 2 together. CSP report sink stays infra-free (browser console) because Supabase is on its way out and a self-hosted DB will replace it.

## Constraints & Context

- Frontend: React 18 + Vite 5, single bundle served from Netlify.
- Backend: Supabase (Auth + Postgres + RLS) - temporary, slated for migration to self-hosted Postgres in Docker on a remote PC.
- Inline assets that matter for CSP:
  - `index.html` has an inline `<style>` block.
  - The entire app uses React inline `style={{}}` props.
  - Google Fonts CSS from `https://fonts.googleapis.com` and font files from `https://fonts.gstatic.com`.
  - Supabase API calls to `https://*.supabase.co`.
- Account model: Supabase Auth user record + 4 RLS-scoped tables (`profiles`, `task_progress`, `task_notes`, `study_sessions`). The browser anon key can wipe table rows but cannot delete the auth.users record - that needs service-role.

## Plan

### Phase 1 - Report-Only CSP (fast validation experiment)

- [x] Audit current asset surface (see Constraints above).
- [x] Add `Content-Security-Policy-Report-Only` header to `netlify.toml` covering:
  - `default-src 'self'`
  - `script-src 'self'`
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` (inline allowed because of React inline styles and the index.html `<style>` block)
  - `font-src 'self' https://fonts.gstatic.com data:`
  - `img-src 'self' data: https:`
  - `connect-src 'self' https://*.supabase.co https://*.supabase.in`
  - `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self' https://accounts.google.com`, `object-src 'none'`
  - No `report-uri` - violations land in browser DevTools console. Endpoint TBD once self-hosted backend is live; comment in `netlify.toml` flags the swap point.

### Phase 2 - Self-service privacy actions in UI

- [x] Add `PrivacyPanel` component to the Dashboard (works in both guest and signed-in modes; the copy adapts).
- [x] **Export My Data** button - JSON download, signed-in pulls from the four tables, guest dumps the three `ccc_*` localStorage keys.
- [x] **Delete My Account** button - "type DELETE to confirm" modal, RLS-scoped deletes, guest-key cleanup, `signOut()`, then `window.location.reload()` for a clean state across all four guest/signed-in × Supabase-configured combinations.
- [x] Surface honest auth-record notice so we don't oversell deletion.

### Phase 3 - Documentation

- [x] Update `SECURITY.md` "Known Gaps", current controls list, "Content Security Policy" section, and rollout plan.
- [x] Mirror the same updates in `public/security.html`.
- [x] Add a release-checklist line so future asset additions force a CSP review.

### Phase 4 - Verification

- [x] `npm run build` succeeds (`✓ built in 370ms`, 369 kB bundle).
- [x] `dist/` grep for external `https://` hosts shows only Google Fonts in `index.html` and anchor links in `privacy.html` - all covered by the new CSP.
- [x] Outcome documented in Review below.

## Avoid

- Marketing "enterprise readiness" anywhere in the README, security page, or UI before Phase 2 ships.
- Building a Supabase Edge Function for auth-user deletion - it's throwaway work given the upcoming migration.
- Setting up a hosted CSP report sink (e.g. report-uri.com) - same reason.

## Review

**Files changed**

- `netlify.toml` - added `Content-Security-Policy-Report-Only` with a comment block flagging the report-uri swap point.
- `nginx.conf` - mirrored all four existing security headers + the same Report-Only CSP so Docker hosting matches Netlify.
- `src/PrivacyPanel.jsx` - new component, ~230 lines. Self-contained: handles export, delete, confirmation modal, error/success surfaces. Works in guest and signed-in modes.
- `src/App.jsx` - two-line wiring: import + `<PrivacyPanel user={user} isGuest={isGuest} />` before `<FeedbackPanel />`.
- `SECURITY.md` - updated last-updated date, added "Content Security Policy" and "Self-service privacy actions" sections, rewrote Known Gaps to reflect the new posture, added a CSP-review line to the release checklist.
- `public/security.html` - mirrored the same updates with HTML-appropriate markup.
- `tasks/todo.md` - this file.

**What this ships**

- Report-Only CSP is live the moment Netlify (or Docker) redeploys. Browsing the app for the next 7 days will surface any blocked resource in DevTools.
- Signed-in users now have a "Privacy Controls" section on the dashboard. Export downloads a JSON snapshot; Delete is guarded by a "type DELETE" modal and wipes all four user-scoped tables. Guest users get the same controls scoped to localStorage.

**Deliberately not done (and why)**

- No Supabase Edge Function for full auth.users deletion. The user is migrating off Supabase to self-hosted Postgres in Docker; writing throwaway server-side code now is wasted effort. The UI is honest about this gap.
- No hosted CSP report sink (e.g. report-uri.com). Same reason - the planned sink lives on the future self-hosted backend. Comments in both `netlify.toml` and `nginx.conf` mark the exact swap point.
- No abstraction layer over Supabase. The privacy module imports `supabaseClient` directly. When the DB migration lands, `supabaseClient.js` is the single swap point and `PrivacyPanel.jsx` will follow that swap with no API changes.

**Followups after the 7-day experiment (2026-05-22)**

1. Review browser-console CSP reports collected during normal usage.
2. Tighten `img-src` (drop `https:` for a host allowlist) if no surprises.
3. Promote `Content-Security-Policy-Report-Only` → `Content-Security-Policy` in `netlify.toml` and `nginx.conf`.
4. When the self-hosted backend is up: add `/csp-report` and `report-to` directive; rewrite `connect-src` from `https://*.supabase.co` to the new host; add a service-side endpoint for full auth-record deletion and remove the email caveat from `PrivacyPanel.jsx` + both security docs.

## Lessons

- **Report-only CSP without a sink is still useful** when (a) the backend is in flux and (b) the experiment is short. DevTools console suffices for a 7-day pass, and it avoids building throwaway report-collection infra. Recorded in the parent `../tasks/lessons.md` if a session-wide lesson file exists.
- **React inline `style={{}}` props plus an inline `<style>` block in `index.html` force `style-src 'unsafe-inline'`.** If a stricter CSP is ever needed, both surfaces have to move to CSS-in-JS with nonces or hashed external stylesheets.
- **Delete-then-reload is more reliable than threading hook resets** across four (guest/signed-in × Supabase configured/not) state combinations.

