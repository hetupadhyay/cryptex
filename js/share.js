/*
 * Send a secret: the ciphertext travels in the link's #fragment, which
 * browsers never send to a server.
 */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const CHOICES = ['caesar', 'atbash', 'vigenere', 'autokey', 'beaufort', 'playfair', 'polybius', 'railfence', 'columnar'];
  const PREFIX = '#secret=';

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
    linkInput.value = location.href.split('#')[0] + PREFIX + encode(payload);
    const preview = payload.t.length > 60 ? payload.t.slice(0, 60) + '…' : payload.t;
    $('.share-preview', out).innerHTML = 'They’ll see <code></code>, encrypted with ' + c.name + (payload.k ? ', with the key included.' : ', and no key.');
    $('.share-preview code', out).textContent = preview;
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
    let secret;
    try {
      secret = decode(location.hash.slice(PREFIX.length));
    } catch {
      return;
    }
    const c = Ciphers.byId(secret.c);
    if (!c || typeof secret.t !== 'string') return;

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
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  openSecret();
  window.addEventListener('hashchange', openSecret);
})();
