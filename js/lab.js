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

  const form = $('#cipher-form');
  const message = $('#message');
  const keysBox = $('.keys', form);
  const runBtn = $('.run', form);
  const errorBox = $('.error', form);
  const hint = $('#message-hint');
  const stageEl = $('.stage');
  const resultText = $('.result-text');
  const resultTitle = $('#result-title');

  const state = {
    cipher: Ciphers.list[0],
    mode: 'encrypt',
    keys: Object.fromEntries(Ciphers.list.map(c => [c.id, Object.fromEntries(c.keys.map(k => [k.id, k.value]))])),
    last: null, // { input, output, mode, cipherId }
  };

  const player = Stage.Player(stageEl, { onFinish: showResult });

  // ---- cipher picker ------------------------------------------------------

  function buildPicker() {
    const picker = $('.picker', form);
    const families = [...new Set(Ciphers.list.map(c => c.family))];
    for (const family of families) {
      const group = document.createElement('div');
      group.className = 'picker-group';
      const title = document.createElement('span');
      title.className = 'picker-family';
      title.textContent = family;
      group.append(title);
      for (const c of Ciphers.list.filter(x => x.family === family)) {
        const label = document.createElement('label');
        label.className = 'pick';
        label.innerHTML = `<input type="radio" name="cipher" value="${c.id}"><span></span>`;
        $('span', label).textContent = c.name;
        group.append(label);
      }
      picker.append(group);
    }
    picker.addEventListener('change', e => {
      if (e.target.name === 'cipher') selectCipher(Ciphers.byId(e.target.value));
    });
  }

  function buildKeys() {
    const c = state.cipher;
    const values = state.keys[c.id];
    keysBox.replaceChildren();
    if (!c.keys.length) {
      const note = document.createElement('p');
      note.className = 'note';
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
    $(`input[name="cipher"][value="${c.id}"]`, form).checked = true;
    buildKeys();
    $('.stage-title').textContent = c.name;
    $('.stage-family').textContent = c.family;
    $('.about').textContent = c.about;
    $('.weak-text').textContent = c.weakness;
    errorBox.textContent = '';
    clearStage();
    updateHint();
  }

  // ---- modes and hints --------------------------------------------------

  function setMode(mode, { swap = true } = {}) {
    const prev = state.mode;
    state.mode = mode;
    $(`input[name="mode"][value="${mode}"]`, form).checked = true;
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

  function clearStage() {
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

  function run() {
    const c = state.cipher;
    const keys = state.keys[c.id];
    const problem = c.check(keys);
    errorBox.textContent = problem;
    if (problem) return;

    const text = message.value;
    const hasContent = c.id === 'polybius' && state.mode === 'decrypt' ? /[1-5]/.test(text) : /[a-z]/i.test(text);
    if (!hasContent) {
      errorBox.textContent = state.mode === 'encrypt' ? 'Type a message with at least one letter.' : 'Paste some ciphertext to decrypt.';
      message.focus();
      return;
    }

    const output = (state.mode === 'encrypt' ? c.encrypt : c.decrypt)(text, keys);
    state.last = { input: text, output, mode: state.mode, cipherId: c.id };

    resultText.textContent = '';
    $('.result').classList.remove('ready');
    stageEl.classList.remove('stale');

    const mount = $('.scene', stageEl);
    const build = () => {
      const scene = Scenes[c.scene]({ cipher: c, keys, mode: state.mode, input: sceneInput(text).text, mount, cue: player.cue });
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
  form.addEventListener('change', e => {
    if (e.target.name === 'mode') setMode(e.target.value);
  });
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

  $$('input[name="speed"]').forEach(r => r.addEventListener('change', () => { Stage.speed = Number(r.value); }));

  // Arrow keys step through the scene when the stage has focus.
  stageEl.tabIndex = -1;
  stageEl.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') player.next();
    else if (e.key === 'ArrowLeft') player.prev();
  });

  // ---- result actions ---------------------------------------------------------

  $('[data-act="copy"]').addEventListener('click', async e => {
    if (!state.last) return;
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(state.last.output);
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Select the text to copy';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
  });

  $('[data-act="attack"]').addEventListener('click', () => {
    if (!state.last) return;
    const ciphertext = state.last.mode === 'encrypt' ? state.last.output : state.last.input;
    Breaker.load(ciphertext, Breaker.attackFor(state.last.cipherId));
    document.getElementById('desk')?.scrollIntoView({ behavior: Stage.reduced ? 'auto' : 'smooth' });
  });

  // ---- start --------------------------------------------------------------------

  buildPicker();
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
})();
