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
    const groups = $('.picker-groups');
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
        const sample = c.encrypt('CIPHER', state.keys[c.id]);
        label.innerHTML = `<input type="radio" name="cipher" value="${c.id}"><span class="pick-name"></span><span class="pick-sample"></span>`;
        $('.pick-name', label).textContent = c.name;
        $('.pick-sample', label).textContent = sample.length > 8 ? sample.slice(0, 8) + '…' : sample;
        if (c === state.cipher) $('input', label).checked = true;
        group.append(label);
      }
      groups.append(group);
    }
    groups.addEventListener('change', e => {
      if (e.target.name !== 'cipher') return;
      selectCipher(Ciphers.byId(e.target.value));
    });
  }

  function buildKeys() {
    const c = state.cipher;
    const values = state.keys[c.id];
    keysBox.replaceChildren();
    if (!c.keys.length) {
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = 'Atbash has no key. The method is the whole secret.';
      keysBox.append(note);
      return;
    }
    for (const k of c.keys) {
      const field = document.createElement('div');
      field.className = 'field field-key' + (k.type === 'number' || k.type === 'select' ? ' narrow' : '');
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

  function setMode(mode) {
    const prev = state.mode;
    state.mode = mode;
    const label = mode === 'encrypt' ? 'Encrypt' : 'Decrypt';
    runBtn.textContent = label;
    $('.placeholder b').textContent = label;
    resultTitle.textContent = mode === 'encrypt' ? 'Ciphertext' : 'Message';
    $('label[for="message"]').textContent = mode === 'encrypt' ? 'Message' : 'Ciphertext';

    // Flipping direction right after a run: hand the output back as the new input.
    const last = state.last;
    if (last && last.mode === prev && last.cipherId === state.cipher.id && message.value === last.input) {
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
    return { text: text.slice(0, cut), cut: cut < text.length, limit };
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

  // ---- running --------------------------------------------------------------

  function clearStage() {
    player.reset();
    const scene = $('.scene', stageEl);
    scene.replaceChildren();
    $('.caption', stageEl).textContent = '';
    resultText.textContent = '';
    resultText.classList.remove('ready');
    $('.result').classList.remove('ready');
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
  message.addEventListener('input', markStale);
  message.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      run();
    }
  });

  $$('input[name="speed"]').forEach(r => r.addEventListener('change', () => { Stage.speed = Number(r.value); }));

  document.addEventListener('keydown', e => {
    if ($('#panel-cipher').hidden || e.target.closest('input, textarea, select')) return;
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
      btn.textContent = 'Couldn’t copy';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
  });

  $('[data-act="attack"]').addEventListener('click', () => {
    if (!state.last) return;
    const ciphertext = state.last.mode === 'encrypt' ? state.last.output : state.last.input;
    const attack = { caesar: 'brute', vigenere: 'vig' }[state.last.cipherId] || 'freq';
    showTab('break');
    Breaker.load(ciphertext, attack);
  });

  // ---- tabs ---------------------------------------------------------------

  const tabs = $$('.tabs .tab');
  const ink = $('.tab-ink');

  function placeInk(tab) {
    ink.style.width = tab.offsetWidth + 'px';
    ink.style.transform = `translateX(${tab.offsetLeft}px)`;
  }

  function showTab(name) {
    tabs.forEach(tab => {
      const on = tab.id === 'tab-' + name;
      tab.setAttribute('aria-selected', on);
      tab.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (on && panel.hidden) {
        panel.hidden = false;
        if (!Stage.reduced) {
          panel.animate([{ opacity: 0, filter: 'blur(2px)', transform: 'translateY(6px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 280, easing: Stage.EASE_OUT });
        }
        placeInk(tab);
      } else if (!on) {
        panel.hidden = true;
      }
    });
    if (name === 'break') {
      player.pause();
      Breaker.refresh();
    }
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => showTab(tab.id.slice(4)));
    tab.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      showTab(next.id.slice(4));
    });
  });

  // ---- theme ------------------------------------------------------------------

  const themeBtn = $('.theme');
  function applyTheme(theme, save) {
    document.documentElement.dataset.theme = theme;
    themeBtn.setAttribute('aria-checked', theme === 'night');
    if (save) {
      try { localStorage.setItem('cryptex-theme', theme); } catch {}
    }
    document.dispatchEvent(new CustomEvent('themechange'));
  }
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'night' ? 'day' : 'night';
    document.documentElement.classList.add('theme-shift');
    applyTheme(next, true);
    setTimeout(() => document.documentElement.classList.remove('theme-shift'), 400);
  });

  // ---- start --------------------------------------------------------------------

  buildPicker();
  selectCipher(state.cipher);
  setMode('encrypt');
  applyTheme(document.documentElement.dataset.theme, false);
  Breaker.init();
  // Fonts change tab widths, so place the underline once they're in.
  document.fonts.ready.then(() => placeInk(tabs.find(t => t.getAttribute('aria-selected') === 'true')));
  window.addEventListener('resize', () => placeInk(tabs.find(t => t.getAttribute('aria-selected') === 'true')));
})();
