import pg from 'pg';
import { hashToken } from './security.js';

const { Pool } = pg;

export class PostgresDatabase {
  constructor(databaseUrl) {
    if (!databaseUrl) throw new Error('DATABASE_URL is required');
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async close() {
    await this.pool.end();
  }

  async query(text, params = []) {
    return this.pool.query(text, params);
  }

  async transaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const tx = new PostgresDatabaseTx(client);
      const result = await fn(tx);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async health() {
    await this.query('select 1');
    return true;
  }

  async findUserById(id) {
    const { rows } = await this.query('select * from users where id = $1', [id]);
    return rows[0] || null;
  }

  async findUserByEmail(email) {
    const { rows } = await this.query('select * from users where email = $1', [email]);
    return rows[0] || null;
  }

  async findUserByGoogleSubject(subject) {
    const { rows } = await this.query('select * from users where google_subject = $1', [subject]);
    return rows[0] || null;
  }

  async createUser({ email, displayName, passwordHash = null, googleSubject = null, oldSupabaseId = null }) {
    const { rows } = await this.query(
      `insert into users (email, display_name, password_hash, google_subject, old_supabase_id)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [email, displayName || null, passwordHash, googleSubject, oldSupabaseId],
    );
    return rows[0];
  }

  async getAccountSecurity(userId) {
    const { rows } = await this.query(
      `select id, email, display_name, password_hash, google_subject, mfa_enabled_at,
              mfa_pending_expires_at
       from users
       where id = $1`,
      [userId],
    );
    return rows[0] || null;
  }

  async updateGoogleSubject(userId, googleSubject) {
    const { rows } = await this.query(
      'update users set google_subject = $2, updated_at = now() where id = $1 returning *',
      [userId, googleSubject],
    );
    return rows[0] || null;
  }

  async setPasswordHash(userId, passwordHash) {
    const { rows } = await this.query(
      'update users set password_hash = $2, updated_at = now() where id = $1 returning *',
      [userId, passwordHash],
    );
    return rows[0] || null;
  }

  async createSession({ userId, token, csrfToken, expiresAt }) {
    const tokenHash = hashToken(token);
    const csrfTokenHash = hashToken(csrfToken);
    const { rows } = await this.query(
      `insert into sessions (user_id, token_hash, csrf_token_hash, expires_at)
       values ($1, $2, $3, $4)
       returning *`,
      [userId, tokenHash, csrfTokenHash, expiresAt],
    );
    return rows[0];
  }

  async findSessionByToken(token) {
    const { rows } = await this.query(
      `select s.*, u.email, u.display_name, u.google_subject, u.mfa_enabled_at
       from sessions s
       join users u on u.id = s.user_id
       where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()`,
      [hashToken(token)],
    );
    return rows[0] || null;
  }

  async rotateSessionCsrf(sessionId, csrfToken) {
    const { rows } = await this.query(
      'update sessions set csrf_token_hash = $2 where id = $1 returning *',
      [sessionId, hashToken(csrfToken)],
    );
    return rows[0] || null;
  }

  async revokeSessionByToken(token) {
    await this.query(
      'update sessions set revoked_at = now() where token_hash = $1 and revoked_at is null',
      [hashToken(token)],
    );
  }

  async revokeSessionsByUserId(userId) {
    await this.query(
      'update sessions set revoked_at = now() where user_id = $1 and revoked_at is null',
      [userId],
    );
  }

  async setPendingMfaSecret(userId, secret, expiresAt) {
    const { rows } = await this.query(
      `update users
       set mfa_pending_totp_secret = $2,
           mfa_pending_expires_at = $3,
           updated_at = now()
       where id = $1
       returning id, email, display_name, password_hash, google_subject, mfa_enabled_at,
                 mfa_pending_totp_secret, mfa_pending_expires_at`,
      [userId, secret, expiresAt],
    );
    return rows[0] || null;
  }

  async enableMfa(userId, secret) {
    const { rows } = await this.query(
      `update users
       set mfa_totp_secret = $2,
           mfa_enabled_at = now(),
           mfa_pending_totp_secret = null,
           mfa_pending_expires_at = null,
           updated_at = now()
       where id = $1
       returning id, email, display_name, password_hash, google_subject, mfa_enabled_at`,
      [userId, secret],
    );
    return rows[0] || null;
  }

  async disableMfa(userId) {
    const { rows } = await this.query(
      `update users
       set mfa_totp_secret = null,
           mfa_enabled_at = null,
           mfa_pending_totp_secret = null,
           mfa_pending_expires_at = null,
           updated_at = now()
       where id = $1
       returning id, email, display_name, password_hash, google_subject, mfa_enabled_at`,
      [userId],
    );
    return rows[0] || null;
  }

  async createMfaChallenge({ userId, token, purpose, expiresAt }) {
    const { rows } = await this.query(
      `insert into mfa_challenges (user_id, token_hash, purpose, expires_at)
       values ($1, $2, $3, $4)
       returning id`,
      [userId, hashToken(token), purpose, expiresAt],
    );
    return rows[0];
  }

  async consumeMfaChallenge(token, purpose) {
    const tokenHash = hashToken(token);
    return this.transaction(async (tx) => {
      const { rows } = await tx.query(
        `select * from mfa_challenges
         where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now()
         for update`,
        [tokenHash, purpose],
      );
      const challenge = rows[0] || null;
      if (!challenge) return null;
      await tx.query('update mfa_challenges set used_at = now() where id = $1', [challenge.id]);
      return challenge;
    });
  }

  async getProgress(userId) {
    const { rows } = await this.query(
      'select task_id, completed, completed_at, updated_at from task_progress where user_id = $1 order by task_id',
      [userId],
    );
    return rows;
  }

  async setProgress(userId, taskId, completed) {
    const { rows } = await this.query(
      `insert into task_progress (user_id, task_id, completed, completed_at, updated_at)
       values ($1, $2, $3, case when $3 then now() else null end, now())
       on conflict (user_id, task_id)
       do update set completed = excluded.completed,
                     completed_at = excluded.completed_at,
                     updated_at = now()
       returning task_id, completed, completed_at, updated_at`,
      [userId, taskId, completed],
    );
    return rows[0];
  }

  async getNotes(userId) {
    const { rows } = await this.query(
      'select task_id, content, updated_at from task_notes where user_id = $1 order by task_id',
      [userId],
    );
    return rows;
  }

  async setNote(userId, taskId, content) {
    const { rows } = await this.query(
      `insert into task_notes (user_id, task_id, content, updated_at)
       values ($1, $2, $3, now())
       on conflict (user_id, task_id)
       do update set content = excluded.content, updated_at = now()
       returning task_id, content, updated_at`,
      [userId, taskId, content],
    );
    return rows[0];
  }

  async getSessions(userId) {
    const { rows } = await this.query(
      `select id, label, duration_seconds, session_date, created_at
       from study_sessions
       where user_id = $1
       order by created_at desc`,
      [userId],
    );
    return rows;
  }

  async addSession(userId, session) {
    const { rows } = await this.query(
      `insert into study_sessions (user_id, label, duration_seconds, session_date)
       values ($1, $2, $3, $4)
       returning id, label, duration_seconds, session_date, created_at`,
      [userId, session.label, session.duration_seconds, session.session_date],
    );
    return rows[0];
  }

  async addSimulationEvent(userId, event) {
    const { rows } = await this.query(
      `insert into training_simulation_events
         (user_id, event_type, outcome, title, risk_delta, occurred_at, details)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, event_type, outcome, title, risk_delta, occurred_at, details, created_at`,
      [
        userId,
        event.event_type,
        event.outcome,
        event.title,
        event.risk_delta,
        event.occurred_at,
        event.details,
      ],
    );
    return rows[0];
  }

  async getSimulationEvents(userId, limit = 50) {
    const { rows } = await this.query(
      `select id, event_type, outcome, title, risk_delta, occurred_at, details, created_at
       from training_simulation_events
       where user_id = $1
       order by occurred_at desc, created_at desc
       limit $2`,
      [userId, limit],
    );
    return rows;
  }

  async exportUser(userId) {
    const [user, progress, notes, sessions, simulationEvents] = await Promise.all([
      this.findUserById(userId),
      this.getProgress(userId),
      this.getNotes(userId),
      this.getSessions(userId),
      this.getSimulationEvents(userId, 500),
    ]);
    return {
      profile: user ? {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        old_supabase_id: user.old_supabase_id,
        created_at: user.created_at,
      } : null,
      task_progress: progress,
      task_notes: notes,
      study_sessions: sessions,
      simulation_events: simulationEvents,
    };
  }

  async deleteAccount(userId) {
    await this.transaction(async (tx) => {
      await tx.query('delete from users where id = $1', [userId]);
    });
  }

  async createPasswordResetToken({ userId, token, expiresAt }) {
    const { rows } = await this.query(
      `insert into password_reset_tokens (user_id, token_hash, expires_at)
       values ($1, $2, $3)
       returning id`,
      [userId, hashToken(token), expiresAt],
    );
    return rows[0];
  }

  async consumePasswordResetToken(token) {
    const tokenHash = hashToken(token);
    return this.transaction(async (tx) => {
      const { rows } = await tx.query(
        `select * from password_reset_tokens
         where token_hash = $1 and used_at is null and expires_at > now()
         for update`,
        [tokenHash],
      );
      const reset = rows[0] || null;
      if (!reset) return null;
      await tx.query('update password_reset_tokens set used_at = now() where id = $1', [reset.id]);
      return reset;
    });
  }

  async insertCspReport({ body, userAgent, ipHash }) {
    await this.query(
      'insert into csp_reports (body, user_agent, ip_hash) values ($1, $2, $3)',
      [body, userAgent || null, ipHash],
    );
  }
}

class PostgresDatabaseTx {
  constructor(client) {
    this.client = client;
  }

  async query(text, params = []) {
    return this.client.query(text, params);
  }

  async transaction() {
    throw new Error('Nested transactions are not supported');
  }
}
