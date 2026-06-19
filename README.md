# Cyber Command Center

A self-directed cybersecurity training platform with progress tracking, study timer, notes, guest mode, and optional synced accounts through a self-hosted backend.

**[Live Demo](https://c3.mdpstudio.com.au)** - try it now, no account needed.

**MDP Studio project page:** [CyberRoadmap / C3](https://mdpstudio.com.au/projects/cybersecurity-study-roadmap/)

## Screenshots

### Login & Guest Access

Google OAuth, email/password, or skip straight to guest mode. Guest progress saves to your browser automatically.

![Login](screenshots/01-login.png)

### Dashboard

Track 49 tasks across 6 phases. Stats update in real time: progress percentage, tasks completed, planned hours, and logged study time.
The dashboard also includes a lightweight simulation-risk panel for logging tabletop or lab drill outcomes without sending phishing campaigns.
It now includes a small assessment-drill panel with ATT&CK/NIST-mapped rubrics so hands-on work can be scored without storing raw lab evidence.

![Dashboard](screenshots/02-dashboard.png)

### Task Tracking

Expand any phase to see modules and tasks. Check off completed work, open external lab links, and attach notes.

![Tasks](screenshots/05-tasks.png)

### Study Timer

Start, pause, and stop a timer with session labels. Completed sessions log to your training history with daily breakdowns, cumulative hours, and streak tracking.

![Study Timer](screenshots/03-timer.png)

### Training Log

Daily breakdown of study sessions with dates, labels, durations, and streak counter.

![Training Log](screenshots/04-training-log.png)

## Quick Start

### Option A: Guest Mode

Visit the **[live demo](https://c3.mdpstudio.com.au)**. Guest mode works instantly with localStorage persistence.

### Option B: Local Development

```bash
cp .env.example .env
npm install
npm run dev
```

If `VITE_C3_API_URL` is empty, the app runs in guest-only mode. Signed-in sync uses the self-hosted API and Postgres stack documented in [`docs/self-hosted-backend.md`](docs/self-hosted-backend.md).

## Deploy

**Frontend:** Netlify remains the production frontend host. Set `VITE_C3_API_URL=https://c3-api.mdpstudio.com.au` only after the remote API passes health, migration, backup, and smoke tests.

**Search readiness:** `public/robots.txt` and `public/sitemap.xml` publish the canonical `https://c3.mdpstudio.com.au` URLs for the dashboard, privacy, terms, and security pages.
Public growth pages live at `/roadmap` and `/soc-checklist` so the project can rank for student and junior analyst learning searches, not only branded app queries.

**Backend:** run `docker-compose.remote.yml` on the remote PC. It starts the Fastify API, a private Postgres container, and a scheduled backup container. Postgres must stay off the public internet.

**Frontend Docker preview:**

```bash
docker build --build-arg VITE_C3_API_URL=https://c3-api.mdpstudio.com.au -t cyber-command .
docker run -p 3000:3000 cyber-command
```

## Features

- **Zero-friction guest mode** - works without any backend; progress is saved to localStorage.
- **Google OAuth + email auth** - sign up, log in, and reset password through the self-hosted API.
- **Optional authenticator MFA** - email/password accounts can require a 6-digit code at login and for high-risk account deletion.
- **6-phase curriculum** - structured cybersecurity training across foundations, SOC, offense, forensics, governance, and certification prep.
- **Real-time progress tracking** - synced across devices for signed-in users, local-only for guests.
- **Study timer** - start, pause, and stop with labeled session logging.
- **Training log** - daily breakdown, streak counter, and cumulative hours.
- **Simulation-risk tracking** - log phishing, social-engineering, credential-hygiene, and incident-response drill outcomes with a compact risk trend.
- **Assessment drills** - score a small set of ATT&CK/NIST-mapped hands-on exercises and record pass, review, or fail outcomes as compact metadata.
- **Per-task notes** - keep commands, flags, findings, and reminders inline.
- **Server-side access control** - each API request is scoped to the signed-in user.
- **Account security and privacy controls** - enable MFA, export data, or delete the account from the dashboard.

## Tech Stack

- **Frontend:** React 18, Vite, custom dark terminal aesthetic.
- **Backend:** Fastify API, PostgreSQL, secure cookies, CSRF checks, Google OAuth, password reset, optional TOTP MFA, CSP reporting.
- **Deployment:** Netlify frontend, remote Docker backend, Cloudflare Tunnel for the API.

## Architecture

```txt
React Frontend (Vite)
  - Dashboard
  - Study timer
  - Auth and guest mode

If VITE_C3_API_URL is set:
  Browser -> self-hosted API -> private PostgreSQL

If VITE_C3_API_URL is empty:
  Browser -> localStorage guest mode
```

## Security

Security posture is documented in [`SECURITY.md`](SECURITY.md) and on the live [Security Policy](https://c3.mdpstudio.com.au/security) page. The current model is intentionally small: guest data stays in browser storage, signed-in account data is scoped by the backend API, email/password accounts can opt in to authenticator MFA, and task notes, simulation-event labels, or assessment-drill metadata should not be used for secrets, client data, payment details, or incident evidence.

Production headers via `netlify.toml`:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` limited to the app, Google Fonts, and `https://c3-api.mdpstudio.com.au`

Security reports: email `meidie@mdpstudio.com.au` with the subject `Security report: Cyber Command Center`. See `SECURITY.md` for scope, data lifecycle, known gaps, and incident reporting details.

[Privacy Policy](https://c3.mdpstudio.com.au/privacy) | [Terms of Service](https://c3.mdpstudio.com.au/terms) | [Security Policy](https://c3.mdpstudio.com.au/security)
