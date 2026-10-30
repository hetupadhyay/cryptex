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

test('more known answers, both ways', () => {
  // Beaufort is its own inverse, so a wrong formula would still round-trip:
  // check it against working by hand (key letter minus message letter).
  assert.equal(run('beaufort', 'encrypt', 'HELLO', { key: 'KEY' }), 'DANZQ');
  assert.equal(run('beaufort', 'decrypt', 'DANZQ', { key: 'KEY' }), 'HELLO');
  assert.equal(run('autokey', 'encrypt', 'ATTACKATDAWN', { key: 'QUEENLY' }), 'QNXEPVYTWTWP');
  assert.equal(run('autokey', 'decrypt', 'QNXEPVYTWTWP', { key: 'QUEENLY' }), 'ATTACKATDAWN');
  assert.equal(run('vigenere', 'decrypt', 'LXFOPVEFRNHR'), 'ATTACKATDAWN');
  assert.equal(run('affine', 'decrypt', 'IHHWVC SWFRCP'), 'AFFINE CIPHER');
  assert.equal(run('playfair', 'encrypt', 'hide the gold in the tree stump', { key: 'playfair example' }), 'BMODZBXDNABEKUDMUIXMMOUVIF');
  assert.equal(run('railfence', 'decrypt', 'WECRLTEERDSOEEFEAOCAIVDEN'), 'WEAREDISCOVEREDFLEEATONCE');
  assert.equal(run('columnar', 'decrypt', 'EVLNACDTESEAROFODEECWIREE'), 'WEAREDISCOVEREDFLEEATONCE');
  assert.equal(run('polybius', 'decrypt', '23 24 / 54 34 45'), 'HI YOU');
});

test('letters outside A to Z pass through and keep their place', () => {
  const message = 'Grüße aus der Straße, ſ ﬁne 😀 café 123';
  for (const id of ['caesar', 'atbash', 'affine', 'vigenere', 'autokey', 'beaufort']) {
    const enc = run(id, 'encrypt', message);
    assert.equal(run(id, 'decrypt', enc), message, id);
    assert.equal([...enc].length, [...message].length, id);
  }
  assert.equal(C.lettersOnly('Straße'), 'STRAE');
  assert.equal(C.upper('straße 😀'), 'STRAßE 😀');
});

test('number keys must be plain whole numbers in range', () => {
  const affine = C.byId('affine');
  for (const b of ['', ' ', '0x3', '1e1', '2.5', '26', '-1']) assert.ok(affine.check({ a: 5, b }), JSON.stringify(b));
  for (const b of [0, '8', ' 8 ', 25]) assert.equal(affine.check({ a: 5, b }), '', JSON.stringify(b));
  assert.ok(C.byId('columnar').check({ key: 'ABCDEFGHIJK' }), 'a keyword longer than ten letters');
  assert.equal(C.byId('columnar').check({ key: 'ABCDEFGHIJ' }), '');
  assert.ok(affine.check({ a: 13, b: 0 }), 'a must have an inverse');
  assert.ok(C.byId('vigenere').check({ key: '123' }), 'a keyword needs letters');
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

test('beaufort attack recovers the key', () => {
  const text = 'The harbour master keeps two sets of books. One goes to the customs office every Friday, and the other stays locked in the safe behind his desk. Find the second set and copy the pages for the last three months, then put everything back exactly as you found it.';
  const secret = run('beaufort', 'encrypt', text, { key: 'ANCHOR' });
  const length = A.guessKeyLength(A.keyLengthScores(secret));
  assert.equal(length, 6);
  const { key, plaintext } = A.crackBeaufort(secret, length);
  assert.equal(key, 'ANCHOR');
  assert.equal(plaintext, text);
});

test('rail fence attack picks the right rail count', () => {
  const text = 'The convoy leaves at dawn from the southern harbour with six ships and two escorts. Tell the pilots to stay low over the water until they reach the coast.';
  for (let rails = 2; rails <= 8; rails++) {
    const secret = run('railfence', 'encrypt', text, { rails });
    const rows = A.railCandidates(secret);
    assert.deepEqual(rows.map(r => r.rails), [2, 3, 4, 5, 6, 7, 8]);
    const best = rows.reduce((a, b) => (b.score > a.score ? b : a));
    assert.equal(best.rails, rails);
    assert.equal(best.text, C.lettersOnly(text));
  }
});

test('affine attack tries all 312 keys and ranks the right one first', () => {
  const text = 'The ledger is hidden behind the clock in the station master’s office. Collect it before the morning train and leave the key with the porter.';
  for (const [a, b] of [[5, 8], [7, 3], [25, 0], [11, 19]]) {
    const secret = run('affine', 'encrypt', text, { a, b });
    const rows = A.affineCandidates(secret);
    assert.equal(rows.length, 312);
    assert.deepEqual([rows[0].a, rows[0].b], [a, b]);
    assert.equal(rows[0].text, text);
  }
});
