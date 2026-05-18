import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { loadConfig, isAllowedOrigin } from './config.js';
import { createMailer } from './email.js';
import {
  CSRF_COOKIE,
  OAUTH_NONCE_COOKIE,
  OAUTH_RETURN_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  clearCookie,
  cookieOptions,
  hashIp,
  hashPassword,
  hashToken,
  isValidEmail,
  normalizeEmail,
  publicUser,
  randomToken,
  sessionExpiresAt,
  verifyPassword,
} from './security.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function oneHourFromNow() {
  const expires = new Date();
  expires.setHours(expires.getHours() + 1);
  return expires;
}

function maxAge(config) {
  return config.sessionDays * 24 * 60 * 60;
}

function setSessionCookies(reply, config, sessionToken, csrfToken) {
  reply.setCookie(SESSION_COOKIE, sessionToken, cookieOptions(config, maxAge(config), true));
  reply.setCookie(CSRF_COOKIE, csrfToken, cookieOptions(config, maxAge(config), false));
}

function clearSessionCookies(reply, config) {
  clearCookie(reply, config, SESSION_COOKIE, true);
  clearCookie(reply, config, CSRF_COOKIE, false);
}

function setShortCookie(reply, config, name, value) {
  reply.setCookie(name, value, {
    ...cookieOptions(config, 10 * 60, true),
    httpOnly: true,
  });
}

function clearOAuthCookies(reply, config) {
  clearCookie(reply, config, OAUTH_STATE_COOKIE, true);
  clearCookie(reply, config, OAUTH_NONCE_COOKIE, true);
  clearCookie(reply, config, OAUTH_RETURN_COOKIE, true);
}

function defaultGoogleClient(config) {
  return {
    async exchangeCode(code) {
      const body = new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: config.googleRedirectUri,
        grant_type: 'authorization_code',
      });
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!response.ok) throw new Error('Google token exchange failed');
      const tokenSet = await response.json();
      if (!tokenSet.id_token) throw new Error('Google token response did not include an ID token');
      return tokenSet;
    },
    async verifyIdToken(idToken, nonce) {
      const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: config.googleClientId,
      });
      if (payload.nonce !== nonce) throw new Error('OAuth nonce mismatch');
      if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) throw new Error('Google token is expired');
      if (payload.email_verified !== true) throw new Error('Google email is not verified');
      if (!isValidEmail(payload.email)) throw new Error('Google email is missing or invalid');
      if (!payload.sub) throw new Error('Google subject is missing');
      return payload;
    },
  };
}

async function createLoginSession(db, reply, config, user) {
  const sessionToken = randomToken();
  const csrfToken = randomToken();
  await db.createSession({
    userId: user.id,
    token: sessionToken,
    csrfToken,
    expiresAt: sessionExpiresAt(config.sessionDays),
  });
  setSessionCookies(reply, config, sessionToken, csrfToken);
  return { user: publicUser(user), csrfToken };
}

async function sessionFromRequest(db, request, reply, config, required = true) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) {
    if (required) reply.code(401);
    return null;
  }
  const session = await db.findSessionByToken(token);
  if (!session) {
    clearSessionCookies(reply, config);
    if (required) reply.code(401);
    return null;
  }
  const csrfToken = request.cookies[CSRF_COOKIE] || randomToken();
  if (hashToken(csrfToken) !== session.csrf_token_hash) {
    await db.rotateSessionCsrf(session.id, csrfToken);
    setSessionCookies(reply, config, token, csrfToken);
  }
  return {
    session,
    csrfToken,
    user: {
      id: session.user_id,
      email: session.email,
      display_name: session.display_name,
      google_subject: session.google_subject,
    },
  };
}

function requireCsrf(request, session, config) {
  const token = request.headers[config.csrfHeader] || '';
  return typeof token === 'string' && hashToken(token) === session.csrf_token_hash;
}

function validateReturnTo(config, returnTo) {
  if (!returnTo) return config.appOrigins[0];
  try {
    const url = new URL(returnTo);
    return isAllowedOrigin(config, url.origin) ? url.origin : config.appOrigins[0];
  } catch {
    return config.appOrigins[0];
  }
}

export function createApp({ db, config = loadConfig(), mailer = createMailer(config), googleClient = defaultGoogleClient(config) }) {
  const app = Fastify({
    logger: {
      level: config.production ? 'info' : 'warn',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  });

  app.addContentTypeParser(['application/csp-report', 'application/reports+json'], { parseAs: 'string' }, (_request, body, done) => {
    try {
      done(null, body ? JSON.parse(body) : {});
    } catch {
      done(null, { raw: body });
    }
  });

  app.register(cookie);
  app.register(cors, {
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', config.csrfHeader],
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(config, origin)) return callback(null, true);
      return callback(null, false);
    },
  });
  app.register(rateLimit, {
    max: config.production ? 120 : 1000,
    timeWindow: '1 minute',
  });

  app.addHook('preHandler', async (request, reply) => {
    if (!MUTATING.has(request.method)) return;
    if (request.url.startsWith('/api/csp-report')) return;
    const origin = request.headers.origin;
    if (!isAllowedOrigin(config, origin)) {
      return reply.code(403).send({ error: 'Origin not allowed.' });
    }
  });

  app.get('/api/health', async () => {
    await db.health();
    return { ok: true, service: 'c3-api' };
  });

  app.get('/api/auth/session', async (request, reply) => {
    const auth = await sessionFromRequest(db, request, reply, config, false);
    if (!auth) return { user: null, csrfToken: null };
    return { user: publicUser(auth.user), csrfToken: auth.csrfToken };
  });

  app.post('/api/auth/signup', async (request, reply) => {
    const email = normalizeEmail(request.body?.email);
    const password = String(request.body?.password || '');
    const displayName = String(request.body?.displayName || '').trim();
    if (!isValidEmail(email)) return reply.code(400).send({ error: 'Enter a valid email address.' });
    if (password.length < 10) return reply.code(400).send({ error: 'Password must be at least 10 characters.' });
    if (!displayName) return reply.code(400).send({ error: 'Enter a display name.' });
    const existing = await db.findUserByEmail(email);
    if (existing) return reply.code(409).send({ error: 'An account already exists for this email.' });
    const passwordHash = await hashPassword(password, config.bcryptCost);
    const user = await db.createUser({ email, displayName, passwordHash });
    return createLoginSession(db, reply, config, user);
  });

  app.post('/api/auth/login', async (request, reply) => {
    const email = normalizeEmail(request.body?.email);
    const password = String(request.body?.password || '');
    const user = isValidEmail(email) ? await db.findUserByEmail(email) : null;
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return reply.code(401).send({ error: 'Invalid email or password.' });
    }
    return createLoginSession(db, reply, config, user);
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await db.revokeSessionByToken(token);
    clearSessionCookies(reply, config);
    return { ok: true };
  });

  app.post('/api/auth/password-reset/request', async (request) => {
    const email = normalizeEmail(request.body?.email);
    if (isValidEmail(email)) {
      const user = await db.findUserByEmail(email);
      if (user) {
        const token = randomToken();
        await db.createPasswordResetToken({ userId: user.id, token, expiresAt: oneHourFromNow() });
        await mailer.sendPasswordReset(user.email, token);
      }
    }
    return { ok: true };
  });

  app.post('/api/auth/password-reset/confirm', async (request, reply) => {
    const token = String(request.body?.token || '');
    const password = String(request.body?.password || '');
    if (password.length < 10) return reply.code(400).send({ error: 'Password must be at least 10 characters.' });
    const reset = await db.consumePasswordResetToken(token);
    if (!reset) return reply.code(400).send({ error: 'Reset link is invalid or expired.' });
    const passwordHash = await hashPassword(password, config.bcryptCost);
    await db.setPasswordHash(reset.user_id, passwordHash);
    await db.revokeSessionsByUserId(reset.user_id);
    return { ok: true };
  });

  app.get('/api/auth/google/start', async (request, reply) => {
    if (!config.googleClientId || !config.googleClientSecret) {
      return reply.code(503).send({ error: 'Google OAuth is not configured.' });
    }
    const state = randomToken();
    const nonce = randomToken();
    const returnTo = validateReturnTo(config, request.query?.returnTo);
    setShortCookie(reply, config, OAUTH_STATE_COOKIE, state);
    setShortCookie(reply, config, OAUTH_NONCE_COOKIE, nonce);
    setShortCookie(reply, config, OAUTH_RETURN_COOKIE, returnTo);
    const params = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: config.googleRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      prompt: 'select_account',
    });
    return reply.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  app.get('/api/auth/google/callback', async (request, reply) => {
    const state = String(request.query?.state || '');
    const code = String(request.query?.code || '');
    const expectedState = request.cookies[OAUTH_STATE_COOKIE];
    const nonce = request.cookies[OAUTH_NONCE_COOKIE];
    const returnTo = validateReturnTo(config, request.cookies[OAUTH_RETURN_COOKIE]);
    clearOAuthCookies(reply, config);
    if (!code || !state || state !== expectedState || !nonce) {
      return reply.code(400).send({ error: 'Invalid OAuth state.' });
    }
    const tokenSet = await googleClient.exchangeCode(code);
    const claims = await googleClient.verifyIdToken(tokenSet.id_token, nonce);
    const email = normalizeEmail(claims.email);
    const googleSubject = String(claims.sub);
    let user = await db.findUserByGoogleSubject(googleSubject);
    if (!user) {
      user = await db.findUserByEmail(email);
      if (user && !user.google_subject) user = await db.updateGoogleSubject(user.id, googleSubject);
    }
    if (!user) {
      user = await db.createUser({
        email,
        displayName: claims.name || email.split('@')[0],
        googleSubject,
      });
    }
    await createLoginSession(db, reply, config, user);
    return reply.redirect(returnTo);
  });

  async function requireAuth(request, reply, csrf = false) {
    const auth = await sessionFromRequest(db, request, reply, config, true);
    if (!auth) return null;
    if (csrf && !requireCsrf(request, auth.session, config)) {
      reply.code(403).send({ error: 'CSRF check failed.' });
      return null;
    }
    return auth;
  }

  app.get('/api/progress', async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    return { progress: await db.getProgress(auth.user.id) };
  });

  app.put('/api/progress/:taskId', async (request, reply) => {
    const auth = await requireAuth(request, reply, true);
    if (!auth) return;
    const completed = Boolean(request.body?.completed);
    return { progress: await db.setProgress(auth.user.id, request.params.taskId, completed) };
  });

  app.get('/api/notes', async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    return { notes: await db.getNotes(auth.user.id) };
  });

  app.put('/api/notes/:taskId', async (request, reply) => {
    const auth = await requireAuth(request, reply, true);
    if (!auth) return;
    return { note: await db.setNote(auth.user.id, request.params.taskId, String(request.body?.content || '')) };
  });

  app.get('/api/sessions', async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    return { sessions: await db.getSessions(auth.user.id) };
  });

  app.post('/api/sessions', async (request, reply) => {
    const auth = await requireAuth(request, reply, true);
    if (!auth) return;
    const duration = Number.parseInt(request.body?.duration_seconds, 10);
    if (!Number.isFinite(duration) || duration <= 0) return reply.code(400).send({ error: 'Session duration is required.' });
    return {
      session: await db.addSession(auth.user.id, {
        label: String(request.body?.label || 'Untitled session').slice(0, 200),
        duration_seconds: duration,
        session_date: String(request.body?.session_date || new Date().toISOString().slice(0, 10)),
      }),
    };
  });

  app.get('/api/privacy/export', async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    return {
      exported_at: new Date().toISOString(),
      app: 'cyber-command-center',
      mode: 'signed-in',
      user: publicUser(auth.user),
      data: await db.exportUser(auth.user.id),
    };
  });

  app.delete('/api/privacy/account', async (request, reply) => {
    const auth = await requireAuth(request, reply, true);
    if (!auth) return;
    await db.deleteAccount(auth.user.id);
    clearSessionCookies(reply, config);
    return { ok: true };
  });

  app.post('/api/csp-report', async (request) => {
    const ipHash = hashIp(request.ip, config.cspReportIpSalt);
    await db.insertCspReport({
      body: request.body || {},
      userAgent: request.headers['user-agent'],
      ipHash,
    });
    return { ok: true };
  });

  return app;
}
