// Returns public configuration the frontend needs.
// Right now: just the Google OAuth Client ID. This is a public value
// (it's sent to Google in the OAuth request from the browser anyway),
// so it's safe to expose. We keep it server-side only so the actual
// value lives in Vercel env vars and can be rotated without a redeploy.

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null
  });
}
