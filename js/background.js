/*
 * The page sits on a faint cipher pad: rows of five-letter code groups,
 * the way enciphered telegrams were written out. For a few seconds after
 * the page opens or comes back into view, and again whenever the cryptex
 * turns, a group decodes into a word, holds for a moment, and scrambles
 * back. Then it rests.
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
  let nextDecode = 0;
  // New words only start before this moment, so the pad goes still.
  let quietAt = 0;

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

  function pen(g) {
    ctx.fillStyle = g.state === 'rest' || g.state === 'serial' ? ink : inkStrong;
    ctx.fillText(g.text, g.x, g.y);
  }

  // The whole pad. Only needed when the page is laid out, the theme
  // changes or the font arrives; after that only changing groups repaint.
  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.font = '13px "Courier Prime", ui-monospace, monospace';
    ctx.textBaseline = 'alphabetic';
    for (const g of groups) pen(g);
  }

  // Groups sit well apart, so a group can be wiped and rewritten inside
  // its own box without touching its neighbours.
  function redraw(g) {
    ctx.clearRect(g.x - 4, g.y - 15, GROUP_W - 8, ROW_H - 6);
    pen(g);
  }

  // Only bare page shows the pad; sheets, folders and text sit on top of it.
  const OPEN = new Set(['BODY', 'MAIN', 'HTML', 'CANVAS']);
  const OPEN_CLASSES = ['hero', 'hero-copy', 'cryptex-stage', 'today-strip', 'doors', 'door-learn'];
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
    if (now >= nextDecode && now < quietAt && active.length < MAX_ACTIVE) {
      startDecode(now);
      nextDecode = now + 1400 + Math.random() * 1800;
    }

    for (const g of active) {
      const t = now - g.start;
      const was = g.text + g.state;
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
      if (g.text + g.state !== was) redraw(g);
    }
    active = active.filter(g => g.state !== 'rest');
  }

  // Frames only run while letters are scrambling. The rest of the time
  // (words holding, or nothing happening) a timer waits for the next
  // thing that is due, so an idle page does no work at all.
  let frame = null;
  let timer = null;
  let last = 0;

  function schedule() {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    frame = timer = null;
    if (still.matches || document.hidden) return;
    if (active.some(g => g.state !== 'holding')) {
      frame = requestAnimationFrame(tick);
      return;
    }
    let due = active.length < MAX_ACTIVE && performance.now() < quietAt ? nextDecode : Infinity;
    for (const g of active) due = Math.min(due, g.start + HOLD_MS + 1);
    if (due === Infinity) return;
    timer = setTimeout(() => {
      step(performance.now());
      schedule();
    }, Math.max(0, due - performance.now()));
  }

  function tick(now) {
    // Twenty frames a second is plenty for letters ticking over.
    if (now - last > 50) {
      step(now);
      last = now;
    }
    schedule();
  }

  function start() {
    if (!still.matches && !document.hidden) {
      nextDecode = performance.now() + 600;
      quietAt = performance.now() + 5000;
    }
    schedule();
  }

  // Turning the cryptex stirs the pad for a moment.
  document.addEventListener('cryptex:turn', () => {
    const now = performance.now();
    if (quietAt < now + 2500) quietAt = now + 2500;
    if (nextDecode > now + 300) nextDecode = now + 300;
    schedule();
  });

  readInk();
  layout();
  start();
  document.fonts.ready.then(draw);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      layout();
      schedule();
    }, 150);
  });
  document.addEventListener('visibilitychange', start);
  still.addEventListener('change', start);
  // On the next frame, so reading the new colours doesn't hold up the lamp.
  document.addEventListener('themechange', () => requestAnimationFrame(() => {
    readInk();
    draw();
  }));
})();
