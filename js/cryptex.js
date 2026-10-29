/*
 * The hero cryptex. Each ring is a cylinder of 26 letters; all rings turn
 * together, so turning them is exactly a Caesar shift.
 */
(function () {
  'use strict';

  const { ALPHABET, toIndex, mod } = Ciphers;
  const STEP = 360 / 26;

  const rings = document.querySelector('.cryptex .rings');
  const wordInput = document.getElementById('cryptex-word');
  const shiftOut = document.getElementById('cryptex-shift');
  const textOut = document.getElementById('cryptex-out');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  let word = 'CIPHER';
  let parts = []; // { turn, base, spring }
  let shift = 0;
  let frame = null;
  let last = 0;
  let touched = false;

  rings.tabIndex = 0;
  rings.setAttribute('role', 'slider');
  rings.setAttribute('aria-label', 'Shift');
  rings.setAttribute('aria-orientation', 'vertical');
  rings.setAttribute('aria-valuemin', '0');
  rings.setAttribute('aria-valuemax', '25');

  function build(intro) {
    rings.replaceChildren();
    parts = [...word].map((ch, i) => {
      const ring = document.createElement('div');
      ring.className = 'ring';
      const turn = document.createElement('div');
      turn.className = 'ring-turn';
      for (let n = 0; n < 26; n++) {
        const face = document.createElement('span');
        face.className = 'ring-face';
        face.textContent = ALPHABET[n];
        face.style.transform = `rotateX(${-n * STEP}deg) translateZ(var(--r))`;
        turn.append(face);
      }
      ring.append(turn);
      rings.append(ring);

      const base = toIndex(ch);
      // The intro spins each ring a few turns and lets it settle, left to right.
      const start = intro ? base + shift - 26 * (2 + i * 0.35) - Math.random() * 6 : base + shift;
      const spring = new Spring(start, intro ? { response: 1.1 + i * 0.16, damping: 0.86 } : undefined);
      spring.target = base + shift;
      return { turn, base, spring };
    });
    paint();
  }

  function current() {
    return parts.length ? parts[0].spring.value - parts[0].base : 0;
  }

  function paint() {
    for (const p of parts) p.turn.style.transform = `rotateX(${p.spring.value * STEP}deg)`;
    const s = mod(Math.round(current()), 26);
    shiftOut.textContent = s;
    textOut.textContent = [...word].map(ch => ALPHABET[mod(toIndex(ch) + s, 26)]).join('');
    rings.setAttribute('aria-valuenow', s);
    rings.setAttribute('aria-valuetext', `Shift ${s}: ${word} reads as ${textOut.textContent}`);
  }

  function tick(t) {
    const dt = last ? Math.min((t - last) / 1000, 1 / 30) : 1 / 60;
    last = t;
    let moving = dragging;
    if (!dragging) {
      for (const p of parts) {
        p.spring.step(dt);
        if (!p.spring.settled()) moving = true;
      }
    }
    paint();
    frame = moving ? requestAnimationFrame(tick) : null;
    if (!frame) last = 0;
  }

  function animate() {
    if (still.matches) {
      for (const p of parts) p.spring.value = p.spring.target;
      paint();
      return;
    }
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function goTo(s, opts = { response: 0.45, damping: 1 }, velocity = 0, fromScroll = false) {
    if (s !== shift) document.dispatchEvent(new Event('cryptex:turn'));
    shift = s;
    if (!fromScroll) anchor = { shift: s, steps: scrollSteps() };
    for (const p of parts) {
      p.spring.tune(opts);
      p.spring.target = p.base + s;
      p.spring.velocity = velocity;
    }
    animate();
  }

  // ---- dragging -------------------------------------------------------------

  let dragging = false;
  let startY = 0;
  let startValue = 0;
  let samples = [];

  function faceHeight() {
    return parts[0] ? parts[0].turn.offsetHeight : 28;
  }

  rings.addEventListener('pointerdown', e => {
    if (!parts.length) return;
    touched = true;
    dragging = true;
    rings.setPointerCapture(e.pointerId);
    rings.classList.add('dragging');
    startY = e.clientY;
    startValue = current();
    samples = [{ y: e.clientY, t: e.timeStamp }];
    animate();
  });

  rings.addEventListener('pointermove', e => {
    if (!dragging) return;
    // Dragging up brings later letters into the window.
    const value = startValue + (startY - e.clientY) / faceHeight();
    for (const p of parts) {
      p.spring.value = p.base + value;
      p.spring.velocity = 0;
    }
    samples.push({ y: e.clientY, t: e.timeStamp });
    if (samples.length > 6) samples.shift();
    paint();
  });

  // A tap that barely moves turns the rings one letter: tapping below the
  // window brings the next letter up, tapping above brings the last one back.
  function release(e) {
    if (!dragging) return;
    dragging = false;
    rings.classList.remove('dragging');
    const first = samples[0];
    const lastSample = samples[samples.length - 1];
    if (e.type === 'pointerup' && Math.abs(lastSample.y - startY) < 5 && e.timeStamp - first.t < 400) {
      const r = rings.getBoundingClientRect();
      goTo(shift + (e.clientY > r.top + r.height / 2 ? 1 : -1));
      return;
    }
    const dt = (lastSample.t - first.t) / 1000;
    const velocity = dt > 0 ? (first.y - lastSample.y) / faceHeight() / dt : 0;
    // A flick throws the rings on; let them settle on the nearest letter past where they'd stop.
    const resting = current() + Spring.project(velocity);
    goTo(Math.round(resting), { response: 0.5, damping: 0.82 }, velocity);
  }

  rings.addEventListener('pointerup', release);
  rings.addEventListener('pointercancel', release);

  // Steps from where the rings are heading, not where they are mid-turn,
  // so quick presses all count.
  rings.addEventListener('keydown', e => {
    const to = {
      ArrowUp: shift + 1, ArrowRight: shift + 1, ArrowDown: shift - 1, ArrowLeft: shift - 1,
      PageUp: shift + 5, PageDown: shift - 5,
      Home: shift - mod(shift, 26), End: shift - mod(shift, 26) + 25,
    }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    touched = true;
    goTo(to);
  });

  // ---- scrolling turns the rings on phones ------------------------------------

  // On a phone, scrolling is the gesture people are already making, so the
  // rings roll with the page: one letter for every SCROLL_STEP pixels.
  const SCROLL_STEP = 34;
  const narrow = window.matchMedia('(max-width: 960px)');
  const hint = document.querySelector('.cryptex-panel > p');
  const scrollSteps = () => Math.floor(window.scrollY / SCROLL_STEP);
  let anchor = { shift: 0, steps: 0 };

  function syncHint() {
    hint.textContent = narrow.matches && !still.matches
      ? 'A cryptex is a Caesar cipher you can hold. Scroll, or drag the rings: they turn together, so every letter shifts by the same amount.'
      : 'A cryptex is a Caesar cipher you can hold. Drag or flick the rings: they turn together, so every letter shifts by the same amount.';
  }

  window.addEventListener('scroll', () => {
    if (!narrow.matches || still.matches || dragging || !parts.length) return;
    // Only while the cryptex is on screen.
    if (rings.getBoundingClientRect().bottom < 0) return;
    const s = anchor.shift + (scrollSteps() - anchor.steps);
    if (s !== shift) goTo(s, { response: 0.3, damping: 1 }, 0, true);
  }, { passive: true });

  narrow.addEventListener('change', syncHint);
  syncHint();

  // ---- the word ---------------------------------------------------------------

  wordInput.addEventListener('input', () => {
    const clean = wordInput.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
    if (wordInput.value !== clean) wordInput.value = clean;
    if (!clean.length) return;
    touched = true;
    word = clean;
    shift = Math.round(current());
    anchor = { shift, steps: scrollSteps() };
    build(false);
  });

  build(!still.matches);
  animate();

  // Once the intro settles, turn three places on its own to show what the rings do.
  setTimeout(() => {
    if (!touched) goTo(3, { response: 0.9, damping: 1 });
  }, still.matches ? 0 : 3200);
})();
