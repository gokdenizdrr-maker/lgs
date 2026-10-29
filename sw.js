/* LGS Takip, çevrimdışı çalışma için service worker. Sürüm 1.22.1.
   Sayfa: önce ağ (en güncel sürüm), ağ yoksa ya da geç kalırsa önbellek.
   Yazı tipleri: önce önbellek. Veriler burada değil, tarayıcının localStorage alanındadır. */
var CACHE = 'lgs-takip-1.22.1';
var CORE = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () { }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('lgs-takip-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || caches.match('./index.html') || caches.match('./');
  });
}

function networkFirst(req) {
  return new Promise(function (resolve) {
    var done = false;
    var timer = setTimeout(function () {
      fromCache(req).then(function (r) { if (r && !done) { done = true; resolve(r); } });
    }, 3000);
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      clearTimeout(timer);
      if (!done) { done = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      fromCache(req).then(function (r) { if (!done) { done = true; resolve(r || Response.error()); } });
    });
  });
}

function cacheFirst(req) {
  return caches.match(req).then(function (r) {
    return r || fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst(req)); return; }
  // Canlı eşitleme bileşeni (sürüm numaralı adres; değişmez): internetsiz açılışta da yüklenebilsin
  if (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0) e.respondWith(cacheFirst(req));
});
