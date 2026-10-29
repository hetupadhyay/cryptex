/*
 * The "Break it" tab: attacks that work without the key.
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
      'Every letter of the message is still here, only the order has changed, which is exactly why the letter counts below still look like ordinary English.',
      { rails: 3 }
    ),
  };

  const input = $('#attack-text');
  const reduced = () => Stage.reduced;
  let attack = 'brute';
  let vigLength = null;
  let lastText = null;

  // ---- brute force ------------------------------------------------------

  const shiftList = $('.shifts');

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
      const li = document.createElement('li');
      li.className = 'shift-row' + (r === best ? ' best' : '');
      li.dataset.shift = r.shift;
      const fit = Math.max(0.02, Math.min(1, bestChi / r.chi));
      li.innerHTML = '<span class="shift-n"></span><span class="shift-text"></span><span class="fit"><i></i></span>';
      $('.shift-n', li).textContent = r.shift;
      $('.shift-text', li).textContent = r.text.length > 90 ? r.text.slice(0, 90) + '…' : r.text;
      $('.fit i', li).style.transform = `scaleX(${fit})`;
      if (r === best) li.setAttribute('aria-label', `Shift ${r.shift}, most likely: ${r.text}`);
      if (entrance && !reduced()) {
        li.style.animationDelay = `${i * 28}ms`;
        li.classList.add('enter');
      }
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
      verdict.textContent = `Only ${letters.length} letters. Counts this small are mostly noise, so treat any pattern loosely.`;
    } else if (chiPlain < 120 && ioc > 0.058) {
      verdict.textContent = 'These counts already match English. The letters haven’t been replaced, only moved around, so this is a transposition cipher.';
    } else if (ioc < 0.05) {
      verdict.textContent = 'The counts are unusually flat. That happens when several alphabets are mixed together. Try the Vigenère attack.';
    } else {
      const guess = Ciphers.mod(Ciphers.toIndex(common[0]) - 4, 26);
      verdict.textContent = `The most common letter is ${common[0]}. In English it’s usually E, which suggests a shift of ${guess}. Slide the bars until the peaks line up.`;
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

    const { key, plaintext } = Analysis.crackVigenere(text, vigLength);
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
    if (attack === 'freq') renderFreq(text);
    if (attack === 'vig') renderVig(text, entrance);
    lastText = text;
  }

  function setAttack(name) {
    attack = name;
    $$('.attack-tab').forEach(t => t.setAttribute('aria-selected', t.dataset.attack === name));
    $$('.work .attack').forEach(s => { s.hidden = s.dataset.attack !== name; });
    render(true);
  }

  let debounce;
  input.addEventListener('input', () => {
    vigLength = null;
    clearTimeout(debounce);
    debounce = setTimeout(() => render(false), 180);
  });

  $$('.attack-tab').forEach(t => t.addEventListener('click', () => setAttack(t.dataset.attack)));
  $$('input[name="brute-order"]').forEach(r => r.addEventListener('change', reorderBrute));
  shiftInput.addEventListener('input', () => renderFreq(input.value));
  $('[data-act="best-shift"]').addEventListener('click', () => {
    shiftInput.value = bestShift(input.value);
    renderFreq(input.value);
  });

  $$('[data-sample]').forEach(b => b.addEventListener('click', () => {
    const name = b.dataset.sample;
    load(SAMPLES[name](), { caesar: 'brute', vigenere: 'vig', railfence: 'freq' }[name]);
  }));

  function load(text, which) {
    input.value = text;
    vigLength = null;
    shiftInput.value = 0;
    setAttack(which || attack);
  }

  window.Breaker = {
    init() {
      buildFreqChart();
      render(false);
    },
    load,
    refresh() {
      if (input.value !== lastText) render(false);
    },
  };
})();
