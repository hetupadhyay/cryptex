// Pick the theme before first paint so the page doesn't flash. Loaded with
// a plain <script src> in the <head>, so it runs before the body is drawn.
(function () {
  var theme = null;
  try { theme = localStorage.getItem('cryptex-theme'); } catch (e) {}
  if (theme !== 'day' && theme !== 'night') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
  }
  document.documentElement.dataset.theme = theme;
})();
