/*
 * Offline support. Every same-origin GET is answered from the cache when
 * it can be, and refreshed from the network in the background, so the site
 * keeps working offline after one visit. Nothing is precached by name
 * except the start page: files are cached as they're used.
 *
 * Bump VERSION to drop every cached file on the next visit.
 */
'use strict';

const VERSION = 'v2';
const CACHE = `cryptex-${VERSION}`;
const START = './';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.add(START))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('cryptex-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// A response that followed a redirect can't answer a navigation, so copy it.
function plain(response) {
  if (!response.redirected) return response;
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });

    const fresh = fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    });

    if (cached) {
      // Answer now, refresh for next time.
      event.waitUntil(fresh.then(() => {}, () => {}));
      return plain(cached);
    }

    try {
      return await fresh;
    } catch (err) {
      // Offline and never seen this page: fall back to the start page.
      if (request.mode === 'navigate') {
        const start = await cache.match(START);
        if (start) return plain(start);
      }
      throw err;
    }
  })());
});
