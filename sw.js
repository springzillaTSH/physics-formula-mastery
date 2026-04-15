// CSEC Physics Formula Mastery — service worker
// © Student Hub / Kerwin Springer.
//
// Strategy:
//   - NETWORK-FIRST for the HTML shell (index.html + "/") so students always
//     see the newest deployed version when they have signal. Offline falls
//     back to the cached copy.
//   - CACHE-FIRST for static assets (manifest, icon) — they rarely change
//     and it keeps repeat visits instant.
//
// Bump CACHE on every non-trivial deploy so clients cleanly re-fetch the shell.

const CACHE = 'formula-mastery-v3';

const STATIC_SHELL = [
  './manifest.webmanifest',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(STATIC_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Is this a navigation / HTML request?
  const isHTML =
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html');

  if (isHTML) {
    // NETWORK-FIRST: try live, cache fresh copy, fall back to cache offline
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('./index.html') || caches.match('./'))
        )
    );
    return;
  }

  // CACHE-FIRST for static assets
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
