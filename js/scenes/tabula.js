/*
 * Vigenère, Autokey and Beaufort on a tabula recta.
 *
 * The key is written under the message, then each pair (message letter, key
 * letter) is looked up in the 26×26 table. The path through the table is
 * drawn as a trail of cells so you can see where the answer comes from.
 * On a phone the table is magnified and the view follows each lookup.
 */
(function () {
  'use strict';

  const { el, stagger } = Stage;
  const { ALPHABET, isLetter, toIndex, toLetter, lettersOnly, mod } = Ciphers;

  Scenes.tabula = function ({ cipher, keys, mode, input, mount, cue }) {
    const enc = mode === 'encrypt';
    const autokey = cipher.id === 'autokey';
    const beaufort = cipher.id === 'beaufort';
    const keyword = lettersOnly(keys.key);
    const source = Ciphers.upper(input);
    const result = Ciphers.upper((enc ? cipher.encrypt : cipher.decrypt)(source, keys));
    const plainLetters = lettersOnly(enc ? source : result);

    const stream = autokey
      ? Ciphers.autokeyStream(keyword, plainLetters)
      : Ciphers.keyStream(keyword, plainLetters.length);

    // --- message with the key written underneath
    const pairs = el('div', 'tape tape-in keyed');
    pairs.append(el('span', 'tape-label', enc ? 'Message and key' : 'Ciphertext and key'));
    const pairRow = el('div', 'tape-row');
    const msgCells = [];
    const keyCells = [];
    let n = 0;
    let word = null;
    for (const ch of source) {
      const col = el('span', 'pair' + (isLetter(ch) ? '' : ' gap'));
      const top = el('span', 'cell', isLetter(ch) ? ch : '');
      const bottom = el('span', 'cell key');
      col.append(top, bottom);
      if (/\s/.test(ch)) {
        pairRow.append(col);
        word = null;
      } else {
        if (!word) word = pairRow.appendChild(el('span', 'word'));
        word.append(col);
      }
      if (isLetter(ch)) {
        msgCells.push(top);
        bottom.dataset.n = n++;
        keyCells.push(bottom);
      }
    }
    pairs.append(pairRow);

    // --- the table
    const table = el('div', 'tabula');
    table.append(el('span', 'tt corner'));
    const colHeads = [...ALPHABET].map(ch => table.appendChild(el('span', 'tt head col', ch)));
    const rowHeads = [];
    const grid = [];
    for (let r = 0; r < 26; r++) {
      rowHeads.push(table.appendChild(el('span', 'tt head row', ALPHABET[r])));
      grid.push([]);
      for (let c = 0; c < 26; c++) {
        const cell = table.appendChild(el('span', 'tt', toLetter(r + c)));
        cell.style.setProperty('--d', r + c);
        grid[r].push(cell);
      }
    }
    const tableWrap = el('div', 'tabula-wrap');
    tableWrap.append(table);

    const outCells = [];
    const outTape = el('div', 'tape tape-out');
    outTape.append(el('span', 'tape-label', enc ? 'Ciphertext' : 'Message'));
    const outRow = el('div', 'tape-row');
    let outWord = null;
    for (const ch of result) {
      const cell = el('span', ch === ' ' ? 'cell gap' : 'cell', isLetter(ch) || ch === ' ' ? '' : ch);
      if (ch === ' ') {
        outRow.append(cell);
        outWord = null;
      } else {
        if (!outWord) outWord = outRow.appendChild(el('span', 'word'));
        outWord.append(cell);
      }
      if (isLetter(ch)) outCells.push(cell);
    }
    outTape.append(outRow);

    mount.replaceChildren(pairs, tableWrap, outTape);

    // --- each lookup: where the trail goes and which cell holds the answer
    const outLetters = lettersOnly(result);
    const inLetters = lettersOnly(source);
    const lookups = inLetters.split('').map((ch, i) => {
      const k = stream[i];
      const x = toIndex(ch);
      const y = toIndex(outLetters[i]);
      if (beaufort) {
        // Column of the input letter, down to the key letter; the row label is the answer.
        const r = mod(k - x, 26);
        return { i, k, path: [...colPath(x, r), ...rowPathBack(r, x)], answer: rowHeads[r], heads: [colHeads[x]], at: [r, x], out: outLetters[i] };
      }
      if (enc) {
        // Column of the message letter, row of the key letter, meet in the middle.
        return { i, k, path: [...colPath(x, k), ...rowPathTo(k, x)], answer: grid[k][x], heads: [colHeads[x], rowHeads[k]], at: [k, x], out: outLetters[i] };
      }
      // Along the key's row to the cipher letter, then up to the column label.
      const c = y;
      return { i, k, path: [...rowPathTo(k, c), ...colPathUp(c, k)], answer: colHeads[c], heads: [rowHeads[k]], at: [k, c], out: outLetters[i] };
    });

    function colPath(c, toRow) { return Array.from({ length: toRow + 1 }, (_, r) => grid[r][c]); }
    function colPathUp(c, fromRow) { return Array.from({ length: fromRow + 1 }, (_, r) => grid[fromRow - r][c]); }
    function rowPathTo(r, toCol) { return Array.from({ length: toCol + 1 }, (_, c) => grid[r][c]); }
    function rowPathBack(r, fromCol) { return Array.from({ length: fromCol + 1 }, (_, c) => grid[r][fromCol - c]); }

    function caption(l) {
      const M = inLetters[l.i];
      const K = ALPHABET[l.k];
      const O = l.out;
      if (beaufort) return `Go down column ${M} until you reach ${K}. That row is labelled ${O}.`;
      if (enc) return `Column ${M}, row ${K}. They cross at ${O}.`;
      const feed = autokey && l.i + keyword.length < inLetters.length ? ` It also becomes key letter ${l.i + keyword.length + 1}.` : '';
      return `Along row ${K} to find ${M}. It sits in column ${O}.${feed}`;
    }

    // --- steps
    const keyCaption = autokey
      ? enc
        ? `Write ${keyword} under the first letters. After that, the key carries on with the message itself.`
        : `Write ${keyword} under the first letters. The rest of the key is the message, so it fills in as we decrypt.`
      : `Write ${keyword} under the ${enc ? 'message' : 'ciphertext'}, repeating it as far as it needs to go.`;

    const steps = [
      { caption: keyCaption, hold: 2800 },
      { caption: 'The tabula recta: 26 alphabets, each one shifted a place further than the row above.', hold: 2600 },
      ...lookups.map((l, n) => ({ caption: caption(l), hold: n < 3 ? 2900 : 1500, lookup: l, pace: n < 3 ? 1 : 0.55 })),
      {
        caption: enc ? `Done. ${cipher.weakness}` : 'Done. The same table, read the other way round.',
        hold: 2000,
        outro: true,
      },
    ];

    // In autokey decryption, key letters past the keyword only exist once
    // the message letter they come from has been worked out.
    const keyKnownAt = i => (autokey && !enc && i >= keyword.length ? i - keyword.length + 2 : 0);

    let lit = [];
    function clearTrail() {
      lit.forEach(node => {
        node.classList.remove('trail', 'hit', 'lit');
        node.style.transitionDelay = '';
      });
      lit = [];
      mount.querySelectorAll('.now').forEach(node => node.classList.remove('now'));
    }
    function light(node, cls, delay) {
      if (delay !== undefined) node.style.transitionDelay = delay + 'ms';
      node.classList.add(cls);
      lit.push(node);
    }

    // On a narrow stage the table is magnified and seen through a window
    // (see scenes.css). The window pans so the cell where the lookup meets
    // sits in the middle. It moves in whole cells, so the labels never sit
    // over half a letter. On a wide stage the whole table fits and the
    // offsets are unused.
    let at = [0, 0];
    function pan(target, ms) {
      at = target;
      const size = grid[0][0].offsetWidth;
      const room = [tableWrap.clientHeight - size, tableWrap.clientWidth - size];
      const offset = axis => {
        const cells = Math.round(at[axis] + 0.5 - room[axis] / size / 2);
        return Math.max(0, Math.min(cells, Math.ceil(26 - room[axis] / size))) * size;
      };
      table.style.setProperty('--pan', ms + 'ms');
      table.style.setProperty('--py', offset(0) + 'px');
      table.style.setProperty('--px', offset(1) + 'px');
    }

    // Turning the phone changes the window, so put the view back in place.
    const resize = new ResizeObserver(() => {
      if (!tableWrap.isConnected) resize.disconnect();
      else pan(at, 0);
    });
    resize.observe(tableWrap);

    function show(i, animate) {
      const step = steps[i];
      clearTrail();

      const focus = step.lookup || (step.outro && lookups[lookups.length - 1]);
      pan(focus ? focus.at : [0, 0], animate ? Stage.ms(520 * (step.pace || 1)) : 0);

      keyCells.forEach((cell, j) => {
        const known = i >= keyKnownAt(j) && (i > keyKnownAt(j) || keyKnownAt(j) === 0 || !animate);
        cell.textContent = known ? ALPHABET[stream[j]] : '';
        cell.classList.toggle('fed', autokey && j >= keyword.length);
      });
      if (animate && i === 0) {
        keyCells.forEach(c => c.classList.remove('shown'));
        const direct = autokey ? keyCells.slice(0, keyword.length) : keyCells;
        stagger(cue, direct, 'shown', { gap: 45 });
        if (autokey && enc) {
          keyCells.slice(keyword.length).forEach((cell, j) => {
            cell.textContent = '';
            cue.fly(msgCells[j], cell, msgCells[j].textContent, {
              delay: 500 + j * 60,
              duration: 520,
              cls: 'ghost-key',
              done: () => { cell.textContent = ALPHABET[stream[j + keyword.length]]; cell.classList.add('shown'); },
            });
          });
        } else {
          keyCells.slice(autokey ? keyword.length : keyCells.length).forEach(c => c.classList.add('shown'));
        }
      } else {
        keyCells.forEach(c => c.classList.add('shown'));
      }

      table.classList.toggle('revealed', i >= 1);
      if (animate && i === 1) table.classList.add('wave');
      else table.classList.remove('wave');

      lookups.forEach((l, j) => {
        const stepIndex = j + 2;
        const filled = stepIndex < i || (stepIndex === i && !animate) || step.outro;
        outCells[j].textContent = filled ? l.out : '';
        outCells[j].classList.toggle('filled', filled);
        msgCells[j].classList.toggle('used', stepIndex < i || step.outro);
      });

      if (step.outro && animate) stagger(cue, outCells, 'settle', { gap: 18 });
      if (!step.lookup) return;

      const l = step.lookup;
      const pace = step.pace;
      msgCells[l.i].classList.add('now');
      keyCells[l.i].classList.add('now');

      if (!animate) {
        l.heads.forEach(h => light(h, 'lit'));
        l.path.forEach(c => light(c, 'trail'));
        light(l.answer, 'hit');
        return;
      }

      l.heads.forEach(h => cue.at(80 * pace, () => light(h, 'lit')));
      const gap = 16 * pace;
      cue.at(200 * pace, () => l.path.forEach((c, j) => light(c, 'trail', Math.round(j * gap))));
      const arrive = 200 * pace + l.path.length * gap + 160;
      cue.at(arrive, () => light(l.answer, 'hit'));

      cue.fly(l.answer, outCells[l.i], l.out, {
        delay: arrive + 260 * pace,
        duration: 640 * Math.max(pace, 0.7),
        done: () => {
          outCells[l.i].textContent = l.out;
          outCells[l.i].classList.add('filled', 'landed');
          const feedTo = keyCells[l.i + keyword.length];
          if (autokey && !enc && feedTo) {
            cue.fly(outCells[l.i], feedTo, l.out, {
              duration: 480,
              cls: 'ghost-key',
              done: () => { feedTo.textContent = l.out; feedTo.classList.add('shown'); },
            });
          }
        },
      });
    }

    return { steps, show };
  };
})();
