/*
 * Faint columns of binary drifting up behind the page.
 * Sparse on purpose: it should read as texture, not as a screensaver.
 */
(function () {
  'use strict';

  const canvas = document.querySelector('canvas.digits');
  const ctx = canvas.getContext('2d');
  const SPACING = 64;
  const LINE = 18;
  let columns = [];
  let colour = '';
  let width = 0;
  let height = 0;
  let last = 0;
  let frame = null;

  function readColour() {
    colour = getComputedStyle(document.documentElement).getPropertyValue('--digits').trim();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.ceil(width / SPACING);
    columns = Array.from({ length: count }, (_, i) => ({
      x: i * SPACING + 12 + Math.random() * 28,
      y: Math.random() * height,
      speed: 5 + Math.random() * 9,
      // Gaps keep it from looking like a solid wall of digits.
      bits: Array.from({ length: Math.ceil(height / LINE) + 2 }, () => (Math.random() < 0.3 ? ' ' : Math.random() < 0.5 ? '0' : '1')),
    }));
    draw(0);
  }

  function draw(dt) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = colour;
    ctx.font = '12px "Courier Prime", ui-monospace, monospace';
    for (const col of columns) {
      col.y -= col.speed * dt;
      if (col.y < -LINE) {
        col.y += LINE;
        col.bits.push(col.bits.shift());
      }
      if (Math.random() < 0.02) {
        const i = Math.floor(Math.random() * col.bits.length);
        if (col.bits[i] !== ' ') col.bits[i] = col.bits[i] === '0' ? '1' : '0';
      }
      for (let i = 0; i < col.bits.length; i++) {
        const y = col.y + i * LINE;
        if (y > height + LINE) break;
        if (col.bits[i] !== ' ') ctx.fillText(col.bits[i], col.x, y);
      }
    }
  }

  function tick(t) {
    // About 24 frames a second is plenty for something this slow.
    if (t - last > 42) {
      draw(last ? Math.min((t - last) / 1000, 0.1) : 0);
      last = t;
    }
    frame = requestAnimationFrame(tick);
  }

  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  function start() {
    cancelAnimationFrame(frame);
    last = 0;
    if (!still.matches && !document.hidden) frame = requestAnimationFrame(tick);
    else draw(0);
  }

  readColour();
  resize();
  start();

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', start);
  still.addEventListener('change', start);
  document.addEventListener('themechange', () => {
    readColour();
    draw(0);
  });
})();
