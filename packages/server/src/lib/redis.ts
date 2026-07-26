import Redis from 'ioredis';
import { logger } from './logger';

let redis: Redis | null = null;

// Bounded retries + no offline command queueing, so a genuinely absent Redis
// fails each command fast instead of retrying forever in the background —
// the same fix applied to lib/queue.ts after CI (no Redis service) exposed
// the default ioredis retry strategy leaving zombie reconnect timers running
// past test teardown. This client had zero callers until F9's academy-health
// cache, so the bug was latent rather than yet observed here.
const RETRY_OPTIONS = {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  connectTimeout: 1000,
  retryStrategy: (times: number) => (times > 2 ? null : Math.min(times * 200, 1000)),
};

export const getRedis = (): Redis | null => {
  if (redis) return redis;

  try {
    redis = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, RETRY_OPTIONS)
      : new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          ...RETRY_OPTIONS,
        });

    redis.on('error', (err) => {
      logger.warn({ err }, 'Redis connection error');
      redis = null;
    });

    return redis;
  } catch {
    return null;
  }
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Ignore cache errors
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.del(key);
  } catch {
    // Ignore cache errors
  }
}

export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // Ignore cache errors
  }
}
