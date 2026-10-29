/*
 * Codebreaking: today's intercept, the missions and the desk, as three
 * folders of one file. The address follows the open folder (#today,
 * #missions, #desk), so each can be linked to.
 */
(function () {
  'use strict';

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

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => show(tab.dataset.file));
    tab.addEventListener('keydown', e => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      show(tabs[(i + step + tabs.length) % tabs.length].dataset.file, { focus: true });
    });
  });

  window.addEventListener('hashchange', () => show(location.hash.slice(1), { push: false }));

  // Anything sent to the desk opens its folder first.
  const load = Breaker.load;
  Breaker.load = (...args) => {
    show('desk');
    return load(...args);
  };

  Breaker.init();
  show(location.hash.slice(1), { push: false });

  const sent = Handoff.take('desk');
  if (sent && sent.text) Breaker.load(sent.text, sent.attack);
})();
