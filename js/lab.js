/*
 * The lab: choose a cipher, run it on the stage.
 */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // How much of the message each scene animates. Long messages still get a
  // full result; the stage just shows the opening stretch.
  const SCENE_LIMIT = { substitution: 64, tabula: 32, playfair: 40, polybius: 36, railfence: 40, columnar: 42 };
  const LETTERS_ONLY = ['playfair', 'railfence', 'columnar'];

  // The word every codebook entry is shown on.
  const SPECIMEN = 'ATTACK';

  // How many keys a brute-force search has to try, at a billion keys a second.
  // shortcut: the counts mirror the rows in js/strength.js; keep the two in step.
  const RATE = 1e9;
  const factorial = n => (n <= 1 ? 1 : n * factorial(n - 1));
  const KEYWORD_5 = { keys: 26 ** 5, count: '26<span class="vh"> to the power of </span><sup>5</sup> = 11,881,376', note: 'for a 5-letter keyword' };
  const SQUARE = { keys: factorial(25), count: '25! ≈ 1.6 × 10<span class="vh"> to the power of </span><sup>25</sup>', note: 'ways to fill a keyed square' };
  const KEYSPACE = {
    caesar: { keys: 25, count: '25', note: 'shifts from 1 to 25' },
    atbash: { keys: 1, count: '1', note: 'there is nothing to choose' },
    affine: { keys: 312, count: '312', note: '12 multipliers times 26 shifts' },
    vigenere: KEYWORD_5,
    autokey: KEYWORD_5,
    beaufort: KEYWORD_5,
    playfair: SQUARE,
    polybius: SQUARE,
    railfence: { keys: 7, count: '7', note: '2 to 8 rails' },
    columnar: { keys: factorial(6), count: '6! = 720', note: 'for a 6-letter keyword' },
  };

  // The player's speeds, and how a screen reader hears each one.
  const SPEEDS = [
    { value: 0.5, text: '½×', say: 'half' },
    { value: 1, text: '1×', say: 'normal' },
    { value: 2, text: '2×', say: 'double' },
    { value: 4, text: '4×', say: 'four times' },
  ];

  const form = $('#cipher-form');
  const message = $('#message');
  const keysBox = $('.keys', form);
  const runBtn = $('.run', form);
  const lever = $('.lever', form);
  const leverBtn = $('.lever-btn', form);
  const errorBox = $('.error', form);
  const hint = $('#message-hint');
  const stageEl = $('.stage');
  const resultText = $('.result-text');
  const resultTitle = $('#result-title');
  const cipherBtn = $('.cipher-btn', form);
  const sheet = $('.codebook-sheet');
  const speedBtn = $('.speed-step', stageEl);

  const state = {
    cipher: Ciphers.list[0],
    mode: 'encrypt',
    speed: 1, // index into SPEEDS
    keys: Object.fromEntries(Ciphers.list.map(c => [c.id, Object.fromEntries(c.keys.map(k => [k.id, k.value]))])),
    last: null, // { input, output, mode, cipherId, keys }
  };

  const player = Stage.Player(stageEl, { onFinish: showResult });

  // ---- the codebook -------------------------------------------------------

  // Every cipher by family, each with a specimen: ATTACK under its usual keys.
  // The same list is built twice: down the side on wide screens, and in the
  // sheet the Cipher button opens on phones.
  function buildCodebook(list) {
    const families = [...new Set(Ciphers.list.map(c => c.family))];
    for (const family of families) {
      const group = document.createElement('div');
      group.className = 'cb-group';
      group.setAttribute('role', 'group');
      const title = document.createElement('span');
      title.className = 'cb-family';
      title.id = `${list.id}-${family.toLowerCase()}`;
      title.textContent = family;
      group.setAttribute('aria-labelledby', title.id);
      group.append(title);
      for (const c of Ciphers.list.filter(x => x.family === family)) {
        const defaults = Object.fromEntries(c.keys.map(k => [k.id, k.value]));
        const entry = document.createElement('button');
        entry.type = 'button';
        entry.className = 'cb-entry';
        entry.dataset.id = c.id;
        entry.setAttribute('role', 'radio');
        entry.innerHTML = `<span class="cb-name"></span><span class="cb-spec">${SPECIMEN}<span aria-hidden="true"> → </span><span class="vh"> becomes </span><b></b></span>`;
        $('.cb-name', entry).textContent = c.name;
        $('.cb-spec b', entry).textContent = c.encrypt(SPECIMEN, defaults);
        group.append(entry);
      }
      list.append(group);
    }

    // A radio group: one tab stop, arrow keys move and choose.
    list.addEventListener('keydown', e => {
      const entries = $$('.cb-entry', list);
      const i = entries.indexOf(e.target.closest('.cb-entry'));
      if (i < 0) return;
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      let j = -1;
      if (step) j = (i + step + entries.length) % entries.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = entries.length - 1;
      if (j < 0) return;
      e.preventDefault();
      entries[j].focus();
      selectCipher(Ciphers.byId(entries[j].dataset.id));
    });
    list.addEventListener('click', e => {
      const entry = e.target.closest('.cb-entry');
      if (!entry) return;
      if (entry.dataset.id !== state.cipher.id) selectCipher(Ciphers.byId(entry.dataset.id));
      if (sheet.contains(list)) sheet.close();
    });
  }

  function markCodebook(c) {
    for (const entry of $$('.cb-entry')) {
      const on = entry.dataset.id === c.id;
      entry.setAttribute('aria-checked', on);
      entry.tabIndex = on ? 0 : -1;
    }
    $('b', cipherBtn).textContent = c.name;
  }

  cipherBtn.addEventListener('click', () => {
    sheet.showModal();
    cipherBtn.setAttribute('aria-expanded', 'true');
    $('.cb-entry[aria-checked="true"]', sheet).focus();
    Sheet.opened('codebook', () => sheet.close());
  });
  sheet.addEventListener('close', () => {
    cipherBtn.setAttribute('aria-expanded', 'false');
    cipherBtn.focus();
    Sheet.closed('codebook');
  });
  Sheet.swipe(sheet, { grip: $('.sheet-grip', sheet), edge: 'bottom', close: () => sheet.close() });
  // A tap on the dimmed page around the sheet closes it.
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });
  window.matchMedia('(min-width: 821px)').addEventListener('change', e => { if (e.matches && sheet.open) sheet.close(); });

  // ---- what it costs to break ---------------------------------------------

  function bruteTime(keys) {
    const seconds = keys / RATE;
    const units = [
      [1e-6, 1e-9, 'nanosecond'],
      [1e-3, 1e-6, 'microsecond'],
      [1, 1e-3, 'millisecond'],
      [60, 1, 'second'],
      [3600, 60, 'minute'],
      [86400, 3600, 'hour'],
      [31557600, 86400, 'day'],
    ];
    for (const [limit, size, name] of units) {
      if (seconds < limit) {
        const n = Math.max(1, Math.round(seconds / size));
        return `${n} ${name}${n === 1 ? '' : 's'}`;
      }
    }
    const years = seconds / 31557600;
    for (const [size, name] of [[1e9, 'billion'], [1e6, 'million']]) {
      if (years >= size) return `${Number((years / size).toPrecision(2))} ${name} years`;
    }
    return `${Math.round(years).toLocaleString('en')} years`;
  }

  function showKeyspace(c) {
    const ks = KEYSPACE[c.id];
    $('.ks-keys').innerHTML = ks.count; // trusted markup from the table above
    $('.ks-note').textContent = ks.note;
    $('.ks-time').textContent = bruteTime(ks.keys);
  }

  function buildKeys() {
    const c = state.cipher;
    const values = state.keys[c.id];
    keysBox.replaceChildren();
    if (!c.keys.length) {
      const note = document.createElement('p');
      note.className = 'key-note';
      note.textContent = 'Atbash has no key. The method is the whole secret.';
      keysBox.append(note);
      return;
    }
    for (const k of c.keys) {
      const field = document.createElement('div');
      field.className = 'field' + (k.type === 'text' ? '' : ' narrow');
      const id = `key-${c.id}-${k.id}`;
      const label = document.createElement('label');
      label.htmlFor = id;
      label.textContent = k.label;
      let input;
      if (k.type === 'select') {
        input = document.createElement('select');
        for (const opt of k.options) input.append(new Option(opt, opt, false, Number(values[k.id]) === opt));
      } else {
        input = document.createElement('input');
        input.type = k.type === 'number' ? 'number' : 'text';
        if (k.type === 'number') {
          input.min = k.min;
          input.max = k.max;
          input.inputMode = 'numeric';
        } else {
          input.spellcheck = false;
          input.autocapitalize = 'characters';
        }
        input.value = values[k.id];
      }
      input.id = id;
      input.setAttribute('aria-describedby', 'lab-error');
      input.addEventListener('input', () => {
        values[k.id] = input.value;
        markStale();
      });
      field.append(label, input);
      keysBox.append(field);
    }
  }

  function selectCipher(c) {
    state.cipher = c;
    markCodebook(c);
    buildKeys();
    $('.stage-title').textContent = c.name;
    $('.stage-family').textContent = c.family;
    $('.about').textContent = c.about;
    $('.weak-text').textContent = c.weakness;
    showKeyspace(c);
    errorBox.textContent = '';
    clearStage();
    updateHint();
  }

  // ---- modes and hints --------------------------------------------------

  // The direction lever: plain text on one side, ciphertext on the other,
  // and the arrow between them says which way the message goes.
  function setMode(mode, { swap = true } = {}) {
    const prev = state.mode;
    state.mode = mode;
    lever.dataset.mode = mode;
    leverBtn.setAttribute('aria-label', mode === 'encrypt' ? 'Switch to decrypting' : 'Switch to encrypting');
    const label = mode === 'encrypt' ? 'Encrypt' : 'Decrypt';
    runBtn.textContent = label;
    $('.placeholder b').textContent = label;
    resultTitle.textContent = mode === 'encrypt' ? 'Ciphertext' : 'Message';
    $('label[for="message"]').textContent = mode === 'encrypt' ? 'Message' : 'Ciphertext';

    // Flipping direction right after a run: hand the output back as the new input.
    const last = state.last;
    if (swap && last && last.mode === prev && last.cipherId === state.cipher.id && message.value === last.input) {
      message.value = last.output;
    }
    clearStage();
    updateHint();
  }

  function sceneInput(text) {
    const c = state.cipher;
    const limit = SCENE_LIMIT[c.scene];
    const countDigits = c.id === 'polybius' && state.mode === 'decrypt';
    let n = 0;
    let cut = text.length;
    for (let i = 0; i < text.length; i++) {
      if (countDigits ? /[1-5]/.test(text[i]) : Ciphers.isLetter(text[i])) n++;
      if (n >= (countDigits ? limit * 2 : limit)) {
        cut = i + 1;
        break;
      }
    }
    return { text: text.slice(0, cut), cut: cut < text.length };
  }

  function updateHint() {
    const c = state.cipher;
    const notes = [];
    if (LETTERS_ONLY.includes(c.scene)) notes.push(`${c.name} works on letters only, so spaces and punctuation are dropped.`);
    if (c.id === 'polybius' && state.mode === 'decrypt') notes.push('Enter digit pairs; a slash marks a word break.');
    if (sceneInput(message.value).cut) {
      notes.push(`The animation covers the first ${SCENE_LIMIT[c.scene]} letters. The result covers everything.`);
    }
    hint.textContent = notes.join(' ');
  }

  function fitMessage() {
    message.style.height = 'auto';
    message.style.height = Math.min(message.scrollHeight + 2, 180) + 'px';
  }

  // ---- running --------------------------------------------------------------

  // Every run and every clear gets a number, so a scene that was waiting
  // for the old one to fade out knows when it's no longer wanted.
  let runs = 0;

  function clearStage() {
    runs++;
    player.reset();
    $('.scene', stageEl).replaceChildren();
    $('.caption', stageEl).textContent = '';
    resultText.textContent = '';
    $('.result').classList.remove('ready');
    stageEl.classList.remove('stale');
  }

  function markStale() {
    if (!stageEl.classList.contains('empty')) stageEl.classList.add('stale');
    updateHint();
  }

  // A problem is marked on the field it's about, which takes focus.
  function flag(fields, problem) {
    errorBox.textContent = problem;
    for (const f of fields) f.setAttribute('aria-invalid', Boolean(problem));
    if (problem) fields[0]?.focus();
  }

  function run() {
    const c = state.cipher;
    const keys = state.keys[c.id];
    const keyFields = $$('input, select', keysBox);
    const problem = c.check(keys);
    flag(keyFields, problem);
    message.setAttribute('aria-invalid', false);
    if (problem) return;

    const text = message.value;
    const hasContent = c.id === 'polybius' && state.mode === 'decrypt' ? /[1-5]/.test(text) : /[a-z]/i.test(text);
    if (!hasContent) {
      flag([message], state.mode === 'encrypt' ? 'Type a message with at least one letter.' : 'Paste some ciphertext to decrypt.');
      return;
    }

    const output = (state.mode === 'encrypt' ? c.encrypt : c.decrypt)(text, keys);
    state.last = { input: text, output, mode: state.mode, cipherId: c.id, keys: { ...keys } };

    resultText.textContent = '';
    $('.result').classList.remove('ready');
    stageEl.classList.remove('stale');

    // On a short screen the stage starts below the controls; bring it up.
    if (stageEl.getBoundingClientRect().top > innerHeight * 0.6) {
      stageEl.scrollIntoView({ behavior: Stage.reduced ? 'auto' : 'smooth', block: 'start' });
    }

    const mount = $('.scene', stageEl);
    const mode = state.mode;
    const id = ++runs;
    // What comes out decides its colour: ciphertext in red pencil, a
    // message read back in carbon.
    const out = mode === 'encrypt' ? 'cipher' : 'plain';
    stageEl.dataset.out = out;
    $('.result').dataset.out = out;
    const build = () => {
      if (id !== runs) return;
      const scene = Scenes[c.scene]({ cipher: c, keys, mode, input: sceneInput(text).text, mount, cue: player.cue });
      player.load(scene);
    };

    // Fade the old scene out quickly before the new one is built.
    if (mount.children.length && !Stage.reduced) {
      mount.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(2px)' }], { duration: 160, easing: 'ease-out' }).finished.then(build);
    } else {
      build();
    }
  }

  function showResult() {
    if (!state.last) return;
    resultText.textContent = state.last.output;
    // Secret links carry one key, so a two-key cipher can't be sent.
    $('[data-act="send"]').hidden = !(window.Share && Share.can(state.last.cipherId));
    const card = $('.result');
    if (!card.classList.contains('ready')) {
      card.classList.add('ready');
      if (!Stage.reduced) {
        resultText.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: Stage.EASE_OUT });
      }
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    run();
  });
  leverBtn.addEventListener('click', () => setMode(state.mode === 'encrypt' ? 'decrypt' : 'encrypt'));
  message.addEventListener('input', () => {
    fitMessage();
    markStale();
  });
  message.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      run();
    }
  });

  // ---- the player bar ---------------------------------------------------------

  // One button steps through the speeds; the ticks fill up as it goes faster.
  function showSpeed() {
    const s = SPEEDS[state.speed];
    Stage.speed = s.value;
    $('.speed-value', speedBtn).textContent = s.text;
    $$('.ticks i', speedBtn).forEach((t, i) => t.classList.toggle('on', i <= state.speed));
    speedBtn.setAttribute('aria-label', `Speed ${s.text}, ${s.say}`);
  }
  speedBtn.addEventListener('click', () => {
    state.speed = (state.speed + 1) % SPEEDS.length;
    showSpeed();
  });
  showSpeed();

  // The bar sticks to the bottom of the window only once there is room for
  // it and a good stretch of the scene above it. While the stage is just
  // peeking in, a stuck bar would sit over its heading, so it waits at the
  // end of the stage instead.
  const stageBody = $('.stage-body', stageEl);
  const dock = $('.dock', stageEl);
  function placeDock() {
    const box = stageBody.getBoundingClientRect();
    const docked = innerHeight - box.top > dock.offsetHeight + 160;
    if (docked === stageEl.classList.contains('docked')) return;
    stageEl.classList.toggle('docked', docked);
    // Coming up from below the window reads better than appearing from nowhere.
    if (docked && !Stage.reduced && box.bottom > innerHeight) {
      dock.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: Stage.EASE_OUT });
    }
  }
  window.addEventListener('scroll', placeDock, { passive: true });
  window.addEventListener('resize', placeDock);
  placeDock();

  // Arrow keys step through the scene when the stage has focus.
  stageEl.tabIndex = -1;
  // Space plays and pauses, the arrows step, anywhere on the page except
  // while typing or inside a control that uses those keys itself. Until
  // something has run, or while the stage is scrolled away, Space scrolls
  // the page as usual.
  const stageInView = () => {
    const r = stageEl.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  };
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, dialog, [role="radiogroup"], [contenteditable]')) return;
    if (stageEl.classList.contains('empty') || !stageInView()) return;
    if (e.key === ' ' && !e.target.closest('button, a')) {
      e.preventDefault();
      player.toggle();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      player.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      player.prev();
    }
  });

  // ---- result actions ---------------------------------------------------------

  $('[data-act="copy"]').addEventListener('click', async e => {
    if (!state.last) return;
    const btn = e.currentTarget;
    const said = $('#copy-said');
    try {
      await navigator.clipboard.writeText(state.last.output);
      btn.textContent = said.textContent = 'Copied';
    } catch {
      getSelection().selectAllChildren(resultText);
      btn.textContent = said.textContent = 'Selected. Copy it from here';
    }
    setTimeout(() => {
      btn.textContent = 'Copy';
      said.textContent = '';
    }, 1600);
  });

  $('[data-act="attack"]').addEventListener('click', () => {
    if (!state.last) return;
    const ciphertext = state.last.mode === 'encrypt' ? state.last.output : state.last.input;
    Breaker.load(ciphertext, Breaker.attackFor(state.last.cipherId));
  });

  // The message, cipher and key of the last run go into Send a secret.
  $('[data-act="send"]').addEventListener('click', () => {
    const last = state.last;
    if (!last || !window.Share) return;
    const def = Ciphers.byId(last.cipherId).keys[0];
    Share.fill({
      id: last.cipherId,
      text: last.mode === 'encrypt' ? last.input : last.output,
      key: def ? String(last.keys[def.id]) : '',
    });
  });

  // ---- start --------------------------------------------------------------------

  buildCodebook($('#codebook-list'));
  buildCodebook($('#codebook-sheet-list'));
  selectCipher(state.cipher);
  setMode('encrypt');
  fitMessage();

  window.Lab = {
    // Opens the lab, optionally on a cipher, with text, keys and a direction.
    // Without an id it keeps whatever cipher is already picked.
    open(id, { mode = 'encrypt', text, keys, run: autorun = false } = {}) {
      const c = id ? Ciphers.byId(id) : state.cipher;
      if (keys) Object.assign(state.keys[c.id], keys);
      selectCipher(c);
      setMode(mode, { swap: false });
      if (text !== undefined) {
        message.value = text;
        fitMessage();
        updateHint();
      }
      document.getElementById('lab').scrollIntoView({ behavior: Stage.reduced ? 'auto' : 'smooth' });
      if (autorun) setTimeout(run, Stage.reduced ? 0 : 500);
    },
  };

  // Work sent here from another page: a timeline card, an intercept, a secret.
  // Session storage can hold anything, so take only what fits a cipher.
  Handoff.ready(() => {
    const sent = Handoff.take('lab');
    if (sent) {
      const c = sent.id ? Ciphers.byId(sent.id) : null;
      const opts = sent.opts && typeof sent.opts === 'object' ? sent.opts : {};
      const keys = {};
      if (c && opts.keys && typeof opts.keys === 'object') {
        for (const k of c.keys) {
          const v = opts.keys[k.id];
          if ((typeof v === 'string' && v.length <= 64) || Number.isFinite(v)) keys[k.id] = v;
        }
      }
      if (!sent.id || c) {
        window.Lab.open(c ? c.id : null, {
          mode: opts.mode === 'decrypt' ? 'decrypt' : 'encrypt',
          text: typeof opts.text === 'string' && opts.text.length <= 20000 ? opts.text : undefined,
          keys,
          run: opts.run === true,
        });
      }
    }
  });
})();
