const CACHE = 'ryoppy-explore-v0.3.0';
const FILES = [
  './',
  './index.html',
  './styles.css?v=0.3.0',
  './app.js?v=0.3.0',
  './manifest.webmanifest',
  './data/cincinnati-alpha.json?v=0.3.0',
  './assets/icon.png',
  './assets/characters/christian/idle.png',
  './assets/characters/christian/talk.png',
  './assets/characters/christian/celebrate.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES.map(file => new URL(file, self.registration.scope).toString())))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(new URL('./index.html', self.registration.scope).toString())),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    })),
  );
});
