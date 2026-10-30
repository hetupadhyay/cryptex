/*
 * The account, on every page: the masthead says whether you're signed in,
 * and your progress is kept in step with your account. A browser that has
 * never been signed in makes no requests for any of this.
 */
(function () {
  'use strict';

  const KEY = 'cryptex-account';

  function cached() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      return saved && typeof saved.email === 'string' ? saved : null;
    } catch {
      return null;
    }
  }

  function remember(user) {
    try {
      if (user) localStorage.setItem(KEY, JSON.stringify({ name: user.name || '', email: user.email }));
      else localStorage.removeItem(KEY);
    } catch {}
  }

  function render(user) {
    const label = user ? (user.name || user.email).trim() : '';
    document.querySelectorAll('[data-account]').forEach(a => {
      a.classList.toggle('signed-in', Boolean(user));
      a.href = user ? '/account' : '/signin';
      a.textContent = user ? label.charAt(0).toUpperCase() : 'Sign in';
      if (user) a.setAttribute('aria-label', `Your account, ${label}`);
      else a.removeAttribute('aria-label');
    });
    document.querySelectorAll('[data-account-menu]').forEach(a => {
      a.href = user ? '/account' : '/signin';
      a.querySelector('span').textContent = user ? 'Your account' : 'Sign in';
      a.querySelector('small').textContent = user ? user.email : 'Keep your progress on every device';
    });
  }

  async function api(method, path, body) {
    const res = await fetch('/api/' + path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try {
      data = await res.json();
    } catch {}
    return { ok: res.ok, status: res.status, data };
  }

  // ---- progress ---------------------------------------------------------------

  const STORES = { cracked: 'cryptex-cracked', daily: 'cryptex-daily' };

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  }

  // The missions and the daily intercept listen for changes made in other
  // tabs. A change that came from the account is announced the same way.
  function write(key, value) {
    const text = JSON.stringify(value);
    try {
      if (localStorage.getItem(key) === text) return;
      localStorage.setItem(key, text);
    } catch {
      return;
    }
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: text }));
  }

  let running = null;
  let again = false;

  // Sends what this browser has and takes back everything the account has,
  // from every device. Without a network it waits for the next change.
  function sync() {
    if (!cached()) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      const r = await api('PUT', 'progress', { cracked: read(STORES.cracked, []), daily: read(STORES.daily, {}) }).catch(() => null);
      if (!r) return;
      if (r.status === 401) {
        remember(null);
        render(null);
        return;
      }
      if (!r.ok) return;
      write(STORES.cracked, r.data.cracked);
      write(STORES.daily, r.data.daily);
    })().finally(() => {
      running = null;
      if (again) {
        again = false;
        sync();
      }
    });
    return running;
  }

  let timer;
  document.addEventListener('cryptex:progress', () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 600);
  });

  // ---- on load ------------------------------------------------------------------

  const known = cached();
  render(known);
  // The name shown is the one remembered here; check it with the server,
  // which also notices a session that has ended.
  const ready = known
    ? api('GET', 'me').then(r => {
      if (!r.ok) return known;
      remember(r.data.user);
      render(r.data.user);
      if (r.data.user) sync();
      return r.data.user;
    }).catch(() => known)
    : Promise.resolve(null);

  window.Account = { api, cached, remember, render, sync, ready };
})();
