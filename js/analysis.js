/*
 * Letter statistics used by the codebreaker's desk.
 */
(function (root) {
  'use strict';

  const Ciphers = root.Ciphers || require('./ciphers.js');
  const { lettersOnly, toIndex, toLetter, modInverse, mod } = Ciphers;

  // Percent of letters in typical English text.
  const ENGLISH = [
    8.17, 1.49, 2.78, 4.25, 12.70, 2.23, 2.02, 6.09, 6.97, 0.15, 0.77, 4.03, 2.41,
    6.75, 7.51, 1.93, 0.10, 5.99, 6.33, 9.06, 2.76, 0.98, 2.36, 0.15, 1.97, 0.07,
  ];

  const ENGLISH_IOC = 0.066;
  const RANDOM_IOC = 1 / 26;

  function counts(letters) {
    const c = new Array(26).fill(0);
    for (const ch of letters) c[toIndex(ch)]++;
    return c;
  }

  function frequencies(text) {
    const letters = lettersOnly(text);
    const c = counts(letters);
    return c.map(n => (letters.length ? (n / letters.length) * 100 : 0));
  }

  // How far a letter distribution is from English. Lower means more English.
  function chiOfCounts(c, n) {
    if (!n) return Infinity;
    let sum = 0;
    for (let i = 0; i < 26; i++) {
      const expected = (ENGLISH[i] / 100) * n;
      sum += (c[i] - expected) ** 2 / expected;
    }
    return sum;
  }

  const chiSquared = letters => chiOfCounts(counts(letters), letters.length);

  // A substitution key only moves counts from one letter to another, so a
  // key can be scored from the ciphertext's counts without decrypting
  // anything. undo(i) is the plain letter the key turns letter i into.
  function chiUnder(c, n, undo) {
    const plain = new Array(26).fill(0);
    for (let i = 0; i < 26; i++) plain[mod(undo(i), 26)] += c[i];
    return chiOfCounts(plain, n);
  }

  function shiftBack(text, shift) {
    return text.replace(/[a-z]/gi, ch => {
      const c = toLetter(toIndex(ch) - shift);
      return ch === ch.toLowerCase() ? c.toLowerCase() : c;
    });
  }

  // All 25 Caesar decryptions, each with its score. A row's text is only
  // worked out if something reads it: the desk shows ten at most.
  function caesarCandidates(text) {
    const letters = lettersOnly(text);
    const c = counts(letters);
    const rows = [];
    for (let shift = 1; shift < 26; shift++) {
      rows.push({ shift, chi: chiUnder(c, letters.length, i => i - shift), get text() { return shiftBack(text, shift); } });
    }
    return rows;
  }

  function indexOfCoincidence(letters) {
    const n = letters.length;
    if (n < 2) return 0;
    const c = counts(letters);
    return c.reduce((sum, f) => sum + f * (f - 1), 0) / (n * (n - 1));
  }

  // Split into `length` columns: every length-th letter belongs together.
  function columns(letters, length) {
    const cols = Array.from({ length }, () => '');
    for (let i = 0; i < letters.length; i++) cols[i % length] += letters[i];
    return cols;
  }

  // For a guessed key length, the average IoC of its columns. The right
  // length makes each column a plain Caesar cipher, so it scores near English.
  function keyLengthScores(text, max = 12) {
    const letters = lettersOnly(text);
    const top = Math.min(max, Math.floor(letters.length / 4));
    const scores = [];
    for (let length = 1; length <= top; length++) {
      const cols = columns(letters, length);
      const ioc = cols.reduce((s, col) => s + indexOfCoincidence(col), 0) / length;
      scores.push({ length, ioc });
    }
    return scores;
  }

  // Multiples of the real length score just as well, so take the shortest
  // length that gets close to the best score.
  function guessKeyLength(scores) {
    if (!scores.length) return 1;
    const best = Math.max(...scores.map(s => s.ioc));
    return scores.find(s => s.ioc >= best * 0.9).length;
  }

  // Try all 26 letters for each column of a repeating-key cipher and keep
  // the one whose column reads most like English. undo(c, k) turns a
  // ciphertext letter back into plaintext for key letter k.
  function crackColumns(text, length, undo) {
    const letters = lettersOnly(text);
    const cols = columns(letters, length);
    const shifts = cols.map(col => {
      const c = counts(col);
      let bestShift = 0;
      let bestChi = Infinity;
      for (let s = 0; s < 26; s++) {
        const chi = chiUnder(c, col.length, i => undo(i, s));
        if (chi < bestChi) {
          bestChi = chi;
          bestShift = s;
        }
      }
      return bestShift;
    });
    const key = shifts.map(toLetter).join('');
    let n = 0;
    const plaintext = text.replace(/[a-z]/gi, ch => {
      const c = toLetter(undo(toIndex(ch), shifts[n++ % length]));
      return ch === ch.toLowerCase() ? c.toLowerCase() : c;
    });
    return { key, plaintext };
  }

  const crackVigenere = (text, length) => crackColumns(text, length, (c, k) => c - k);

  // Beaufort encrypts with c = k - p, so p = k - c. The key still repeats,
  // so keyLengthScores finds its length the same way.
  const crackBeaufort = (text, length) => crackColumns(text, length, (c, k) => k - c);

  // ---- transposition and affine ---------------------------------------------

  // Percent of letter pairs in typical English text, for the most common pairs.
  const BIGRAMS = {
    TH: 3.56, HE: 3.07, IN: 2.43, ER: 2.05, AN: 1.99, RE: 1.85, ON: 1.76, AT: 1.49,
    EN: 1.45, ND: 1.35, TI: 1.34, ES: 1.34, OR: 1.28, TE: 1.20, OF: 1.17, ED: 1.17,
    IS: 1.13, IT: 1.12, AL: 1.09, AR: 1.07, ST: 1.05, TO: 1.04, NT: 1.04, NG: 0.95,
    SE: 0.93, HA: 0.93, AS: 0.87, OU: 0.87, IO: 0.83, LE: 0.83, VE: 0.83, CO: 0.79,
    ME: 0.79, DE: 0.76, HI: 0.76, RI: 0.73, RO: 0.73, IC: 0.70, NE: 0.69, EA: 0.69,
    RA: 0.69, CE: 0.65, LI: 0.62, CH: 0.60, LL: 0.58, BE: 0.58, MA: 0.57, SI: 0.55,
    OM: 0.55, UR: 0.54,
  };
  // Any pair not in the table counts as this rare.
  const RARE_PAIR = 0.02;

  // Average log-probability of each letter pair. Higher means more English.
  // A transposition keeps every letter, so single-letter counts can't tell
  // the right order from a wrong one, but pairs like TH and ER can.
  function bigramScore(letters) {
    if (letters.length < 2) return -Infinity;
    let sum = 0;
    for (let i = 1; i < letters.length; i++) {
      sum += Math.log10(BIGRAMS[letters[i - 1] + letters[i]] || RARE_PAIR);
    }
    return sum / (letters.length - 1);
  }

  // The text read back on every rail count from 2 to 8, each with its score.
  function railCandidates(text) {
    const railfence = Ciphers.byId('railfence');
    const rows = [];
    for (let rails = 2; rails <= 8; rails++) {
      const plain = railfence.decrypt(text, { rails });
      rows.push({ rails, text: plain, score: bigramScore(plain) });
    }
    return rows;
  }

  // All 312 affine keys, most English first, scored from the letter counts.
  function affineCandidates(text) {
    const affine = Ciphers.byId('affine');
    const letters = lettersOnly(text);
    const c = counts(letters);
    const rows = [];
    for (let a = 1; a < 26; a += 2) {
      if (a === 13) continue;
      const inverse = modInverse(a, 26);
      for (let b = 0; b < 26; b++) {
        rows.push({ a, b, chi: chiUnder(c, letters.length, i => inverse * (i - b)), get text() { return affine.decrypt(text, { a, b }); } });
      }
    }
    return rows.sort((x, y) => x.chi - y.chi);
  }

  const api = {
    ENGLISH,
    ENGLISH_IOC,
    RANDOM_IOC,
    frequencies,
    chiSquared,
    shiftBack,
    caesarCandidates,
    indexOfCoincidence,
    keyLengthScores,
    guessKeyLength,
    crackVigenere,
    crackBeaufort,
    bigramScore,
    railCandidates,
    affineCandidates,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Analysis = api;
})(this);
