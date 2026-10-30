/*
 * The sign-in, account and reset-password pages.
 */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const page = document.body.dataset.page;
  const { api } = window.Account;
  const NAMES = { google: 'Google', github: 'GitHub', apple: 'Apple' };

  function notice(text) {
    const el = $('#auth-notice');
    el.textContent = text;
    el.hidden = !text;
  }

  // A problem is shown under the form and marked on the field it's about.
  function problem(form, errorEl, text, field) {
    errorEl.textContent = text || '';
    $$('input', form).forEach(input => input.setAttribute('aria-invalid', Boolean(text) && input.name === field));
    const bad = field && $(`input[name="${field}"]`, form);
    if (bad) bad.focus();
  }

  function busy(form, on) {
    $$('button', form).forEach(b => { b.disabled = on; });
  }

  // Only a page on this site, never somewhere else.
  function next() {
    const to = new URLSearchParams(location.search).get('next');
    if (!to || !to.startsWith('/')) return '/account';
    try {
      const url = new URL(to, location.origin);
      return url.origin === location.origin ? url.pathname + url.search + url.hash : '/account';
    } catch {
      return '/account';
    }
  }

  function clearQuery() {
    history.replaceState(history.state, '', location.pathname);
  }

  // ---- sign in and create an account -------------------------------------------

  async function signin() {
    const ERRORS = {
      unavailable: 'That way of signing in isn’t switched on yet.',
      cancelled: 'Signing in was cancelled.',
      expired: 'That sign-in took too long or was interrupted. Please try again.',
      failed: 'Signing in didn’t work this time. Please try again.',
    };
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    if (error === 'no-email') {
      notice(`Your ${NAMES[params.get('provider')] || 'other'} account needs a confirmed email address to sign in here. Add one there, or use your email below.`);
    } else if (ERRORS[error]) notice(ERRORS[error]);

    if (await window.Account.ready) return location.replace(next());

    const config = await api('GET', 'config').catch(() => null);
    if (!config || !config.ok || !config.data.accounts) {
      notice('Accounts aren’t switched on yet. Everything else on the site works as usual.');
      return;
    }
    $('.auth-body').hidden = false;
    const { providers, mail } = config.data;
    providers.forEach(id => {
      $(`.provider[data-provider="${id}"]`).hidden = false;
    });
    $('.auth-or').hidden = !providers.length;

    const form = $('#auth-form');
    const errorEl = $('#auth-error');
    const submit = $('[type="submit"]', form);
    let mode = 'signin';

    function setMode(to) {
      mode = to;
      $$('.auth-modes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode));
      $$('[data-only]').forEach(el => { el.hidden = el.dataset.only !== mode || (el.dataset.act === 'forgot' && !mail); });
      const title = mode === 'signin' ? 'Sign in' : 'Create an account';
      $('#auth-title').textContent = title;
      document.title = `${title} · Cryptex`;
      submit.textContent = submit.dataset[mode === 'signin' ? 'labelSignin' : 'labelSignup'];
      $('#auth-password').autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
      problem(form, errorEl, '');
    }
    $$('.auth-modes button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    setMode(location.hash === '#signup' ? 'signup' : 'signin');

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = $('#auth-email').value.trim();
      const password = $('#auth-password').value;
      if (!email) return problem(form, errorEl, 'Please enter your email address.', 'email');
      if (!password) return problem(form, errorEl, 'Please enter your password.', 'password');
      busy(form, true);
      const r = await api('POST', mode === 'signin' ? 'login' : 'signup', { email, password, name: $('#auth-name').value })
        .catch(() => ({ ok: false, data: { error: 'You seem to be offline. Please try again when you’re connected.' } }));
      busy(form, false);
      if (!r.ok) return problem(form, errorEl, r.data.error || 'That didn’t work. Please try again.', r.data.field || (r.status === 401 ? 'password' : null));
      window.Account.remember(r.data.user);
      await window.Account.sync();
      location.assign(mode === 'signup' && next() === '/account' ? '/account?welcome=1' : next());
    });

    // Forgotten password: an emailed link.
    const forgot = $('#forgot-form');
    const showForgot = on => {
      form.hidden = on;
      forgot.hidden = !on;
      $('.auth-modes').hidden = on;
      $('.providers').hidden = on;
      $('.auth-or').hidden = on || !providers.length;
      (on ? $('#forgot-email') : $('#auth-email')).focus();
    };
    $('[data-act="forgot"]').addEventListener('click', () => {
      $('#forgot-email').value = $('#auth-email').value;
      showForgot(true);
    });
    $('[data-act="back"]', forgot).addEventListener('click', () => showForgot(false));
    forgot.addEventListener('submit', async e => {
      e.preventDefault();
      const said = $('#forgot-said');
      busy(forgot, true);
      const r = await api('POST', 'password/forgot', { email: $('#forgot-email').value })
        .catch(() => ({ ok: false, data: { error: 'You seem to be offline. Please try again when you’re connected.' } }));
      busy(forgot, false);
      if (!r.ok) return problem(forgot, said, r.data.error, r.data.field);
      problem(forgot, said, '');
      notice('If there’s an account for that email, a link to reset the password is on its way. It works for an hour.');
      showForgot(false);
    });
  }

  // ---- the account page ---------------------------------------------------------

  async function account() {
    const user = await window.Account.ready;
    if (!user) return location.replace('/signin?next=/account');
    const config = await api('GET', 'config').catch(() => ({ data: { providers: [], mail: false } }));
    const { providers = [], mail = false } = config.data || {};

    const params = new URLSearchParams(location.search);
    const said = {
      welcome: 'You’re signed in. Your progress on this device is now saved to your account.',
      verified: params.get('verified') === '1' ? 'Your email is confirmed.' : 'That confirmation link has expired or was already used.',
      linked: `${NAMES[params.get('linked')] || 'That account'} is now linked. You can use it to sign in.`,
    };
    if (params.get('error') === 'taken') notice(`That ${NAMES[params.get('provider')] || ''} account is already linked to another Cryptex account.`);
    else for (const key of ['welcome', 'verified', 'linked']) if (params.has(key)) notice(said[key]);
    if (params.toString()) clearQuery();

    $('.account-body').hidden = false;
    let me = user;

    function progress() {
      const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
      const cracked = read('cryptex-cracked', []).length;
      const daily = read('cryptex-daily', {});
      const days = Object.keys(daily.days || {}).length;
      const best = daily.best || 0;
      $('#account-progress').textContent =
        `${cracked} of 8 missions cracked, ${days} daily ${days === 1 ? 'intercept' : 'intercepts'} cracked, best streak ${best} ${best === 1 ? 'day' : 'days'}. ` +
        'It’s saved to your account, so it’s there on any device you sign in on.';
    }

    function show(u) {
      me = u;
      window.Account.remember(u);
      window.Account.render(u);
      $('#account-who').textContent = `Signed in as ${u.name || u.email}.`;
      $('#account-email').textContent = u.email;
      const badge = $('#account-verified');
      badge.textContent = u.emailVerified ? 'Confirmed' : 'Not confirmed yet';
      badge.classList.toggle('ok', u.emailVerified);
      $('#verify-line').hidden = u.emailVerified || !mail;
      if (document.activeElement !== $('#account-name')) $('#account-name').value = u.name;
      const methods = 1 + u.linked.length - (u.hasPassword ? 0 : 1);
      $$('#methods li').forEach(li => {
        const id = li.dataset.method;
        const on = id === 'password' ? u.hasPassword : u.linked.includes(id);
        li.hidden = id !== 'password' && !on && !providers.includes(id);
        $('.method-state', li).textContent = id === 'password' ? (on ? 'Set' : 'Not set') : on ? 'Linked' : 'Not linked';
        li.classList.toggle('on', on);
        const link = $('[data-link]', li);
        if (link) link.hidden = on;
        const unlink = $('[data-unlink]', li);
        if (unlink) unlink.hidden = !on || methods < 2;
      });
      $('#password-title').textContent = u.hasPassword ? 'Password' : 'Set a password';
      $('#current-field').hidden = !u.hasPassword;
      progress();
    }
    show(user);
    window.addEventListener('storage', progress);
    window.Account.sync().then(progress);

    $('[data-act="resend"]').addEventListener('click', async () => {
      const r = await api('POST', 'verify/resend', {}).catch(() => null);
      $('#resend-said').textContent = !r ? 'You seem to be offline.' : r.ok ? `Sent. Check ${me.email}.` : r.data.error;
    });

    $('#name-form').addEventListener('submit', async e => {
      e.preventDefault();
      const r = await api('POST', 'name', { name: $('#account-name').value }).catch(() => null);
      $('#name-said').textContent = !r ? 'You seem to be offline.' : r.ok ? 'Saved.' : r.data.error;
      if (r && r.ok) show(r.data.user);
    });

    $$('[data-unlink]').forEach(b => b.addEventListener('click', async () => {
      const r = await api('DELETE', `auth/${b.dataset.unlink}`).catch(() => null);
      $('#methods-error').textContent = !r ? 'You seem to be offline.' : r.ok ? '' : r.data.error;
      if (r && r.ok) show(r.data.user);
    }));

    const pwForm = $('#password-form');
    pwForm.addEventListener('submit', async e => {
      e.preventDefault();
      busy(pwForm, true);
      const r = await api('POST', 'password/change', { current: $('#current-password').value, password: $('#new-password').value })
        .catch(() => ({ ok: false, data: { error: 'You seem to be offline.' } }));
      busy(pwForm, false);
      if (!r.ok) return problem(pwForm, $('#password-error'), r.data.error, r.data.field === 'current' ? null : 'password');
      problem(pwForm, $('#password-error'), '');
      pwForm.reset();
      $('#password-said').textContent = 'Saved. You’re still signed in here; other devices will need the new password.';
      show(r.data.user);
    });
    $('#current-password').name = 'current';
    $('#new-password').name = 'password';

    async function leave(path) {
      const r = await api('POST', path, {}).catch(() => null);
      if (!r || !r.ok) return notice('That didn’t work. Please try again when you’re connected.');
      window.Account.remember(null);
      location.assign('/');
    }
    $('[data-act="logout"]').addEventListener('click', () => leave('logout'));
    $('[data-act="logout-everywhere"]').addEventListener('click', () => leave('logout-everywhere'));

    const delForm = $('#delete-form');
    $('#delete-confirm').name = 'confirm';
    delForm.addEventListener('submit', async e => {
      e.preventDefault();
      const confirm = $('#delete-confirm').value.trim().toLowerCase();
      if (confirm !== 'delete') return problem(delForm, $('#delete-error'), 'Type “delete” to confirm.', 'confirm');
      busy(delForm, true);
      const r = await api('DELETE', 'account', { confirm }).catch(() => null);
      busy(delForm, false);
      if (!r || !r.ok) return problem(delForm, $('#delete-error'), r ? r.data.error : 'You seem to be offline.', 'confirm');
      window.Account.remember(null);
      location.assign('/');
    });
  }

  // ---- reset password -----------------------------------------------------------

  function reset() {
    const token = new URLSearchParams(location.hash.slice(1)).get('token');
    // The link's secret isn't left in the address bar or the history.
    history.replaceState(history.state, '', location.pathname);
    const form = $('#reset-form');
    if (!token) {
      form.hidden = true;
      notice('This page needs the link from your email. Ask for a new one from the sign-in page.');
      return;
    }
    form.addEventListener('submit', async e => {
      e.preventDefault();
      busy(form, true);
      const r = await api('POST', 'password/reset', { token, password: $('#reset-password').value })
        .catch(() => ({ ok: false, data: { error: 'You seem to be offline. Please try again when you’re connected.' } }));
      busy(form, false);
      if (!r.ok) return problem(form, $('#reset-error'), r.data.error, 'password');
      window.Account.remember(r.data.user);
      location.assign('/account');
    });
    $('#reset-password').name = 'password';
  }

  if (page === 'signin') signin();
  else if (page === 'account') account();
  else if (page === 'reset') reset();
})();
