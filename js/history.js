/*
 * The timeline: every cipher in the order it entered history.
 */
(function () {
  'use strict';

  const CHAPTERS = [
    { id: 'atbash', year: 'c. 600 BC', place: 'Jerusalem', story: 'Scribes copying the Book of Jeremiah swapped the first letter of the Hebrew alphabet for the last, the second for the second-to-last, and so on.' },
    { id: 'polybius', year: 'c. 150 BC', place: 'Greece', story: 'The historian Polybius described turning each letter into two numbers, so a message could be signalled across a valley with torches.' },
    { id: 'caesar', year: 'c. 50 BC', place: 'Rome', story: 'Suetonius wrote that Julius Caesar moved every letter of his private letters three places along. Few people could read at all, so it was often enough.' },
    { id: 'vigenere', year: '1553', place: 'Venice', story: 'Giovan Battista Bellaso keyed a cipher with a word, giving each letter its own shift. Later credited to Vigenère, it held out for three centuries.' },
    { id: 'autokey', year: '1586', place: 'Paris', story: 'Blaise de Vigenère’s own design let the message become its own key, so there was no repeating pattern for an attacker to find.' },
    { id: 'affine', year: '1801', place: 'Göttingen', story: 'Once Gauss wrote down modular arithmetic, Caesar’s shift became one member of a family: multiply, add, and wrap around 26.' },
    { id: 'playfair', year: '1854', place: 'London', story: 'Charles Wheatstone invented it and Lord Playfair promoted it. It was quick enough for soldiers in the field and served into the First World War.' },
    { id: 'beaufort', year: '1857', place: 'London', story: 'Francis Beaufort, of the wind scale, left a Vigenère variant that subtracts instead of adds. It later ran inside the Hagelin M-209 machine.' },
    { id: 'railfence', year: '1860s', place: 'American Civil War', story: 'Telegraph operators used quick transpositions like the rail fence. Easy to do by hand, and just as easy for the other side to undo.' },
    { id: 'columnar', year: '1914', place: 'Western Front', story: 'Columnar transposition, often done twice, sat at the heart of German army ciphers in the First World War, including the famous ADFGVX.' },
  ];

  const list = document.querySelector('.timeline');
  const [prevBtn, nextBtn] = document.querySelectorAll('.timeline-nav .round-btn');

  for (const ch of CHAPTERS) {
    const c = Ciphers.byId(ch.id);
    const defaults = Object.fromEntries(c.keys.map(k => [k.id, k.value]));
    const sample = c.encrypt('ATTACK AT DAWN', defaults);

    const li = document.createElement('li');
    li.className = 'timeline-card';
    li.innerHTML = `
      <span class="tl-year"></span>
      <div><h3 class="tl-name"></h3><span class="tl-place"></span></div>
      <p class="tl-story"></p>
      <p class="tl-sample">ATTACK AT DAWN<br><b></b></p>
      <button type="button" class="btn glass-btn small tl-open">Watch it in the lab</button>`;
    li.querySelector('.tl-year').textContent = ch.year;
    li.querySelector('.tl-name').textContent = c.name;
    li.querySelector('.tl-place').textContent = ch.place;
    li.querySelector('.tl-story').textContent = ch.story;
    li.querySelector('.tl-sample b').textContent = sample;
    li.querySelector('.tl-open').addEventListener('click', () => {
      Lab.open(ch.id, { text: 'Attack at dawn', run: true });
    });
    list.append(li);
  }

  function updateNav() {
    prevBtn.disabled = list.scrollLeft < 8;
    nextBtn.disabled = list.scrollLeft + list.clientWidth > list.scrollWidth - 8;
  }

  [prevBtn, nextBtn].forEach(btn => btn.addEventListener('click', () => {
    const card = list.querySelector('.timeline-card');
    const step = card.offsetWidth + 16;
    list.scrollBy({ left: Number(btn.dataset.dir) * step * 2, behavior: Stage.reduced ? 'auto' : 'smooth' });
  }));
  list.addEventListener('scroll', updateNav, { passive: true });
  window.addEventListener('resize', updateNav);
  updateNav();
})();
