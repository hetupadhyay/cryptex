/*
 * The figures in two chapters: Enigma, the machine that was broken anyway,
 * and the one-time pad, the one cipher that can't be. Story.open() brings
 * either figure into view and sets it working.
 */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const { ALPHABET, mod, toIndex, lettersOnly } = Ciphers;
  const isLetter = ch => /^[A-Z]$/i.test(ch);
  const indexes = text => [...lettersOnly(text)].map(toIndex);

  // ---- Enigma I ---------------------------------------------------------------

  // Army and air force rotors. The notch is the letter showing in the window
  // when the rotor is about to carry its left-hand neighbour along.
  const ROTORS = {
    I: { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
    II: { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
    III: { wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' },
    IV: { wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notch: 'J' },
    V: { wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', notch: 'Z' },
  };
  const REFLECTOR_B = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';

  // Plugboard pairs like "AT BL" as a swap table. Pairs after the first
  // mistake are ignored, and the mistake is reported.
  function plugboard(pairs) {
    const map = [...ALPHABET].map((_, i) => i);
    for (const pair of String(pairs).toUpperCase().split(/[^A-Z]+/).filter(Boolean)) {
      if (pair.length !== 2 || pair[0] === pair[1]) {
        return { map, error: `Plug letters in pairs of two different letters, like AT. ${pair} isn’t one.` };
      }
      const [a, b] = [...pair].map(toIndex);
      const taken = map[a] !== a ? pair[0] : map[b] !== b ? pair[1] : '';
      if (taken) return { map, error: `${taken} is already plugged. Each letter takes one cable.` };
      map[a] = b;
      map[b] = a;
    }
    return { map, error: '' };
  }

  // Rotors are listed left to right, as they sat in the machine. Rings and
  // start positions are letters, one per rotor.
  function machine({ rotors = ['I', 'II', 'III'], rings = 'AAA', start = 'AAA', plugs = '' } = {}) {
    const wheels = rotors.map(name => {
      const fwd = [...ROTORS[name].wiring].map(toIndex);
      const back = [];
      fwd.forEach((out, i) => { back[out] = i; });
      return { fwd, back, notch: toIndex(ROTORS[name].notch) };
    });
    const ring = [...rings].map(toIndex);
    const pos = [...start].map(toIndex);
    const plug = plugboard(plugs).map;
    const reflect = [...REFLECTOR_B].map(toIndex);

    // One pass through rotor i, in either direction.
    const through = (table, i, x) => {
      const offset = pos[i] - ring[i];
      return mod(table[mod(x + offset, 26)] - offset, 26);
    };

    // The rotors turn before the current flows. The middle rotor moves again
    // on the very next key press once it reaches its own notch, taking the
    // left rotor with it: the double step.
    function step() {
      if (pos[1] === wheels[1].notch) {
        pos[0] = mod(pos[0] + 1, 26);
        pos[1] = mod(pos[1] + 1, 26);
      } else if (pos[2] === wheels[2].notch) {
        pos[1] = mod(pos[1] + 1, 26);
      }
      pos[2] = mod(pos[2] + 1, 26);
    }

    function press(letter) {
      step();
      let x = plug[toIndex(letter)];
      for (let i = 2; i >= 0; i--) x = through(wheels[i].fwd, i, x);
      x = reflect[x];
      for (let i = 0; i <= 2; i++) x = through(wheels[i].back, i, x);
      return ALPHABET[plug[x]];
    }

    return { pos, press };
  }

  // Letters go through the machine, everything else is copied as it is.
  // Enigma is its own inverse, so this decrypts too.
  function encrypt(text, settings) {
    const m = machine(settings);
    return [...String(text).toUpperCase()].map(ch => (isLetter(ch) ? m.press(ch) : ch)).join('');
  }

  const Enigma = { ROTORS, REFLECTOR_B, plugboard, machine, encrypt };

  // ---- the Enigma panel ---------------------------------------------------------

  const PLUGS = 'AQ BJ CW DM EK FT';
  const KEYBOARD = ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'];
  const NOTE = 'The rotor letters are the start position. Set them, then type.';

  const panel = $('.enigma');
  const textInput = $('#enigma-text');
  const plugInput = $('#enigma-plugs');
  const plugError = $('#enigma-plug-error');
  const tape = $('.enigma-tape', panel);
  const lampSays = $('.enigma-said', panel);
  const note = $('.enigma-note', panel);
  const strips = [...panel.querySelectorAll('.rotor-strip')];
  const lamps = {};

  // The keys are "bulbs" in the markup: .lamp is the night lamp in the masthead.
  const board = $('.lampboard', panel);
  for (const row of KEYBOARD) {
    const div = document.createElement('div');
    div.className = 'bulb-row';
    for (const letter of row) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bulb';
      b.textContent = letter;
      b.addEventListener('click', () => {
        stopTyping();
        press(letter);
      });
      lamps[letter] = b;
      div.append(b);
    }
    board.append(div);
  }

  let start = [0, 0, 0];
  let shown = [null, null, null];
  let typing = null;

  // Five letters per window: the one showing, two either side. At rest the
  // strip sits one row up, so a step only has to slide it one row further.
  function fillStrip(strip, p) {
    const win = strip.parentElement;
    win.setAttribute('aria-label', `Rotor ${win.dataset.name} shows ${ALPHABET[p]}`);
    strip.replaceChildren(...[-2, -1, 0, 1, 2].map(d => {
      const span = document.createElement('span');
      span.textContent = ALPHABET[mod(p + d, 26)];
      return span;
    }));
  }

  function setRotors(pos, animate) {
    pos.forEach((p, i) => {
      if (p === shown[i]) return;
      const delta = shown[i] === null ? 0 : mod(p - shown[i], 26);
      shown[i] = p;
      fillStrip(strips[i], p);
      strips[i].getAnimations().forEach(a => a.cancel());
      if (!animate || Stage.reduced || (delta !== 1 && delta !== 25)) return;
      const from = delta === 1 ? 'translateY(0)' : 'translateY(-40%)';
      strips[i].animate([{ transform: from }, { transform: 'translateY(-20%)' }], { duration: 200, easing: Stage.EASE_OUT });
    });
  }

  function lightLamp(pressed, lit) {
    $('.bulb.lit', board)?.classList.remove('lit');
    $('.bulb.pressed', board)?.classList.remove('pressed');
    if (!lit) return;
    lamps[pressed].classList.add('pressed');
    void lamps[lit].offsetWidth; // restart the glow if the same lamp lights twice
    lamps[lit].classList.add('lit');
  }

  // The whole message is run again from the start position every time, so
  // deleting or pasting never leaves the rotors out of step with the text.
  function update(light, turn = light) {
    const m = machine({ start: start.map(i => ALPHABET[i]).join(''), plugs: plugInput.value });
    let out = '';
    let pressed = null;
    let lit = null;
    for (const ch of textInput.value.toUpperCase()) {
      if (isLetter(ch)) {
        pressed = ch;
        lit = m.press(ch);
        out += lit;
      } else {
        out += ch;
      }
    }
    tape.textContent = out;
    setRotors(m.pos, turn);
    if (light) lightLamp(pressed, lit);
    else lightLamp(null, null);
    // A screen reader hears the lamp, not the whole tape again. Not while
    // the machine types a message itself: that would be a letter a beat.
    lampSays.textContent = light && lit && !typing ? `${pressed} lights ${lit}` : '';
  }

  function press(letter) {
    if (textInput.value.length >= textInput.maxLength) return;
    textInput.value += letter;
    update(true);
  }

  function stopTyping() {
    clearTimeout(typing);
    typing = null;
  }

  // Types a message into the machine a key at a time.
  function typeOut(text, delay = 0) {
    stopTyping();
    textInput.value = '';
    update(false, false);
    if (Stage.reduced) {
      textInput.value = text;
      update(true);
      return;
    }
    let n = 0;
    const next = () => {
      textInput.value = text.slice(0, ++n);
      update(isLetter(text[n - 1]));
      if (n < text.length) typing = setTimeout(next, isLetter(text[n]) ? 130 : 40);
      else typing = null;
    };
    typing = setTimeout(next, delay);
  }

  let before = '';
  textInput.addEventListener('input', () => {
    stopTyping();
    const now = textInput.value;
    // Only a single letter typed at the end counts as a key press.
    const typedOne = now.length === before.length + 1 && now.startsWith(before) && isLetter(now.at(-1));
    before = now;
    note.textContent = NOTE;
    update(typedOne);
  });

  // With focus anywhere on the machine but the text fields, the keyboard
  // works the keys.
  panel.addEventListener('keydown', e => {
    if (e.target.matches('input') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[a-z]$/i.test(e.key)) {
      e.preventDefault();
      stopTyping();
      press(e.key.toUpperCase());
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      stopTyping();
      textInput.value = textInput.value.slice(0, -1);
      update(false);
    }
  });

  // Turning a rotor by hand sets a new start position, so the message
  // starts again from there.
  panel.querySelectorAll('.rotor-btn').forEach(btn => btn.addEventListener('click', () => {
    stopTyping();
    const i = Number(btn.dataset.rotor);
    start = shown.slice();
    start[i] = mod(start[i] + Number(btn.dataset.dir), 26);
    textInput.value = '';
    note.textContent = NOTE;
    update(false, true);
  }));

  // A half-typed pair isn't a mistake yet, so the error waits for a pause
  // in typing, or for the field to be left.
  let plugTimer;
  function showPlugError(error) {
    plugError.textContent = error;
    plugInput.setAttribute('aria-invalid', Boolean(error));
  }
  plugInput.addEventListener('input', () => {
    update(false);
    clearTimeout(plugTimer);
    const { error } = plugboard(plugInput.value);
    if (!error) showPlugError('');
    else plugTimer = setTimeout(() => showPlugError(error), 900);
  });
  plugInput.addEventListener('change', () => {
    clearTimeout(plugTimer);
    showPlugError(plugboard(plugInput.value).error);
  });

  $('[data-act="enigma-decrypt"]', panel).addEventListener('click', () => {
    const cipher = tape.textContent;
    if (!lettersOnly(cipher)) {
      textInput.focus();
      return;
    }
    note.textContent = 'Same start position, ciphertext in, message out. The machine undoes itself.';
    typeOut(cipher);
  });

  $('[data-act="enigma-clear"]', panel).addEventListener('click', () => {
    stopTyping();
    textInput.value = '';
    note.textContent = NOTE;
    update(false, false);
  });

  plugInput.value = PLUGS;
  update(false);

  // The chapter's ATTACK AT DAWN line, worked out on the same settings.
  $('[data-sample="enigma"]').textContent = encrypt('ATTACK AT DAWN', { plugs: PLUGS });
  $('[data-act="enigma-sample"]').addEventListener('click', () => open('enigma', { text: 'Attack at dawn' }));

  // ---- the one-time pad -----------------------------------------------------------

  // Uniform random letters from the browser's cryptographic generator.
  // Bytes of 234 and up are thrown away: 234 is the largest multiple of 26
  // below 256, so keeping them would make A to V slightly more likely.
  function randomLetters(count) {
    const out = [];
    while (out.length < count) {
      for (const b of crypto.getRandomValues(new Uint8Array(count * 2))) {
        if (b < 234 && out.length < count) out.push(b % 26);
      }
    }
    return out;
  }

  // Capitals and single spaces only, so every column lines up.
  const clean = text => String(text).toUpperCase().replace(/[^A-Z\s]/g, '').replace(/\s+/g, ' ').trim();

  // Writes letter indexes into the shape of a message, spaces and all.
  function shape(text, letters) {
    let n = 0;
    return [...text].map(ch => (ch === ' ' ? ' ' : ALPHABET[letters[n++]])).join('');
  }

  // One column per character: the rows stacked for a letter, a gap for a space.
  function renderTiles(el, rows) {
    el.replaceChildren(...[...rows[0]].map((ch, i) => {
      const col = document.createElement('span');
      if (ch === ' ') {
        col.className = 'otp-gap';
        return col;
      }
      col.className = 'otp-col';
      for (const row of rows) {
        const b = document.createElement('b');
        b.textContent = row[i];
        col.append(b);
      }
      return col;
    }));
  }

  const padPanel = $('.otp');
  const padText = $('#pad-text');
  const padAlt = $('#pad-alt');
  const padTiles = $('.otp-tiles.real', padPanel);
  const altTiles = $('.otp-tiles.other', padPanel);
  const altHint = $('#pad-alt-hint');
  const verdict = $('.otp-verdict', padPanel);
  let pad = [];
  let cipher = [];

  function renderPad() {
    const msg = clean(padText.value);
    const m = indexes(msg);
    // A longer message gets more pad; the letters already drawn stay put.
    if (pad.length < m.length) pad = pad.concat(randomLetters(m.length - pad.length));
    const key = pad.slice(0, m.length);
    cipher = m.map((x, i) => mod(x + key[i], 26));
    renderTiles(padTiles, [msg, shape(msg, key), shape(msg, cipher)]);
    renderAlt();
  }

  function renderAlt() {
    const alt = clean(padAlt.value);
    const a = indexes(alt);
    const fits = cipher.length > 0 && a.length === cipher.length;
    verdict.hidden = !fits;
    if (!fits) {
      altTiles.replaceChildren();
      altHint.textContent = !cipher.length
        ? 'Type a message above first.'
        : `It needs ${cipher.length} letters to line up with the ciphertext. This has ${a.length}.`;
      return;
    }
    altHint.textContent = '';
    // The pad that turns this ciphertext into this message: ciphertext minus message.
    const key = a.map((x, i) => mod(cipher[i] - x, 26));
    renderTiles(altTiles, [shape(alt, cipher), shape(alt, key), alt]);
  }

  padText.addEventListener('input', renderPad);
  padAlt.addEventListener('input', renderAlt);
  $('[data-act="new-pad"]', padPanel).addEventListener('click', () => {
    pad = [];
    renderPad();
  });

  // Two messages on one pad. A fresh pad changes both ciphertexts but never
  // their difference, which is the whole problem.
  const REUSE = ['MEET AT THE BRIDGE', 'BRING THE MAPS NOW'];
  const reuseRows = [...padPanel.querySelectorAll('.reuse-lines dd')];
  const groups = letters => letters.map(i => ALPHABET[i]).join('').replace(/(.{5})(?=.)/g, '$1 ');

  function renderReuse(animate) {
    const [m1, m2] = REUSE.map(indexes);
    const key = randomLetters(m1.length);
    const c1 = m1.map((x, i) => mod(x + key[i], 26));
    const c2 = m2.map((x, i) => mod(x + key[i], 26));
    const diff = c1.map((x, i) => mod(x - c2[i], 26));
    [c1, c2, diff].forEach((row, i) => { reuseRows[i].textContent = groups(row); });
    if (animate && !Stage.reduced) {
      for (const dd of reuseRows.slice(0, 2)) {
        dd.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 260, easing: Stage.EASE_OUT });
      }
    }
  }

  $('[data-act="reuse-pad"]', padPanel).addEventListener('click', () => renderReuse(true));

  renderPad();
  renderReuse(false);

  // ---- bringing a figure into view ---------------------------------------------

  function open(id, { text } = {}) {
    const target = { enigma: panel, 'one-time-pad': padTiles }[id]?.closest('figure');
    if (!target) return;
    target.scrollIntoView({ behavior: Stage.reduced ? 'auto' : 'smooth' });
    if (text === undefined) return;
    if (id === 'enigma') {
      // Back to the settings the chapter's sample uses.
      start = [0, 0, 0];
      plugInput.value = PLUGS;
      plugError.textContent = '';
      note.textContent = NOTE;
      typeOut(text.toUpperCase(), 600);
    } else if (id === 'one-time-pad') {
      padText.value = text;
      pad = [];
      renderPad();
    }
  }

  window.Enigma = Enigma;
  window.Story = { open };
})();
