export const apiBaseUrl = import.meta.env.VITE_C3_API_URL || '';
export const apiConfigured = Boolean(apiBaseUrl);

let csrfToken = null;

function apiUrl(path) {
  return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
}

async function request(path, options = {}) {
  if (!apiConfigured) throw new Error('API is not configured.');
  const method = options.method || 'GET';
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }
  const response = await fetch(apiUrl(path), {
    method,
    headers,
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (parseError) {
    console.warn('API response was not valid JSON', parseError);
    data = { error: text || 'Unexpected API response.' };
  }
  if (!response.ok) throw new Error(data.error || `Request failed with ${response.status}`);
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data;
}

export const authApi = {
  async getSession() {
    return request('/api/auth/session');
  },
  async signIn(email, password) {
    return request('/api/auth/login', { method: 'POST', body: { email, password } });
  },
  async verifyMfaLogin(ticket, code) {
    return request('/api/auth/mfa/login/verify', { method: 'POST', body: { ticket, code } });
  },
  async signUp(email, password, displayName) {
    return request('/api/auth/signup', { method: 'POST', body: { email, password, displayName } });
  },
  async signOut() {
    const result = await request('/api/auth/logout', { method: 'POST' });
    csrfToken = null;
    return result;
  },
  async resetPassword(email) {
    return request('/api/auth/password-reset/request', { method: 'POST', body: { email } });
  },
  async confirmPasswordReset(token, password) {
    return request('/api/auth/password-reset/confirm', { method: 'POST', body: { token, password } });
  },
  signInWithGoogle() {
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href = apiUrl(`/api/auth/google/start?returnTo=${returnTo}`);
  },
};

export const c3Api = {
  async getAccountSecurity() {
    return request('/api/account/security');
  },
  async startMfaSetup() {
    return request('/api/account/mfa/setup', { method: 'POST' });
  },
  async enableMfa(code) {
    return request('/api/account/mfa/enable', { method: 'POST', body: { code } });
  },
  async disableMfa(code) {
    return request('/api/account/mfa/disable', { method: 'POST', body: { code } });
  },
  async getProgress() {
    return request('/api/progress');
  },
  async setProgress(taskId, completed) {
    return request(`/api/progress/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      body: { completed },
    });
  },
  async getNotes() {
    return request('/api/notes');
  },
  async setNote(taskId, content) {
    return request(`/api/notes/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      body: { content },
    });
  },
  async getSessions() {
    return request('/api/sessions');
  },
  async addSession(session) {
    return request('/api/sessions', {
      method: 'POST',
      body: {
        label: session.label,
        duration_seconds: session.duration,
        session_date: session.date,
      },
    });
  },
  async getRiskSummary() {
    return request('/api/risk-summary');
  },
  async addSimulationEvent(event) {
    return request('/api/simulation-events', {
      method: 'POST',
      body: event,
    });
  },
  async exportAccount() {
    return request('/api/privacy/export');
  },
  async deleteAccount(mfaCode) {
    return request('/api/privacy/account', {
      method: 'DELETE',
      body: mfaCode ? { mfaCode } : {},
    });
  },
};
