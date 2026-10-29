const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/ciphers.js');
const D = require('../js/daily.js');

const START = '2026-10-26'; // a Monday
const year = Array.from({ length: 365 }, (_, i) => D.addDays(START, i));

test('the same date always gives the same puzzle', () => {
  assert.deepEqual(D.puzzleFor('2026-10-29'), D.puzzleFor('2026-10-29'));
  assert.deepEqual(D.puzzleFor('2031-02-28'), D.puzzleFor('2031-02-28'));
});

test('consecutive dates never share a message', () => {
  for (let i = 1; i < year.length; i++) {
    const a = D.puzzleFor(year[i - 1]);
    const b = D.puzzleFor(year[i]);
    assert.notEqual(a.plain, b.plain, `${year[i - 1]} and ${year[i]}`);
    assert.notEqual(a.text, b.text);
  }
});

test('every message comes round before any repeats', () => {
  const n = D.MESSAGES.length;
  assert.ok(n >= 60);
  // Passes through the pool start on the epoch.
  for (const pass of [0, 1, 2]) {
    const days = Array.from({ length: n }, (_, i) => D.addDays(D.EPOCH, pass * n + i));
    assert.equal(new Set(days.map(k => D.puzzleFor(k).plain)).size, n);
  }
});

test('puzzles are numbered from the epoch', () => {
  assert.equal(D.numberFor(D.EPOCH), 1);
  assert.equal(D.puzzleFor(D.addDays(D.EPOCH, 127)).number, 128);
  // Across a daylight-saving change the count still moves by one.
  assert.equal(D.numberFor('2026-10-26') - D.numberFor('2026-10-25'), 1);
});

test('every puzzle for the next year decrypts with its stated cipher and key', () => {
  for (const key of year) {
    const p = D.puzzleFor(key);
    const cipher = C.byId(p.cipher);
    const defaults = Object.fromEntries(cipher.keys.map(k => [k.id, k.value]));
    const out = cipher.decrypt(p.text, { ...defaults, ...p.keys });
    assert.equal(D.normalise(out, p.cipher), D.normalise(p.plain, p.cipher), `${key} ${p.cipher}`);
    assert.notEqual(C.lettersOnly(p.text), C.lettersOnly(p.plain), `${key} is not encrypted`);
  }
});

test('the last hint names the key', () => {
  for (const key of year) {
    const p = D.puzzleFor(key);
    assert.equal(p.hints.length, 3);
    const last = p.hints[2];
    if (p.cipher === 'caesar') assert.match(last, new RegExp(`shift is ${p.keys.shift}\\.`));
    if (p.cipher === 'affine') assert.ok(last.includes(`a = ${p.keys.a} and b = ${p.keys.b}`));
    if (p.cipher === 'railfence') assert.ok(last.startsWith(`${p.keys.rails} rails`));
    if (p.keys.key) assert.ok(last.includes(p.keys.key), key);
  }
});

test('difficulty follows the weekday', () => {
  const allowed = {
    1: ['caesar', 'atbash'],
    2: ['affine', 'railfence'],
    3: ['affine', 'railfence', 'vigenere'],
    4: ['vigenere', 'columnar'],
    5: ['columnar', 'playfair', 'vigenere'],
  };
  const tiers = [5, 1, 2, 3, 3, 4, 5];
  for (const key of year) {
    const p = D.puzzleFor(key);
    const day = D.weekday(key);
    assert.equal(p.tier, tiers[day], key);
    assert.ok(allowed[p.tier].includes(p.cipher), `${key} ${p.cipher}`);
    if (p.cipher === 'vigenere') {
      const length = p.keys.key.length;
      if (p.tier === 5) assert.ok(length >= 8, `${key} weekend key ${p.keys.key}`);
      else assert.ok(length <= 6, `${key} midweek key ${p.keys.key}`);
    }
  }
  assert.equal(D.puzzleFor('2026-10-26').level, 'Easy');
  assert.equal(D.puzzleFor('2026-11-01').level, 'Fiendish');
});

test('answers ignore spacing, case, J and Playfair padding', () => {
  assert.equal(D.normalise('Meet at the bridge, at noon!', 'caesar'), 'MEETATTHEBRIDGEATNOON');
  assert.equal(D.normalise('jump', 'vigenere'), 'IUMP');
  assert.equal(D.normalise('BALXLOON', 'playfair'), D.normalise('balloon', 'playfair'));
});

test('streaks count back from today, or from yesterday until today is solved', () => {
  const days = { '2026-10-26': 0, '2026-10-27': 2, '2026-10-28': 1 };
  assert.equal(D.streak(days, '2026-10-28'), 3);
  assert.equal(D.streak(days, '2026-10-29'), 3);
  assert.equal(D.streak(days, '2026-10-30'), 0);
  assert.equal(D.streak({}, '2026-10-29'), 0);
});

test('the result line', () => {
  const p = D.puzzleFor(D.addDays(D.EPOCH, 127));
  assert.equal(D.resultText(p, 1, 4), 'Cryptex intercept No. 128: cracked with 1 hint. Streak: 4');
  assert.equal(D.resultText(p, 0, 1), 'Cryptex intercept No. 128: cracked with no hints. Streak: 1');
  assert.ok(!/\u2014/.test(D.resultText(p, 2, 9)));
});
