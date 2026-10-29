/*
 * Renders the link preview card and the home screen icons with Playwright:
 *
 *   node tools/render-images.js
 *
 * Writes img/og.png (1200 × 630), img/icon-192.png, img/icon-512.png,
 * img/icon-maskable-512.png and img/apple-touch-icon.png (180 × 180).
 * Playwright isn't a dependency of the site; this only needs it installed
 * wherever you run it.
 */
'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const out = name => path.join(ROOT, 'img', name);

// The logo, as in img/mark.svg: a key whose bow is a C.
const TILE = '#16212a';
const BOW = '<path d="M14.6 10.6A7.4 7.4 0 1 0 14.6 21.4" fill="none" stroke="#e3e8e5" stroke-width="4.6" />';
const BLADE = '<path d="M10.5 13.9h20.2a1.3 1.3 0 0 1 1.3 1.3v1.6a1.3 1.3 0 0 1-1.3 1.3h-1.4v4.5h-3.6v-4.5h-1.6v3.1h-3.6v-3.1h-10z" fill="#e5836f" />';

// The key's own centre, in its 32-unit drawing, so it can be scaled about it.
const KEY_CX = 15.9;
const KEY_CY = 16;

// `width` is how much of the tile the key spans, from 0 to 1.
// `round` gives the tile rounded corners on a clear background; without it
// the tile fills the whole square, for platforms that mask icons themselves.
function icon({ width, round }) {
  const scale = (width * 32) / 32.2;
  const tx = 16 - KEY_CX * scale;
  const ty = 16 - KEY_CY * scale;
  const tile = round ? `<rect width="32" height="32" rx="7" fill="${TILE}" />` : `<rect width="32" height="32" fill="${TILE}" />`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${tile}<g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(4)})">${BOW}${BLADE}</g></svg>`;
}

const ICONS = [
  { file: 'icon-192.png', size: 192, svg: icon({ width: 0.755, round: true }) },
  { file: 'icon-512.png', size: 512, svg: icon({ width: 0.755, round: true }) },
  // Maskable icons get cropped to as little as a circle 80% across, so the
  // key stays well inside it.
  { file: 'icon-maskable-512.png', size: 512, svg: icon({ width: 0.62, round: false }) },
  // iOS rounds the corners itself and fills anything clear with black.
  { file: 'apple-touch-icon.png', size: 180, svg: icon({ width: 0.7, round: false }) },
];

(async () => {
  const browser = await chromium.launch();

  for (const { file, size, svg } of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: out(file), omitBackground: true });
    await page.close();
    console.log('wrote img/' + file);
  }

  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(path.join(__dirname, 'og.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: out('og.png') });
  console.log('wrote img/og.png');

  await browser.close();
})();
