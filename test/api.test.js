import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../api/app.js';
import { generateTotpCode, hashToken } from '../api/security.js';

const ORIGIN = 'https://c3.mdpstudio.com.au';

class FakeDb {
  constructor() {
    this.users = [];
    this.sessions = [];
    this.progress = [];
    this.notes = [];
    this.studySessions = [];
    this.resets = [];
    this.mfaChallenges = [];
    this.cspReports = [];
    this.nextId = 1;
  }

  async health() { return true; }

  async findUserById(id) { return this.users.find((user) => user.id === id) || null; }
  async findUserByEmail(email) { return this.users.find((user) => user.email === email) || null; }
  async findUserByGoogleSubject(subject) { return this.users.find((user) => user.google_subject === subject) || null; }

  async createUser({ email, displayName, passwordHash = null, googleSubject = null, oldSupabaseId = null }) {
    const user = {
      id: `u-${this.nextId++}`,
      email,
      display_name: displayName,
      password_hash: passwordHash,
      google_subject: googleSubject,
      old_supabase_id: oldSupabaseId,
      created_at: new Date().toISOString(),
      mfa_totp_secret: null,
      mfa_enabled_at: null,
      mfa_pending_totp_secret: null,
      mfa_pending_expires_at: null,
    };
    this.users.push(user);
    return user;
  }

  async updateGoogleSubject(userId, googleSubject) {
    const user = await this.findUserById(userId);
    user.google_subject = googleSubject;
    return user;
  }

  async getAccountSecurity(userId) {
    return this.findUserById(userId);
  }

  async setPasswordHash(userId, passwordHash) {
    const user = await this.findUserById(userId);
    user.password_hash = passwordHash;
    return user;
  }

  async createSession({ userId, token, csrfToken, expiresAt }) {
    const session = {
      id: `s-${this.nextId++}`,
      user_id: userId,
      token_hash: hashToken(token),
      csrf_token_hash: hashToken(csrfToken),
      expires_at: expiresAt,
      revoked_at: null,
    };
    this.sessions.push(session);
    return session;
  }

  async findSessionByToken(token) {
    const tokenHash = hashToken(token);
    const session = this.sessions.find((item) => item.token_hash === tokenHash && !item.revoked_at && item.expires_at > new Date());
    if (!session) return null;
    const user = await this.findUserById(session.user_id);
    return {
      ...session,
      email: user.email,
      display_name: user.display_name,
      google_subject: user.google_subject,
      mfa_enabled_at: user.mfa_enabled_at,
    };
  }

  async rotateSessionCsrf(sessionId, csrfToken) {
    const session = this.sessions.find((item) => item.id === sessionId);
    session.csrf_token_hash = hashToken(csrfToken);
    return session;
  }

  async revokeSessionByToken(token) {
    const session = this.sessions.find((item) => item.token_hash === hashToken(token));
    if (session) session.revoked_at = new Date();
  }

  async revokeSessionsByUserId(userId) {
    this.sessions
      .filter((session) => session.user_id === userId)
      .forEach((session) => { session.revoked_at = new Date(); });
  }

  async setPendingMfaSecret(userId, secret, expiresAt) {
    const user = await this.findUserById(userId);
    user.mfa_pending_totp_secret = secret;
    user.mfa_pending_expires_at = expiresAt;
    return user;
  }

  async enableMfa(userId, secret) {
    const user = await this.findUserById(userId);
    user.mfa_totp_secret = secret;
    user.mfa_enabled_at = new Date().toISOString();
    user.mfa_pending_totp_secret = null;
    user.mfa_pending_expires_at = null;
    return user;
  }

  async disableMfa(userId) {
    const user = await this.findUserById(userId);
    user.mfa_totp_secret = null;
    user.mfa_enabled_at = null;
    user.mfa_pending_totp_secret = null;
    user.mfa_pending_expires_at = null;
    return user;
  }

  async createMfaChallenge({ userId, token, purpose, expiresAt }) {
    const challenge = {
      id: `mfa-${this.nextId++}`,
      user_id: userId,
      token_hash: hashToken(token),
      purpose,
      expires_at: expiresAt,
      used_at: null,
    };
    this.mfaChallenges.push(challenge);
    return challenge;
  }

  async consumeMfaChallenge(token, purpose) {
    const tokenHash = hashToken(token);
    const challenge = this.mfaChallenges.find((item) => (
      item.token_hash === tokenHash
      && item.purpose === purpose
      && !item.used_at
      && item.expires_at > new Date()
    ));
    if (!challenge) return null;
    challenge.used_at = new Date();
    return challenge;
  }

  async getProgress(userId) {
    return this.progress.filter((row) => row.user_id === userId);
  }

  async setProgress(userId, taskId, completed) {
    let row = this.progress.find((item) => item.user_id === userId && item.task_id === taskId);
    if (!row) {
      row = { user_id: userId, task_id: taskId };
      this.progress.push(row);
    }
    row.completed = completed;
    row.completed_at = completed ? new Date().toISOString() : null;
    return row;
  }

  async getNotes(userId) {
    return this.notes.filter((row) => row.user_id === userId);
  }

  async setNote(userId, taskId, content) {
    let row = this.notes.find((item) => item.user_id === userId && item.task_id === taskId);
    if (!row) {
      row = { user_id: userId, task_id: taskId };
      this.notes.push(row);
    }
    row.content = content;
    return row;
  }

  async getSessions(userId) {
    return this.studySessions.filter((row) => row.user_id === userId);
  }

  async addSession(userId, session) {
    const row = { id: `study-${this.nextId++}`, user_id: userId, ...session };
    this.studySessions.push(row);
    return row;
  }

  async exportUser(userId) {
    const user = await this.findUserById(userId);
    return {
      profile: user ? {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        old_supabase_id: user.old_supabase_id,
        created_at: user.created_at,
        mfa_enabled_at: user.mfa_enabled_at,
      } : null,
      task_progress: await this.getProgress(userId),
      task_notes: await this.getNotes(userId),
      study_sessions: await this.getSessions(userId),
    };
  }

  async deleteAccount(userId) {
    this.users = this.users.filter((row) => row.id !== userId);
    this.sessions = this.sessions.filter((row) => row.user_id !== userId);
    this.progress = this.progress.filter((row) => row.user_id !== userId);
    this.notes = this.notes.filter((row) => row.user_id !== userId);
    this.studySessions = this.studySessions.filter((row) => row.user_id !== userId);
  }

  async createPasswordResetToken({ userId, token, expiresAt }) {
    this.resets.push({ user_id: userId, token_hash: hashToken(token), expires_at: expiresAt, used_at: null });
  }

  async consumePasswordResetToken(token) {
    const reset = this.resets.find((item) => item.token_hash === hashToken(token) && !item.used_at && item.expires_at > new Date());
    if (!reset) return null;
    reset.used_at = new Date();
    return reset;
  }

  async insertCspReport(report) {
    this.cspReports.push(report);
  }
}

function testConfig() {
  return {
    production: false,
    appOrigins: [ORIGIN],
    apiOrigin: 'http://127.0.0.1:8080',
    cookieSecure: false,
    cookieDomain: undefined,
    sessionDays: 14,
    bcryptCost: 4,
    csrfHeader: 'x-csrf-token',
    googleClientId: 'google-client',
    googleClientSecret: 'google-secret',
    googleRedirectUri: 'http://127.0.0.1:8080/api/auth/google/callback',
    passwordResetBaseUrl: ORIGIN,
    authLogResetLinks: false,
    cspReportIpSalt: 'test-salt',
  };
}

function cookieHeader(response) {
  const cookies = response.cookies || [];
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

function body(response) {
  return JSON.parse(response.body);
}

function appWith(db = new FakeDb(), extras = {}) {
  const app = createApp({
    db,
    config: testConfig(),
    mailer: extras.mailer || { async sendPasswordReset() { return { sent: true }; } },
    googleClient: extras.googleClient || {
      async exchangeCode() { return { id_token: 'mock-id-token' }; },
      async verifyIdToken(_idToken, nonce) {
        return { sub: `google-${nonce}`, email: 'google@example.com', email_verified: true, name: 'Google User', nonce };
      },
    },
  });
  return { app, db };
}

test('signup creates a session and signed-in data is scoped to that user', async () => {
  const { app, db } = appWith();
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: { origin: ORIGIN },
    payload: { email: 'owner@example.com', password: 'long-password', displayName: 'Owner' },
  });
  assert.equal(signup.statusCode, 200);
  const cookies = cookieHeader(signup);
  const csrfToken = body(signup).csrfToken;

  const progress = await app.inject({
    method: 'PUT',
    url: '/api/progress/f1',
    headers: { origin: ORIGIN, cookie: cookies, 'x-csrf-token': csrfToken },
    payload: { completed: true },
  });
  assert.equal(progress.statusCode, 200);

  const note = await app.inject({
    method: 'PUT',
    url: '/api/notes/f1',
    headers: { origin: ORIGIN, cookie: cookies, 'x-csrf-token': csrfToken },
    payload: { content: 'done cleanly' },
  });
  assert.equal(note.statusCode, 200);

  const session = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    headers: { origin: ORIGIN, cookie: cookies, 'x-csrf-token': csrfToken },
    payload: { label: 'Study', duration_seconds: 120, session_date: '2026-05-15' },
  });
  assert.equal(session.statusCode, 200);

  const exported = await app.inject({ method: 'GET', url: '/api/privacy/export', headers: { cookie: cookies } });
  assert.equal(exported.statusCode, 200);
  assert.equal(body(exported).data.task_progress.length, 1);
  assert.equal(body(exported).data.task_notes.length, 1);
  assert.equal(body(exported).data.study_sessions.length, 1);

  assert.equal(db.users.length, 1);
  await app.close();
});

test('state-changing signed-in routes require CSRF', async () => {
  const { app } = appWith();
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: { origin: ORIGIN },
    payload: { email: 'csrf@example.com', password: 'long-password', displayName: 'CSRF' },
  });
  const response = await app.inject({
    method: 'PUT',
    url: '/api/progress/f1',
    headers: { origin: ORIGIN, cookie: cookieHeader(signup) },
    payload: { completed: true },
  });
  assert.equal(response.statusCode, 403);
  await app.close();
});

test('state-changing routes reject disallowed origins with 403', async () => {
  const { app } = appWith();
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: { origin: 'https://evil.example' },
    payload: { email: 'origin@example.com', password: 'long-password', displayName: 'Origin' },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(body(response).error, 'Origin not allowed.');
  await app.close();
});

test('CORS preflight allows signed-in mutating routes', async () => {
  const { app } = appWith();
  const response = await app.inject({
    method: 'OPTIONS',
    url: '/api/progress/f1',
    headers: {
      origin: ORIGIN,
      'access-control-request-method': 'PUT',
      'access-control-request-headers': 'content-type,x-csrf-token',
    },
  });
  assert.equal(response.statusCode, 204);
  assert.match(response.headers['access-control-allow-methods'], /PUT/);
  assert.match(response.headers['access-control-allow-methods'], /DELETE/);
  assert.match(response.headers['access-control-allow-headers'], /x-csrf-token/);
  await app.close();
});

test('account deletion cascades app data and clears session', async () => {
  const { app, db } = appWith();
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: { origin: ORIGIN },
    payload: { email: 'delete@example.com', password: 'long-password', displayName: 'Delete' },
  });
  const cookies = cookieHeader(signup);
  const csrfToken = body(signup).csrfToken;
  await app.inject({
    method: 'PUT',
    url: '/api/progress/f1',
    headers: { origin: ORIGIN, cookie: cookies, 'x-csrf-token': csrfToken },
    payload: { completed: true },
  });
  const deleted = await app.inject({
    method: 'DELETE',
    url: '/api/privacy/account',
    headers: { origin: ORIGIN, cookie: cookies, 'x-csrf-token': csrfToken },
  });
  assert.equal(deleted.statusCode, 200);
  assert.equal(db.users.length, 0);
  assert.equal(db.progress.length, 0);
  await app.close();
});

test('Google OAuth callback creates or links a verified Google user', async () => {
  const { app, db } = appWith();
  const start = await app.inject({
    method: 'GET',
    url: `/api/auth/google/start?returnTo=${encodeURIComponent(ORIGIN)}`,
  });
  assert.equal(start.statusCode, 302);
  const state = start.cookies.find((cookie) => cookie.name === 'c3_oauth_state').value;
  const callback = await app.inject({
    method: 'GET',
    url: `/api/auth/google/callback?state=${encodeURIComponent(state)}&code=ok`,
    headers: { cookie: cookieHeader(start) },
  });
  assert.equal(callback.statusCode, 302);
  assert.equal(db.users.length, 1);
  assert.equal(db.users[0].email, 'google@example.com');
  assert.ok(db.users[0].google_subject);
  await app.close();
});

test('password reset token is one-time use', async () => {
  const sent = [];
  const { app, db } = appWith(new FakeDb(), {
    mailer: { async sendPasswordReset(email, token) { sent.push({ email, token }); } },
  });
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: { origin: ORIGIN },
    payload: { email: 'reset@example.com', password: 'long-password', displayName: 'Reset' },
  });
  const request = await app.inject({
    method: 'POST',
    url: '/api/auth/password-reset/request',
    headers: { origin: ORIGIN },
    payload: { email: 'reset@example.com' },
  });
  assert.equal(request.statusCode, 200);
  assert.equal(sent.length, 1);
  const confirm = await app.inject({
    method: 'POST',
    url: '/api/auth/password-reset/confirm',
    headers: { origin: ORIGIN },
    payload: { token: sent[0].token, password: 'new-long-password' },
  });
  assert.equal(confirm.statusCode, 200);
  assert.ok(db.users[0].password_hash);
  const restored = await app.inject({
    method: 'GET',
    url: '/api/auth/session',
    headers: { cookie: cookieHeader(signup) },
  });
  assert.equal(body(restored).user, null);
  const replay = await app.inject({
    method: 'POST',
    url: '/api/auth/password-reset/confirm',
    headers: { origin: ORIGIN },
    payload: { token: sent[0].token, password: 'another-long-password' },
  });
  assert.equal(replay.statusCode, 400);
  await app.close();
});

test('authenticator MFA setup makes password login require a second factor', async () => {
  const { app } = appWith();
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: { origin: ORIGIN },
    payload: { email: 'mfa@example.com', password: 'long-password', displayName: 'MFA' },
  });
  assert.equal(signup.statusCode, 200);
  const cookies = cookieHeader(signup);
  const csrfToken = body(signup).csrfToken;

  const setup = await app.inject({
    method: 'POST',
    url: '/api/account/mfa/setup',
    headers: { origin: ORIGIN, cookie: cookies, 'x-csrf-token': csrfToken },
  });
  assert.equal(setup.statusCode, 200);
  const setupBody = body(setup);
  assert.match(setupBody.otpauthUri, /^otpauth:\/\/totp\//);

  const enable = await app.inject({
    method: 'POST',
    url: '/api/account/mfa/enable',
    headers: { origin: ORIGIN, cookie: cookies, 'x-csrf-token': csrfToken },
    payload: { code: generateTotpCode(setupBody.secret) },
  });
  assert.equal(enable.statusCode, 200);
  assert.equal(body(enable).mfa.enabled, true);
  assert.equal(body(enable).mfa.loginProtected, true);

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin: ORIGIN },
    payload: { email: 'mfa@example.com', password: 'long-password' },
  });
  assert.equal(login.statusCode, 200);
  assert.equal(body(login).mfaRequired, true);
  assert.ok(body(login).ticket);
  assert.equal(login.cookies.some((cookie) => cookie.name === 'c3_session'), false);

  const verified = await app.inject({
    method: 'POST',
    url: '/api/auth/mfa/login/verify',
    headers: { origin: ORIGIN },
    payload: { ticket: body(login).ticket, code: generateTotpCode(setupBody.secret) },
  });
  assert.equal(verified.statusCode, 200);
  assert.equal(body(verified).user.email, 'mfa@example.com');
  assert.equal(body(verified).user.mfaEnabled, true);
  await app.close();
});

test('MFA-enabled account deletion requires a valid step-up code', async () => {
  const { app, db } = appWith();
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: { origin: ORIGIN },
    payload: { email: 'delete-mfa@example.com', password: 'long-password', displayName: 'Delete MFA' },
  });
  const cookies = cookieHeader(signup);
  const csrfToken = body(signup).csrfToken;
  const setup = await app.inject({
    method: 'POST',
    url: '/api/account/mfa/setup',
    headers: { origin: ORIGIN, cookie: cookies, 'x-csrf-token': csrfToken },
  });
  const secret = body(setup).secret;
  const enable = await app.inject({
    method: 'POST',
    url: '/api/account/mfa/enable',
    headers: { origin: ORIGIN, cookie: cookies, 'x-csrf-token': csrfToken },
    payload: { code: generateTotpCode(secret) },
  });
  assert.equal(enable.statusCode, 200);

  const blocked = await app.inject({
    method: 'DELETE',
    url: '/api/privacy/account',
    headers: { origin: ORIGIN, cookie: cookies, 'x-csrf-token': csrfToken },
  });
  assert.equal(blocked.statusCode, 403);
  assert.equal(db.users.length, 1);

  const deleted = await app.inject({
    method: 'DELETE',
    url: '/api/privacy/account',
    headers: { origin: ORIGIN, cookie: cookies, 'x-csrf-token': csrfToken },
    payload: { mfaCode: generateTotpCode(secret) },
  });
  assert.equal(deleted.statusCode, 200);
  assert.equal(db.users.length, 0);
  await app.close();
});

test('CSP report endpoint accepts browser report content type', async () => {
  const { app, db } = appWith();
  const response = await app.inject({
    method: 'POST',
    url: '/api/csp-report',
    headers: { 'content-type': 'application/csp-report', 'user-agent': 'test-agent' },
    payload: JSON.stringify({ 'csp-report': { 'violated-directive': 'connect-src' } }),
  });
  assert.equal(response.statusCode, 200);
  assert.equal(db.cspReports.length, 1);
  assert.equal(db.cspReports[0].body['csp-report']['violated-directive'], 'connect-src');
  assert.equal(db.cspReports[0].userAgent, 'test-agent');
  await app.close();
});
