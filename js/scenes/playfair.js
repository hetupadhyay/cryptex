/*
 * Playfair: a keyed 5×5 square, and three rules for swapping pairs.
 */
(function () {
  'use strict';

  const { el, stagger } = Stage;

  const RULES = {
    row: { enc: 'take the letter to the right of each, wrapping round', dec: 'take the letter to the left of each, wrapping round', name: 'on the same row' },
    column: { enc: 'take the letter below each, wrapping round', dec: 'take the letter above each, wrapping round', name: 'in the same column' },
    rectangle: { enc: 'swap each for the corner on its own row', dec: 'swap each for the corner on its own row', name: 'corners of a rectangle' },
  };

  Scenes.playfair = function ({ cipher, keys, mode, input, mount, cue }) {
    const enc = mode === 'encrypt';
    const dir = enc ? 1 : -1;
    const square = Ciphers.keySquare(keys.key);
    const fromKey = Ciphers.keywordLength(keys.key);
    const pairs = enc ? Ciphers.playfairPairs(input) : Ciphers.chunkPairs(input);
    const swaps = pairs.map(p => Ciphers.playfairSwap(square, p.a, p.b, dir));

    // --- the message, split into pairs
    const inTape = el('div', 'tape tape-in pairs');
    inTape.append(el('span', 'tape-label', enc ? 'Message in pairs' : 'Ciphertext in pairs'));
    const inRow = el('div', 'tape-row');
    const inPairs = pairs.map(p => {
      const g = el('span', 'digraph');
      const a = el('span', 'cell', p.a);
      const b = el('span', 'cell' + (p.pad ? ' pad' : ''), p.b);
      g.append(a, b);
      inRow.append(g);
      return [a, b];
    });
    inTape.append(inRow);

    // --- the square
    const board = el('div', 'square-wrap');
    const grid = el('div', 'square');
    const cells = square.map((ch, i) => {
      const cell = el('span', 'sq' + (i < fromKey ? ' from-key' : ''), ch === 'I' ? 'I/J' : ch);
      cell.style.setProperty('--i', i);
      grid.append(cell);
      return cell;
    });
    const box = el('span', 'rect');
    grid.append(box);
    board.append(grid);

    const outTape = el('div', 'tape tape-out pairs');
    outTape.append(el('span', 'tape-label', enc ? 'Ciphertext' : 'Message (padding still in)'));
    const outRow = el('div', 'tape-row');
    const outPairs = swaps.map(() => {
      const g = el('span', 'digraph');
      const a = el('span', 'cell');
      const b = el('span', 'cell');
      g.append(a, b);
      outRow.append(g);
      return [a, b];
    });
    outTape.append(outRow);

    mount.replaceChildren(inTape, board, outTape);

    const keyword = Ciphers.lettersOnly(keys.key);
    const doubled = pairs.filter(p => p.pad === 'double').length;
    const padded = pairs.some(p => p.pad === 'end');

    let prepCaption;
    if (enc) {
      const notes = [];
      // The filler is X, or Q when the letter it pads is itself an X.
      const filler = kind => {
        const used = new Set(pairs.filter(p => p.pad === kind).map(p => p.b));
        return used.size === 1 ? `a ${[...used][0]}` : 'an X, or a Q next to an X';
      };
      if (doubled) notes.push(`${doubled === 1 ? 'a doubled pair gets' : 'doubled pairs get'} ${filler('double')} between them`);
      if (padded) notes.push(`the odd letter at the end gets ${filler('end')}`);
      prepCaption = 'Split the message into pairs, with J written as I' + (notes.length ? ': ' + notes.join(', and ') + '.' : '.');
    } else {
      prepCaption = 'Split the ciphertext into pairs. Every pair is decrypted on its own.';
    }

    const steps = [
      { caption: `Build the square from ${keyword}: its letters first, skipping repeats, then the rest of the alphabet. I and J share a cell.`, hold: 3000 },
      { caption: prepCaption, hold: 2600 },
      ...swaps.map((s, n) => {
        const rule = RULES[s.rule];
        const p = pairs[n];
        return {
          caption: `${p.a}${p.b}: ${rule.name}, so ${enc ? rule.enc : rule.dec}. ${s.out}.`,
          hold: n < 3 ? 3000 : 1700,
          pace: n < 3 ? 1 : 0.6,
          swap: s,
          n,
        };
      }),
      {
        caption: enc
          ? `Done. ${cipher.weakness}`
          : 'Done. Drop the padding Xs that don’t belong, and the message reads normally.',
        hold: 2000,
        outro: true,
      },
    ];

    function placeBox(a, b) {
      const ra = Math.floor(a / 5), ca = a % 5;
      const rb = Math.floor(b / 5), cb = b % 5;
      box.style.setProperty('--r', Math.min(ra, rb));
      box.style.setProperty('--c', Math.min(ca, cb));
      box.style.setProperty('--h', Math.abs(ra - rb) + 1);
      box.style.setProperty('--w', Math.abs(ca - cb) + 1);
    }

    function show(i, animate) {
      const step = steps[i];
      mount.querySelectorAll('.now, .src, .dst').forEach(n => n.classList.remove('now', 'src', 'dst'));
      box.classList.remove('on');

      if (animate && i === 0) {
        cells.forEach(c => c.classList.remove('in'));
        stagger(cue, cells, 'in', { gap: 55 });
      } else {
        cells.forEach(c => c.classList.add('in'));
      }

      inTape.classList.toggle('split', i >= 1);
      inTape.classList.toggle('split-anim', animate && i === 1);

      swaps.forEach((s, n) => {
        const stepIndex = n + 2;
        const filled = stepIndex < i || (stepIndex === i && !animate) || step.outro;
        outPairs[n].forEach((cell, j) => {
          cell.textContent = filled ? s.out[j] : '';
          cell.classList.toggle('filled', filled);
        });
        inPairs[n].forEach(cell => cell.classList.toggle('used', stepIndex < i || step.outro));
      });

      if (step.outro && animate) stagger(cue, outPairs.flat(), 'settle', { gap: 16 });
      if (!step.swap) return;

      const s = step.swap;
      const pace = step.pace;
      inPairs[step.n].forEach(c => c.classList.add('now'));
      const [fa, fb] = s.from.map(k => cells[k]);
      const [ta, tb] = s.to.map(k => cells[k]);
      placeBox(s.from[0], s.from[1]);
      box.dataset.rule = s.rule;

      if (!animate) {
        fa.classList.add('src');
        fb.classList.add('src');
        box.classList.add('on');
        ta.classList.add('dst');
        tb.classList.add('dst');
        return;
      }
      cue.at(100 * pace, () => { fa.classList.add('src'); fb.classList.add('src'); });
      cue.at(520 * pace, () => box.classList.add('on'));
      cue.at(1000 * pace, () => { ta.classList.add('dst'); tb.classList.add('dst'); });
      [ta, tb].forEach((target, j) => {
        const cell = outPairs[step.n][j];
        cue.fly(target, cell, s.out[j], {
          delay: 1300 * pace + j * 120,
          duration: 640 * Math.max(pace, 0.7),
          done: () => { cell.textContent = s.out[j]; cell.classList.add('filled', 'landed'); },
        });
      });
    }

    return { steps, show };
  };
})();
