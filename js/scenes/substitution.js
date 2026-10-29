/*
 * One fixed alphabet swap: Caesar, Atbash, Affine.
 *
 * Two alphabets sit on top of each other. First the bottom one is turned into
 * the cipher alphabet (slid, mirrored or computed), then each letter of the
 * message is looked up and carried down to the output.
 */
(function () {
  'use strict';

  const { el, tape, stagger } = Stage;
  const { ALPHABET, isLetter, toIndex, modInverse } = Ciphers;

  function explain(cipher, keys, p, c, enc) {
    const P = ALPHABET[p];
    const C = ALPHABET[c];
    if (cipher.id === 'caesar') {
      const k = Number(keys.shift);
      const wraps = enc ? p + k > 25 : p - k < 0;
      const tail = wraps ? ', wrapping past ' + (enc ? 'Z back to A' : 'A back to Z') : '';
      return enc
        ? `${P} moves ${k} along the alphabet${tail}: ${C}.`
        : `${C} moves ${k} back along the alphabet${tail}: ${P}.`;
    }
    if (cipher.id === 'atbash') {
      const nth = p + 1;
      const ord = nth + (nth % 10 === 1 && nth !== 11 ? 'st' : nth % 10 === 2 && nth !== 12 ? 'nd' : nth % 10 === 3 && nth !== 13 ? 'rd' : 'th');
      return enc
        ? `${P} is ${ord} from the start, so it becomes ${ord} from the end: ${C}.`
        : `${C} is ${ord} from the end, so it was ${ord} from the start: ${P}.`;
    }
    const a = Number(keys.a);
    const b = Number(keys.b);
    if (enc) {
      const raw = a * p + b;
      return `${P} is ${p}. ${a} × ${p} + ${b} = ${raw}, and ${raw} mod 26 = ${c}, which is ${C}.`;
    }
    const inv = modInverse(a, 26);
    const raw = inv * (c - b);
    return `${C} is ${c}. Undo it with ${inv}, the inverse of ${a}: ${inv} × (${c} − ${b}) = ${raw}, mod 26 = ${p}, which is ${P}.`;
  }

  function introCaptions(cipher, keys, enc) {
    const first = enc
      ? 'Two copies of the alphabet. The top row is your message’s alphabet; the bottom row will become the cipher alphabet.'
      : 'Two copies of the alphabet. To decrypt, we find each cipher letter on the bottom row and read the letter above it.';
    if (cipher.intro === 'slide') {
      return [first, `Slide the bottom row ${keys.shift} places to the left. Each plain letter now sits directly above its replacement.`];
    }
    if (cipher.intro === 'mirror') {
      return [first, 'Flip the bottom row end to end. A lines up with Z, B with Y, all the way to the middle.'];
    }
    return [first, `Work out each position p as (${keys.a} × p + ${keys.b}) mod 26. That gives a scrambled alphabet with no letter used twice.`];
  }

  Scenes.substitution = function ({ cipher, keys, mode, input, mount, cue }) {
    const enc = mode === 'encrypt';
    const row = cipher.row(keys);
    const shift = Number(keys.shift) || 0;
    const source = input.toUpperCase();
    const result = (enc ? cipher.encrypt : cipher.decrypt)(source, keys).toUpperCase();

    // --- layout
    const inTape = tape([...source], { label: enc ? 'Message' : 'Ciphertext', cls: 'tape-in' });
    const outTape = tape([...result].map(ch => (isLetter(ch) ? '' : ch)), { label: enc ? 'Ciphertext' : 'Message', cls: 'tape-out' });

    const board = el('div', 'alpha-board intro-' + cipher.intro);
    const top = el('div', 'alpha-row plain');
    const topCells = [...ALPHABET].map(ch => top.appendChild(el('span', 'tile', ch)));

    const beams = el('div', 'alpha-beams' + (enc ? '' : ' up'));
    const beamCells = [...ALPHABET].map(() => beams.appendChild(el('span', 'beam')));

    const bottom = el('div', 'alpha-row cipher');
    const track = el('div', 'alpha-track');
    bottom.append(track);

    let tiles;
    let bottomCell;
    if (cipher.intro === 'slide') {
      // Two alphabets end to end, so sliding left never shows a gap.
      tiles = [...ALPHABET + ALPHABET].map(ch => track.appendChild(el('span', 'tile', ch)));
      bottomCell = p => tiles[p + shift];
    } else if (cipher.intro === 'mirror') {
      tiles = [...ALPHABET].map((ch, i) => {
        const t = track.appendChild(el('span', 'tile placed', ch));
        t.style.setProperty('--i', i);
        return t;
      });
      bottomCell = p => tiles[25 - p];
    } else {
      tiles = [...ALPHABET].map(ch => {
        const t = track.appendChild(el('span', 'tile flip'));
        t.append(el('span', 'face front', ch), el('span', 'face back', ''));
        return t;
      });
      tiles.forEach((t, p) => { t.lastChild.textContent = row[p]; });
      bottomCell = p => tiles[p];
    }

    board.append(top, beams, bottom);
    mount.replaceChildren(inTape.root, board, outTape.root);

    // --- steps
    const letters = [];
    [...source].forEach((ch, pos) => {
      if (!isLetter(ch)) return;
      const p = enc ? toIndex(ch) : row.indexOf(ch);
      const c = enc ? toIndex(row[p]) : toIndex(ch);
      letters.push({ pos, p, c, out: result[pos] });
    });

    const [introA, introB] = introCaptions(cipher, keys, enc);
    const steps = [
      { caption: introA, hold: 2600 },
      { caption: introB, hold: 2800 },
      ...letters.map((l, n) => ({ caption: explain(cipher, keys, l.p, l.c, enc), hold: n < 3 ? 2600 : 1300, letter: l, pace: n < 3 ? 1 : 0.55 })),
      {
        caption: enc
          ? `Done. ${cipher.weakness}`
          : 'Done. Every letter went back through the same alphabet, the other way.',
        hold: 2000,
        outro: true,
      },
    ];

    function setAlphabet(on, animate) {
      if (cipher.intro === 'slide') {
        track.style.transform = on ? `translateX(calc(var(--cell) * ${-shift}))` : '';
        tiles.forEach((t, j) => t.classList.toggle('wrapped', on && j >= 26 && j < 26 + shift));
      } else if (cipher.intro === 'mirror') {
        tiles.forEach((t, i) => {
          t.style.setProperty('--i', on ? 25 - i : i);
          t.style.transitionDelay = animate ? `${Math.abs(12.5 - i) * 18}ms` : '';
        });
      } else {
        tiles.forEach((t, i) => {
          t.style.transitionDelay = animate ? `${i * 45}ms` : '';
          t.classList.toggle('turned', on);
        });
      }
    }

    function clearMarks() {
      mount.querySelectorAll('.now, .src, .dst, .on').forEach(n => n.classList.remove('now', 'src', 'dst', 'on'));
    }

    function show(i, animate) {
      const step = steps[i];
      clearMarks();
      setAlphabet(i >= 1, animate && i === 1);
      board.classList.toggle('settled', i >= 1);

      letters.forEach((l, n) => {
        const stepIndex = n + 2;
        const cell = outTape.cells[l.pos];
        const filled = stepIndex < i || (stepIndex === i && !animate) || step.outro;
        cell.textContent = filled ? l.out : '';
        cell.classList.toggle('filled', filled);
        inTape.cells[l.pos].classList.toggle('used', stepIndex < i || step.outro);
      });

      if (step.outro && animate) {
        stagger(cue, letters.map(l => outTape.cells[l.pos]), 'settle', { gap: 18 });
      }
      if (!step.letter) return;

      const l = step.letter;
      const pace = step.pace;
      const inCell = inTape.cells[l.pos];
      const outCell = outTape.cells[l.pos];
      const first = enc ? topCells[l.p] : bottomCell(l.p);
      const second = enc ? bottomCell(l.p) : topCells[l.p];

      inCell.classList.add('now');
      if (!animate) {
        first.classList.add('src');
        beamCells[l.p].classList.add('on');
        second.classList.add('dst');
        return;
      }
      cue.at(120 * pace, () => first.classList.add('src'));
      cue.at(380 * pace, () => beamCells[l.p].classList.add('on'));
      cue.at(640 * pace, () => second.classList.add('dst'));
      cue.fly(second, outCell, l.out, {
        delay: 860 * pace,
        duration: 620 * Math.max(pace, 0.7),
        done: () => {
          outCell.textContent = l.out;
          outCell.classList.add('filled', 'landed');
        },
      });
    }

    return { steps, show };
  };
})();
