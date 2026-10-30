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
const VERSION = '5b21730faf';
const PRECACHE = [
  '/',
  '/learn',
  '/lab',
  '/codebreaking',
  '/terms',
  '/privacy',
  '/css/codebreaking.css?v=747a85efb5',
  '/css/daily.css?v=875309f422',
  '/css/desk.css?v=89df0a7983',
  '/css/home.css?v=6e815e2cd5',
  '/css/lab.css?v=c5c6805ed5',
  '/css/learn.css?v=4011634be2',
  '/css/pages.css?v=e75b1a6ac5',
  '/css/scenes.css?v=3828524726',
  '/css/shell.css?v=341482449c',
  '/css/site.css?v=23e132a75b',
  '/css/story.css?v=343044d36e',
  '/js/analysis.js?v=64f37747e0',
  '/js/background.js?v=3443079fe1',
  '/js/breaker.js?v=4c906b26b7',
  '/js/ciphers.js?v=1bfec5b0c6',
  '/js/codebreaking.js?v=0bb867115c',
  '/js/cryptex.js?v=360dd66c8e',
  '/js/daily.js?v=56d0fb8391',
  '/js/handoff.js?v=87a67e4e6d',
  '/js/history.js?v=849256fe01',
  '/js/home.js?v=72bd02db73',
  '/js/intercepts.js?v=77c6667feb',
  '/js/lab.js?v=adf6895a50',
  '/js/pwa.js?v=5b673ad196',
  '/js/scenes/columnar.js?v=ea6b1ebf53',
  '/js/scenes/playfair.js?v=2b08874d0a',
  '/js/scenes/polybius.js?v=e974e61d35',
  '/js/scenes/railfence.js?v=dd94fb627d',
  '/js/scenes/substitution.js?v=57cb744904',
  '/js/scenes/tabula.js?v=926bb806c3',
  '/js/share.js?v=ae6496ea0f',
  '/js/sheet.js?v=4151f3c65e',
  '/js/site.js?v=baf0d9e177',
  '/js/spring.js?v=8c5f9b1865',
  '/js/stage.js?v=7c00074c23',
  '/js/story.js?v=468efee997',
  '/js/strength.js?v=cf277a4497',
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
