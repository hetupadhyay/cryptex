/*
 * Codebreaking: today's intercept, the missions and the desk, as three
 * folders of one file. The address follows the open folder (#today,
 * #missions, #desk), so each can be linked to.
 */
(function () {
  'use strict';

  const strip = document.querySelector('.file-tabs');
  const tabs = [...document.querySelectorAll('.file-tab')];
  const panels = [...document.querySelectorAll('.file-panel')];
  const files = tabs.map(t => t.dataset.file);

  function show(file, { focus = false, push = true } = {}) {
    if (!files.includes(file)) file = files[0];
    tabs.forEach(tab => {
      const on = tab.dataset.file === file;
      tab.setAttribute('aria-selected', on);
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    });
    panels.forEach(p => { p.hidden = p.dataset.file !== file; });
    if (push && location.hash !== '#' + file) history.replaceState(null, '', '#' + file);
  }

  // A folder opened from further down the page (a footer link, or work sent
  // to the desk) brings its tabs back into view.
  function reveal() {
    const top = strip.getBoundingClientRect().top;
    if (top >= 0 && top < innerHeight / 2) return;
    strip.scrollIntoView({ behavior: Stage.reduced ? 'auto' : 'smooth' });
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => show(tab.dataset.file));
    tab.addEventListener('keydown', e => {
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      show(tabs[(to + tabs.length) % tabs.length].dataset.file, { focus: true });
    });
  });

  // Only a folder's own name opens it: #top, from the skip link, isn't one.
  window.addEventListener('hashchange', () => {
    const file = location.hash.slice(1);
    if (!files.includes(file)) return;
    show(file, { push: false });
    reveal();
  });

  // A link to the folder already in the address (from the footer, say)
  // changes nothing in the address, so no hashchange comes. Open it here.
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href);
    if (url.pathname !== location.pathname || url.hash !== location.hash || !files.includes(url.hash.slice(1))) return;
    e.preventDefault();
    show(url.hash.slice(1));
    reveal();
  });

  // Anything sent to the desk opens its folder first. If the button that
  // sent it was in the folder that just closed, focus goes to the desk's tab.
  const load = Breaker.load;
  Breaker.load = (...args) => {
    const from = document.activeElement;
    show('desk');
    reveal();
    if (from && from.closest('.file-panel[hidden]')) tabs[files.indexOf('desk')].focus({ preventScroll: true });
    return load(...args);
  };

  Breaker.init();
  show(location.hash.slice(1), { push: false });

  Handoff.ready(() => {
    const sent = Handoff.take('desk');
    if (sent && sent.text) Breaker.load(sent.text, sent.attack);
  });
})();
