/*
 * The codebreaker's desk: attacks that work without the key.
 */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const { ALPHABET, lettersOnly } = Ciphers;
  const { ENGLISH } = Analysis;

  const SAMPLES = {
    caesar: () => Ciphers.byId('caesar').encrypt(
      'Meet the courier at the north gate after midnight. Bring the second ledger and tell no one at the embassy. If the guards change early, wait by the river until you see two lamps in the window.',
      { shift: 7 }
    ),
    vigenere: () => Ciphers.byId('vigenere').encrypt(
      'Our people at the harbour report that the shipment left two days ahead of schedule. The captain was told the cargo is machine parts, but the manifest was changed the night before it sailed. Watch the eastern docks on Thursday and photograph every crate that is moved into the warehouse. Do not approach the crew under any circumstances. Report through the usual channel and burn this note once you have read it.',
      { key: 'LANTERN' }
    ),
    railfence: () => Ciphers.byId('railfence').encrypt(
      'Every letter of the message is still here, only the order has changed, which is exactly why its letter counts still look like ordinary English.',
      { rails: 3 }
    ),
    affine: () => Ciphers.byId('affine').encrypt(
      'The ledger is hidden behind the clock in the station master’s office. Collect it before the morning train and leave the key with the porter. Nobody else can know that it has moved.',
      { a: 5, b: 8 }
    ),
  };

  // The attack each sample is meant for.
  const SAMPLE_ATTACK = { caesar: 'brute', vigenere: 'vig', railfence: 'rail', affine: 'affine' };

  const input = $('#attack-text');
  const reduced = () => Stage.reduced;
  let attack = 'brute';
  let vigLength = null;
  let vigMode = 'vigenere';

  // The start of a long decryption, as much as a row shows. A substitution
  // decrypts letter by letter, so the rows only need the start of the text.
  const preview = text => (text.length > 90 ? text.slice(0, 90) + '…' : text);
  const head = text => text.slice(0, 120) + (text.length > 120 ? '…' : '');

  // One row of a ranked list: the text a key gives, and how well that fits
  // English compared with the best row (0 to 1). The caller fills in the key.
  function candidateRow(text, fit, best, i, entrance) {
    const li = document.createElement('li');
    li.className = 'shift-row' + (best ? ' best' : '');
    li.innerHTML = '<span class="shift-n"></span><span class="shift-text"></span><span class="fit"><i></i></span>';
    $('.shift-text', li).textContent = preview(text);
    $('.fit i', li).style.transform = `scaleX(${Math.max(0.02, Math.min(1, fit))})`;
    if (entrance && !reduced()) {
      li.style.animationDelay = `${i * 28}ms`;
      li.classList.add('enter');
    }
    return li;
  }

  // ---- brute force ------------------------------------------------------

  const shiftList = $('.attack[data-attack="brute"] .shifts');

  function renderBrute(text, entrance) {
    const section = $('.attack[data-attack="brute"]');
    const verdict = $('.verdict', section);
    if (!lettersOnly(text).length) {
      shiftList.replaceChildren();
      verdict.textContent = 'Paste a Caesar ciphertext, or load the sample, to try all 25 keys at once.';
      return;
    }
    const rows = Analysis.caesarCandidates(text);
    const best = rows.reduce((a, b) => (b.chi < a.chi ? b : a));
    const bestChi = best.chi;
    verdict.textContent = `Shift ${best.shift} reads most like English. That took 25 tries.`;

    const byScore = $('input[name="brute-order"]:checked').value === 'score';
    const ordered = byScore ? rows.slice().sort((a, b) => a.chi - b.chi) : rows;

    shiftList.replaceChildren(...ordered.map((r, i) => {
      const shown = Analysis.shiftBack(head(text), r.shift);
      const li = candidateRow(shown, bestChi / r.chi, r === best, i, entrance);
      li.dataset.shift = r.shift;
      $('.shift-n', li).textContent = r.shift;
      if (r === best) li.setAttribute('aria-label', `Shift ${r.shift}, most likely: ${preview(shown)}`);
      return li;
    }));
  }

  // Slide rows to their new places instead of jumping when the order changes.
  function reorderBrute() {
    const before = new Map($$('.shift-row', shiftList).map(li => [li.dataset.shift, li.getBoundingClientRect().top]));
    renderBrute(input.value, false);
    if (reduced()) return;
    $$('.shift-row', shiftList).forEach(li => {
      const dy = before.get(li.dataset.shift) - li.getBoundingClientRect().top;
      if (dy) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 420, easing: Stage.EASE_MOVE });
    });
  }

  // ---- affine -------------------------------------------------------------

  const affineSection = $('.attack[data-attack="affine"]');
  const affineList = $('.shifts', affineSection);

  function renderAffine(text, entrance) {
    const verdict = $('.verdict', affineSection);
    if (!lettersOnly(text).length) {
      affineList.replaceChildren();
      verdict.textContent = 'Paste an affine ciphertext, or load the sample, to score all 312 keys at once.';
      return;
    }
    const rows = Analysis.affineCandidates(text);
    const best = rows[0];
    verdict.textContent = `The key a = ${best.a}, b = ${best.b} reads most like English. 312 keys tried, and these are the best 10.`;

    affineList.replaceChildren(...rows.slice(0, 10).map((r, i) => {
      const shown = Ciphers.byId('affine').decrypt(head(text), { a: r.a, b: r.b });
      const li = candidateRow(shown, best.chi / r.chi, r === best, i, entrance);
      const key = $('.shift-n', li);
      key.className = 'shift-n affine-key';
      key.innerHTML = '<small>a</small><span></span><small>b</small><span></span>';
      const [a, b] = $$('span', key);
      a.textContent = r.a;
      b.textContent = r.b;
      li.setAttribute('aria-label', `a ${r.a}, b ${r.b}${r === best ? ', most likely' : ''}: ${preview(shown)}`);
      return li;
    }));
  }

  // ---- rail fence -----------------------------------------------------------

  const railSection = $('.attack[data-attack="rail"]');
  const railList = $('.shifts', railSection);

  function renderRail(text, entrance) {
    const verdict = $('.verdict', railSection);
    if (lettersOnly(text).length < 2) {
      railList.replaceChildren();
      verdict.textContent = 'Paste a rail fence ciphertext, or load the sample, to read it back on every rail count from 2 to 8.';
      return;
    }
    const rows = Analysis.railCandidates(text);
    const best = rows.reduce((a, b) => (b.score > a.score ? b : a));
    verdict.textContent = `Reading it back on ${best.rails} rails gives the most common English letter pairs. That took 7 tries.`;

    // Scores are average log-probabilities per pair, so the bar shows how much
    // less likely each reading is than the best, stretched so small gaps show.
    railList.replaceChildren(...rows.map((r, i) => {
      const li = candidateRow(r.text, 10 ** ((r.score - best.score) * 2), r === best, i, entrance);
      $('.shift-n', li).textContent = r.rails;
      li.setAttribute('aria-label', `${r.rails} rails${r === best ? ', most likely' : ''}: ${preview(r.text)}`);
      return li;
    }));
  }

  // ---- frequency ----------------------------------------------------------

  const freqSection = $('.attack[data-attack="freq"]');
  const freqBars = $('.bars', freqSection);
  const shiftInput = $('#freq-shift');

  function buildFreqChart() {
    freqBars.replaceChildren(...[...ALPHABET].map((ch, i) => {
      const col = document.createElement('div');
      col.className = 'bar-col';
      col.innerHTML = '<div class="bar-pair"><i class="bar english"></i><i class="bar cipher"></i></div><span class="bar-label"></span>';
      $('.bar.english', col).style.transform = `scaleY(${ENGLISH[i] / 13})`;
      $('.bar.cipher', col).style.transform = 'scaleY(0)';
      $('.bar-label', col).textContent = ch;
      return col;
    }));
  }

  function renderFreq(text) {
    const verdict = $('.verdict', freqSection);
    const letters = lettersOnly(text);
    const shift = Number(shiftInput.value);
    $('.shift-out', freqSection).textContent = shift;
    const shifted = Analysis.shiftBack(text, shift);
    const freq = Analysis.frequencies(shifted);
    const top = Math.max(13, ...freq);
    $$('.bar-col', freqBars).forEach((col, i) => {
      $('.bar.cipher', col).style.transform = `scaleY(${freq[i] / top})`;
      $('.bar.english', col).style.transform = `scaleY(${ENGLISH[i] / top})`;
      col.title = `${ALPHABET[i]}: ${freq[i].toFixed(1)}% here, ${ENGLISH[i].toFixed(1)}% in English`;
    });
    // The bars in words, for anyone who can't see them.
    $('#freq-said').textContent = letters.length
      ? [...ALPHABET].map((ch, i) => `${ch} ${freq[i].toFixed(1)}%, English ${ENGLISH[i].toFixed(1)}%`).join('. ') + '.'
      : '';

    const preview = $('.preview', freqSection);
    const tops = $('.tops', freqSection);
    if (!letters.length) {
      verdict.textContent = 'Paste some ciphertext to see how often each letter turns up.';
      preview.textContent = '';
      tops.replaceChildren();
      return;
    }

    const raw = Analysis.frequencies(text);
    const rank = f => f.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 6).map(([, i]) => ALPHABET[i]);
    const common = rank(raw);
    const ioc = Analysis.indexOfCoincidence(letters);
    const chiPlain = Analysis.chiSquared(letters);

    if (letters.length < 40) {
      verdict.textContent = `Only ${letters.length} ${letters.length === 1 ? 'letter' : 'letters'}. Counts this small are mostly noise, so treat any pattern loosely.`;
    } else if (chiPlain < 120 && ioc > 0.058) {
      verdict.textContent = 'These counts already match English. The letters haven’t been replaced, only moved around, so this is a transposition cipher. If it’s a rail fence, try every rail count.';
    } else if (ioc < 0.05) {
      verdict.textContent = 'The counts are unusually flat. That happens when several alphabets are mixed together. Try the Vigenère attack.';
    } else {
      const guess = Ciphers.mod(Ciphers.toIndex(common[0]) - 4, 26);
      verdict.textContent = `The most common letter is ${common[0]}. In English it’s usually E, so if this is a Caesar shift, it’s probably ${guess}. Slide the bars until the peaks line up. If no shift lines them up, the alphabet was scrambled some other way.`;
    }

    tops.innerHTML = '<div><dt>Most common here</dt><dd></dd></div><div><dt>Most common in English</dt><dd>E T A O I N</dd></div>';
    $('dd', tops).textContent = rank(Analysis.frequencies(shifted)).join(' ');
    preview.textContent = shifted.length > 220 ? shifted.slice(0, 220) + '…' : shifted;
  }

  function bestShift(text) {
    const rows = Analysis.caesarCandidates(text);
    const best = rows.reduce((a, b) => (b.chi < a.chi ? b : a));
    return Analysis.chiSquared(lettersOnly(text)) <= best.chi ? 0 : best.shift;
  }

  // ---- Vigenère ---------------------------------------------------------------

  const vigSection = $('.attack[data-attack="vig"]');
  const iocBars = $('.bars', vigSection);
  const VIG_NAMES = { vigenere: 'Vigenère', beaufort: 'Beaufort' };

  function setVigMode(mode) {
    vigMode = mode === 'beaufort' ? 'beaufort' : 'vigenere';
    $(`input[name="vig-mode"][value="${vigMode}"]`).checked = true;
    $('h3', vigSection).textContent = `${VIG_NAMES[vigMode]} key length`;
  }

  function renderVig(text, entrance) {
    const verdict = $('.verdict', vigSection);
    const scores = Analysis.keyLengthScores(text, 12);
    const tiles = $('.key-tiles', vigSection);
    const preview = $('.preview', vigSection);
    if (scores.length < 2) {
      iocBars.replaceChildren();
      tiles.replaceChildren();
      preview.textContent = '';
      verdict.textContent = 'This attack needs a few sentences of ciphertext. Load the Vigenère sample to see it work.';
      return;
    }

    const guess = Analysis.guessKeyLength(scores);
    if (!vigLength || vigLength > scores.length) vigLength = guess;

    const top = Math.max(0.075, ...scores.map(s => s.ioc));
    iocBars.style.setProperty('--english', Analysis.ENGLISH_IOC / top);
    iocBars.style.setProperty('--random', Analysis.RANDOM_IOC / top);
    iocBars.replaceChildren(...scores.map(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bar-col pick-length' + (s.length === vigLength ? ' chosen' : '') + (s.length === guess ? ' guess' : '');
      b.setAttribute('aria-pressed', s.length === vigLength);
      b.setAttribute('aria-label', `Key length ${s.length}, index of coincidence ${s.ioc.toFixed(3)}`);
      b.innerHTML = '<span class="bar-pair"><i class="bar cipher"></i></span><span class="bar-label"></span>';
      $('.bar', b).style.transform = `scaleY(${s.ioc / top})`;
      $('.bar-label', b).textContent = s.length;
      b.addEventListener('click', () => {
        vigLength = s.length;
        renderVig(input.value, true);
      });
      return b;
    }));

    const crack = vigMode === 'beaufort' ? Analysis.crackBeaufort : Analysis.crackVigenere;
    const { key, plaintext } = crack(text, vigLength);
    verdict.textContent = vigLength === guess
      ? `Splitting the text into ${guess} columns makes each one look like English, so the key is probably ${guess} letters long.`
      : `Trying a key length of ${vigLength}. The best guess was ${guess}.`;

    tiles.replaceChildren(...[...key].map((ch, i) => {
      const t = document.createElement('span');
      t.className = 'key-tile';
      t.innerHTML = '<b></b><small></small>';
      $('b', t).textContent = ch;
      $('small', t).textContent = `col ${i + 1}`;
      if (entrance && !reduced()) {
        t.style.animationDelay = `${i * 70}ms`;
        t.classList.add('enter');
      }
      return t;
    }));
    preview.textContent = plaintext.length > 320 ? plaintext.slice(0, 320) + '…' : plaintext;
  }

  // ---- wiring ----------------------------------------------------------------

  function render(entrance) {
    const text = input.value;
    if (attack === 'brute') renderBrute(text, entrance);
    if (attack === 'affine') renderAffine(text, entrance);
    if (attack === 'freq') renderFreq(text);
    if (attack === 'vig') renderVig(text, entrance);
    if (attack === 'rail') renderRail(text, entrance);
  }

  const attackTabs = $$('.attack-tab');

  function setAttack(name, focus) {
    // A name from a hand-off or an old link might not be one of ours.
    if (!attackTabs.some(t => t.dataset.attack === name)) name = attackTabs[0].dataset.attack;
    attack = name;
    attackTabs.forEach(t => {
      const on = t.dataset.attack === name;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $$('.work .attack').forEach(s => { s.hidden = s.dataset.attack !== name; });
    render(true);
  }

  let debounce;
  input.addEventListener('input', () => {
    vigLength = null;
    clearTimeout(debounce);
    debounce = setTimeout(() => render(false), 180);
  });

  // The index reads top to bottom, so the arrows go either way.
  attackTabs.forEach((t, i) => {
    t.addEventListener('click', () => setAttack(t.dataset.attack));
    t.addEventListener('keydown', e => {
      const n = attackTabs.length;
      const to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: n - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      setAttack(attackTabs[(to + n) % n].dataset.attack, true);
    });
  });
  $$('input[name="brute-order"]').forEach(r => r.addEventListener('change', reorderBrute));
  $$('input[name="vig-mode"]').forEach(r => r.addEventListener('change', () => {
    setVigMode(r.value);
    renderVig(input.value, true);
  }));
  shiftInput.addEventListener('input', () => renderFreq(input.value));
  $('[data-act="best-shift"]').addEventListener('click', () => {
    shiftInput.value = bestShift(input.value);
    renderFreq(input.value);
  });

  $$('[data-sample]').forEach(b => b.addEventListener('click', () => {
    const name = b.dataset.sample;
    load(SAMPLES[name](), SAMPLE_ATTACK[name]);
  }));

  // `which` can carry the Vigenère panel's mode after a colon, as in
  // 'vig:beaufort', so callers that only pass attackFor's answer still land
  // in the right mode. options.mode does the same thing.
  function load(text, which, options = {}) {
    const [name, mode] = String(which || attack).split(':');
    input.value = text;
    vigLength = null;
    shiftInput.value = 0;
    if (name === 'vig' && (which || options.mode)) setVigMode(options.mode || mode);
    setAttack(name);
  }

  const ATTACK_FOR = {
    caesar: 'brute',
    affine: 'affine',
    vigenere: 'vig',
    beaufort: 'vig:beaufort',
    railfence: 'rail',
  };

  window.Breaker = {
    init() {
      buildFreqChart();
      // Open on a real intercept, so the desk shows what it does straight away.
      input.value = SAMPLES.caesar();
      render(false);
    },
    load,
    // The attack that suits text from a given cipher.
    attackFor: id => ATTACK_FOR[id] || 'freq',
  };
})();
