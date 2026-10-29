/*
 * The essay: every cipher from the lab in the order it entered history,
 * and the year rail beside it that follows the reader down the page.
 */
(function () {
  'use strict';

  // Grouped as the essay's chapters. Enigma and the one-time pad aren't in
  // the lab, so their chapters are written out in learn.html.
  const CHAPTERS = [
    { id: 'atbash', group: 'ancient', year: 'c. 600 BC', place: 'Jerusalem', story: 'Scribes copying the Book of Jeremiah swapped the first letter of the Hebrew alphabet for the last, the second for the second-to-last, and so on.' },
    { id: 'polybius', group: 'ancient', year: 'c. 150 BC', place: 'Greece', story: 'The historian Polybius described turning each letter into two numbers, so a message could be signalled across a valley with torches.' },
    { id: 'caesar', group: 'ancient', year: 'c. 50 BC', place: 'Rome', story: 'Suetonius wrote that Julius Caesar moved every letter of his private letters three places along. Few people could read at all, so it was often enough.' },
    { id: 'vigenere', group: 'alphabets', year: '1553', place: 'Venice', story: 'Giovan Battista Bellaso keyed a cipher with a word, giving each letter its own shift. Later credited to Vigenère, it held out for three centuries.' },
    { id: 'autokey', group: 'alphabets', year: '1586', place: 'Paris', story: 'Blaise de Vigenère’s own design let the message become its own key, so there was no repeating pattern for an attacker to find.' },
    { id: 'affine', group: 'alphabets', year: '1801', place: 'Göttingen', story: 'Once Gauss wrote down modular arithmetic, Caesar’s shift became one member of a family: multiply, add, and wrap around 26.' },
    { id: 'playfair', group: 'alphabets', year: '1854', place: 'London', story: 'Charles Wheatstone invented it and Lord Playfair promoted it. It was quick enough for soldiers in the field and served into the First World War.' },
    { id: 'beaufort', group: 'alphabets', year: '1857', place: 'London', story: 'Francis Beaufort, of the wind scale, left a Vigenère variant that subtracts instead of adds. It later ran inside the Hagelin M-209 machine.' },
    { id: 'railfence', group: 'transposition', year: '1860s', place: 'American Civil War', story: 'Telegraph operators used quick transpositions like the rail fence. Easy to do by hand, and just as easy for the other side to undo.' },
    { id: 'columnar', group: 'transposition', year: '1914', place: 'Western Front', story: 'Columnar transposition, often done twice, sat at the heart of German army ciphers in the First World War, including the famous ADFGVX.' },
  ];

  for (const ch of CHAPTERS) {
    const c = Ciphers.byId(ch.id);
    const defaults = Object.fromEntries(c.keys.map(k => [k.id, k.value]));

    const entry = document.createElement('article');
    entry.className = 'entry';
    entry.id = ch.id;
    entry.dataset.year = ch.year;
    entry.setAttribute('aria-labelledby', `${ch.id}-title`);
    entry.innerHTML = `
      <h3></h3>
      <p class="dateline"><span class="year"></span> <span class="place"></span></p>
      <p></p>
      <p class="sample"><span>ATTACK AT DAWN</span> <b></b></p>
      <a class="link" href="/lab">Try it in the lab</a>`;
    const title = entry.querySelector('h3');
    title.id = `${ch.id}-title`;
    title.textContent = c.name;
    entry.querySelector('.year').textContent = ch.year;
    entry.querySelector('.place').textContent = ch.place;
    entry.querySelector('p:not([class])').textContent = ch.story;
    entry.querySelector('.sample b').textContent = c.encrypt('ATTACK AT DAWN', defaults);

    // A plain click carries the sample over to the lab; a click meant for a
    // new tab just opens the lab.
    entry.querySelector('.link').addEventListener('click', e => {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      Lab.open(ch.id, { text: 'Attack at dawn', run: true });
    });
    document.querySelector(`.entries[data-group="${ch.group}"]`).append(entry);
  }

  // ---- the year rail -------------------------------------------------------------

  // One link per chapter, or per cipher inside a chapter of ciphers. Each
  // mark counts as being read from the top of `from`: a chapter's first
  // cipher starts with the chapter's own introduction.
  const rail = document.querySelector('.rail');
  const railList = rail.querySelector('.rail-list');
  const nowBtn = rail.querySelector('.rail-now');
  const marks = [];

  function railLink(target, year, name) {
    const a = document.createElement('a');
    a.href = `#${target.id}`;
    a.innerHTML = '<span class="rail-year"></span><span class="rail-name"></span>';
    a.querySelector('.rail-year').textContent = year;
    a.querySelector('.rail-name').textContent = name;
    return a;
  }

  for (const chapter of document.querySelectorAll('.chapter')) {
    const title = chapter.dataset.rail || chapter.querySelector('h2').textContent;
    const entries = [...chapter.querySelectorAll('.entry')];
    const li = document.createElement('li');
    if (!entries.length) {
      const a = railLink(chapter, chapter.dataset.year, title);
      marks.push({ a, from: chapter, year: chapter.dataset.year, name: title });
      li.append(a);
    } else {
      li.className = 'rail-part';
      const part = document.createElement('a');
      part.className = 'rail-part-name';
      part.href = `#${chapter.id}`;
      part.textContent = title;
      const ol = document.createElement('ol');
      entries.forEach((entry, i) => {
        const name = entry.querySelector('h3').textContent;
        const item = document.createElement('li');
        const a = railLink(entry, entry.dataset.year, name);
        marks.push({ a, from: i === 0 ? chapter : entry, year: entry.dataset.year, name });
        item.append(a);
        ol.append(item);
      });
      li.append(part, ol);
    }
    railList.append(li);
  }

  // The chapter being read is the last one whose top has passed a line a
  // third of the way down the window. At the very bottom it's the last one.
  let current = null;
  let frame = 0;
  function follow() {
    frame = 0;
    const line = window.innerHeight * 0.33;
    let mark = marks[0];
    for (const m of marks) {
      if (m.from.getBoundingClientRect().top <= line) mark = m;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) mark = marks.at(-1);
    if (mark === current) return;
    current?.a.removeAttribute('aria-current');
    mark.a.setAttribute('aria-current', 'location');
    nowBtn.querySelector('.rail-now-year').textContent = mark.year;
    nowBtn.querySelector('.rail-now-name').textContent = mark.name;
    current = mark;
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(follow); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  follow();

  // Arriving from a link to a chapter goes straight there instead of
  // smooth-scrolling through the whole essay. It waits for the figures
  // further down to be built, since they change where the chapter sits.
  const html = document.documentElement;
  document.addEventListener('DOMContentLoaded', () => {
    const arrival = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!arrival) return;
    html.style.scrollBehavior = 'auto';
    arrival.scrollIntoView();
    window.addEventListener('load', () => requestAnimationFrame(() => { html.style.scrollBehavior = ''; }), { once: true });
  });

  // On narrow screens the rail folds into a bar that names the current
  // chapter and opens the full list.
  function setOpen(open, { navigating = false } = {}) {
    if (open === rail.classList.contains('open')) return;
    nowBtn.setAttribute('aria-expanded', open);
    rail.classList.toggle('open', open);
    if (open) Sheet.opened('chapters', () => setOpen(false));
    else Sheet.closed('chapters', { navigating });
  }
  nowBtn.addEventListener('click', () => setOpen(!rail.classList.contains('open')));
  railList.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false, { navigating: true }); });
  document.addEventListener('click', e => { if (!rail.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && rail.classList.contains('open')) {
      setOpen(false);
      nowBtn.focus();
    }
  });
})();
