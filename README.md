# අකුරු මිතුරු

A Sinhala letter learning app for grade-1 kids. The app walks a child through:

1. **Tier 1** — vowels (අ, ආ, ඇ, ඈ, ඉ, ඊ, උ, ඌ, එ, ඒ, ඔ, ඕ)
2. **Tier 2** — consonants (ක, ම, ප, ත, න, ර, ල, ස, ග, ද, ව, හ, ය, බ, ට, ඩ, ච, ජ)
3. **Tier 3** — two-letter words (no pillam)
4. **Tier 4** — three-letter words (no pillam)

A parent (you) sits with the child and grades each letter ✓ or ✗. The app
tracks every letter individually — letters the child struggles with surface
more often in future word sets, automatically.

Progress syncs across devices via Google Sign-In + Vercel KV (Upstash Redis).

## Architecture

```
/api/                 Vercel serverless functions (Node 20)
  config.js           Returns the public Google Client ID to the frontend
  progress.js         GET/POST progress, keyed by Google sub claim
  _lib/
    google.js         ID token verification (google-auth-library)
    kv.js             Upstash Redis client

/public/              Static assets served as-is
  manifest.webmanifest  PWA manifest (named "අකුරු මිතුරු")
  service-worker.js   Offline cache for the app shell
  icons/              SVG + PNG icons

/src/                 Frontend modules (vanilla JS, no build step)
  app.js              Main entry: routes home <-> lesson, handles streak
  data/
    letters.js        Curriculum (vowels, consonants, tiers)
    words.js          Curated 2- and 3-letter pillam-free words
  lib/
    auth.js           Google Identity Services wrapper
    storage.js        localStorage cache + cloud sync
    tracker.js        Per-letter mastery model
    picker.js         Weighted lesson generation
    audio.js          Synthesized chimes (no audio files)
  screens/
    home.js           Streak, current tier, mastered letters
    lesson.js         Letter and word prompts with retry logic
  styles/
    main.css          Mobile-first; TV breakpoint at 1280px

/data/words.md        Human-readable word list — edit, then sync to words.js
```

## Required environment variables (set on Vercel)

| Variable                        | Purpose                                       |
|---------------------------------|-----------------------------------------------|
| `GOOGLE_CLIENT_ID`              | Web OAuth Client ID from Google Cloud         |
| `KV_REST_API_URL` *or* `UPSTASH_REDIS_REST_URL`     | Upstash Redis URL (auto-injected by Vercel) |
| `KV_REST_API_TOKEN` *or* `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token (auto-injected) |

If you connect Upstash through the Vercel Storage UI, the KV vars are added
automatically. You only need to add `GOOGLE_CLIENT_ID` manually.

## Running locally

You need Node 20+ and the Vercel CLI for local dev (so `/api/*` routes work):

```bash
npm install
npm install -g vercel
vercel link        # link to your Vercel project
vercel env pull    # pull env vars into .env.local
npm run dev        # starts vercel dev on http://localhost:3000
```

For just frontend testing without API routes, you can also serve statically:

```bash
npx serve .
```

(Sign-in and cloud sync won't work without `vercel dev`, but the lesson
flow itself runs from localStorage.)

## How the letter tracking works

Each letter has a stat record:

```js
{ firstTry: 7, retry: 2, missed: 1, mastered: false }
```

- `firstTry` — correct on the first attempt (full credit)
- `retry` — got it on the second attempt after the bigger correct letter was shown (75% credit)
- `missed` — wrong both attempts (no credit, surfaces again soon)

Mastery score = `(firstTry + 0.75 * retry) / total`. A letter becomes
"mastered" once it has 5+ first-try corrects with a score ≥ 0.85.

The word picker computes a weight per letter (high for weak, low for
mastered) and biases word selection toward words containing weak letters.
Untouched letters get a medium weight so they're introduced steadily.

## Deploying

Every push to `main` auto-deploys via Vercel. Pull requests get preview URLs.

```bash
git add .
git commit -m "..."
git push
```

## Editing the curriculum

The word list lives in two places:
- `data/words.md` — human-readable, with English meanings
- `src/data/words.js` — what the app actually uses

If you change the list, update both. Letters live in `src/data/letters.js`.

## Notes on language handling

The app is locked to Sinhala. Every text element has `lang="si"` and
`translate="no"` to prevent Chrome's auto-translate prompt from messing
with the letters. There's also a meta tag `<meta name="google" content="notranslate">`
in the head as a belt-and-suspenders.

## License

MIT — for personal/family use. Noto Sans Sinhala (loaded from Google Fonts)
is licensed under SIL Open Font License.
