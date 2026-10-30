const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/enigma.js');

test('Enigma I matches the well-known AAAAA example', () => {
  // Rotors I, II, III, reflector B, rings and start at A, no plugs.
  assert.equal(E.encrypt('AAAAA'), 'BDZGO');
});

test('the middle rotor steps twice in a row', () => {
  const m = E.machine({ start: 'ADU' });
  const seen = [];
  for (let i = 0; i < 3; i++) {
    m.press('A');
    seen.push(m.pos.map(p => String.fromCharCode(65 + p)).join(''));
  }
  assert.deepEqual(seen, ['ADV', 'AEW', 'BFX']);
});

test('the machine undoes itself, and never maps a letter to itself', () => {
  const settings = { start: 'QEV', plugs: 'AQ BJ CW DM EK FT' };
  const text = 'WEATHER FORECAST FOR THE CHANNEL';
  const enc = E.encrypt(text, settings);
  assert.equal(E.encrypt(enc, settings), text);
  for (let i = 0; i < text.length; i++) if (text[i] !== ' ') assert.notEqual(enc[i], text[i]);
});

test('the plugboard reports the first bad pair', () => {
  assert.equal(E.plugboard('AQ BJ').error, '');
  assert.match(E.plugboard('AQ B').error, /B isn’t one/);
  assert.match(E.plugboard('AQ QB').error, /Q is already plugged/);
  assert.match(E.plugboard('AA').error, /AA isn’t one/);
});
