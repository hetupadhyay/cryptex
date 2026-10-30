/*
 * Rail fence: write along a zig-zag, read rail by rail.
 */
(function () {
  'use strict';

  const { el, tape, stagger } = Stage;
  const SVG = 'http://www.w3.org/2000/svg';

  Scenes.railfence = function ({ cipher, keys, mode, input, mount, cue }) {
    const enc = mode === 'encrypt';
    const rails = Number(keys.rails);
    const letters = Ciphers.lettersOnly(input);
    const n = letters.length;
    const pattern = Ciphers.railPattern(n, rails);
    const result = (enc ? cipher.encrypt : cipher.decrypt)(letters, keys);
    const plain = enc ? letters : result;

    // Order in which positions are read rail by rail.
    const railOrder = [];
    for (let r = 0; r < rails; r++) {
      for (let i = 0; i < n; i++) if (pattern[i] === r) railOrder.push(i);
    }

    const inTape = tape([...letters], { label: enc ? 'Message' : 'Ciphertext', cls: 'tape-in' });
    const outTape = tape([...result].map(() => ''), { label: enc ? 'Ciphertext' : 'Message', cls: 'tape-out' });

    // A long message would make the fence wider than a phone, so it's laid
    // out in bands, each a stretch of the zig-zag with its own rail labels,
    // and nothing runs off the side.
    const room = Math.max(160, Stage.room(mount) - 40);
    const bands = Math.ceil(n / Math.max(6, Math.floor(room / 22)));
    const per = Math.ceil(n / bands);
    const fenceWrap = el('div', 'fence-wrap');
    const fences = [];
    const slots = [];
    for (let start = 0; start < n; start += per) {
      const count = Math.min(per, n - start);
      const band = el('div', 'fence-band');
      band.style.setProperty('--n', count);
      band.style.setProperty('--rails', rails);

      const labels = el('div', 'rail-labels');
      for (let r = 0; r < rails; r++) {
        const label = labels.appendChild(el('span', 'rail-label', String(r + 1)));
        label.style.gridRow = r + 1;
      }

      const fence = el('div', 'fence');
      const line = document.createElementNS(SVG, 'svg');
      line.setAttribute('class', 'zigzag');
      line.setAttribute('viewBox', `0 0 ${count} ${rails}`);
      line.setAttribute('preserveAspectRatio', 'none');
      const path = document.createElementNS(SVG, 'polyline');
      path.setAttribute('points', pattern.slice(start, start + count).map((r, i) => `${i + 0.5},${r + 0.5}`).join(' '));
      path.setAttribute('pathLength', '1');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      line.append(path);
      fence.append(line);
      for (let i = start; i < start + count; i++) {
        const slot = fence.appendChild(el('span', 'slot'));
        slot.style.gridRow = pattern[i] + 1;
        slot.style.gridColumn = i - start + 1;
        slots.push(slot);
      }

      band.append(labels, fence);
      fenceWrap.append(band);
      fences.push(fence);
    }

    mount.replaceChildren(inTape.root, fenceWrap, outTape.root);

    const perRail = Array.from({ length: rails }, (_, r) => railOrder.filter(i => pattern[i] === r));

    // --- steps
    const steps = [];
    if (enc) {
      steps.push({ caption: `Draw a zig-zag across ${rails} rails, one slot per letter.`, hold: 2200, phase: 'path' });
      steps.push({ caption: 'Write the message along the zig-zag, going down and up the rails.', hold: Math.min(1400 + n * 70, 5200), phase: 'write' });
      // With more rails than letters, the lowest rails stay empty.
      perRail.forEach((positions, r) => {
        if (!positions.length) return;
        steps.push({
          caption: `Read rail ${r + 1} from left to right: ${positions.map(i => plain[i]).join('')}.`,
          hold: 1400 + positions.length * 90,
          phase: 'read-rail',
          rail: r,
        });
      });
    } else {
      steps.push({
        caption: `Mark the zig-zag for ${n} ${n === 1 ? 'letter' : 'letters'} on ${rails} rails. That tells us how many letters each rail holds: ${perRail.map(p => p.length).join(', ')}.`,
        hold: 3000,
        phase: 'path',
      });
      let taken = 0;
      perRail.forEach((positions, r) => {
        if (!positions.length) return;
        steps.push({
          caption: `Fill rail ${r + 1} with the next ${positions.length === 1 ? 'letter' : `${positions.length} letters`} of the ciphertext.`,
          hold: 1300 + positions.length * 90,
          phase: 'fill-rail',
          rail: r,
          start: taken,
        });
        taken += positions.length;
      });
      steps.push({ caption: 'Now read along the zig-zag, down and up again.', hold: Math.min(1400 + n * 70, 5200), phase: 'read-path' });
    }
    steps.push({ caption: enc ? `Done. ${cipher.weakness}` : 'Done. The zig-zag puts every letter back where it started.', hold: 2000, outro: true });

    // How far along each phase is at step i, for drawing any step from scratch.
    function stateAt(i) {
      const s = { path: i >= 0, placed: new Set(), out: 0 };
      for (let k = 0; k <= i; k++) {
        const step = steps[k];
        if (step.phase === 'write' || step.outro) pattern.forEach((_, p) => s.placed.add(p));
        if (step.phase === 'fill-rail') perRail[step.rail].forEach(p => s.placed.add(p));
        if (step.phase === 'read-rail') s.out += perRail[step.rail].length;
        if (step.phase === 'read-path' || step.outro) s.out = n;
      }
      return s;
    }

    // Cipher letters sit in rail order; plain letters in path order.
    const letterAt = p => plain[p];
    const outPos = enc ? railOrder.map((p, k) => ({ from: p, to: k })) : pattern.map((_, p) => ({ from: p, to: p }));

    function show(i, animate) {
      const step = steps[i];
      const now = stateAt(i);
      const before = i > 0 ? stateAt(i - 1) : { placed: new Set(), out: 0 };
      mount.querySelectorAll('.now, .reading').forEach(x => x.classList.remove('now', 'reading'));

      fences.forEach(f => f.classList.toggle('drawn', now.path));
      if (animate && i === 0) {
        fences.forEach(f => f.classList.remove('drawn'));
        void fenceWrap.offsetWidth;
        fences.forEach(f => f.classList.add('drawn'));
      }

      const animPlaced = animate ? before.placed : now.placed;
      slots.forEach((slot, p) => {
        const on = animPlaced.has(p);
        slot.textContent = on ? letterAt(p) : '';
        slot.classList.toggle('filled', on);
      });

      const animOut = animate ? before.out : now.out;
      outTape.cells.forEach((cell, k) => {
        const on = k < animOut;
        cell.textContent = on ? result[k] : '';
        cell.classList.toggle('filled', on);
      });
      // While a step animates, its letters dim one by one as they leave.
      const settled = animate ? before : now;
      inTape.cells.forEach((cell, k) => {
        cell.classList.toggle('used', enc ? settled.placed.has(k) : k < settled.placed.size);
      });

      if (!animate) {
        if (step.rail !== undefined) perRail[step.rail].forEach(p => slots[p].classList.add('reading'));
        return;
      }

      const place = (p, from, delay) => cue.fly(from, slots[p], letterAt(p), {
        delay,
        duration: 520,
        done: () => { slots[p].textContent = letterAt(p); slots[p].classList.add('filled', 'landed'); },
      });
      const emit = (p, k, delay) => {
        const cell = outTape.cells[k];
        cue.at(delay, () => slots[p].classList.add('reading'));
        cue.fly(slots[p], cell, result[k], {
          delay: delay + 120,
          duration: 520,
          done: () => { cell.textContent = result[k]; cell.classList.add('filled', 'landed'); },
        });
      };

      if (step.phase === 'write') {
        const gap = Math.max(40, Math.min(90, 3600 / n));
        pattern.forEach((_, p) => {
          cue.at(p * gap, () => inTape.cells[p].classList.add('used'));
          place(p, inTape.cells[p], p * gap);
        });
      } else if (step.phase === 'fill-rail') {
        perRail[step.rail].forEach((p, j) => {
          const src = inTape.cells[step.start + j];
          cue.at(j * 80, () => src.classList.add('used'));
          place(p, src, j * 80);
        });
      } else if (step.phase === 'read-rail') {
        const startK = before.out;
        perRail[step.rail].forEach((p, j) => emit(p, startK + j, 160 + j * 90));
      } else if (step.phase === 'read-path') {
        const gap = Math.max(40, Math.min(90, 3600 / n));
        outPos.forEach(({ from, to }, j) => emit(from, to, j * gap));
      } else if (step.outro) {
        stagger(cue, outTape.cells, 'settle', { gap: 18 });
      }
    }

    return { steps, show };
  };
})();
