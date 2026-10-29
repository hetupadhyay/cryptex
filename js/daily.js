/*
 * Daily intercept: one new message a day, the same for everyone on the same
 * date. Monday is gentle and the week gets harder towards the weekend.
 *
 * The top half turns a date into a puzzle and needs nothing but Ciphers,
 * so the tests can run it in Node. The page part only runs in the browser.
 */
(function (root) {
  'use strict';

  const Ciphers = root.Ciphers || require('./ciphers.js');
  const { lettersOnly, mod } = Ciphers;

  // No. 1 went out on this day. Everything after counts up from it.
  const EPOCH = '2026-06-24';
  const DAY = 86400000;
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const MESSAGES = [
    { place: 'Carthage, 149 BC', plain: 'The walls will hold for a month. Send grain by the southern harbour.' },
    { place: 'Rome, 44 BC', plain: 'Do not attend the senate tomorrow. Friends of the dictator are being watched.' },
    { place: 'Hadrian’s Wall, AD 130', plain: 'Smoke seen beyond the northern ditch. Double the watch at the west gate.' },
    { place: 'Constantinople, 1453', plain: 'The chain across the harbour holds, so they are dragging their ships over the hill.' },
    { place: 'Florence, 1478', plain: 'Mass on Sunday is not safe. Tell the brothers to stay away from the cathedral.' },
    { place: 'Venice, 1510', plain: 'The ambassador lies about the treaty. Watch who he dines with on Friday.' },
    { place: 'Paris, 1572', plain: 'Leave the city before the bells ring. Trust no one wearing a white cross.' },
    { place: 'Chartley, 1586', plain: 'The letters in the beer barrels are being copied before they arrive.' },
    { place: 'Plymouth, 1588', plain: 'Sails sighted off the Lizard at dawn. Light the beacons along the coast.' },
    { place: 'Amsterdam, 1665', plain: 'The fleet sails on the morning tide. Our man in the dockyard has been paid.' },
    { place: 'Boston, 1775', plain: 'The regulars march tonight by water. Ride out and warn every farmhouse.' },
    { place: 'Philadelphia, 1777', plain: 'Howe is landing at the head of the bay. Move the printing press inland.' },
    { place: 'Versailles, 1789', plain: 'The king will not sign. Move the papers to the house on the left bank.' },
    { place: 'Toulon, 1793', plain: 'The young artillery captain has found the weak fort. Expect fire by morning.' },
    { place: 'Cadiz, 1805', plain: 'The combined fleet leaves harbour at first light. Signal the frigates.' },
    { place: 'Vienna, 1805', plain: 'The bridge over the Danube was taken without a shot. Recall the couriers.' },
    { place: 'Moscow, 1812', plain: 'The city is empty and the fires have started. Nobody has come to surrender it.' },
    { place: 'Waterloo, 1815', plain: 'Hold the farmhouse at all costs. The Prussians are coming from the east.' },
    { place: 'Edinburgh, 1828', plain: 'The body snatchers work the east kirkyard on Tuesdays. Post a guard.' },
    { place: 'Sebastopol, 1854', plain: 'The heavy guns are short of powder. Hold the redoubt until relief arrives.' },
    { place: 'Calcutta, 1857', plain: 'The telegraph line to Delhi is down. Send riders with copies of this order.' },
    { place: 'Richmond, 1862', plain: 'Federal balloons over the river again. Keep the campfires small tonight.' },
    { place: 'Vicksburg, 1863', plain: 'Rations are down to half. Listen for digging under the redan.' },
    { place: 'Washington, 1864', plain: 'The courier on the Baltimore train carries two sets of papers. Check his boots.' },
    { place: 'Paris, 1870', plain: 'This letter leaves by balloon. If the wind turns, it will land behind their lines.' },
    { place: 'Dawson, 1898', plain: 'The claim on the north creek is real. Buy every mule in town before Friday.' },
    { place: 'Pretoria, 1899', plain: 'A prisoner went over the wall last night. Watch the trains to the coast.' },
    { place: 'St Petersburg, 1905', plain: 'The printing press is under the floor of the bakery. Move it before Sunday.' },
    { place: 'Antarctica, 1912', plain: 'Depot reached at last. Weather fierce and fuel short, but spirits good.' },
    { place: 'Sarajevo, 1914', plain: 'The motorcade route has changed. Our people on the quay do not know.' },
    { place: 'Mons, 1914', plain: 'Fall back from the canal by nightfall. Blow the bridges behind the rearguard.' },
    { place: 'Gallipoli, 1915', plain: 'Leave the beach in silence. Rig the rifles to keep firing on their own.' },
    { place: 'Verdun, 1916', plain: 'The fort is cut off. Pigeons are our only link now, and we have one left.' },
    { place: 'Zurich, 1916', plain: 'The exile in the little room upstairs keeps asking about trains to the east.' },
    { place: 'London, 1917', plain: 'The telegram to Mexico has been read. Tell no one how we came by it.' },
    { place: 'Petrograd, 1917', plain: 'The cruiser will fire one blank shot at nine. That is the signal.' },
    { place: 'Western Front, 1918', plain: 'The armistice is signed. Cease fire at eleven and not one minute before.' },
    { place: 'Chicago, 1925', plain: 'The shipment comes in under the fish. Pay the dock foreman and nobody else.' },
    { place: 'Bombay, 1930', plain: 'The march reaches the sea on Saturday. Have the salt pans watched.' },
    { place: 'Berlin, 1936', plain: 'The engineer at the radio plant wants out. He will bring the drawings.' },
    { place: 'Madrid, 1937', plain: 'The bridge is mined. Wait for the third train, not the second.' },
    { place: 'Shanghai, 1937', plain: 'Burn the codebooks. The consulate closes at noon and the boats leave at one.' },
    { place: 'Bletchley, 1940', plain: 'The weather report reads the same every morning. Use it as a crib.' },
    { place: 'Dover, 1940', plain: 'Every boat that can float is needed across the channel. Sail tonight.' },
    { place: 'Lisbon, 1941', plain: 'Our man at the casino has a new passport. Meet him at the tram stop.' },
    { place: 'Cairo, 1942', plain: 'The novel on the shelf is the key book. The page number changes each day.' },
    { place: 'Pearl Harbor, 1942', plain: 'Report that the island is short of fresh water, in the clear, and see who repeats it.' },
    { place: 'Marrakesh, 1943', plain: 'The general arrives by car, not plane. Clear the road from the airfield.' },
    { place: 'Stockholm, 1943', plain: 'The ball bearings leave on the Thursday boat. Our man is in the crew.' },
    { place: 'Telemark, 1943', plain: 'The heavy water plant can be reached by the gorge. Go in on skis.' },
    { place: 'Normandy, 1944', plain: 'The second line of the poem has been broadcast. Cut the rail lines tonight.' },
    { place: 'Arnhem, 1944', plain: 'The bridge is ours but the radios are dead. Tell them we need armour.' },
    { place: 'Warsaw, 1944', plain: 'The sewers under the old town are passable. Move the wounded at midnight.' },
    { place: 'Geneva, 1944', plain: 'Bring the microfilm inside the hollow coin. The usual cafe at noon.' },
    { place: 'Berlin, 1948', plain: 'The planes land every three minutes. Coal tonight, flour tomorrow.' },
    { place: 'Vienna, 1949', plain: 'The tunnel under the street reaches their cables. Start recording at dawn.' },
    { place: 'Tangier, 1952', plain: 'The gold leaves on the night boat. The captain thinks it is cigarettes.' },
    { place: 'Monte Carlo, 1955', plain: 'The countess wins too often at the green table. Find out who deals.' },
    { place: 'Istanbul, 1958', plain: 'The ferry to the Asian side is watched. Take the fishing boat instead.' },
    { place: 'East Berlin, 1961', plain: 'The wire goes up tonight. If you mean to cross, it has to be now.' },
    { place: 'Havana, 1962', plain: 'The long crates at the port are not tractors. Photograph them from the hill.' },
    { place: 'Moscow, 1962', plain: 'The colonel will leave a chalk mark on the lamp post. Check it every Sunday.' },
    { place: 'Prague, 1968', plain: 'The tanks crossed the border at midnight. Keep the radio station on the air.' },
    { place: 'Rosslyn, 1973', plain: 'Meet in the parking garage at two. Come alone and do not take a taxi.' },
    { place: 'Helsinki, 1975', plain: 'The delegation brought a second interpreter. He is not who he says.' },
    { place: 'Moscow, 1985', plain: 'The dead drop under the bridge is blown. Use the church on Thursday.' },
    { place: 'Berlin, 1989', plain: 'The guards have opened the gate. Tell the office to hold the front page.' },
  ];

  // Keywords come with a clue, so the second hint can point at them
  // without spelling them out.
  const WORDS = {
    short: [
      { word: 'CROWN', clue: 'what a monarch wears' },
      { word: 'RAVEN', clue: 'a black bird that guards the Tower of London' },
      { word: 'ANCHOR', clue: 'what keeps a ship from drifting' },
      { word: 'CANDLE', clue: 'what people read by before electric light' },
      { word: 'BRIDGE', clue: 'the way across a river' },
      { word: 'TIGER', clue: 'the largest striped cat' },
      { word: 'SHADOW', clue: 'what follows you on a sunny day' },
      { word: 'WINTER', clue: 'the coldest season' },
      { word: 'HONEY', clue: 'what bees make' },
      { word: 'MIRROR', clue: 'what shows you your own face' },
      { word: 'KNIGHT', clue: 'the chess piece that jumps' },
      { word: 'PIANO', clue: 'an instrument with 88 keys' },
      { word: 'CLOCK', clue: 'something with hands but no arms' },
      { word: 'SILVER', clue: 'the medal for second place' },
    ],
    long: [
      { word: 'LIGHTHOUSE', clue: 'what warns ships off the rocks' },
      { word: 'TELESCOPE', clue: 'what astronomers look through' },
      { word: 'SUBMARINE', clue: 'a boat that travels underwater' },
      { word: 'HURRICANE', clue: 'a storm big enough to be given a name' },
      { word: 'LABYRINTH', clue: 'the maze with a monster at its heart' },
      { word: 'WATERLOO', clue: 'the battle that ended an emperor' },
      { word: 'CROSSROADS', clue: 'the place where two roads meet' },
      { word: 'NIGHTFALL', clue: 'the moment the day ends' },
      { word: 'TYPEWRITER', clue: 'a machine with keys and an inked ribbon' },
      { word: 'PARACHUTE', clue: 'what brings a jumper down gently' },
    ],
    columnar: [
      { word: 'ZEBRA', clue: 'a horse in stripes' },
      { word: 'GARDEN', clue: 'where flowers grow' },
      { word: 'PLANET', clue: 'what Mars and Venus are' },
      { word: 'MARKET', clue: 'where stalls sell food' },
      { word: 'WINDOW', clue: 'a pane of glass in a wall' },
      { word: 'FOREST', clue: 'a great many trees' },
      { word: 'BISHOP', clue: 'the chess piece that moves on diagonals' },
      { word: 'CANYON', clue: 'a deep valley cut by a river' },
      { word: 'LANTERN', clue: 'a light you can carry' },
    ],
    playfair: [
      { word: 'MONARCHY', clue: 'rule by a king or queen' },
      { word: 'WHEATSTONE', clue: 'the surname of the man who invented this cipher' },
      { word: 'TELEGRAPH', clue: 'the wires that carried messages before telephones' },
      { word: 'KINGDOM', clue: 'a country ruled by a king' },
      { word: 'HARVEST', clue: 'bringing the crops in' },
      { word: 'CHAMPION', clue: 'the winner of a contest' },
    ],
  };

  const pick = (rand, list) => list[Math.floor(rand() * list.length)];
  const keywordHint = w => `The keyword has ${w.word.length} letters. Think of ${w.clue}.`;

  // One recipe per kind of puzzle: which cipher, how to pick its key, and
  // three hints that go from a nudge to very nearly the answer.
  const RECIPES = {
    caesar: {
      cipher: 'caesar',
      briefs: ['Every letter seems to have slid the same distance along the alphabet.', 'Whoever sent this trusted the oldest trick in the book.'],
      make(rand) {
        const shift = 1 + Math.floor(rand() * 25);
        return {
          keys: { shift },
          hints: ['There are only 25 possible shifts, so there’s no need to guess.', 'Send it to the desk and use “Try every shift”.', `The shift is ${shift}.`],
        };
      },
    },
    atbash: {
      cipher: 'atbash',
      briefs: ['No key was found on the courier, and none was needed.', 'The clerk who wrote this knew one trick, and it doesn’t need a key.'],
      make() {
        return {
          keys: {},
          hints: ['No key means the method is the whole secret.', 'Fold the alphabet in half: A swaps with Z, B with Y.', 'It’s Atbash. Open it in the lab and decrypt.'],
        };
      },
    },
    affine: {
      cipher: 'affine',
      briefs: ['Scribbled in the margin: “multiply, then add”.', 'One fixed alphabet, but not a simple shift. Someone did some arithmetic.'],
      make(rand) {
        const a = pick(rand, [3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25]);
        const b = Math.floor(rand() * 26);
        return {
          keys: { a, b },
          hints: ['It’s still one fixed alphabet, so letter counts work. The most common letter is probably E.', `It’s an affine cipher with a multiplier of ${a}.`, `a = ${a} and b = ${b}. Decrypt it in the lab.`],
        };
      },
    },
    railfence: {
      cipher: 'railfence',
      grouped: true,
      briefs: ['The letters look oddly familiar for a cipher.', 'Copied off the wire in a hurry. Every letter of the original is still here somewhere.'],
      make(rand, tier) {
        const rails = tier < 3 ? 2 + Math.floor(rand() * 2) : 3 + Math.floor(rand() * 3);
        return {
          keys: { rails },
          hints: ['Count the letters at the desk. If they already look like English, nothing was replaced.', 'Only the order changed, written out in a zig-zag. Try a rail fence.', `${rails} rails. Decrypt it in the lab.`],
        };
      },
    },
    vigenere: {
      cipher: 'vigenere',
      briefs: ['The same letter comes out differently from one place to the next. The sender keys everything with ordinary words.', 'Several alphabets at once, picked out by a keyword. Nobody at this station ever chose a hard one.'],
      make(rand) {
        const w = pick(rand, WORDS.short);
        return {
          keys: { key: w.word },
          hints: ['It’s Vigenère, keyed with an ordinary word.', keywordHint(w), `The keyword is ${w.word}.`],
        };
      },
    },
    vigenereLong: {
      cipher: 'vigenere',
      briefs: ['A short message behind a long keyword. Counting letters won’t get far on this one.', 'A long keyword over a short message. The desk alone won’t crack it.'],
      make(rand) {
        const w = pick(rand, WORDS.long);
        return {
          keys: { key: w.word },
          hints: ['Several alphabets at once: it’s Vigenère, and the message is too short for the desk to find the key.', keywordHint(w), `The keyword is ${w.word}.`],
        };
      },
    },
    columnar: {
      cipher: 'columnar',
      grouped: true,
      briefs: ['All the right letters in all the wrong places. Someone wrote this out in rows first.', 'Nothing has been replaced, but the order has been through a grid.'],
      make(rand) {
        const w = pick(rand, WORDS.columnar);
        return {
          keys: { key: w.word },
          hints: ['The letter counts look like English, so it’s a transposition, but not a zig-zag. Try columnar.', keywordHint(w), `The keyword is ${w.word}. Decrypt it in the lab.`],
        };
      },
    },
    playfair: {
      cipher: 'playfair',
      grouped: true,
      briefs: ['Sent in pairs, and no pair is ever a doubled letter.', 'An even number of letters, and the counts look like nothing in particular.'],
      make(rand) {
        const w = pick(rand, WORDS.playfair);
        return {
          keys: { key: w.word },
          hints: ['Pairs of letters, never doubled, and no J anywhere: that’s Playfair.', keywordHint(w), `The keyword is ${w.word}. Decrypt it in the lab and ignore any padding Xs.`],
        };
      },
    },
  };

  // Difficulty by weekday, Sunday first to match Date#getDay.
  const LEVELS = [
    { name: 'Easy', kinds: ['caesar', 'atbash'] },
    { name: 'Fair', kinds: ['affine', 'railfence'] },
    { name: 'Tricky', kinds: ['affine', 'railfence', 'vigenere'] },
    { name: 'Hard', kinds: ['vigenere', 'columnar'] },
    { name: 'Fiendish', kinds: ['columnar', 'playfair', 'vigenereLong'] },
  ];
  const TIER_BY_WEEKDAY = [5, 1, 2, 3, 3, 4, 5];

  // ---- dates -----------------------------------------------------------------

  const pad = n => String(n).padStart(2, '0');

  // The reader's local date, as YYYY-MM-DD.
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Date keys are worked on in UTC so a daylight-saving change never
  // turns one day into two.
  function utc(key) {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }

  function addDays(key, n) {
    const d = new Date(utc(key) + n * DAY);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  const weekday = key => new Date(utc(key)).getUTCDay();
  const daysSince = key => Math.round((utc(key) - utc(EPOCH)) / DAY);
  // A clock set before No. 1 still gets No. 1, never a negative number.
  const numberFor = key => Math.max(1, daysSince(key) + 1);

  function longDate(key) {
    const d = new Date(utc(key));
    return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  }

  // ---- seeded randomness -------------------------------------------------------

  // FNV-1a, to turn a string into a 32-bit seed.
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Mulberry32: small, fast and the same on every browser.
  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Every message comes round once before any repeats. The pool is shuffled
  // afresh for each pass through it, and a pass never opens with the
  // message that closed the one before.
  function shuffled(pass) {
    const rand = random(hash(`cryptex-pass:${pass}`));
    const order = MESSAGES.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  function messageFor(day) {
    const n = MESSAGES.length;
    const pass = Math.floor(day / n);
    const order = shuffled(pass);
    if (order[0] === shuffled(pass - 1)[n - 1]) [order[0], order[1]] = [order[1], order[0]];
    return MESSAGES[order[mod(day, n)]];
  }

  // ---- the puzzle ---------------------------------------------------------------

  function puzzleFor(key) {
    const rand = random(hash(`cryptex-daily:${key}`));
    const tier = TIER_BY_WEEKDAY[weekday(key)];
    const kind = pick(rand, LEVELS[tier - 1].kinds);
    const recipe = RECIPES[kind];
    const { keys, hints } = recipe.make(rand, tier);
    const message = messageFor(daysSince(key));
    const cipher = Ciphers.byId(recipe.cipher);
    let text = cipher.encrypt(message.plain, keys).toUpperCase();
    // Letters-only ciphers go out in five-letter groups, the way a
    // telegraph clerk would send them.
    if (recipe.grouped) text = text.match(/.{1,5}/g).join(' ');
    return {
      date: key,
      number: numberFor(key),
      title: longDate(key),
      tier,
      level: LEVELS[tier - 1].name,
      kind,
      cipher: cipher.id,
      keys,
      place: message.place,
      plain: message.plain,
      brief: pick(rand, recipe.briefs),
      hints,
      text,
    };
  }

  // Letters only, J folded into I, so spacing and case never matter.
  // Playfair answers also ignore the padding Xs the cipher adds.
  function normalise(text, cipher) {
    let s = lettersOnly(text).replace(/J/g, 'I');
    if (cipher === 'playfair') s = s.replace(/X/g, '');
    return s;
  }

  // ---- streaks --------------------------------------------------------------------

  // Days in a row, counting back from today. A streak survives until
  // midnight, so an unsolved today still counts yesterday's run.
  function streak(days, today) {
    let key = today in days ? today : addDays(today, -1);
    let n = 0;
    while (key in days) {
      n++;
      key = addDays(key, -1);
    }
    return n;
  }

  function resultText(puzzle, hints, run) {
    const used = hints ? `${hints} ${hints === 1 ? 'hint' : 'hints'}` : 'no hints';
    return `Cryptex intercept No. ${puzzle.number}: cracked with ${used}. Streak: ${run}`;
  }

  const api = {
    EPOCH,
    MESSAGES,
    LEVELS,
    dateKey,
    addDays,
    weekday,
    numberFor,
    puzzleFor,
    normalise,
    streak,
    resultText,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.Daily = api;
    page();
  }

  // ---- the page -------------------------------------------------------------------

  function page() {
    const $ = (sel, el = document) => el.querySelector(sel);
    const { ALPHABET } = Ciphers;
    const STORE = 'cryptex-daily';

    const section = $('#daily');
    // Other pages load this file only for the puzzle itself.
    if (!section) return;
    const card = $('.daily-card', section);
    const form = $('.answer', card);
    const input = $('#daily-input');
    const feedback = $('.answer-feedback', card);
    const hintList = $('.hint-list', card);
    const hintBtn = $('[data-act="hint"]', card);
    const interceptEl = $('.intercept', card);
    const done = $('.daily-done', card);
    const resultEl = $('.daily-result', card);
    const copied = $('.daily-copied', card);
    const countdown = $('.daily-countdown', section);
    const week = $('.daily-week', section);

    // { days: { 'YYYY-MM-DD': hints used }, best, hints: { date, n } }
    // Storage can hold anything, so keep only entries of the expected shape.
    function load() {
      const blank = { days: {}, best: 0, hints: { date: '', n: 0 } };
      const count = n => Number.isInteger(n) && n >= 0 && n < 1e6;
      try {
        const saved = JSON.parse(localStorage.getItem(STORE));
        if (!saved || typeof saved !== 'object') return blank;
        const days = {};
        if (saved.days && typeof saved.days === 'object' && !Array.isArray(saved.days)) {
          for (const [day, hints] of Object.entries(saved.days)) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(day) && count(hints)) days[day] = hints;
          }
        }
        const h = saved.hints;
        return {
          days,
          best: count(saved.best) ? saved.best : 0,
          hints: h && typeof h.date === 'string' && count(h.n) ? { date: h.date, n: h.n } : blank.hints,
        };
      } catch {
        return blank;
      }
    }

    const state = load();

    // Another tab may have saved since this one loaded. Fold that in first,
    // so a stale tab never writes over a day cracked somewhere else.
    function merge() {
      const stored = load();
      state.days = { ...stored.days, ...state.days };
      state.best = Math.max(state.best, stored.best);
      if (stored.hints.date === state.hints.date) state.hints.n = Math.max(state.hints.n, stored.hints.n);
      else if (stored.hints.date > state.hints.date) state.hints = stored.hints;
    }

    function save() {
      merge();
      try {
        localStorage.setItem(STORE, JSON.stringify(state));
      } catch {}
    }

    let puzzle = null;
    let hintsShown = 0;

    const solved = () => puzzle.date in state.days;

    function show(key) {
      puzzle = puzzleFor(key);
      hintsShown = state.hints.date === key ? Math.min(state.hints.n, puzzle.hints.length) : 0;
      $('.daily-no', card).textContent = `No. ${puzzle.number}`;
      $('.daily-date', card).textContent = puzzle.title;
      $('.pips', card).setAttribute('aria-label', `Difficulty ${puzzle.tier} of ${LEVELS.length}`);
      $('.pips', card).replaceChildren(...LEVELS.map((_, i) => {
        const pip = document.createElement('i');
        if (i < puzzle.tier) pip.className = 'on';
        return pip;
      }));
      $('.daily-level-name', card).textContent = puzzle.level;
      $('.daily-from', card).textContent = `${puzzle.place}.`;
      $('.daily-brief', card).textContent = puzzle.brief;
      interceptEl.textContent = solved() ? puzzle.plain.toUpperCase() : puzzle.text;
      input.value = '';
      feedback.textContent = solved() ? 'Cracked. A new intercept arrives at midnight.' : '';
      feedback.className = 'answer-feedback' + (solved() ? ' right' : '');
      hintList.replaceChildren(...puzzle.hints.slice(0, hintsShown).map(hintItem));
      card.classList.toggle('cracked', solved());
      card.querySelector('.stamp')?.remove();
      if (solved()) addStamp(false);
      copied.textContent = '';
      renderRecord();
    }

    function hintItem(text) {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    }

    function addStamp(animate) {
      const stamp = document.createElement('span');
      stamp.className = 'stamp' + (animate ? ' landing' : '');
      stamp.textContent = 'CRACKED';
      stamp.setAttribute('aria-hidden', 'true');
      card.append(stamp);
    }

    // Everything that depends on progress rather than on the puzzle.
    function renderRecord() {
      const run = streak(state.days, puzzle.date);
      const used = solved() ? state.days[puzzle.date] : hintsShown;
      $('[data-stat="streak"]', section).textContent = run;
      $('[data-stat="streak"]', section).classList.toggle('live', run > 0);
      $('[data-stat="best"]', section).textContent = Math.max(state.best, run);
      $('[data-stat="hints"]', section).textContent = used;
      $('.daily-status', section).textContent = solved()
        ? `Cracked today with ${used ? `${used} ${used === 1 ? 'hint' : 'hints'}` : 'no hints'}.`
        : run ? 'Crack today’s before midnight to keep your streak.' : 'Not cracked yet today.';
      hintBtn.hidden = solved() || hintsShown >= puzzle.hints.length;
      hintBtn.textContent = hintsShown ? 'Show another hint' : 'Show a hint';
      done.hidden = !solved();
      if (solved()) resultEl.textContent = resultText(puzzle, used, run);
      renderWeek();
    }

    // Monday to Sunday, so the week reads from easy to hard.
    function renderWeek() {
      const monday = addDays(puzzle.date, -mod(weekday(puzzle.date) - 1, 7));
      week.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
        const key = addDays(monday, i);
        const tier = TIER_BY_WEEKDAY[weekday(key)];
        const li = document.createElement('li');
        const status = key in state.days ? 'cracked' : key === puzzle.date ? 'today' : key > puzzle.date ? 'ahead' : 'missed';
        li.className = 'daily-day ' + status;
        li.style.setProperty('--tier', tier);
        li.innerHTML = '<span class="dd-name"></span><span class="dd-mark"></span>';
        $('.dd-name', li).textContent = WEEKDAYS[weekday(key)][0];
        $('.dd-mark', li).textContent = Number(key.slice(8));
        const what = { cracked: 'cracked', today: 'today', ahead: 'still to come', missed: 'missed' }[status];
        li.setAttribute('aria-label', `${longDate(key)}, ${LEVELS[tier - 1].name.toLowerCase()}: ${what}`);
        if (key === puzzle.date) li.setAttribute('aria-current', 'date');
        return li;
      }));
    }

    // Scrambles the intercept into the plaintext, a letter at a time.
    function reveal() {
      const target = puzzle.plain.toUpperCase();
      if (Stage.reduced) {
        interceptEl.textContent = target;
        return;
      }
      const shown = puzzle;
      const start = performance.now();
      const length = target.length;
      const total = Math.min(1600, 400 + length * 12);
      function frame(t) {
        if (puzzle !== shown) return;
        const count = Math.floor(((t - start) / total) * length);
        let out = '';
        for (let i = 0; i < length; i++) {
          const ch = target[i];
          out += i < count || !/[A-Z]/.test(ch) ? ch : ALPHABET[(Math.random() * 26) | 0];
        }
        interceptEl.textContent = out;
        if (count < length) requestAnimationFrame(frame);
        else interceptEl.textContent = target;
      }
      requestAnimationFrame(frame);
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      const guess = normalise(input.value, puzzle.cipher);
      const right = normalise(puzzle.plain, puzzle.cipher);
      if (!guess) {
        feedback.textContent = 'Type the message you decrypted.';
        feedback.className = 'answer-feedback wrong';
        return;
      }
      if (guess === right) {
        const first = !solved();
        if (first) {
          state.days[puzzle.date] = hintsShown;
          state.best = Math.max(state.best, streak(state.days, puzzle.date));
          save();
          card.classList.add('cracked');
          addStamp(true);
          reveal();
        }
        feedback.textContent = 'Cracked. A new intercept arrives at midnight.';
        feedback.className = 'answer-feedback right';
        renderRecord();
        return;
      }
      let off = 0;
      if (guess.length === right.length) for (let i = 0; i < guess.length; i++) if (guess[i] !== right[i]) off++;
      feedback.textContent = off && off <= 3
        ? `Very close. ${off} ${off === 1 ? 'letter is' : 'letters are'} off.`
        : 'Not quite. Check your work, or take a hint.';
      feedback.className = 'answer-feedback wrong';
    });

    hintBtn.addEventListener('click', () => {
      if (hintsShown >= puzzle.hints.length) return;
      const li = hintItem(puzzle.hints[hintsShown++]);
      hintList.append(li);
      state.hints = { date: puzzle.date, n: hintsShown };
      save();
      renderRecord();
      // The button goes once the hints run out; keep focus on what it showed.
      if (hintBtn.hidden) {
        li.tabIndex = -1;
        li.focus();
      }
    });

    $('[data-act="to-desk"]', card).addEventListener('click', () => {
      // Starts from the letter counts: choosing the attack is part of the puzzle.
      Breaker.load(puzzle.text, 'freq');
    });

    $('[data-act="to-lab"]', card).addEventListener('click', () => {
      // Leave the cipher as it is: picking it is part of the puzzle.
      Lab.open(null, { mode: 'decrypt', text: puzzle.text });
    });

    $('[data-act="copy"]', card).addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(`${resultEl.textContent}\n${location.origin}/codebreaking#today`);
        copied.textContent = 'Copied.';
      } catch {
        // No clipboard (an old browser, or a page opened from a file):
        // select the line so it can be copied by hand.
        getSelection().selectAllChildren(resultEl);
        copied.textContent = 'Selected. Copy it from here.';
      }
    });

    // ---- the clock ------------------------------------------------------------------

    // Counts down to local midnight, and swaps in the new intercept if the
    // page is still open when it arrives.
    function tick() {
      const now = new Date();
      if (dateKey(now) !== puzzle.date) show(dateKey(now));
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const left = Math.max(0, Math.floor((midnight - now) / 1000));
      countdown.textContent = `${Math.floor(left / 3600)}:${pad(Math.floor(left / 60) % 60)}:${pad(left % 60)}`;
      countdown.setAttribute('aria-label', `${Math.floor(left / 3600)} hours and ${Math.floor(left / 60) % 60} minutes`);
    }

    function loop() {
      tick();
      setTimeout(loop, 1000 - (Date.now() % 1000) + 20);
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick();
    });

    // Progress made in another tab shows up here too.
    window.addEventListener('storage', e => {
      if (e.key !== STORE) return;
      const was = solved();
      merge();
      if (solved() && !was) show(puzzle.date);
      else renderRecord();
    });

    show(dateKey(new Date()));
    loop();
  }
})(this);
