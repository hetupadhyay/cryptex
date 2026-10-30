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
    // The browser's own bar follows the lamp, not just the system setting.
    const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = paper; });
    // One name, "Night lamp", and pressed or not says whether it's on.
    lamps.forEach(l => l.setAttribute('aria-pressed', theme === 'night'));
    if (save) {
      try { localStorage.setItem('cryptex-theme', theme); } catch {}
    }
    document.dispatchEvent(new CustomEvent('themechange'));
  }

  // The whole page cross-fades once, rather than every element easing its
  // own colours, which is slow on a long page.
  lamps.forEach(lamp => lamp.addEventListener('click', () => {
    const next = root.dataset.theme === 'night' ? 'day' : 'night';
    if (document.startViewTransition && !reduced()) document.startViewTransition(() => applyTheme(next, true));
    else applyTheme(next, true);
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
  function setMenu(open, { navigating = false } = {}) {
    if (!menu || open === !menu.hidden) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.textContent = open ? 'Close' : 'Menu';
    document.body.classList.toggle('menu-open', open);
    if (open) Sheet.opened('menu', () => setMenu(false));
    else Sheet.closed('menu', { navigating });
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => setMenu(menu.hidden));
    Sheet.swipe(menu, { grip: menu.querySelector('.sheet-grip'), edge: 'top', close: () => setMenu(false) });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !menu.hidden) {
        setMenu(false);
        menuBtn.focus();
      }
    });
    menu.addEventListener('click', e => { if (Sheet.follow('menu', e)) setMenu(false, { navigating: true }); });
    // Tabbing out of the open menu closes it, so focus never lands on
    // something the menu covers.
    menu.addEventListener('focusout', e => {
      if (e.relatedTarget && !menu.contains(e.relatedTarget) && e.relatedTarget !== menuBtn) setMenu(false);
    });
    window.matchMedia('(min-width: 821px)').addEventListener('change', e => { if (e.matches) setMenu(false); });
  }

  // ---- today's intercept --------------------------------------------------------

  // shortcut: the epoch and numbering mirror js/daily.js (No. 1 was 24 June 2026),
  // repeated here so every page can show the number without loading the puzzle.
  const EPOCH = Date.UTC(2026, 5, 24);
  function todayNumber(now) {
    const local = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(1, Math.floor((local - EPOCH) / 86400000) + 1);
  }
  // The masthead only needs hours and minutes; the seconds tick on the
  // Today folder itself.
  const numbers = document.querySelectorAll('.today-no');
  const lefts = document.querySelectorAll('.today-left');
  function tick() {
    const now = new Date();
    numbers.forEach(n => { n.textContent = `No. ${todayNumber(now)}`; });
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const m = Math.max(1, Math.ceil((midnight - now) / 60000));
    lefts.forEach(t => {
      t.textContent = `${Math.floor(m / 60)}h ${m % 60}m`;
      t.setAttribute('datetime', `PT${Math.floor(m / 60)}H${m % 60}M`);
    });
    if (lefts.length) setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
  }
  tick();

  // ---- the coded signature ------------------------------------------------------

  // "Made by" is written in a Caesar shift of 3. It decodes while pointed
  // at, and a tap turns it either way on a touch screen. Screen readers get
  // the plain name from the page instead.
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
    let plain = false;
    const show = to => {
      plain = to === 'plain';
      roll(to);
    };
    sig.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show('plain'); });
    sig.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') show('coded'); });
    // Where something can hover, pointing has already decoded it.
    sig.addEventListener('click', () => { if (!matchMedia('(hover: hover)').matches) show(plain ? 'coded' : 'plain'); });
  });
})();
