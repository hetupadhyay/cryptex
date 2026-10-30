/*
 * Columnar transposition: rows under a keyword, columns read in key order.
 */
(function () {
  'use strict';

  const { el, tape, stagger } = Stage;

  Scenes.columnar = function ({ cipher, keys, mode, input, mount, cue }) {
    const enc = mode === 'encrypt';
    const { key, order, rank } = Ciphers.columnOrder(keys.key);
    const cols = key.length;
    const letters = Ciphers.lettersOnly(input);
    const n = letters.length;
    const result = (enc ? cipher.encrypt : cipher.decrypt)(letters, keys);
    const plain = enc ? letters : result;
    const heights = Ciphers.columnHeights(n, cols);
    const rows = heights[0] || 0;

    const inTape = tape([...letters], { label: enc ? 'Message' : 'Ciphertext', cls: 'tape-in' });
    const outTape = tape([...result].map(() => ''), { label: enc ? 'Ciphertext' : 'Message', cls: 'tape-out' });

    const grid = el('div', 'columns');
    grid.style.setProperty('--cols', cols);
    grid.style.setProperty('--rows', rows);
    const columns = [];
    for (let c = 0; c < cols; c++) {
      const col = el('div', 'column');
      const head = el('span', 'col-key', key[c]);
      const num = el('span', 'col-rank', String(rank[c] + 1));
      col.append(head, num);
      const cells = [];
      for (let r = 0; r < heights[c]; r++) cells.push(col.appendChild(el('span', 'slot')));
      grid.append(col);
      columns.push({ col, num, cells });
    }
    const gridWrap = el('div', 'columns-wrap follow');
    gridWrap.append(grid);
    mount.replaceChildren(inTape.root, gridWrap, outTape.root);

    // plain[r * cols + c] lives in column c, row r.
    const letterAt = (c, r) => plain[r * cols + c];

    // Where each ciphertext letter comes from, in reading order.
    const cipherCells = [];
    order.forEach(c => { for (let r = 0; r < heights[c]; r++) cipherCells.push({ c, r }); });

    const many = k => `${k} ${k === 1 ? 'letter' : 'letters'}`;
    const steps = [
      { caption: `Write ${key} across the top and number its letters in alphabetical order.`, hold: 2600, phase: 'key' },
    ];
    if (enc) {
      steps.push({ caption: `Write the message underneath, ${cols} letters to a row.`, hold: Math.min(1400 + n * 60, 5000), phase: 'write' });
      steps.push({ caption: 'Slide the columns into number order.', hold: 2400, phase: 'sort' });
      // A message shorter than the keyword leaves some columns empty:
      // there's nothing to read from them.
      order.forEach((c, k) => {
        if (!heights[c]) return;
        const text = columns[c].cells.map((_, r) => letterAt(c, r)).join('');
        steps.push({ caption: `Read column ${k + 1} (${key[c]}) top to bottom: ${text}.`, hold: 1300 + heights[c] * 110, phase: 'read-col', col: c, k });
      });
    } else {
      const long = n % cols;
      const split = n < cols
        ? `${many(n)} over ${cols} columns: the first ${n === 1 ? 'keyword column gets one' : `${n} keyword columns get one each`}, the rest none.`
        : long
          ? `${many(n)} over ${cols} columns: the first ${long} keyword column${long === 1 ? ' gets' : 's get'} ${many(rows)}, the rest ${rows - 1}.`
          : `${many(n)} over ${cols} columns: ${many(rows)} each.`;
      steps.push({ caption: `${split} Lay the columns out in number order.`, hold: 3200, phase: 'sort' });
      order.forEach((c, k) => {
        if (!heights[c]) return;
        steps.push({ caption: `Column ${k + 1} (${key[c]}) takes the next ${heights[c] === 1 ? 'letter' : `${heights[c]} letters`}.`, hold: 1200 + heights[c] * 110, phase: 'fill-col', col: c, k });
      });
      steps.push({ caption: 'Put the columns back in keyword order.', hold: 2400, phase: 'unsort' });
      steps.push({ caption: 'Read across the rows.', hold: Math.min(1400 + n * 60, 5000), phase: 'read-rows' });
    }
    steps.push({ caption: enc ? `Done. ${cipher.weakness}` : 'Done. The rows read as the original message.', hold: 2000, outro: true });

    function stateAt(i) {
      const s = { ranked: true, sorted: false, filled: new Set(), out: 0 };
      for (let k = 0; k <= i; k++) {
        const step = steps[k];
        if (step.phase === 'write') plain.split('').forEach((_, p) => s.filled.add(p));
        if (step.phase === 'sort') s.sorted = true;
        if (step.phase === 'unsort') s.sorted = false;
        if (step.phase === 'fill-col') columns[step.col].cells.forEach((_, r) => s.filled.add(r * cols + step.col));
        if (step.phase === 'read-col') s.out += heights[step.col];
        if (step.phase === 'read-rows') s.out = n;
        if (step.outro) { s.out = n; plain.split('').forEach((_, p) => s.filled.add(p)); }
      }
      return s;
    }

    function arrange(sorted, animate) {
      columns.forEach(({ col }, c) => {
        col.style.setProperty('--x', sorted ? rank[c] : c);
        col.style.transitionDelay = animate ? `${(sorted ? rank[c] : c) * 50}ms` : '';
      });
    }

    function show(i, animate) {
      const step = steps[i];
      const now = stateAt(i);
      const before = i > 0 ? stateAt(i - 1) : { sorted: false, filled: new Set(), out: 0 };
      mount.querySelectorAll('.now, .reading').forEach(x => x.classList.remove('now', 'reading'));

      if (animate && step.phase === 'key') {
        columns.forEach(({ num }) => num.classList.remove('in'));
        order.forEach((c, k) => cue.at(500 + k * 160, () => columns[c].num.classList.add('in')));
      } else {
        columns.forEach(({ num }) => num.classList.add('in'));
      }

      arrange(now.sorted, animate && now.sorted !== before.sorted);
      grid.classList.toggle('sorted', now.sorted);

      const shownFilled = animate ? before.filled : now.filled;
      columns.forEach(({ cells }, c) => cells.forEach((slot, r) => {
        const on = shownFilled.has(r * cols + c);
        slot.textContent = on ? letterAt(c, r) : '';
        slot.classList.toggle('filled', on);
      }));

      const shownOut = animate ? before.out : now.out;
      outTape.cells.forEach((cell, k) => {
        cell.textContent = k < shownOut ? result[k] : '';
        cell.classList.toggle('filled', k < shownOut);
      });
      const settled = animate ? before : now;
      inTape.cells.forEach((cell, k) => {
        cell.classList.toggle('used', enc ? settled.filled.has(k) : k < settled.filled.size);
      });

      // A long keyword's grid can be wider than a phone: keep the column
      // being worked on in view.
      if (step.col !== undefined) {
        columns[step.col].col.classList.add('now');
        Stage.follow(columns[step.col].col, animate);
      }
      if (!animate) return;

      const slotOf = (c, r) => columns[c].cells[r];
      const drop = (c, r, src, delay) => cue.fly(src, slotOf(c, r), letterAt(c, r), {
        delay,
        duration: 500,
        done: () => { slotOf(c, r).textContent = letterAt(c, r); slotOf(c, r).classList.add('filled', 'landed'); },
      });
      const emit = (c, r, k, delay) => {
        cue.at(delay, () => slotOf(c, r).classList.add('reading'));
        cue.fly(slotOf(c, r), outTape.cells[k], result[k], {
          delay: delay + 100,
          duration: 520,
          done: () => { outTape.cells[k].textContent = result[k]; outTape.cells[k].classList.add('filled', 'landed'); },
        });
      };

      if (step.phase === 'write') {
        const gap = Math.max(35, Math.min(80, 3400 / n));
        for (let p = 0; p < n; p++) {
          cue.at(p * gap, () => inTape.cells[p].classList.add('used'));
          drop(p % cols, Math.floor(p / cols), inTape.cells[p], p * gap);
        }
      } else if (step.phase === 'fill-col') {
        const start = cipherCells.findIndex(x => x.c === step.col);
        columns[step.col].cells.forEach((_, r) => {
          const src = inTape.cells[start + r];
          cue.at(r * 90, () => src.classList.add('used'));
          drop(step.col, r, src, r * 90);
        });
      } else if (step.phase === 'read-col') {
        const start = before.out;
        columns[step.col].cells.forEach((_, r) => emit(step.col, r, start + r, 150 + r * 110));
      } else if (step.phase === 'read-rows') {
        const gap = Math.max(35, Math.min(80, 3400 / n));
        for (let p = 0; p < n; p++) emit(p % cols, Math.floor(p / cols), p, p * gap);
      } else if (step.outro) {
        stagger(cue, outTape.cells, 'settle', { gap: 18 });
      }
    }

    return { steps, show };
  };
})();
