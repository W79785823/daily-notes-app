const CACHE_NAME = 'daily-notes-pwa-v3';
const SHELL_ASSETS = [
  '/',
  '/login',
  '/offline',
  '/site.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/images') || /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|json|webmanifest)$/.test(url.pathname);
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document' || (request.destination === '' && request.headers.get('accept')?.includes('text/html'));
}

async function putInCache(request, response) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response);
  } catch {}
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!isSameOrigin(url)) return;

  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          await putInCache(event.request, response.clone());
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(event.request);
          if (cachedPage) return cachedPage;
          const offlinePage = await caches.match('/offline');
          if (offlinePage) return offlinePage;
          return new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then(async (cached) => {
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          await putInCache(event.request, response.clone());
          return response;
        } catch {
          return new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
      }),
    );
  }
});
