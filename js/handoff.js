/*
 * Moving work between pages. The lab and the desk each have their own page,
 * so a button elsewhere that sends text to one of them leaves it here for a
 * moment and goes there; the page picks it up once as it loads.
 */
(function () {
  'use strict';

  const KEY = 'cryptex-handoff';
  const PAGES = { lab: '/lab', desk: '/codebreaking#desk' };
  const MAX_TEXT = 20000;
  // Long enough for a slow page to load, short enough that a hand-off for
  // a page the reader never reached doesn't turn up on a later visit.
  const FRESH = 60000;

  function go(to, payload) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ to, at: Date.now(), ...payload }));
    } catch {}
    location.href = PAGES[to];
  }

  // What was sent to this page, if anything. It's only handed over once,
  // and one that has waited too long is thrown away.
  function take(to) {
    try {
      const data = JSON.parse(sessionStorage.getItem(KEY));
      if (!data) return null;
      const fresh = typeof data.at === 'number' && Date.now() - data.at < FRESH;
      if (data.to !== to && fresh) return null;
      sessionStorage.removeItem(KEY);
      if (data.to !== to || !fresh) return null;
      if (data.text !== undefined && (typeof data.text !== 'string' || data.text.length > MAX_TEXT)) return null;
      return data;
    } catch {
      return null;
    }
  }

  // Stand-ins for pages without the lab or the desk; js/lab.js and
  // js/breaker.js replace them where those pages load.
  // shortcut: this mirrors Breaker.attackFor, keep the two in step.
  const ATTACKS = { caesar: 'brute', vigenere: 'vig', beaufort: 'vig:beaufort', railfence: 'rail', affine: 'affine' };
  window.Lab = { open: (id, opts = {}) => go('lab', { id, opts }) };
  window.Breaker = {
    load: (text, attack) => go('desk', { text, attack }),
    attackFor: id => ATTACKS[id] || 'freq',
  };
  // A page the browser rendered ahead of time runs its scripts before the
  // reader clicks; anything sent to it is only there once they arrive.
  function ready(fn) {
    if (document.prerendering) document.addEventListener('prerenderingchange', fn, { once: true });
    else fn();
  }

  window.Handoff = { take, ready };
})();
