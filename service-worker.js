// Tiny offline-first service worker.
// Caches the app shell and serves it on subsequent loads.

const CACHE = 'akuru-mithuru-v5';
const SHELL = [
  '/',
  '/index.html',
  '/src/app.js',
  '/src/styles/main.css',
  '/src/data/letters.js',
  '/src/data/words.js',
  '/src/lib/storage.js',
  '/src/lib/tracker.js',
  '/src/lib/picker.js',
  '/src/lib/auth.js',
  '/src/lib/audio.js',
  '/src/screens/home.js',
  '/src/screens/lesson.js',
  '/manifest.webmanifest',
  '/icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache /api/* — always go to the network.
  if (url.pathname.startsWith('/api/')) return;

  // Network-first for HTML so updates ship promptly.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for static assets.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(event.request, clone));
        return res;
      }).catch(() => cached);
    })
  );
});
