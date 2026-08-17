import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from '../utils/logger';

// Anonymous per-IP search quota — more aggressive than authed to protect
// the shared SemanticEngine rate-limit budget from unaccountable traffic.
export const anonSearchLimiter = rateLimit({
  windowMs: 60_000,
  max: config.rateLimit.anonPerMin,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `u:${req.user.sub}` : `ip:${req.ip ?? 'unknown'}`),
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many searches. Please slow down or sign up for an account.' });
  },
  skip: (req) => Boolean(req.user),
});

export const authedSearchLimiter = rateLimit({
  windowMs: 60_000,
  max: config.rateLimit.authPerMin,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `u:${req.user?.sub ?? req.ip}`,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Rate limit reached. Please wait a moment and try again.' });
  },
  skip: (req) => !req.user,
});

// Login brute-force protection: lockout after N failed attempts per identifier.
import { RateLimiterMemory } from 'rate-limiter-flexible';
export const loginLimiter = new RateLimiterMemory({
  points: config.rateLimit.loginMaxAttempts,
  duration: config.rateLimit.loginLockoutMin * 60,
});

export async function checkLoginLockout(key: string): Promise<{ blocked: boolean; remainingPoints?: number; msBeforeNext?: number }> {
  try {
    const res = await loginLimiter.consume(key, 1);
    return { blocked: false, remainingPoints: res.remainingPoints, msBeforeNext: res.msBeforeNext };
  } catch (rejRes) {
    return { blocked: true, msBeforeNext: (rejRes as { msBeforeNext?: number }).msBeforeNext };
  }
}

export function logRateLimitHit(scope: string, key: string): void {
  logger.warn({ scope, key }, 'rate limit hit');
}
