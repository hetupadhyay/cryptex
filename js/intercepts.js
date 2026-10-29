/*
 * Intercepts: eight messages to crack, roughly in order of difficulty.
 * Ciphertexts are made from the plaintext when the page loads, so the
 * answers only live here and nowhere in the markup.
 */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const { lettersOnly, ALPHABET } = Ciphers;
  const STORE = 'cryptex-cracked';

  const MISSIONS = [
    {
      id: 'rhine', place: 'Gaul, 58 BC', title: 'The courier from Rome', cipher: 'caesar', keys: { shift: 3 },
      plain: 'The legion marches at dawn. Hold the river until we arrive.',
      brief: 'A Roman courier was caught near the Rhine. His wax tablet holds a single line. Caesar was known for keeping things simple.',
      hints: ['Caesar moved every letter the same distance, and he usually chose three.', 'Shift each letter three places back: D becomes A, E becomes B.', 'The first word is THE.'],
    },
    {
      id: 'scribe', place: 'Jerusalem, c. 600 BC', title: 'A scribe’s note', cipher: 'atbash', keys: {},
      plain: 'The north wall is weakest at night.',
      brief: 'This note was tucked inside a scroll. There’s no key written anywhere on it, which is a clue in itself.',
      hints: ['No key means the method is the whole secret.', 'Fold the alphabet in half: A swaps with Z, B with Y.', 'It’s Atbash. Open it in the lab and decrypt.'],
    },
    {
      id: 'alesia', place: 'Alesia, 52 BC', title: 'An unknown shift', cipher: 'caesar', keys: { shift: 17 },
      plain: 'Bring more horses to the western crossing before the moon rises.',
      brief: 'Another courier, but the shift isn’t three this time. Someone learned from the last capture.',
      hints: ['There are only 25 possible shifts, so there’s no need to guess.', 'Send it to the desk and use “Try every shift”.', 'The shift is 17.'],
    },
    {
      id: 'richmond', place: 'Richmond, 1863', title: 'Off the telegraph wire', cipher: 'railfence', keys: { rails: 3 },
      plain: 'General Lee moves north tonight with two divisions',
      brief: 'An operator copied this off a tapped telegraph line. The letters look oddly familiar for a cipher.',
      hints: ['Count the letters at the desk. If they already look like English, nothing was replaced.', 'Only the order changed, so it’s a transposition. Try a rail fence.', 'Three rails.'],
    },
    {
      id: 'gottingen', place: 'Göttingen, 1801', title: 'The mathematician’s postcard', cipher: 'affine', keys: { a: 5, b: 8 },
      plain: 'Every prime keeps its secrets until someone looks closely.',
      brief: 'A postcard between two mathematicians. Scribbled in the margin: “multiply, then add”.',
      hints: ['It’s still one fixed alphabet, so letter counts work. The most common letter is probably E.', 'It’s an affine cipher with a multiplier of 5.', 'a = 5 and b = 8.'],
    },
    {
      id: 'chartley', place: 'Chartley Hall, 1586', title: 'A letter to the queen', cipher: 'vigenere', keys: { key: 'CROWN' },
      plain: 'The queen must be warned before midnight. Her letters are being read.',
      brief: 'Mary, Queen of Scots, wrote in cipher from captivity, and her letters were read anyway. This one is keyed with a word anyone at court would think of.',
      hints: ['It’s Vigenère with a five-letter keyword.', 'Think about what a queen wears.', 'The keyword is CROWN.'],
    },
    {
      id: 'wheatstone', place: 'London, 1854', title: 'Wheatstone’s puzzle', cipher: 'playfair', keys: { key: 'CHARLES' },
      plain: 'Meet at the bridge at noon',
      brief: 'Charles Wheatstone liked to slip Playfair puzzles into the newspaper personal columns. This one is keyed with his own first name.',
      hints: ['It’s Playfair. The square is built from a keyword.', 'The keyword is the inventor’s first name.', 'CHARLES. Decrypt it in the lab and ignore any padding Xs.'],
    },
    {
      id: 'front', place: 'Western Front, 1917', title: 'The long intercept', cipher: 'vigenere', keys: { key: 'SENTINEL' },
      plain: 'The relief column will reach the forward trenches on Tuesday night. Artillery support has been moved to the northern sector and the bridge at the canal is to be held at all costs. Supplies are short and the men are tired, but the line must not break before the reinforcements arrive. Burn this order once it has been read.',
      brief: 'A long message keyed with a word nobody would guess. This time we don’t want the message. We want the key, so we can read every message after it.',
      ask: 'What is the keyword?',
      answer: 'SENTINEL',
      hints: ['Long messages give away their key length. Send it to the desk.', 'Use “Find a Vigenère key”. The tallest bar is the length.', 'The keyword is eight letters long.'],
    },
  ];

  for (const m of MISSIONS) {
    const c = Ciphers.byId(m.cipher);
    const defaults = Object.fromEntries(c.keys.map(k => [k.id, k.value]));
    m.text = c.encrypt(m.plain, { ...defaults, ...m.keys }).toUpperCase();
  }

  // ---- progress ---------------------------------------------------------------

  // Only ids of real missions count, whatever else is in storage.
  function loadCracked() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || '[]');
      const ids = new Set(MISSIONS.map(m => m.id));
      return new Set(Array.isArray(saved) ? saved.filter(id => ids.has(id)) : []);
    } catch {
      return new Set();
    }
  }

  const cracked = loadCracked();

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify([...cracked]));
    } catch {}
  }

  // ---- layout -----------------------------------------------------------------

  const list = $('.mission-list');
  const card = $('.mission');
  // The Missions tab keeps the count, the way a file is marked on its tab.
  const progress = $('.missions-count');
  const form = $('.answer', card);
  const input = $('#answer-input');
  const feedback = $('.answer-feedback', card);
  const hintList = $('.hint-list', card);
  const hintBtn = $('[data-act="hint"]', card);
  const interceptEl = $('.intercept', card);

  let index = MISSIONS.findIndex(m => !cracked.has(m.id));
  if (index < 0) index = 0;
  let hintsShown = 0;

  function renderList() {
    list.replaceChildren(...MISSIONS.map((m, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mission-item' + (cracked.has(m.id) ? ' cracked' : '');
      b.setAttribute('aria-current', i === index);
      b.innerHTML = '<span class="mi-num"></span><span class="mi-text"><b></b><span></span></span><span class="mi-state"></span>';
      $('.mi-num', b).textContent = fileNo(i);
      $('.mi-text b', b).textContent = m.title;
      $('.mi-text span', b).textContent = m.place;
      $('.mi-state', b).textContent = cracked.has(m.id) ? 'Cracked' : '';
      b.addEventListener('click', () => open(i));
      li.append(b);
      return li;
    }));
    // "cracked" can drop out on a phone, where the tabs are tight.
    if (progress) progress.innerHTML = `${cracked.size} of ${MISSIONS.length}<span class="tab-more"> cracked</span>`;
  }

  const fileNo = i => String(i + 1).padStart(2, '0');

  function show(i) {
    index = i;
    hintsShown = 0;
    const m = MISSIONS[i];
    $('.mission-no', card).textContent = `File ${fileNo(i)}`;
    $('.mission-place', card).textContent = m.place;
    $('.mission-title', card).textContent = m.title;
    $('.mission-brief', card).textContent = m.brief;
    $('.answer-ask', card).textContent = m.ask || 'What does the message say?';
    interceptEl.textContent = cracked.has(m.id) ? m.plain.toUpperCase() : m.text;
    input.value = '';
    input.placeholder = m.answer ? 'Type the keyword' : 'Type the decrypted message';
    feedback.textContent = '';
    feedback.className = 'answer-feedback';
    hintList.replaceChildren();
    hintBtn.hidden = false;
    hintBtn.textContent = 'Show a hint';
    card.classList.toggle('cracked', cracked.has(m.id));
    card.querySelector('.stamp')?.remove();
    if (cracked.has(m.id)) addStamp(false);
    renderList();
  }

  // Picked from the index. Where the file sits below the index (on a
  // phone), bring it up so the choice visibly did something.
  function open(i) {
    show(i);
    if (card.getBoundingClientRect().top > innerHeight * 0.7) {
      card.scrollIntoView({ behavior: Stage.reduced ? 'auto' : 'smooth' });
    }
  }

  function addStamp(animate) {
    const stamp = document.createElement('span');
    stamp.className = 'stamp' + (animate ? ' landing' : '');
    stamp.textContent = 'CRACKED';
    stamp.setAttribute('aria-hidden', 'true');
    card.append(stamp);
  }

  // Letters only, J folded into I, so spacing and case never matter.
  // Playfair answers also ignore the padding Xs the cipher adds.
  function normalise(text, m) {
    let s = lettersOnly(text).replace(/J/g, 'I');
    if (m.cipher === 'playfair') s = s.replace(/X/g, '');
    return s;
  }

  // Scrambles the intercept into the plaintext, a letter at a time.
  function reveal(m) {
    const target = m.plain.toUpperCase();
    if (Stage.reduced) {
      interceptEl.textContent = target;
      return;
    }
    const start = performance.now();
    const length = target.length;
    const total = Math.min(1600, 400 + length * 12);
    function frame(t) {
      const done = Math.floor(((t - start) / total) * length);
      let out = '';
      for (let i = 0; i < length; i++) {
        const ch = target[i];
        out += i < done || !/[A-Z]/.test(ch) ? ch : ALPHABET[(Math.random() * 26) | 0];
      }
      interceptEl.textContent = out;
      if (done < length) requestAnimationFrame(frame);
      else interceptEl.textContent = target;
    }
    requestAnimationFrame(frame);
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const m = MISSIONS[index];
    const guess = normalise(input.value, m);
    const right = normalise(m.answer || m.plain, m);
    if (!guess) {
      feedback.textContent = m.answer ? 'Type the keyword you found.' : 'Type the message you decrypted.';
      feedback.className = 'answer-feedback wrong';
      return;
    }
    if (guess === right) {
      const first = !cracked.has(m.id);
      cracked.add(m.id);
      save();
      card.classList.add('cracked');
      if (first) {
        addStamp(true);
        reveal(m);
      }
      const next = MISSIONS.findIndex(x => !cracked.has(x.id));
      feedback.textContent = next < 0 ? 'Cracked. That’s every intercept. Not bad at all.' : `Cracked. Next up: ${MISSIONS[next].title}.`;
      feedback.className = 'answer-feedback right';
      renderList();
      return;
    }
    let off = 0;
    if (guess.length === right.length) for (let i = 0; i < guess.length; i++) if (guess[i] !== right[i]) off++;
    feedback.textContent = off && off <= 3
      ? `Very close. ${off} ${off === 1 ? 'letter is' : 'letters are'} off.`
      : 'Not quite. Check your work, or take a hint.';
    feedback.className = 'answer-feedback wrong';
  });

  hintBtn.addEventListener('click', () => {
    const m = MISSIONS[index];
    if (hintsShown >= m.hints.length) return;
    const li = document.createElement('li');
    li.textContent = m.hints[hintsShown++];
    hintList.append(li);
    if (hintsShown >= m.hints.length) hintBtn.hidden = true;
    else hintBtn.textContent = 'Show another hint';
  });

  $('[data-act="to-desk"]', card).addEventListener('click', () => {
    const m = MISSIONS[index];
    Breaker.load(m.text, Breaker.attackFor(m.cipher));
  });

  $('[data-act="to-lab"]', card).addEventListener('click', () => {
    const m = MISSIONS[index];
    // Leave the cipher as it is: picking it is part of the puzzle.
    Lab.open(null, { mode: 'decrypt', text: m.text });
  });

  show(index);
})();
