/*
 * The parts every page shares: the lamp, the phone menu, the current page in
 * the masthead, today's intercept and its countdown, and the coded signature.
 */
(function () {
  'use strict';

  const root = document.documentElement;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- the lamp ---------------------------------------------------------------

  const lamps = [...document.querySelectorAll('.mast .lamp')];

  function applyTheme(theme, save) {
    root.dataset.theme = theme;
    lamps.forEach(l => {
      l.setAttribute('aria-pressed', theme === 'night');
      l.setAttribute('aria-label', theme === 'night' ? 'Turn off the night lamp' : 'Turn on the night lamp');
    });
    if (save) {
      try { localStorage.setItem('cryptex-theme', theme); } catch {}
    }
    document.dispatchEvent(new CustomEvent('themechange'));
  }

  lamps.forEach(lamp => lamp.addEventListener('click', () => {
    root.classList.add('theme-shift');
    applyTheme(root.dataset.theme === 'night' ? 'day' : 'night', true);
    setTimeout(() => root.classList.remove('theme-shift'), 420);
  }));
  applyTheme(root.dataset.theme === 'night' ? 'night' : 'day', false);

  // ---- where we are -------------------------------------------------------------

  const page = document.body.dataset.page;
  document.querySelectorAll('.mast [data-page]').forEach(a => {
    if (a.dataset.page === page) a.setAttribute('aria-current', 'page');
  });

  // A soft edge under the masthead only once the page scrolls beneath it.
  const mast = document.querySelector('.mast');
  const edge = () => mast && mast.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', edge, { passive: true });
  edge();

  // ---- the phone menu -----------------------------------------------------------

  const menuBtn = document.querySelector('.menu-btn');
  const menu = document.getElementById('menu');
  function setMenu(open) {
    if (!menu) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.textContent = open ? 'Close' : 'Menu';
    document.body.classList.toggle('menu-open', open);
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => setMenu(menu.hidden));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !menu.hidden) {
        setMenu(false);
        menuBtn.focus();
      }
    });
    menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    window.matchMedia('(min-width: 821px)').addEventListener('change', e => { if (e.matches) setMenu(false); });
  }

  // ---- today's intercept --------------------------------------------------------

  // shortcut: the epoch and numbering mirror js/daily.js (No. 1 was 24 June 2026),
  // repeated here so every page can show the number without loading the puzzle.
  const EPOCH = Date.UTC(2026, 5, 24);
  function todayNumber(now) {
    const local = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((local - EPOCH) / 86400000) + 1;
  }
  const numbers = document.querySelectorAll('.today-no');
  const lefts = document.querySelectorAll('.today-left');
  function tick() {
    const now = new Date();
    numbers.forEach(n => { n.textContent = `No. ${todayNumber(now)}`; });
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((midnight - now) / 1000));
    const text = `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    lefts.forEach(t => {
      t.textContent = text;
      t.setAttribute('datetime', `PT${Math.floor(s / 3600)}H${Math.floor(s / 60) % 60}M`);
    });
  }
  tick();
  if (lefts.length) setInterval(tick, 1000);

  // ---- the coded signature ------------------------------------------------------

  // "Made by" is written in a Caesar shift of 3 and decodes while hovered or focused.
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  document.querySelectorAll('.signature').forEach(sig => {
    let timer;
    const roll = (to) => {
      clearInterval(timer);
      const target = sig.dataset[to];
      if (reduced()) {
        sig.textContent = target;
        return;
      }
      let n = 0;
      timer = setInterval(() => {
        n++;
        sig.textContent = [...target].map((ch, i) => (i < n || ch === ' ' ? ch : LETTERS[(Math.random() * 26) | 0])).join('');
        if (n >= target.length) clearInterval(timer);
      }, 30);
    };
    sig.addEventListener('mouseenter', () => roll('plain'));
    sig.addEventListener('focus', () => roll('plain'));
    sig.addEventListener('mouseleave', () => roll('coded'));
    sig.addEventListener('blur', () => roll('coded'));
  });
})();
