const DEFAULT_APP_ORIGINS = [
  'https://c3.mdpstudio.com.au',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
];

function readList(value, fallback) {
  if (!value) return fallback;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function readBool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function readInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const apiOrigin = env.API_ORIGIN || 'http://127.0.0.1:8088';
  const appOrigins = readList(env.APP_ORIGIN || env.ALLOWED_ORIGINS, DEFAULT_APP_ORIGINS);
  const totpEncryptionKey = env.TOTP_ENCRYPTION_KEY
    || (production ? '' : 'local-development-only-totp-key-change-me');
  const totpPreviousEncryptionKeys = readList(env.TOTP_PREVIOUS_ENCRYPTION_KEYS, []);

  const config = {
    nodeEnv: env.NODE_ENV || 'development',
    production,
    host: env.API_HOST || '0.0.0.0',
    port: readInt(env.API_PORT, 8080),
    apiOrigin,
    appOrigins,
    databaseUrl: env.DATABASE_URL,
    cookieDomain: env.COOKIE_DOMAIN || undefined,
    cookieSecure: readBool(env.COOKIE_SECURE, production),
    sessionDays: readInt(env.SESSION_DAYS, 14),
    bcryptCost: readInt(env.BCRYPT_COST, production ? 12 : 8),
    csrfHeader: 'x-csrf-token',
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: env.GOOGLE_REDIRECT_URI || `${apiOrigin}/api/auth/google/callback`,
    smtpUrl: env.SMTP_URL,
    mailFrom: env.MAIL_FROM || 'Cyber Command Center <security@mdpstudio.com.au>',
    passwordResetBaseUrl: env.PASSWORD_RESET_BASE_URL || 'https://c3.mdpstudio.com.au',
    authLogResetLinks: readBool(env.AUTH_LOG_RESET_LINKS, !production),
    cspReportIpSalt: env.CSP_REPORT_IP_SALT || env.SESSION_SECRET || 'local-csp-report-salt',
    totpEncryptionKey,
    totpPreviousEncryptionKeys,
    totpEncryptionKeys: [totpEncryptionKey, ...totpPreviousEncryptionKeys],
  };

  if (production && config.totpEncryptionKey.length < 32) {
    throw new Error('TOTP_ENCRYPTION_KEY must contain at least 32 characters in production');
  }
  if (config.totpPreviousEncryptionKeys.some((key) => key.length < 32)) {
    throw new Error('Every TOTP_PREVIOUS_ENCRYPTION_KEYS entry must contain at least 32 characters');
  }
  if (new Set(config.totpEncryptionKeys).size !== config.totpEncryptionKeys.length) {
    throw new Error('TOTP encryption keys must be unique');
  }
  return config;
}

export function isAllowedOrigin(config, origin) {
  return Boolean(origin && config.appOrigins.includes(origin));
}
