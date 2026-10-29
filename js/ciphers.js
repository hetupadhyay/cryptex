/*
 * Classical ciphers on the 26-letter Latin alphabet.
 *
 * Substitution ciphers keep spaces, punctuation and letter case where they are.
 * Playfair, Rail Fence and Columnar work on letters only, the way they were
 * used on paper, so their output is a solid block of capitals.
 */
(function (root) {
  'use strict';

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  const mod = (n, m) => ((n % m) + m) % m;
  const isLetter = ch => /^[a-z]$/i.test(ch);
  const toIndex = ch => ch.toUpperCase().charCodeAt(0) - 65;
  const toLetter = i => ALPHABET[mod(i, 26)];
  // Filtered before uppercasing: 'ß'.toUpperCase() is 'SS', which would add
  // letters the letter-by-letter ciphers never see.
  const lettersOnly = text => String(text).replace(/[^A-Za-z]/g, '').toUpperCase();
  // Capitals for A to Z only, so every other character keeps its length.
  const upper = text => String(text).replace(/[a-z]+/g, s => s.toUpperCase());

  // Calls fn(letterIndex, n) for every letter, where n counts letters only.
  function mapLetters(text, fn) {
    let n = 0;
    let out = '';
    for (const ch of text) {
      if (!isLetter(ch)) {
        out += ch;
        continue;
      }
      const c = toLetter(fn(toIndex(ch), n++));
      out += ch === ch.toLowerCase() ? c.toLowerCase() : c;
    }
    return out;
  }

  function gcd(a, b) {
    return b ? gcd(b, a % b) : Math.abs(a);
  }

  function modInverse(a, m) {
    for (let x = 1; x < m; x++) {
      if (mod(a * x, m) === 1) return x;
    }
    return null;
  }

  const AFFINE_A = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];

  // ---- Vigenère family -------------------------------------------------

  // The key letter used for each message letter, as indexes 0-25.
  // Autokey needs the plaintext to extend its key, so decryption has to
  // build the stream as it goes; that's handled in autokeyDecrypt.
  function keyStream(key, count) {
    const k = lettersOnly(key);
    return Array.from({ length: count }, (_, n) => toIndex(k[n % k.length]));
  }

  function autokeyStream(key, plainLetters) {
    const k = lettersOnly(key) + plainLetters;
    return Array.from({ length: plainLetters.length }, (_, n) => toIndex(k[n]));
  }

  function autokeyDecrypt(text, key) {
    const k = lettersOnly(key);
    const recovered = [];
    return mapLetters(text, (c, n) => {
      const shift = n < k.length ? toIndex(k[n]) : recovered[n - k.length];
      const p = mod(c - shift, 26);
      recovered.push(p);
      return p;
    });
  }

  // ---- 5x5 squares (Playfair, Polybius) ---------------------------------

  // 25 letters, row by row. I and J share a cell.
  function keySquare(keyword) {
    const source = (lettersOnly(keyword || '') + ALPHABET).replace(/J/g, 'I');
    return [...new Set(source)];
  }

  function keywordLength(keyword) {
    return new Set(lettersOnly(keyword || '').replace(/J/g, 'I')).size;
  }

  // Splits a message into Playfair pairs. A doubled pair gets an X pushed
  // between the letters, and an odd last letter gets an X partner.
  // (If the letter itself is X, Q is used instead.)
  function playfairPairs(text) {
    const s = lettersOnly(text).replace(/J/g, 'I');
    const pairs = [];
    let i = 0;
    while (i < s.length) {
      const a = s[i];
      const b = s[i + 1];
      const filler = a === 'X' ? 'Q' : 'X';
      if (b === undefined) {
        pairs.push({ a, b: filler, pad: 'end' });
        i += 1;
      } else if (a === b) {
        pairs.push({ a, b: filler, pad: 'double' });
        i += 1;
      } else {
        pairs.push({ a, b });
        i += 2;
      }
    }
    return pairs;
  }

  // Ciphertext is already in pairs; just chunk it.
  function chunkPairs(text) {
    const s = lettersOnly(text).replace(/J/g, 'I');
    const pairs = [];
    for (let i = 0; i < s.length; i += 2) {
      pairs.push(s[i + 1] ? { a: s[i], b: s[i + 1] } : { a: s[i], b: 'X', pad: 'end' });
    }
    return pairs;
  }

  // dir is +1 to encrypt (right / down), -1 to decrypt (left / up).
  function playfairSwap(square, a, b, dir) {
    const pa = square.indexOf(a);
    const pb = square.indexOf(b);
    const ra = Math.floor(pa / 5), ca = pa % 5;
    const rb = Math.floor(pb / 5), cb = pb % 5;
    let ta, tb, rule;
    if (ra === rb) {
      rule = 'row';
      ta = ra * 5 + mod(ca + dir, 5);
      tb = rb * 5 + mod(cb + dir, 5);
    } else if (ca === cb) {
      rule = 'column';
      ta = mod(ra + dir, 5) * 5 + ca;
      tb = mod(rb + dir, 5) * 5 + cb;
    } else {
      rule = 'rectangle';
      ta = ra * 5 + cb;
      tb = rb * 5 + ca;
    }
    return { rule, from: [pa, pb], to: [ta, tb], out: square[ta] + square[tb] };
  }

  function playfair(text, key, dir) {
    const square = keySquare(key);
    const pairs = dir > 0 ? playfairPairs(text) : chunkPairs(text);
    return pairs.map(p => playfairSwap(square, p.a, p.b, dir).out).join('');
  }

  // ---- Polybius ----------------------------------------------------------

  function polybiusEncrypt(text, key) {
    const square = keySquare(key);
    const units = [];
    for (const ch of text) {
      if (isLetter(ch)) {
        const p = square.indexOf(ch.toUpperCase().replace('J', 'I'));
        units.push(`${Math.floor(p / 5) + 1}${(p % 5) + 1}`);
      } else if (/\s/.test(ch) && units.length && units[units.length - 1] !== '/') {
        units.push('/');
      }
    }
    if (units[units.length - 1] === '/') units.pop();
    return units.join(' ');
  }

  // Reads digit pairs; a slash marks a word break.
  function polybiusTokens(text) {
    const tokens = [];
    let digit = null;
    for (const ch of text) {
      if (ch === '/') {
        digit = null;
        if (tokens.length && tokens[tokens.length - 1] !== '/') tokens.push('/');
      } else if (/[1-5]/.test(ch)) {
        if (digit === null) {
          digit = ch;
        } else {
          tokens.push(digit + ch);
          digit = null;
        }
      }
    }
    return tokens;
  }

  function polybiusDecrypt(text, key) {
    const square = keySquare(key);
    return polybiusTokens(text)
      .map(t => (t === '/' ? ' ' : square[(t[0] - 1) * 5 + (t[1] - 1)]))
      .join('');
  }

  // ---- Rail fence ----------------------------------------------------------

  // Which rail each position lands on: 0 1 2 1 0 1 2 ...
  function railPattern(length, rails) {
    const cycle = 2 * (rails - 1);
    return Array.from({ length }, (_, i) => {
      const p = i % cycle;
      return p < rails ? p : cycle - p;
    });
  }

  function railEncrypt(text, rails) {
    const s = lettersOnly(text);
    const pattern = railPattern(s.length, rails);
    let out = '';
    for (let r = 0; r < rails; r++) {
      for (let i = 0; i < s.length; i++) if (pattern[i] === r) out += s[i];
    }
    return out;
  }

  function railDecrypt(text, rails) {
    const s = lettersOnly(text);
    const pattern = railPattern(s.length, rails);
    const slots = new Array(s.length);
    let n = 0;
    for (let r = 0; r < rails; r++) {
      for (let i = 0; i < s.length; i++) if (pattern[i] === r) slots[i] = s[n++];
    }
    return slots.join('');
  }

  // ---- Columnar transposition -------------------------------------------

  // order[n] is the column read n-th; rank[col] is where that column sorts.
  // Repeated key letters are ranked left to right.
  function columnOrder(key) {
    const k = lettersOnly(key);
    const order = [...k].map((_, i) => i).sort((x, y) => (k[x] === k[y] ? x - y : k[x] < k[y] ? -1 : 1));
    const rank = [];
    order.forEach((col, n) => { rank[col] = n; });
    return { key: k, order, rank };
  }

  // The last row may be short, so the first (length % cols) columns are taller.
  function columnHeights(length, cols) {
    const base = Math.floor(length / cols);
    return Array.from({ length: cols }, (_, c) => base + (c < length % cols ? 1 : 0));
  }

  function columnarEncrypt(text, key) {
    const s = lettersOnly(text);
    const { order } = columnOrder(key);
    const cols = order.length;
    let out = '';
    for (const col of order) {
      for (let i = col; i < s.length; i += cols) out += s[i];
    }
    return out;
  }

  function columnarDecrypt(text, key) {
    const s = lettersOnly(text);
    const { order } = columnOrder(key);
    const cols = order.length;
    const heights = columnHeights(s.length, cols);
    const columns = [];
    let n = 0;
    for (const col of order) {
      columns[col] = s.slice(n, n + heights[col]);
      n += heights[col];
    }
    let out = '';
    for (let r = 0; r < heights[0]; r++) {
      for (let c = 0; c < cols; c++) if (columns[c][r]) out += columns[c][r];
    }
    return out;
  }

  // ---- Key checks ----------------------------------------------------------

  const needsLetters = (value, label) =>
    lettersOnly(value).length ? '' : `${label} needs at least one letter.`;

  // Plain digits only: Number() would also take '', '0x3' and '1e1'.
  function wholeNumber(value, min, max, label) {
    const text = String(value).trim();
    const n = Number(text);
    if (!/^-?\d+$/.test(text) || n < min || n > max) return `${label} must be a whole number from ${min} to ${max}.`;
    return '';
  }

  // ---- The catalogue -----------------------------------------------------

  const ciphers = [
    {
      id: 'caesar',
      name: 'Caesar',
      family: 'Substitution',
      scene: 'substitution',
      intro: 'slide',
      keys: [{ id: 'shift', label: 'Shift', type: 'number', min: 1, max: 25, value: 3 }],
      check: k => wholeNumber(k.shift, 1, 25, 'Shift'),
      encrypt: (t, k) => mapLetters(t, x => x + Number(k.shift)),
      decrypt: (t, k) => mapLetters(t, x => x - Number(k.shift)),
      row: k => [...ALPHABET].map((_, p) => toLetter(p + Number(k.shift))),
      about: 'Julius Caesar shifted his letters by three. Every letter moves the same distance along the alphabet, wrapping from Z back to A.',
      weakness: 'There are only 25 possible keys. Trying all of them takes a fraction of a second.',
    },
    {
      id: 'atbash',
      name: 'Atbash',
      family: 'Substitution',
      scene: 'substitution',
      intro: 'mirror',
      keys: [],
      check: () => '',
      encrypt: t => mapLetters(t, x => 25 - x),
      decrypt: t => mapLetters(t, x => 25 - x),
      row: () => [...ALPHABET].reverse(),
      about: 'Originally a Hebrew cipher, found in the Book of Jeremiah. The alphabet is folded in half: A swaps with Z, B with Y, and so on.',
      weakness: 'It has no key. Anyone who knows the method can read the message.',
    },
    {
      id: 'affine',
      name: 'Affine',
      family: 'Substitution',
      scene: 'substitution',
      intro: 'compute',
      keys: [
        { id: 'a', label: 'Multiplier a', type: 'select', options: AFFINE_A, value: 5 },
        { id: 'b', label: 'Shift b', type: 'number', min: 0, max: 25, value: 8 },
      ],
      check: k => {
        if (gcd(Number(k.a), 26) !== 1) return 'The multiplier can’t share a factor with 26, or two letters would encrypt the same way.';
        return wholeNumber(k.b, 0, 25, 'Shift');
      },
      encrypt: (t, k) => mapLetters(t, x => Number(k.a) * x + Number(k.b)),
      decrypt: (t, k) => mapLetters(t, y => modInverse(Number(k.a), 26) * (y - Number(k.b))),
      row: k => [...ALPHABET].map((_, p) => toLetter(Number(k.a) * p + Number(k.b))),
      about: 'Each letter becomes a number, gets multiplied by a, shifted by b, and wrapped around 26. Caesar is the special case where a is 1.',
      weakness: 'Only 312 keys, and it’s still one fixed alphabet, so letter frequencies give it away.',
    },
    {
      id: 'vigenere',
      name: 'Vigenère',
      family: 'Polyalphabetic',
      scene: 'tabula',
      keys: [{ id: 'key', label: 'Keyword', type: 'text', value: 'LEMON' }],
      check: k => needsLetters(k.key, 'The keyword'),
      encrypt: (t, k) => {
        const ks = keyStream(k.key, lettersOnly(t).length);
        return mapLetters(t, (x, n) => x + ks[n]);
      },
      decrypt: (t, k) => {
        const ks = keyStream(k.key, lettersOnly(t).length);
        return mapLetters(t, (x, n) => x - ks[n]);
      },
      about: 'Each letter gets its own Caesar shift, taken from the keyword, which repeats along the message. For about 300 years it was called “le chiffre indéchiffrable”.',
      weakness: 'The keyword repeats. Babbage and Kasiski found the key length from that pattern, and after that it’s just several Caesar ciphers.',
    },
    {
      id: 'autokey',
      name: 'Autokey',
      family: 'Polyalphabetic',
      scene: 'tabula',
      keys: [{ id: 'key', label: 'Keyword', type: 'text', value: 'QUEEN' }],
      check: k => needsLetters(k.key, 'The keyword'),
      encrypt: (t, k) => {
        const ks = autokeyStream(k.key, lettersOnly(t));
        return mapLetters(t, (x, n) => x + ks[n]);
      },
      decrypt: (t, k) => autokeyDecrypt(t, k.key),
      about: 'Vigenère’s own improvement. After the keyword runs out, the message itself becomes the key, so nothing ever repeats.',
      weakness: 'The key is ordinary English, so guessing a likely word like THE in the right place unlocks the letters around it.',
    },
    {
      id: 'beaufort',
      name: 'Beaufort',
      family: 'Polyalphabetic',
      scene: 'tabula',
      keys: [{ id: 'key', label: 'Keyword', type: 'text', value: 'FORT' }],
      check: k => needsLetters(k.key, 'The keyword'),
      encrypt: (t, k) => {
        const ks = keyStream(k.key, lettersOnly(t).length);
        return mapLetters(t, (x, n) => ks[n] - x);
      },
      decrypt: (t, k) => {
        const ks = keyStream(k.key, lettersOnly(t).length);
        return mapLetters(t, (x, n) => ks[n] - x);
      },
      about: 'Like Vigenère, but the message letter is subtracted from the key letter. Encrypting twice gives the message back, which made it handy for the Hagelin M-209 machine.',
      weakness: 'It has the same repeating-key weakness as Vigenère.',
    },
    {
      id: 'playfair',
      name: 'Playfair',
      family: 'Grid',
      scene: 'playfair',
      keys: [{ id: 'key', label: 'Keyword', type: 'text', value: 'MONARCHY' }],
      check: k => needsLetters(k.key, 'The keyword'),
      encrypt: (t, k) => playfair(t, k.key, 1),
      decrypt: (t, k) => playfair(t, k.key, -1),
      about: 'Charles Wheatstone’s 1854 cipher encrypts pairs of letters using a 5×5 square. British forces used it in the Boer War and the First World War.',
      weakness: 'Pairs hide single-letter counts, but common pairs like TH, HE and IN still stand out, and a pair always encrypts the same way.',
    },
    {
      id: 'polybius',
      name: 'Polybius',
      family: 'Grid',
      scene: 'polybius',
      keys: [{ id: 'key', label: 'Keyword (optional)', type: 'text', value: '' }],
      check: () => '',
      encrypt: (t, k) => polybiusEncrypt(t, k.key),
      decrypt: (t, k) => polybiusDecrypt(t, k.key),
      about: 'The Greek historian Polybius described signalling with torches: each letter becomes its row and column in a 5×5 square. Prisoners still use it as tap code.',
      weakness: 'Each letter always gives the same pair of digits, so it’s a simple substitution in disguise.',
    },
    {
      id: 'railfence',
      name: 'Rail fence',
      family: 'Transposition',
      scene: 'railfence',
      keys: [{ id: 'rails', label: 'Rails', type: 'number', min: 2, max: 8, value: 3 }],
      check: k => wholeNumber(k.rails, 2, 8, 'Rails'),
      encrypt: (t, k) => railEncrypt(t, Number(k.rails)),
      decrypt: (t, k) => railDecrypt(t, Number(k.rails)),
      about: 'Write the message in a zig-zag across a few rails, then read each rail in turn. The letters stay the same; only their order changes.',
      weakness: 'Letter counts look exactly like English, which tells an attacker it’s a transposition. There are only a handful of rail counts to try.',
    },
    {
      id: 'columnar',
      name: 'Columnar',
      family: 'Transposition',
      scene: 'columnar',
      keys: [{ id: 'key', label: 'Keyword', type: 'text', value: 'ZEBRAS' }],
      check: k => needsLetters(k.key, 'The keyword'),
      encrypt: (t, k) => columnarEncrypt(t, k.key),
      decrypt: (t, k) => columnarDecrypt(t, k.key),
      about: 'Write the message in rows under a keyword, then read the columns off in the keyword’s alphabetical order. Armies used it through both World Wars, often twice in a row.',
      weakness: 'Done once, it can be undone by shuffling columns side by side until common pairs like TH and ER line up.',
    },
  ];

  const api = {
    ALPHABET,
    list: ciphers,
    byId: id => ciphers.find(c => c.id === id),
    mod,
    isLetter,
    toIndex,
    toLetter,
    lettersOnly,
    upper,
    modInverse,
    keyStream,
    autokeyStream,
    keySquare,
    keywordLength,
    playfairPairs,
    chunkPairs,
    playfairSwap,
    polybiusTokens,
    railPattern,
    columnOrder,
    columnHeights,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ciphers = api;
})(this);
