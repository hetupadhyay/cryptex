/*
 * Home. The site used to be one long page, so links into its sections, and
 * secret links, still arrive here; send each one to where it lives now.
 * Otherwise fill in today's intercept and the three ways in.
 */
(function () {
  'use strict';

  const MOVED = {
    history: '/learn',
    unbreakable: '/learn#enigma',
    strength: '/learn#strength',
    today: '/learn#why-it-matters',
    lab: '/lab',
    share: '/lab#share',
    desk: '/codebreaking#desk',
    daily: '/codebreaking#today',
    intercepts: '/codebreaking#missions',
  };

  // Only the table's own keys: #constructor isn't a section.
  function movedTo(hash) {
    if (hash.startsWith('#secret=')) return '/lab' + hash;
    const key = hash.slice(1);
    return Object.hasOwn(MOVED, key) ? MOVED[key] : '';
  }

  const target = movedTo(location.hash);
  if (target) {
    location.replace(target);
    return;
  }
  // An old link followed while already on this page.
  window.addEventListener('hashchange', () => {
    const to = movedTo(location.hash);
    if (to) location.replace(to);
  });

  const $ = (sel, el = document) => el.querySelector(sel);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  // ---- saved progress -----------------------------------------------------------

  // shortcut: the mission ids mirror js/intercepts.js, keep the two in step.
  const MISSIONS = ['rhine', 'scribe', 'alesia', 'richmond', 'gottingen', 'chartley', 'wheatstone', 'front'];

  // Storage can hold anything, so only ids of real missions count.
  function loadCracked() {
    try {
      const saved = JSON.parse(localStorage.getItem('cryptex-cracked') || '[]');
      return new Set(Array.isArray(saved) ? saved.filter(id => MISSIONS.includes(id)) : []);
    } catch {
      return new Set();
    }
  }

  // The days the daily intercept was cracked, { 'YYYY-MM-DD': hints used },
  // kept to entries of the shape js/daily.js saves.
  function loadDays() {
    const days = {};
    try {
      const saved = JSON.parse(localStorage.getItem('cryptex-daily'));
      if (saved && saved.days && typeof saved.days === 'object' && !Array.isArray(saved.days)) {
        for (const [day, hints] of Object.entries(saved.days)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isInteger(hints) && hints >= 0) days[day] = hints;
        }
      }
    } catch {}
    return days;
  }

  const days = loadDays();
  const today = () => (window.Daily ? Daily.dateKey(new Date()) : '');
  const streak = () => (window.Daily ? Daily.streak(days, today()) : 0);

  // ---- today's intercept --------------------------------------------------------

  // The strip stays hidden unless the puzzle can be built. The countdown
  // ticks in site.js; the strip only redraws when the date turns over.
  const strip = $('.today-strip');
  let shown = '';

  function showToday() {
    const key = today();
    if (!key || key === shown) return;
    let puzzle;
    try {
      puzzle = Daily.puzzleFor(key);
    } catch {
      strip.hidden = true;
      return;
    }
    shown = key;
    $('.strip-no', strip).textContent = `No. ${puzzle.number}`;
    $('.strip-place', strip).textContent = puzzle.place;
    $('.strip-brief', strip).textContent = puzzle.brief;
    $('.strip-date', strip).textContent = puzzle.title;
    $('.strip-level', strip).textContent = puzzle.level;
    $('.strip-text', strip).textContent = puzzle.text;

    const pips = $('.strip-pips', strip);
    pips.setAttribute('role', 'img');
    pips.setAttribute('aria-label', `${puzzle.tier} of ${Daily.LEVELS.length}`);
    pips.replaceChildren(...Daily.LEVELS.map((_, i) => {
      const pip = document.createElement('i');
      if (i < puzzle.tier) pip.className = 'on';
      return pip;
    }));

    const run = streak();
    const streakEl = $('.strip-streak', strip);
    streakEl.hidden = run === 0;
    $('b', streakEl).textContent = plural(run, 'day');

    const solved = key in days;
    $('.strip-solved', strip).hidden = !solved;
    $('.strip-go .btn', strip).textContent = solved ? 'Look again' : 'Start';
  }

  if (strip) {
    showToday();
    setInterval(showToday, 30000);
  }

  // ---- the lab door: one cipher at work ---------------------------------------------

  const line = $('.lab-line');
  const caesar = Ciphers.byId('caesar');
  const lineIn = $('#lab-line-in');
  const lineOut = $('.lab-line-out');
  const shiftOut = $('#lab-line-shift');
  let lineShift = 3;

  function encryptLine() {
    shiftOut.textContent = lineShift;
    lineOut.textContent = caesar.encrypt(lineIn.value, { shift: lineShift }).toUpperCase() || ' ';
  }

  line.addEventListener('click', e => {
    const btn = e.target.closest('[data-step]');
    if (!btn) return;
    // Shifts run 1 to 25; 0 and 26 would leave the message as it is.
    lineShift = ((lineShift - 1 + Number(btn.dataset.step) + 25) % 25) + 1;
    encryptLine();
  });
  lineIn.addEventListener('input', encryptLine);
  encryptLine();

  // The lab picks up the same line and key, and plays it through.
  $('.lab-line-open').addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    Lab.open('caesar', { text: lineIn.value.trim() || 'Attack at dawn', keys: { shift: lineShift }, run: true });
  });

  // ---- the codebreaking door: how far the reader has got ----------------------------

  const door = $('.door-break');
  const cracked = loadCracked();
  const run = streak();
  const n = cracked.size;

  $('.break-n', door).textContent = n;
  // The tally marks missions in order, the way the missions page lists them.
  door.querySelectorAll('.break-tally li').forEach((li, i) => li.classList.toggle('on', cracked.has(MISSIONS[i])));

  // With nothing cracked the door stays an invitation, as written in the page.
  const go = $('.break-go', door);
  const note = $('.break-note', door);
  if (n === MISSIONS.length) {
    note.textContent = 'Every mission is cracked. The desk takes any ciphertext you bring it.';
    go.textContent = 'Go to the desk';
    go.href = '/codebreaking#desk';
  } else if (n) {
    note.textContent = `${MISSIONS.length - n} still to crack.`;
    go.textContent = 'Carry on with the missions';
  }

  const streakEl = $('.break-streak', door);
  streakEl.hidden = run === 0;
  $('b', streakEl).textContent = plural(run, 'day');
})();
