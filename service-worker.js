// PERF-03: bump this string on every deploy that changes static assets so
// existing installs pick up the new files on next visit.
const CACHE = 'fincwin-v6';
const ASSETS = [
  './',
  './app.html',
  './manifest.json',
  './js/crypto-core.js',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './styles/base.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/dark.css',
  './styles/themes.css',
  './js/vendor/chart.min.js',
  './js/vendor/papaparse.esm.js',
  './js/vendor/qr-creator.es6.min.js',
  './js/vendor/firebase/firebase-app.js',
  './js/vendor/firebase/firebase-auth.js',
  './js/vendor/firebase/firebase-firestore.js',
  './js/constants.js',
  './js/state.js',
  './js/health.js',
  './js/modals.js',
  './js/expenses.js',
  './js/revenue.js',
  './js/loans.js',
  './js/savings.js',
  './js/analytics.js',
  './js/calendar.js',
  './js/archive.js',
  './js/settings.js',
  './js/import-bank.js',
  './js/onboarding.js',
  './js/gamification.js',
  './js/boot.js',
  './js/search.js',
  './js/darkmode.js',
  './js/sync.js',
  './js/events.js',
  './js/bulk-add.js',
  './js/config.fallback.js',
  './icon.svg',
  './icon-maskable.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // Cache assets individually — one 404 must not silently wipe the entire cache
      return Promise.all(
        ASSETS.map(function (url) {
          return c.add(url).catch(function () {});
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
      .then(function () {
        // Notify all open tabs that a new SW version is active (audit P-01).
        return self.clients.matchAll({ includeUncontrolled: true }).then(function (clients) {
          clients.forEach(function (c) { c.postMessage({ type: 'SW_UPDATED' }); });
        });
      })
  );
});

self.addEventListener('fetch', function (e) {
  var url = e.request.url;
  // Skip caching for: browser internals, external APIs, and versioned CDN scripts
  // (Firebase/Google auth SDKs must stay network-first — stale cached versions break auth)
  // Skip caching for external APIs and CDN resources that must never be served stale.
  // Firebase SDK is vendored locally — no gstatic.com bypass needed here.
  if (url.indexOf('chrome-extension') > -1 ||
      url.indexOf('api.anthropic') > -1 ||
      url.indexOf('api.openai') > -1 ||
      url.indexOf('open.er-api') > -1 ||
      url.indexOf('firebaseio.com') > -1 ||
      url.indexOf('firebase.googleapis.com') > -1 ||
      url.indexOf('identitytoolkit.googleapis.com') > -1 ||
      url.indexOf('accounts.google.com') > -1 ||
      url.indexOf('googleapis.com/drive') > -1 ||
      url.indexOf('fonts.googleapis.com') > -1 ||
      url.indexOf('fonts.gstatic.com') > -1) return;

  // config.local.js must always be network-first — it holds Firebase credentials that
  // may be placeholders in the repo and must never be served stale from cache.
  if (url.indexOf('config.local.js') > -1) {
    e.respondWith(
      fetch(e.request).catch(function () {
        return new Response('window.__FINCWIN_CONFIG__=null;', { status: 200, headers: { 'Content-Type': 'application/javascript' } });
      })
    );
    return;
  }

  // Network-first for JS files — prevents stale code bugs after deploys
  var isJS = url.indexOf('/js/') > -1 && url.indexOf('.js') > -1 &&
             url.indexOf('vendor') === -1; // vendor (chart.min.js) can stay cache-first
  if (isJS) {
    e.respondWith(
      fetch(e.request).then(function (response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return response;
      }).catch(function () {
        return caches.match(e.request).then(function (r) {
          return r || new Response('// offline', { status: 503, headers: { 'Content-Type': 'application/javascript' } });
        });
      })
    );
    return;
  }

  // Cache-first for everything else (HTML, CSS, fonts, vendor JS)
  e.respondWith(
    caches.match(e.request).then(function (r) {
      return r || fetch(e.request).catch(function () {
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
