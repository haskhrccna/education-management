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
const STATIC_CACHE = 'qr-static-v3';
const API_CACHE = 'qr-api-v3';
const SHELL_CACHE = 'qr-shell-v3';

const CACHEABLE_API = /\/api\/v1\/(surahs|mushaf\/(page\/\d+|surahs\/\d+))$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = self.caches.open(SHELL_CACHE);
      // Precache the app shell + the 404 fallback so the app opens offline.
      // Relative Requests resolve against the SW script URL, so they are
      // correct on both a root domain and a GitHub Pages project path.
      // The API lives on a DIFFERENT origin in every real deployment, and it
      // requires a bearer token the service worker does not have — so nothing
      // is precached from it here; API responses are cached as the app
      // fetches them (see CACHEABLE_API below).
      await shell.then((c) => c.addAll(['index.html', '404.html'].map((p) => new Request(p, { cache: 'reload' }))));
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

  if (req.method !== 'GET') return;

  // Stable Quran content is cacheable even cross-origin: the API is served
  // from its own host (api.<domain>), so an origin check would have made this
  // branch dead code in every real deployment.
  if (CACHEABLE_API.test(url.pathname)) {
    event.respondWith(networkFirstCache(req, API_CACHE));
    return;
  }

  // Everything else is only ever cached same-origin.
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstShell(req));
    return;
  }

  // Static assets under the Expo export — the path is prefixed with the
  // deploy base path on a project site, so match anywhere in the path.
  if (url.pathname.includes('/_expo/') || /\.(js|css|png|jpg|jpeg|webp|woff2?|ttf|otf|svg|ico)$/.test(url.pathname)) {
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
