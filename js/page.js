/*
 * The standalone pages (terms, privacy, 404) only need the theme switch.
 * Same behaviour as js/site.js, which expects the main page's sections.
 */
(function () {
  'use strict';

  const themeBtn = document.querySelector('.theme');
  if (!themeBtn) return;

  function applyTheme(theme, save) {
    document.documentElement.dataset.theme = theme;
    themeBtn.setAttribute('aria-checked', theme === 'night');
    if (save) {
      try { localStorage.setItem('cryptex-theme', theme); } catch {}
    }
  }

  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'night' ? 'day' : 'night';
    document.documentElement.classList.add('theme-shift');
    applyTheme(next, true);
    setTimeout(() => document.documentElement.classList.remove('theme-shift'), 420);
  });

  applyTheme(document.documentElement.dataset.theme === 'night' ? 'night' : 'day', false);
})();
