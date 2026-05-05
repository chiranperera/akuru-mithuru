// Google ID token verification.
// The frontend sends Authorization: Bearer <id_token>; we verify it with
// Google's public keys and return the user's stable identifier (the `sub`).

import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

export async function verifyBearerToken(req) {
  const auth = req.headers['authorization'] || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const idToken = match[1].trim();
  if (!idToken) return null;
  const expectedAudience = process.env.GOOGLE_CLIENT_ID;
  if (!expectedAudience) {
    console.error('GOOGLE_CLIENT_ID is not set on the server.');
    return null;
  }
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: expectedAudience
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    };
  } catch (err) {
    console.warn('Token verification failed:', err.message);
    return null;
  }
}
