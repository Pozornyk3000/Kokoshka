/* Анамнез: офлайн-кэш. Сгенерировано tools/build.mjs. */
const CACHE = 'anamnez-ee228693856f';
const FILES = ["./","index.html","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","icons/apple-touch-icon.png","icons/favicon-32.png","fonts/caveat-cyrillic-ext.woff2","fonts/caveat-cyrillic.woff2","fonts/caveat-latin-ext.woff2","fonts/caveat-latin.woff2","fonts/golos-text-cyrillic-ext.woff2","fonts/golos-text-cyrillic.woff2","fonts/golos-text-latin-ext.woff2","fonts/golos-text-latin.woff2","fonts/oranienbaum-cyrillic-ext.woff2","fonts/oranienbaum-cyrillic.woff2","fonts/oranienbaum-latin-ext.woff2","fonts/oranienbaum-latin.woff2","fonts/pt-mono-cyrillic-ext.woff2","fonts/pt-mono-cyrillic.woff2","fonts/pt-mono-latin-ext.woff2","fonts/pt-mono-latin.woff2"];

self.addEventListener('install', (e) => {
  // cache: 'reload' — мимо HTTP-кэша браузера, чтобы новая версия не сохранила старую страницу
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('anamnez-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromNetwork(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then((r) => { clearTimeout(t); resolve(r); }, (e) => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fromNetwork(req, 4000)
        .then((r) => {
          if (r.ok && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put('index.html', copy));
          }
          return r;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
