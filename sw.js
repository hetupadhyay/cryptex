/*
 * Offline support. A release is cached as one set when the worker
 * installs, so a page and its files always come from the same release.
 *
 * Pages come from the network first, so a new release shows up on the
 * next visit, and from the cache when there's no network. Styles,
 * scripts and fonts come from the cache first: their addresses carry a
 * hash of the file (?v=...), so a cached copy is never out of date.
 *
 * The list below is written by tools/stamp.py; run it after changing a
 * page or any file a page loads.
 */
'use strict';

// stamp:start (written by tools/stamp.py)
const VERSION = '44eb5fd14c';
const PRECACHE = [
  '/',
  '/learn',
  '/lab',
  '/codebreaking',
  '/terms',
  '/privacy',
  '/css/codebreaking.css?v=dc9e4528a0',
  '/css/daily.css?v=875309f422',
  '/css/desk.css?v=89df0a7983',
  '/css/home.css?v=a1a699ce96',
  '/css/lab.css?v=fbea155d0c',
  '/css/learn.css?v=8c0a610d60',
  '/css/pages.css?v=4adfaea274',
  '/css/scenes.css?v=3828524726',
  '/css/shell.css?v=86cb6c2055',
  '/css/site.css?v=bd4eac637f',
  '/css/story.css?v=1e29ccb1a7',
  '/js/analysis.js?v=64f37747e0',
  '/js/background.js?v=3443079fe1',
  '/js/breaker.js?v=c889a61949',
  '/js/ciphers.js?v=612b2eab7a',
  '/js/codebreaking.js?v=a27435444e',
  '/js/cryptex.js?v=360dd66c8e',
  '/js/daily.js?v=56d0fb8391',
  '/js/handoff.js?v=87a67e4e6d',
  '/js/history.js?v=849256fe01',
  '/js/home.js?v=72bd02db73',
  '/js/intercepts.js?v=77c6667feb',
  '/js/lab.js?v=eba9402966',
  '/js/pwa.js?v=5b673ad196',
  '/js/scenes/columnar.js?v=5d961719e6',
  '/js/scenes/playfair.js?v=bcec07a8f7',
  '/js/scenes/polybius.js?v=e974e61d35',
  '/js/scenes/railfence.js?v=69c6b00337',
  '/js/scenes/substitution.js?v=57cb744904',
  '/js/scenes/tabula.js?v=926bb806c3',
  '/js/share.js?v=c6cb68012d',
  '/js/sheet.js?v=4151f3c65e',
  '/js/site.js?v=315fff37f5',
  '/js/spring.js?v=8c5f9b1865',
  '/js/stage.js?v=7c00074c23',
  '/js/story.js?v=cccddd9e89',
  '/js/strength.js?v=3bcad7be98',
  '/js/theme.js?v=8626267322',
  '/fonts/courier-prime-400.woff2',
  '/fonts/courier-prime-700.woff2',
  '/fonts/hanken-grotesk.woff2',
  '/manifest.webmanifest',
  '/img/mark.svg',
  '/img/icon-192.png',
  '/img/apple-touch-icon.png',
];
// stamp:end

const CACHE = `cryptex-${VERSION}`;
const START = '/';
// How long a page waits for the network before falling back to the cache.
const PATIENCE = 4000;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
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

const keep = response => response.ok && response.type === 'basic';

async function page(event) {
  const cache = await caches.open(CACHE);
  const network = fetch(event.request).then(response => {
    if (keep(response)) cache.put(event.request.url.split(/[?#]/)[0], response.clone()).catch(() => {});
    return response;
  });
  event.waitUntil(network.then(() => {}, () => {}));
  const late = new Promise(resolve => setTimeout(resolve, PATIENCE));
  try {
    const response = await Promise.race([network, late]);
    if (response) return response;
  } catch {}
  // No network, or a very slow one: the cached copy of this page, then
  // the start page, and failing both, whatever the network says.
  const cached = await cache.match(event.request, { ignoreSearch: true }) || await cache.match(START);
  return cached ? plain(cached) : network;
}

async function file(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (keep(response)) cache.put(event.request, response.clone()).catch(() => {});
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.respondWith(page(event));
  else if (url.searchParams.has('v') || url.pathname.startsWith('/fonts/')) event.respondWith(file(event));
  // Anything else (the manifest, icons, speculation rules) goes to the
  // network as usual, and to the precached copy when offline.
  else event.respondWith(fetch(request).catch(() => caches.match(request)));
});
