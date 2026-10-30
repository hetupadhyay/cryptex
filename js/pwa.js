/*
 * Registers the service worker, so the site opens offline once it has been
 * visited. Only over https or on localhost: service workers can't run from
 * a file:// page, and the site works fine without one.
 */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (location.protocol !== 'https:' && !(location.protocol === 'http:' && local)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
})();
