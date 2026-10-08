/* Hisaab service worker: app shell offline, never caches Google API calls */
var CACHE = 'hisaab-202610081211';
var SHELL = ['./', 'index.html', 'app.css?v=202610081211', 'icons.js?v=202610081211', 'db.js?v=202610081211', 'app.js?v=202610081211', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'img/intro-home.jpg', 'img/intro-add.jpg', 'img/intro-month.jpg', 'img/intro-share.jpg'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(CACHE).then(function (ca) { ca.put('index.html', c); }); return r; })
      .catch(function () { return caches.match('index.html'); }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function (hit) { return hit || fetch(e.request); }));
});
