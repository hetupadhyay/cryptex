/*
 * Send a secret: the ciphertext travels in the link's #fragment, which
 * browsers never send to a server.
 */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const CHOICES = ['caesar', 'atbash', 'vigenere', 'autokey', 'beaufort', 'playfair', 'polybius', 'railfence', 'columnar'];
  const PREFIX = '#secret=';
  // Limits for links, checked both ways: a link we make always opens, and a
  // huge or hand-made one is refused before it can slow the page down.
  const MAX_LINK = 8192; // characters after the #
  const MAX_TEXT = 4000;
  const MAX_KEY = 64;

  const form = $('#share-form');
  const select = $('#share-cipher');
  const keyField = $('#share-key-field');
  const keyInput = $('#share-key');
  const includeKey = $('#share-include-key');
  const error = $('#share-error');
  const out = $('.share-out', form);
  const linkInput = $('#share-link');

  for (const id of CHOICES) select.append(new Option(Ciphers.byId(id).name, id));
  select.value = 'vigenere';

  const keyDef = () => Ciphers.byId(select.value).keys[0];

  function syncKey() {
    const def = keyDef();
    keyField.hidden = !def;
    includeKey.closest('.check').hidden = !def;
    if (!def) return;
    $('label', keyField).textContent = def.label.replace(' (optional)', '');
    keyInput.type = def.type === 'number' ? 'number' : 'text';
    if (def.type === 'number') {
      keyInput.min = def.min;
      keyInput.max = def.max;
    }
    keyInput.value = def.value || (def.type === 'text' ? 'SECRET' : '');
    out.hidden = true;
  }

  // base64url of UTF-8 JSON, so any message survives the trip.
  const encode = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decode = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));

  // Everything in a link is untrusted: check the cipher, and the type and
  // length of every field. Returns null for anything that doesn't fit.
  function parseSecret(fragment) {
    if (fragment.length > MAX_LINK + PREFIX.length) return null;
    const data = fragment.slice(PREFIX.length);
    if (!/^[A-Za-z0-9_-]+$/.test(data)) return null;
    let raw;
    try {
      raw = decode(data);
    } catch {
      return null;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (typeof raw.c !== 'string' || !CHOICES.includes(raw.c)) return null;
    if (typeof raw.t !== 'string' || !raw.t || raw.t.length > MAX_TEXT) return null;
    const c = Ciphers.byId(raw.c);
    const def = c.keys[0];
    // A key that is missing, malformed or invalid for the cipher is dropped,
    // and the link opens as if it came without one.
    let k = null;
    if (def && typeof raw.k === 'string' && raw.k && raw.k.length <= MAX_KEY && !c.check({ [def.id]: raw.k })) k = raw.k;
    return { c, t: raw.t, k };
  }

  select.addEventListener('change', syncKey);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const c = Ciphers.byId(select.value);
    const def = keyDef();
    const keys = def ? { [def.id]: keyInput.value } : {};
    const problem = c.check(keys);
    const text = $('#share-text').value;
    error.textContent = problem || (/[a-z]/i.test(text) ? '' : 'Write a message with at least one letter.');
    if (error.textContent) return;

    const payload = { c: c.id, t: c.encrypt(text, keys) };
    if (def && includeKey.checked) payload.k = keyInput.value;
    const data = encode(payload);
    if (payload.t.length > MAX_TEXT || data.length > MAX_LINK || (payload.k && payload.k.length > MAX_KEY)) {
      error.textContent = 'That’s too long to fit in a link. Try a shorter message or key.';
      out.hidden = true;
      return;
    }
    linkInput.value = location.href.split('#')[0] + PREFIX + data;
    const preview = payload.t.length > 60 ? payload.t.slice(0, 60) + '…' : payload.t;
    const code = document.createElement('code');
    code.textContent = preview;
    $('.share-preview', out).replaceChildren('They’ll see ', code, `, encrypted with ${c.name}` + (payload.k ? ', with the key included.' : ', and no key.'));
    out.hidden = false;
  });

  $('[data-act="copy-link"]', form).addEventListener('click', async e => {
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(linkInput.value);
      btn.textContent = 'Copied';
    } catch {
      linkInput.select();
      btn.textContent = 'Press Ctrl+C to copy';
    }
    setTimeout(() => { btn.textContent = 'Copy link'; }, 1800);
  });

  syncKey();

  // ---- opening a link ---------------------------------------------------------

  const dialog = $('.secret-dialog');

  function openSecret() {
    if (!location.hash.startsWith(PREFIX)) return;
    const secret = parseSecret(location.hash);
    if (!secret) {
      history.replaceState(null, '', location.href.split('#')[0]);
      return;
    }
    const { c } = secret;

    $('.secret-meta', dialog).textContent = secret.k
      ? `It was encrypted with ${c.name}, and they included the key. Watch it decrypt, or try cracking it first.`
      : `It was encrypted with ${c.name}. They didn’t send the key, so you’ll have to break it.`;
    $('.secret-text', dialog).textContent = secret.t;
    const labBtn = $('[data-act="secret-lab"]', dialog);
    labBtn.hidden = !secret.k;

    $('[data-act="secret-crack"]', dialog).onclick = () => {
      dialog.close();
      Breaker.load(secret.t, Breaker.attackFor(c.id));
      document.getElementById('desk').scrollIntoView({ behavior: Stage.reduced ? 'auto' : 'smooth' });
    };
    labBtn.onclick = () => {
      dialog.close();
      const def = c.keys[0];
      Lab.open(c.id, { mode: 'decrypt', text: secret.t, keys: def ? { [def.id]: secret.k } : {}, run: true });
    };

    // Clear the fragment so a reload doesn't reopen it.
    history.replaceState(null, '', location.href.split('#')[0]);
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
  }

  openSecret();
  window.addEventListener('hashchange', openSecret);
})();
