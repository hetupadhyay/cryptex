/*
 * Sheets on phones: the menu, the lab's codebook and Learn's chapter list.
 * The back gesture closes an open sheet instead of leaving the page, and a
 * sheet with a grip can be dragged or flicked away.
 */
(function () {
  'use strict';

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

  // ---- back closes the sheet ------------------------------------------------------

  // Opening a sheet adds a history entry at the same address, so the back
  // gesture pops it and closes the sheet rather than leaving the page.
  const open = new Map();

  function opened(id, close) {
    if (open.has(id)) return;
    open.set(id, close);
    history.pushState({ ...(history.state || {}), sheet: id }, '');
  }

  // Closed from inside the page: take our entry back off. When the sheet
  // closed because a link in it was followed, the page is already moving
  // on, and stepping back would undo that.
  function closed(id, { navigating = false } = {}) {
    if (!open.delete(id)) return;
    if (!navigating && history.state && history.state.sheet === id) history.back();
  }

  window.addEventListener('popstate', () => {
    for (const [id, close] of open) {
      if (history.state && history.state.sheet === id) continue;
      open.delete(id);
      close();
    }
  });

  // ---- swipe to dismiss -------------------------------------------------------------

  // Drag the grip towards the edge the sheet came from. A short flick is
  // enough; a slow drag needs to cover a third of the sheet. Pulling the
  // other way gives a little, then stops, like a rubber band.
  function swipe(el, { grip, edge = 'bottom', close }) {
    if (!el || !grip) return;
    const sign = edge === 'bottom' ? 1 : -1;
    let drag = null;

    grip.addEventListener('pointerdown', e => {
      if (e.button !== 0 || drag) return;
      drag = { id: e.pointerId, y: e.clientY, dy: 0, trail: [{ y: e.clientY, t: e.timeStamp }] };
      grip.setPointerCapture(e.pointerId);
      el.style.transition = 'none';
    });

    grip.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const raw = (e.clientY - drag.y) * sign;
      drag.dy = raw >= 0 ? raw : -Math.sqrt(-raw) * 2;
      drag.trail.push({ y: e.clientY, t: e.timeStamp });
      if (drag.trail.length > 5) drag.trail.shift();
      el.style.transform = `translateY(${drag.dy * sign}px)`;
    });

    const release = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const { dy, trail } = drag;
      drag = null;
      el.style.transition = '';
      const a = trail[0];
      const b = trail[trail.length - 1];
      const speed = b.t > a.t ? ((b.y - a.y) * sign) / (b.t - a.t) : 0; // px per ms, towards the edge
      const from = `translateY(${dy * sign}px)`;
      el.style.transform = '';
      if (dy > el.offsetHeight / 3 || (speed > 0.5 && dy > 8)) {
        if (reduced()) return close();
        el.animate([{ transform: from }, { transform: `translateY(${sign * 100}%)` }], { duration: 220, easing: EASE_OUT })
          .finished.then(close, close);
      } else if (dy && !reduced()) {
        el.animate([{ transform: from }, { transform: 'none' }], { duration: 320, easing: EASE_OUT });
      }
    };
    grip.addEventListener('pointerup', release);
    grip.addEventListener('pointercancel', release);
  }

  window.Sheet = { opened, closed, swipe };
})();
