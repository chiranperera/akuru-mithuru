// /api/progress
//   GET  -> { progress } for the signed-in user, or 404 if no record yet.
//   POST -> body { progress } stored under progress:<google-sub>.
//
// Authenticates via the Google ID token in the Authorization header.

import { verifyBearerToken } from './_lib/google.js';
import { getRedis, progressKey } from './_lib/kv.js';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const user = await verifyBearerToken(req);
  if (!user) return res.status(401).json({ error: 'unauthenticated' });

  let redis;
  try {
    redis = getRedis();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'storage_unavailable' });
  }

  const key = progressKey(user.sub);

  if (req.method === 'GET') {
    const value = await redis.get(key);
    if (!value) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ progress: value });
  }

  // POST
  let body = req.body;
  // Some Vercel runtimes don't auto-parse JSON; handle both cases.
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object' || !body.progress) {
    return res.status(400).json({ error: 'bad_payload' });
  }
  const progress = body.progress;
  // Basic guardrails: cap size to prevent abuse.
  const serialized = JSON.stringify(progress);
  if (serialized.length > 200_000) {
    return res.status(413).json({ error: 'payload_too_large' });
  }
  await redis.set(key, progress);
  return res.status(200).json({ ok: true });
}
