/*
 * Polybius square: every letter becomes its row and column number.
 */
(function () {
  'use strict';

  const { el, tape, stagger } = Stage;
  const { isLetter } = Ciphers;

  Scenes.polybius = function ({ cipher, keys, mode, input, mount, cue }) {
    const enc = mode === 'encrypt';
    const square = Ciphers.keySquare(keys.key);
    const fromKey = Ciphers.keywordLength(keys.key);

    // Units are what the input tape shows: letters when encrypting, digit pairs when decrypting.
    let units;
    if (enc) {
      units = [];
      for (const ch of input.toUpperCase()) {
        if (isLetter(ch)) units.push(ch);
        else if (/\s/.test(ch) && units.length && units[units.length - 1] !== ' ') units.push(' ');
      }
      if (units[units.length - 1] === ' ') units.pop();
    } else {
      units = Ciphers.polybiusTokens(input).map(t => (t === '/' ? ' ' : t));
    }

    const lookups = [];
    const outUnits = units.map((u, pos) => {
      if (u === ' ') return enc ? '/' : ' ';
      const index = enc ? square.indexOf(u.replace('J', 'I')) : (u[0] - 1) * 5 + (u[1] - 1);
      const r = Math.floor(index / 5);
      const c = index % 5;
      const out = enc ? `${r + 1}${c + 1}` : square[index];
      lookups.push({ pos, index, r, c, out, from: u });
      return out;
    });

    const inTape = tape(units, { label: enc ? 'Message' : 'Ciphertext', cls: 'tape-in' + (enc ? '' : ' wide') });
    const outTape = tape(outUnits.map(u => (u === '/' || u === ' ' ? u : '')), { label: enc ? 'Ciphertext' : 'Message', cls: 'tape-out' + (enc ? ' wide' : '') });
    outTape.cells.forEach((cell, i) => { if (outUnits[i] === '/') cell.className = 'cell slash'; });

    const grid = el('div', 'square numbered');
    grid.append(el('span', 'sq head corner'));
    const colHeads = [1, 2, 3, 4, 5].map(n => grid.appendChild(el('span', 'sq head', n)));
    const rowHeads = [];
    const cells = [];
    for (let r = 0; r < 5; r++) {
      rowHeads.push(grid.appendChild(el('span', 'sq head', r + 1)));
      for (let c = 0; c < 5; c++) {
        const i = r * 5 + c;
        const cell = el('span', 'sq' + (i < fromKey ? ' from-key' : ''), square[i] === 'I' ? 'I/J' : square[i]);
        grid.append(cell);
        cells.push(cell);
      }
    }
    const board = el('div', 'square-wrap');
    board.append(grid);
    mount.replaceChildren(inTape.root, board, outTape.root);

    const steps = [
      {
        caption: fromKey
          ? `A 5×5 square, keyword letters first. Rows and columns are numbered 1 to 5. I and J share a cell.`
          : 'A 5×5 square of the alphabet. Rows and columns are numbered 1 to 5. I and J share a cell.',
        hold: 2600,
      },
      ...lookups.map((l, n) => ({
        caption: enc
          ? `${l.from} is in row ${l.r + 1}, column ${l.c + 1}: ${l.out}.`
          : `${l.from}: row ${l.r + 1}, column ${l.c + 1}. That’s ${l.out}.`,
        hold: n < 3 ? 2400 : 1200,
        pace: n < 3 ? 1 : 0.55,
        lookup: l,
      })),
      { caption: enc ? `Done. ${cipher.weakness}` : 'Done. Each pair of digits pointed back to one cell.', hold: 2000, outro: true },
    ];

    let lit = [];
    function light(node, cls, delay) {
      node.style.transitionDelay = delay ? delay + 'ms' : '';
      node.classList.add(cls);
      lit.push(node);
    }

    function show(i, animate) {
      const step = steps[i];
      lit.forEach(n => { n.classList.remove('lit', 'trail', 'hit'); n.style.transitionDelay = ''; });
      lit = [];
      mount.querySelectorAll('.now').forEach(n => n.classList.remove('now'));

      if (animate && i === 0) {
        cells.forEach(c => c.classList.remove('in'));
        stagger(cue, cells, 'in', { gap: 40 });
      } else {
        cells.forEach(c => c.classList.add('in'));
      }

      lookups.forEach((l, n) => {
        const stepIndex = n + 1;
        const filled = stepIndex < i || (stepIndex === i && !animate) || step.outro;
        outTape.cells[l.pos].textContent = filled ? l.out : '';
        outTape.cells[l.pos].classList.toggle('filled', filled);
        inTape.cells[l.pos].classList.toggle('used', stepIndex < i || step.outro);
      });

      if (step.outro && animate) stagger(cue, lookups.map(l => outTape.cells[l.pos]), 'settle', { gap: 18 });
      if (!step.lookup) return;

      const l = step.lookup;
      const pace = step.pace;
      const target = cells[l.index];
      const rowTrail = Array.from({ length: l.c }, (_, c) => cells[l.r * 5 + c]);
      const colTrail = Array.from({ length: l.r }, (_, r) => cells[r * 5 + l.c]);
      const outCell = outTape.cells[l.pos];
      inTape.cells[l.pos].classList.add('now');

      if (!animate) {
        light(rowHeads[l.r], 'lit');
        light(colHeads[l.c], 'lit');
        [...rowTrail, ...colTrail].forEach(n => light(n, 'trail'));
        light(target, 'hit');
        return;
      }

      const fill = () => { outCell.textContent = l.out; outCell.classList.add('filled', 'landed'); };

      if (enc) {
        // Find the letter, then read its coordinates off the edges.
        cue.at(100 * pace, () => light(target, 'hit'));
        cue.at(420 * pace, () => {
          rowTrail.slice().reverse().forEach((n, j) => light(n, 'trail', j * 40 * pace));
          colTrail.slice().reverse().forEach((n, j) => light(n, 'trail', j * 40 * pace));
        });
        cue.at(700 * pace, () => { light(rowHeads[l.r], 'lit'); light(colHeads[l.c], 'lit'); });
        cue.fly(rowHeads[l.r], outCell, String(l.r + 1), { delay: 900 * pace, duration: 560 * Math.max(pace, 0.7) });
        cue.fly(colHeads[l.c], outCell, String(l.c + 1), { delay: 1020 * pace, duration: 560 * Math.max(pace, 0.7), done: fill });
      } else {
        // Coordinates first, then the trails meet at the letter.
        cue.at(100 * pace, () => light(rowHeads[l.r], 'lit'));
        cue.at(260 * pace, () => light(colHeads[l.c], 'lit'));
        cue.at(420 * pace, () => {
          rowTrail.forEach((n, j) => light(n, 'trail', j * 40 * pace));
          colTrail.forEach((n, j) => light(n, 'trail', j * 40 * pace));
        });
        cue.at(700 * pace, () => light(target, 'hit'));
        cue.fly(target, outCell, l.out, { delay: 900 * pace, duration: 600 * Math.max(pace, 0.7), done: fill });
      }
    }

    return { steps, show };
  };
})();
