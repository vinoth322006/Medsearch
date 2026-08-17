import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy(times) {
    if (times > 10) return null;
    return Math.min(times * 1000, 5000);
  }
});

redis.on('error', (err: any) => {
  if (err?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED')) {
    logger.warn('redis connection refused, retrying...');
  } else {
    logger.error({ err }, 'redis error');
  }
});
redis.on('connect', () => logger.info('redis connected'));

export interface CacheResult<T> {
  hit: boolean;
  value: T | null;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ err, key }, 'cacheGet failed (treating as miss)');
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSec: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSec);
  } catch (err) {
    logger.warn({ err, key }, 'cacheSet failed');
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    logger.warn({ err, key }, 'cacheDel failed');
  }
}

export const cacheKeys = {
  search: (normalized: string, rerank: boolean) => `search:${rerank ? '1' : '0'}:${normalized}`,
  metaBatch: (pmidsKey: string) => `meta:batch:${pmidsKey}`,
};

// Normalized search query for cache keying (lowercased, whitespace collapsed)
export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}
