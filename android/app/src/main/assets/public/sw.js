// Bike Rider service worker — NETWORK-FIRST so players always get the newest version when online.
// The cache is only an offline fallback. Bump VERSION on every release to drop old caches.
const VERSION = 'bike-rider-v21';
const CORE = [
  './', './index.html', './manifest.webmanifest', './browserconfig.xml',
  './icons/favicon.svg', './icons/favicon.ico', './icons/favicon-48.png',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-192-maskable.png',
  './icons/icon-512.png', './icons/icon-512-maskable.png',
  './vendor/three.r128.min.js'
];
self.addEventListener('install', e => {
  self.skipWaiting();
  // Per-item add: one missing file must never abort the whole precache.
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {}))))
      .catch(() => {})
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin || req.headers.has('range')) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.status === 200) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req).then(m => m || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
