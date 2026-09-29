// ShiftPlanner Service Worker — Offline Caching
var CACHE_NAME = 'shiftplanner-v14';
// Core app shell — must ALL cache or the app can't work offline (atomic addAll).
var CORE_ASSETS = [
  './',
  './ShiftPlanner.html',
  './app.js',
  './rules.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];
// Optional/enhancement assets — precached best-effort so a single miss (e.g. a path/case typo on a
// case-sensitive host) can't fail the whole SW install and kill offline mode. The PDF libs still
// load fine at runtime from the network if a precache entry is ever missed; Share/Print also has a
// print fallback. (PWA audit S1.)
var OPTIONAL_ASSETS = [
  './vendor/jspdf.umd.min.js',
  './vendor/jspdf.plugin.autotable.min.js',
  './screenshots/screenshot-wide.png',
  './screenshots/screenshot-narrow.png'
];

// Install: cache the shell atomically, then the optional assets best-effort.
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CORE_ASSETS).then(function() {
        // Best-effort: never let an optional asset miss reject the install.
        return Promise.all(OPTIONAL_ASSETS.map(function(url) {
          return cache.add(url).catch(function(e) {
            console.warn('[SW] optional asset not precached:', url, e);
          });
        }));
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: serve from cache first, fall back to network
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).then(function(response) {
        // Cache new GET requests dynamically (skip non-GET so we never try to cache POST etc.)
        if (event.request.method === 'GET' && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
        }
        return response;
      });
    }).catch(function() {
      // Offline fallback for navigation
      if (event.request.mode === 'navigate') {
        return caches.match('./ShiftPlanner.html');
      }
    })
  );
});
