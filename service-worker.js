const CACHE = 'zorblify-v2';
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon-48.png',
  '/favicon-192.png',
  '/favicon-512.png',
  '/games/gravity-flip/index.html',
  '/games/stack-up/index.html',
  '/games/volt-grid/index.html',
  '/games/castle-defense/index.html',
  '/games/neon-runner/index.html',
  '/games/aura-clash/index.html',
];

// Install — cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache first, network fallback
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Supabase isteklerini cache'leme
  if (url.hostname.includes('supabase')) return;
  // Fonts cache'leme
  if (url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic')) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(r => r || fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; }))
      )
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => {
      if (r) return r;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
