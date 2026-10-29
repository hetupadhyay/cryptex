/*
 * The essay's year rail, which follows the reader down the page, and the
 * links that carry each cipher's sample over to the lab.
 */
(function () {
  'use strict';

  // Each cipher's entry is written out in learn.html. A plain click on its
  // lab link carries the sample over; a click meant for a new tab just
  // opens the lab.
  for (const link of document.querySelectorAll('.entry .link[data-cipher]')) {
    link.addEventListener('click', e => {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      Lab.open(link.dataset.cipher, { text: 'Attack at dawn', run: true });
    });
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
    // The last chapter used to be #today, a name the daily intercept now has.
    if (location.hash === '#today') history.replaceState(history.state, '', '#why-it-matters');
    let arrival = null;
    try {
      arrival = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    } catch {
      return;
    }
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
  railList.addEventListener('click', e => { if (Sheet.follow('chapters', e)) setOpen(false, { navigating: true }); });
  document.addEventListener('click', e => { if (!rail.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && rail.classList.contains('open')) {
      setOpen(false);
      nowBtn.focus();
    }
  });
})();
