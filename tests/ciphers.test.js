const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/ciphers.js');
const A = require('../js/analysis.js');

const run = (id, mode, text, keys = {}) => {
  const cipher = C.byId(id);
  const k = Object.fromEntries(cipher.keys.map(f => [f.id, f.value]));
  return cipher[mode](text, { ...k, ...keys });
};

test('known textbook examples', () => {
  assert.equal(run('caesar', 'encrypt', 'Attack at dawn!'), 'Dwwdfn dw gdzq!');
  assert.equal(run('atbash', 'encrypt', 'WIZARD'), 'DRAZIW');
  assert.equal(run('affine', 'encrypt', 'AFFINE CIPHER'), 'IHHWVC SWFRCP');
  assert.equal(run('vigenere', 'encrypt', 'ATTACKATDAWN'), 'LXFOPVEFRNHR');
  assert.equal(run('autokey', 'encrypt', 'ATTACKATDAWN'), 'QNXEPKTMDCGN');
  assert.equal(run('playfair', 'encrypt', 'instruments', { key: 'monarchy' }), 'GATLMZCLRQXA');
  assert.equal(run('polybius', 'encrypt', 'Hi you'), '23 24 / 54 34 45');
  assert.equal(run('railfence', 'encrypt', 'WE ARE DISCOVERED FLEE AT ONCE'), 'WECRLTEERDSOEEFEAOCAIVDEN');
  assert.equal(run('columnar', 'encrypt', 'WE ARE DISCOVERED FLEE AT ONCE'), 'EVLNACDTESEAROFODEECWIREE');
});

test('every cipher round-trips', () => {
  const message = 'The quick brown fox jumps over the lazy dog';
  for (const cipher of C.list) {
    const enc = run(cipher.id, 'encrypt', message);
    const dec = run(cipher.id, 'decrypt', enc);
    const plain = C.lettersOnly(message);
    const got = C.lettersOnly(dec);
    if (cipher.id === 'playfair') {
      // J becomes I and padding Xs stay in.
      assert.equal(got.replace(/X/g, ''), plain.replace(/J/g, 'I').replace(/X/g, ''), cipher.id);
    } else if (cipher.id === 'polybius') {
      assert.equal(got, plain.replace(/J/g, 'I'), cipher.id);
    } else {
      assert.equal(got, plain, cipher.id);
    }
  }
});

test('columnar handles a short last row and repeated key letters', () => {
  const enc = run('columnar', 'encrypt', 'ABCDEFGHIJ', { key: 'BOOK' });
  assert.equal(run('columnar', 'decrypt', enc, { key: 'BOOK' }), 'ABCDEFGHIJ');
});

test('caesar brute force picks the right shift', () => {
  const secret = run('caesar', 'encrypt', 'Frequency analysis works because some letters are far more common than others.', { shift: 11 });
  const best = A.caesarCandidates(secret).sort((a, b) => a.chi - b.chi)[0];
  assert.equal(best.shift, 11);
});

test('vigenere attack recovers the key', () => {
  const text = 'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of light, it was the season of darkness, it was the spring of hope, it was the winter of despair.';
  const secret = run('vigenere', 'encrypt', text, { key: 'CIPHER' });
  const length = A.guessKeyLength(A.keyLengthScores(secret));
  assert.equal(length, 6);
  assert.equal(A.crackVigenere(secret, length).key, 'CIPHER');
});
