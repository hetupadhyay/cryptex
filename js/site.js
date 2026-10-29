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

  // Highlight the section you're reading in the nav.
  const links = [...document.querySelectorAll('.nav-links a')];
  const sections = links.map(a => document.querySelector(a.getAttribute('href')));
  if ('IntersectionObserver' in window) {
    const visible = new Map();
    const io = new IntersectionObserver(entries => {
      for (const e of entries) visible.set(e.target, e.isIntersecting);
      const current = sections.find(s => visible.get(s));
      links.forEach((a, i) => a.classList.toggle('current', sections[i] === current));
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => io.observe(s));
  }

  Breaker.init();
})();
