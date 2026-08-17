import dotenv from 'dotenv';
dotenv.config();

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${key}`);
  return v;
}

// In production, security-critical secrets must be explicitly set and strong.
function secret(key: string, devFallback: string): string {
  const v = process.env[key];
  const isProd = process.env.NODE_ENV === 'production';
  if (v && v.length >= 32) return v;
  if (isProd) {
    throw new Error(
      `${key} must be set to a random string of at least 32 bytes in production (e.g. openssl rand -hex 32).`,
    );
  }
  return v ?? devFallback;
}

function int(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
  port: int('PORT', 4000),
  databaseUrl: required('DATABASE_URL', 'postgresql://medisearch:medisearch_dev@localhost:5432/medisearch?schema=public'),
  redisUrl: required('REDIS_URL', 'redis://localhost:6379'),
  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
    refreshSecret: secret('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
    accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
    refreshTtlDays: int('REFRESH_TOKEN_TTL_DAYS', 30),
  },
  litsense: {
    baseUrl: process.env.LITSENSE_BASE_URL ?? 'https://www.ncbi.nlm.nih.gov/research/litsense-api/api/',
    timeoutMs: int('LITSENSE_TIMEOUT_MS', 8000),
    minIntervalMs: int('LITSENSE_MIN_INTERVAL_MS', 1000),
    maxResults: 100,
  },
  eutils: {
    baseUrl: process.env.EUTILS_BASE_URL ?? 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
    apiKey: process.env.EUTILS_API_KEY ?? '',
    timeoutMs: int('EUTILS_TIMEOUT_MS', 8000),
    minIntervalMs: int('EUTILS_MIN_INTERVAL_MS', 334),
    batchSize: 200,
  },
  cache: {
    searchTtlSec: int('SEARCH_CACHE_TTL_SEC', 1200),
    metaTtlSec: int('META_CACHE_TTL_SEC', 2592000),
  },
  rateLimit: {
    anonPerMin: int('ANON_IP_RATE_LIMIT_PER_MIN', 12),
    authPerMin: int('AUTH_RATE_LIMIT_PER_MIN', 30),
    loginMaxAttempts: int('LOGIN_MAX_ATTEMPTS', 5),
    loginLockoutMin: int('LOGIN_LOCKOUT_MIN', 15),
  },
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@medsearch.local',
    adminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'AdminPass!2024',
  },
  adminCanViewUserQueries: (process.env.ADMIN_CAN_VIEW_USER_QUERIES ?? 'false') === 'true',
  logLevel: process.env.LOG_LEVEL ?? 'info',
};

export type AppConfig = typeof config;
