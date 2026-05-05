// KV client. Uses the env vars Vercel injects when an Upstash Redis store
// is connected to the project. Supports both common naming schemes.

import { Redis } from '@upstash/redis';

let _redis = null;

export function getRedis() {
  if (_redis) return _redis;
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Redis env vars not configured. Connect an Upstash KV in Vercel.');
  }
  _redis = new Redis({ url, token });
  return _redis;
}

export function progressKey(googleSub) {
  return `progress:${googleSub}`;
}
