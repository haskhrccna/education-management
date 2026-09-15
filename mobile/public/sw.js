/**
 * Minimal offline service worker for the Expo web export (GitHub Pages).
 *
 * Strategy:
 *  - Static assets (JS/CSS/fonts/icons): cache-first, background revalidate.
 *  - API GETs for stable Quran content (/surahs, /mushaf pages + ayahs):
 *    network-first with a cache fallback so recitation metadata is available
 *    offline. Auth failures are never cached.
 *  - Navigations: network-first, falling back to the cached shell (404.html
 *    on Pages mirrors index.html) so the app opens offline.
 *  - Everything else (POST/PUT/DELETE, auth): passthrough.
 */
const STATIC_CACHE = 'qr-static-v2';
const API_CACHE = 'qr-api-v2';
const SHELL_CACHE = 'qr-shell-v2';

const CACHEABLE_API = /^\/api\/v1\/(surahs|mushaf\/(page\/\d+|surahs\/\d+))$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = self.caches.open(SHELL_CACHE);
      // Precache the app shell + 404 fallback + the stable learning endpoints
      // EXPO_PUBLIC_API_URL is stamped into index.html at build time; offline
      // fallback still serves the cached shell when the API is unreachable.
      await Promise.all([
        shell.then((c) => c.addAll(['index.html', '404.html'].map((p) => new Request(p, { cache: 'reload' })))),
        // Surah/ayah metadata is immutable in practice — precache it so the
        // recitation picker works offline after first login.
        ...['/api/v1/surahs'].map((p) =>
          self.caches
            .open(API_CACHE)
            .then((c) => c.add(new Request(p, { credentials: 'include' })).catch(() => undefined))
        ),
      ]);
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, API_CACHE, SHELL_CACHE]);
      const keys = await self.caches.keys();
      await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => self.caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only same-origin GET requests are ever cached; pass through everything else.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstShell(req));
    return;
  }

  if (CACHEABLE_API.test(url.pathname)) {
    event.respondWith(networkFirstCache(req, API_CACHE));
    return;
  }

  // Static assets under the Expo export (/_expo/..., /assets/...)
  if (url.pathname.startsWith('/_expo/') || /\.(js|css|png|jpg|jpeg|webp|woff2?|ttf|otf|svg|ico)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }
});

async function networkFirstShell(req) {
  const cache = await self.caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = (await cache.match(req)) || (await cache.match('index.html')) || (await cache.match('404.html'));
    if (cached) return cached;
    throw new Error('offline: no cached shell');
  }
}

async function networkFirstCache(req, cacheName) {
  const cache = await self.caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    // Only cache successful responses — a 401/403/500 must not be replayed offline.
    if (fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await cache.match(req, { ignoreSearch: false });
    if (cached) return cached;
    throw new Error('offline: no cached response');
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await self.caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh.ok) cache.put(req, fresh.clone());
  return fresh;
}
