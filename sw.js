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
const VERSION = '143f8af958';
const PRECACHE = [
  '/',
  '/learn',
  '/lab',
  '/codebreaking',
  '/terms',
  '/privacy',
  '/css/codebreaking.css?v=01b3a75d7d',
  '/css/daily.css?v=875309f422',
  '/css/desk.css?v=89df0a7983',
  '/css/home.css?v=e5d449e446',
  '/css/lab.css?v=cc3ce4751c',
  '/css/learn.css?v=4011634be2',
  '/css/pages.css?v=e75b1a6ac5',
  '/css/scenes.css?v=80f816938d',
  '/css/shell.css?v=341482449c',
  '/css/site.css?v=663543549d',
  '/css/story.css?v=343044d36e',
  '/js/analysis.js?v=64f37747e0',
  '/js/background.js?v=d135e07da1',
  '/js/breaker.js?v=4c906b26b7',
  '/js/ciphers.js?v=517fef3150',
  '/js/codebreaking.js?v=33958d9e93',
  '/js/cryptex.js?v=3db7e3361d',
  '/js/daily.js?v=95d419e4d9',
  '/js/enigma.js?v=631d0b6f71',
  '/js/handoff.js?v=ad58c84027',
  '/js/history.js?v=849256fe01',
  '/js/home.js?v=a53d7e9b27',
  '/js/intercepts.js?v=70f2c96bdb',
  '/js/lab.js?v=b07282eb61',
  '/js/pwa.js?v=5b673ad196',
  '/js/scenes/columnar.js?v=5f551bc86e',
  '/js/scenes/playfair.js?v=23084a281e',
  '/js/scenes/polybius.js?v=e974e61d35',
  '/js/scenes/railfence.js?v=b4d0d7f692',
  '/js/scenes/substitution.js?v=581c58d35f',
  '/js/scenes/tabula.js?v=c3cacba365',
  '/js/share.js?v=ae6496ea0f',
  '/js/sheet.js?v=f4d1354ad7',
  '/js/site.js?v=c274758143',
  '/js/spring.js?v=8c5f9b1865',
  '/js/stage.js?v=afe593e760',
  '/js/story.js?v=965d3d9299',
  '/js/strength.js?v=eeb194b85b',
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

// Straight from the network, past the browser's own cache, so a font or
// icon replaced under the same name is fetched afresh.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' }))))
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

// The cache only ever holds the release the worker was installed with: a
// newer page from the network is shown but not kept, since its files
// belong to a release this cache doesn't have.
async function page(event) {
  const cache = await caches.open(CACHE);
  const network = fetch(event.request);
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
  const cached = await caches.match(event.request, { cacheName: CACHE });
  return cached || fetch(event.request);
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
