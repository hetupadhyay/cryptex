/*
 * Page-wide bits: the theme switch and the nav's current section.
 */
(function () {
  'use strict';

  const themeBtn = document.querySelector('.theme');

  function applyTheme(theme, save) {
    document.documentElement.dataset.theme = theme;
    themeBtn.setAttribute('aria-checked', theme === 'night');
    if (save) {
      try { localStorage.setItem('cryptex-theme', theme); } catch {}
    }
    document.dispatchEvent(new CustomEvent('themechange'));
  }

  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'night' ? 'day' : 'night';
    document.documentElement.classList.add('theme-shift');
    applyTheme(next, true);
    setTimeout(() => document.documentElement.classList.remove('theme-shift'), 420);
  });

  applyTheme(document.documentElement.dataset.theme, false);

  // On small screens the links are a row that scrolls sideways. Mark which
  // ends have more past them, so the CSS can fade those edges.
  const row = document.querySelector('.nav-links');
  function edges() {
    const more = row.scrollWidth - row.clientWidth;
    row.classList.toggle('more-start', row.scrollLeft > 1);
    row.classList.toggle('more-end', row.scrollLeft < more - 1);
  }
  edges();
  window.addEventListener('resize', edges);

  // Any scrolling of the row that we didn't start is the reader's, and for
  // a little while after that we leave the row where they put it.
  let ownScrollUntil = 0;
  let readerAt = -Infinity;
  const readerMoved = () => { readerAt = performance.now(); };
  row.addEventListener('scroll', () => {
    edges();
    if (performance.now() > ownScrollUntil) readerMoved();
  }, { passive: true });
  ['pointerdown', 'wheel'].forEach(type => row.addEventListener(type, readerMoved, { passive: true }));

  function reveal(link) {
    const more = row.scrollWidth - row.clientWidth;
    if (!link || more <= 0 || performance.now() - readerAt < 2500) return;
    // Clear of the fade, with a little of the next link showing.
    const room = 44;
    const a = link.getBoundingClientRect();
    const b = row.getBoundingClientRect();
    const start = a.left - b.left + row.scrollLeft;
    let left = row.scrollLeft;
    if (start - room < left) left = start - room;
    else if (start + a.width + room > left + row.clientWidth) left = start + a.width + room - row.clientWidth;
    left = Math.max(0, Math.min(left, more));
    if (Math.abs(left - row.scrollLeft) < 1) return;
    ownScrollUntil = performance.now() + 900;
    row.scrollTo({ left, behavior: Stage.reduced ? 'auto' : 'smooth' });
  }

  // Highlight the section you're reading in the nav, and keep its link in
  // view once the page has settled on it.
  const links = [...row.querySelectorAll('a')];
  const sections = links.map(a => document.querySelector(a.getAttribute('href')));
  if ('IntersectionObserver' in window) {
    const visible = new Map();
    let revealTimer;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) visible.set(e.target, e.isIntersecting);
      const current = sections.find(s => visible.get(s));
      links.forEach((a, i) => a.classList.toggle('current', sections[i] === current));
      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => reveal(links[sections.indexOf(current)]), 250);
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => s && io.observe(s));
  }

  Breaker.init();
})();
