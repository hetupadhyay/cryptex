/*
 * The page sits on a faint cipher pad: rows of five-letter code groups,
 * the way enciphered telegrams were written out. Now and then a group
 * decodes into a word, holds for a moment, and scrambles back.
 */
(function () {
  'use strict';

  const canvas = document.querySelector('canvas.pad');
  const ctx = canvas.getContext('2d');
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const WORDS = [
    'SHIFT', 'ROTOR', 'AGENT', 'PLAIN', 'CRYPT', 'NORTH', 'TRUTH', 'CODES', 'KEYED', 'GRILL',
    'ALPHA', 'DELTA', 'TANGO', 'RELAY', 'CLOAK', 'QUIET', 'BURNT', 'WHEEL', 'NIGHT', 'SPOKE',
  ];
  const GROUP_W = 66;
  const ROW_H = 28;
  const MARGIN = 14;
  const SCRAMBLE_MS = 700;
  const HOLD_MS = 2600;
  const MAX_ACTIVE = 3;

  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const randomGroup = () => Array.from({ length: 5 }, () => LETTERS[(Math.random() * 26) | 0]).join('');

  let groups = [];
  let active = [];
  let ink = '';
  let inkStrong = '';
  let width = 0;
  let height = 0;
  let frame = null;
  let nextDecode = 0;

  function readInk() {
    const css = getComputedStyle(document.documentElement);
    ink = css.getPropertyValue('--pad-ink').trim();
    inkStrong = css.getPropertyValue('--pad-ink-strong').trim();
  }

  function layout() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    groups = [];
    active = [];
    const cols = Math.floor((width - MARGIN) / GROUP_W);
    const rows = Math.ceil(height / ROW_H);
    // Every row starts with a serial number, like a real pad page.
    const firstSerial = 1000 + ((Math.random() * 8000) | 0);
    for (let r = 0; r < rows; r++) {
      groups.push({ x: MARGIN, y: 20 + r * ROW_H, text: String(firstSerial + r).padStart(4, '0'), state: 'serial' });
      for (let c = 1; c < cols; c++) {
        groups.push({ x: MARGIN + c * GROUP_W, y: 20 + r * ROW_H, text: randomGroup(), state: 'rest' });
      }
    }
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.font = '13px "Courier Prime", ui-monospace, monospace';
    ctx.textBaseline = 'alphabetic';
    for (const g of groups) {
      ctx.fillStyle = g.state === 'rest' || g.state === 'serial' ? ink : inkStrong;
      ctx.fillText(g.text, g.x, g.y);
    }
  }

  // Only bare page shows the pad; panels, cards and text sit on top of it.
  const OPEN = new Set(['BODY', 'MAIN', 'HTML', 'CANVAS']);
  const OPEN_CLASSES = ['bench', 'controls', 'work', 'panel', 'picker-groups', 'picker-group', 'keys', 'masthead'];
  function isOpen(x, y) {
    const hit = document.elementFromPoint(x, y);
    return !hit || OPEN.has(hit.tagName) || OPEN_CLASSES.some(c => hit.classList.contains(c));
  }

  // Picks a resting group out in the open and starts it decoding.
  function startDecode(now) {
    for (let tries = 0; tries < 40; tries++) {
      const g = groups[(Math.random() * groups.length) | 0];
      if (!g || g.state !== 'rest') continue;
      if (!isOpen(g.x + 2, g.y - 5) || !isOpen(g.x + 46, g.y - 5)) continue;
      g.state = 'decoding';
      g.word = WORDS[(Math.random() * WORDS.length) | 0];
      g.start = now;
      active.push(g);
      return;
    }
  }

  // Letters lock in from left to right while the rest keep cycling.
  function scramble(target, progress) {
    const locked = Math.floor(progress * 5.999);
    let out = '';
    for (let i = 0; i < 5; i++) out += i < locked ? target[i] : LETTERS[(Math.random() * 26) | 0];
    return out;
  }

  function step(now) {
    if (now >= nextDecode && active.length < MAX_ACTIVE) {
      startDecode(now);
      nextDecode = now + 1400 + Math.random() * 1800;
    }

    for (const g of active) {
      const t = now - g.start;
      if (g.state === 'decoding') {
        if (t < SCRAMBLE_MS) {
          g.text = scramble(g.word, t / SCRAMBLE_MS);
        } else {
          g.text = g.word;
          g.state = 'holding';
          g.start = now;
        }
      } else if (g.state === 'holding' && t > HOLD_MS) {
        g.state = 'encoding';
        g.start = now;
        g.word = randomGroup();
      } else if (g.state === 'encoding') {
        if (t < SCRAMBLE_MS) {
          g.text = scramble(g.word, t / SCRAMBLE_MS);
        } else {
          g.text = g.word;
          g.state = 'rest';
        }
      }
    }
    active = active.filter(g => g.state !== 'rest');
    draw();
  }

  let last = 0;
  function tick(now) {
    // Twenty frames a second is plenty for letters ticking over.
    if (now - last > 50) {
      step(now);
      last = now;
    }
    frame = requestAnimationFrame(tick);
  }

  function start() {
    cancelAnimationFrame(frame);
    if (still.matches || document.hidden) {
      draw();
      return;
    }
    nextDecode = performance.now() + 600;
    frame = requestAnimationFrame(tick);
  }

  readInk();
  layout();
  start();
  document.fonts.ready.then(draw);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 150);
  });
  document.addEventListener('visibilitychange', start);
  still.addEventListener('change', start);
  document.addEventListener('themechange', () => {
    readInk();
    draw();
  });
})();
