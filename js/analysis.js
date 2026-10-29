/*
 * Letter statistics used by the "Break it" tab.
 */
(function (root) {
  'use strict';

  const Ciphers = root.Ciphers || require('./ciphers.js');
  const { lettersOnly, toIndex, toLetter, mod } = Ciphers;

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
  function chiSquared(letters) {
    if (!letters.length) return Infinity;
    const c = counts(letters);
    let sum = 0;
    for (let i = 0; i < 26; i++) {
      const expected = (ENGLISH[i] / 100) * letters.length;
      sum += (c[i] - expected) ** 2 / expected;
    }
    return sum;
  }

  function shiftBack(text, shift) {
    return text.replace(/[a-z]/gi, ch => {
      const c = toLetter(toIndex(ch) - shift);
      return ch === ch.toLowerCase() ? c.toLowerCase() : c;
    });
  }

  // All 25 Caesar decryptions, each with its score.
  function caesarCandidates(text) {
    const letters = lettersOnly(text);
    const rows = [];
    for (let shift = 1; shift < 26; shift++) {
      const shifted = [...letters].map(ch => toLetter(toIndex(ch) - shift)).join('');
      rows.push({ shift, text: shiftBack(text, shift), chi: chiSquared(shifted) });
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

  function crackVigenere(text, length) {
    const letters = lettersOnly(text);
    const cols = columns(letters, length);
    const shifts = cols.map(col => {
      let bestShift = 0;
      let bestChi = Infinity;
      for (let s = 0; s < 26; s++) {
        const chi = chiSquared([...col].map(ch => toLetter(toIndex(ch) - s)).join(''));
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
      const c = toLetter(mod(toIndex(ch) - shifts[n++ % length], 26));
      return ch === ch.toLowerCase() ? c.toLowerCase() : c;
    });
    return { key, plaintext };
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
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Analysis = api;
})(this);
