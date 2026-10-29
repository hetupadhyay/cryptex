/*
 * The stage: plays a scene one step at a time.
 *
 * A scene is { steps: [{ caption, hold }], show(index, animate) }.
 * show() must be able to draw any step from scratch, which is what makes
 * stepping backwards and scrubbing work. When `animate` is true it also plays
 * the motion that leads into that step.
 */
(function () {
  'use strict';

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const Stage = {
    speed: 1,
    get reduced() { return motionQuery.matches; },
    ms(n) { return n / Stage.speed; },
  };

  const EASE_MOVE = 'cubic-bezier(0.77, 0, 0.175, 1)';
  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // A row of letter cells. Each unit is one cell; ' ' becomes a word gap.
  function tape(units, { label, cls } = {}) {
    const root = el('div', 'tape' + (cls ? ' ' + cls : ''));
    if (label) root.append(el('span', 'tape-label', label));
    const row = el('div', 'tape-row');
    // Cells are grouped into words so a line never breaks mid-word.
    let word = null;
    const cells = units.map(u => {
      const cell = el('span', u === ' ' ? 'cell gap' : 'cell', u === ' ' ? '' : u);
      if (u === ' ') {
        row.append(cell);
        word = null;
      } else {
        if (!word) word = row.appendChild(el('span', 'word'));
        word.append(cell);
      }
      return cell;
    });
    root.append(row);
    return { root, row, cells };
  }

  // Timers and flying letters for the current step, so they can all be
  // cancelled when the user jumps somewhere else.
  function cueSheet() {
    let timers = [];
    let ghosts = [];

    return {
      at(delay, fn) {
        timers.push(setTimeout(fn, Stage.ms(delay)));
      },

      // Sends a copy of `text` from one element to another, then calls done.
      fly(from, to, text, { duration = 560, delay = 0, done, cls = '' } = {}) {
        const land = () => done && done();
        if (Stage.reduced || !from || !to) {
          this.at(delay, land);
          return;
        }
        this.at(delay, () => {
          const a = from.getBoundingClientRect();
          const b = to.getBoundingClientRect();
          if (!a.width || !b.width) return land();

          const ghost = el('span', 'ghost ' + cls, text);
          Object.assign(ghost.style, {
            left: a.left + 'px',
            top: a.top + 'px',
            width: a.width + 'px',
            height: a.height + 'px',
            fontSize: getComputedStyle(from).fontSize,
          });
          document.body.append(ghost);
          ghosts.push(ghost);

          const dx = b.left + b.width / 2 - (a.left + a.width / 2);
          const dy = b.top + b.height / 2 - (a.top + a.height / 2);
          const scale = b.height / a.height;
          // A slight lift in the middle of the trip reads as "picked up and set down".
          const flight = ghost.animate(
            [
              { transform: 'translate(0, 0) scale(1)', opacity: 0.4 },
              { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 14}px) scale(${(1 + scale) / 2 + 0.12})`, opacity: 1, offset: 0.5 },
              { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1 },
            ],
            { duration: Stage.ms(duration), easing: EASE_MOVE, fill: 'forwards' }
          );
          flight.finished.then(() => {
            ghost.remove();
            land();
          }, () => ghost.remove());
        });
      },

      clear() {
        timers.forEach(clearTimeout);
        ghosts.forEach(g => g.remove());
        timers = [];
        ghosts = [];
      },
    };
  }

  // Turns a list of elements on with a small stagger.
  function stagger(cue, nodes, cls, { gap = 40, delay = 0 } = {}) {
    nodes.forEach((node, i) => cue.at(delay + i * gap, () => node.classList.add(cls)));
  }

  // Lets show() set the final state of a step without any transitions.
  function instantly(mount, fn) {
    mount.classList.add('instant');
    fn();
    void mount.offsetWidth;
    mount.classList.remove('instant');
  }

  function Player(root, { onFinish } = {}) {
    const mount = root.querySelector('.scene');
    const caption = root.querySelector('.caption');
    const counter = root.querySelector('.step-count');
    const scrub = root.querySelector('.scrub');
    const playBtn = root.querySelector('[data-act="play"]');
    const cue = cueSheet();

    let scene = null;
    let index = -1;
    let playing = false;
    let timer = null;

    function setCaption(text) {
      if (caption.textContent === text) return;
      caption.textContent = text;
      if (!Stage.reduced) {
        caption.animate(
          [{ opacity: 0, filter: 'blur(3px)', transform: 'translateY(4px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }],
          { duration: 260, easing: EASE_OUT }
        );
      }
    }

    function render(i, animate) {
      cue.clear();
      index = Math.max(0, Math.min(i, scene.steps.length - 1));
      const step = scene.steps[index];
      if (animate && !Stage.reduced) scene.show(index, true);
      else instantly(mount, () => scene.show(index, false));
      setCaption(step.caption);
      counter.textContent = `${index + 1} / ${scene.steps.length}`;
      scrub.value = index;
      root.classList.toggle('at-end', index === scene.steps.length - 1);
      if (index === scene.steps.length - 1) {
        setPlaying(false);
        if (onFinish) onFinish();
      }
    }

    function setPlaying(on) {
      playing = on;
      clearTimeout(timer);
      playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
      playBtn.dataset.state = on ? 'playing' : 'paused';
      if (on) schedule();
    }

    function schedule() {
      const step = scene.steps[index];
      timer = setTimeout(() => {
        if (!playing) return;
        render(index + 1, true);
        if (playing) schedule();
      }, Stage.ms(step.hold || 1500));
    }

    const api = {
      load(next, { autoplay = true } = {}) {
        setPlaying(false);
        cue.clear();
        scene = next;
        scrub.max = scene.steps.length - 1;
        root.classList.remove('empty');
        render(0, true);
        if (autoplay) setPlaying(true);
      },
      play() {
        if (!scene) return;
        if (index >= scene.steps.length - 1) render(0, true);
        setPlaying(true);
      },
      pause: () => setPlaying(false),
      toggle() { playing ? api.pause() : api.play(); },
      next() { if (scene) { setPlaying(false); render(index + 1, true); } },
      prev() { if (scene) { setPlaying(false); render(index - 1, false); } },
      end() { if (scene) { setPlaying(false); render(scene.steps.length - 1, false); } },
      seek(i) { if (scene) { setPlaying(false); render(i, false); } },
      reset() {
        setPlaying(false);
        cue.clear();
        scene = null;
        index = -1;
        root.classList.add('empty');
        root.classList.remove('at-end');
      },
      get cue() { return cue; },
    };

    root.querySelector('[data-act="play"]').addEventListener('click', api.toggle);
    root.querySelector('[data-act="prev"]').addEventListener('click', api.prev);
    root.querySelector('[data-act="next"]').addEventListener('click', api.next);
    root.querySelector('[data-act="end"]').addEventListener('click', api.end);
    scrub.addEventListener('input', () => api.seek(Number(scrub.value)));

    return api;
  }

  window.Stage = Object.assign(Stage, { el, tape, stagger, Player, EASE_MOVE, EASE_OUT });
  window.Scenes = {};
})();
