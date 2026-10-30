/*
 * The Enigma I machine itself: rotors, reflector, plugboard and the
 * stepping, with no page attached, so the tests can run it in Node.
 * js/story.js builds the working figure on Learn around it.
 */
(function (root) {
  'use strict';

  const Ciphers = root.Ciphers || require('./ciphers.js');
  const { ALPHABET, mod, toIndex } = Ciphers;
  const isLetter = ch => /^[A-Z]$/i.test(ch);

  // Army and air force rotors. The notch is the letter showing in the window
  // when the rotor is about to carry its left-hand neighbour along.
  const ROTORS = {
    I: { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
    II: { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
    III: { wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' },
    IV: { wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notch: 'J' },
    V: { wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', notch: 'Z' },
  };
  const REFLECTOR_B = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';

  // Plugboard pairs like "AT BL" as a swap table. Pairs after the first
  // mistake are ignored, and the mistake is reported.
  function plugboard(pairs) {
    const map = [...ALPHABET].map((_, i) => i);
    for (const pair of String(pairs).toUpperCase().split(/[^A-Z]+/).filter(Boolean)) {
      if (pair.length !== 2 || pair[0] === pair[1]) {
        return { map, error: `Plug letters in pairs of two different letters, like AT. ${pair} isn’t one.` };
      }
      const [a, b] = [...pair].map(toIndex);
      const taken = map[a] !== a ? pair[0] : map[b] !== b ? pair[1] : '';
      if (taken) return { map, error: `${taken} is already plugged. Each letter takes one cable.` };
      map[a] = b;
      map[b] = a;
    }
    return { map, error: '' };
  }

  // Rotors are listed left to right, as they sat in the machine. Rings and
  // start positions are letters, one per rotor.
  function machine({ rotors = ['I', 'II', 'III'], rings = 'AAA', start = 'AAA', plugs = '' } = {}) {
    const wheels = rotors.map(name => {
      const fwd = [...ROTORS[name].wiring].map(toIndex);
      const back = [];
      fwd.forEach((out, i) => { back[out] = i; });
      return { fwd, back, notch: toIndex(ROTORS[name].notch) };
    });
    const ring = [...rings].map(toIndex);
    const pos = [...start].map(toIndex);
    const plug = plugboard(plugs).map;
    const reflect = [...REFLECTOR_B].map(toIndex);

    // One pass through rotor i, in either direction.
    const through = (table, i, x) => {
      const offset = pos[i] - ring[i];
      return mod(table[mod(x + offset, 26)] - offset, 26);
    };

    // The rotors turn before the current flows. The middle rotor moves again
    // on the very next key press once it reaches its own notch, taking the
    // left rotor with it: the double step.
    function step() {
      if (pos[1] === wheels[1].notch) {
        pos[0] = mod(pos[0] + 1, 26);
        pos[1] = mod(pos[1] + 1, 26);
      } else if (pos[2] === wheels[2].notch) {
        pos[1] = mod(pos[1] + 1, 26);
      }
      pos[2] = mod(pos[2] + 1, 26);
    }

    function press(letter) {
      step();
      let x = plug[toIndex(letter)];
      for (let i = 2; i >= 0; i--) x = through(wheels[i].fwd, i, x);
      x = reflect[x];
      for (let i = 0; i <= 2; i++) x = through(wheels[i].back, i, x);
      return ALPHABET[plug[x]];
    }

    return { pos, press };
  }

  // Letters go through the machine, everything else is copied as it is.
  // Enigma is its own inverse, so this decrypts too.
  function encrypt(text, settings) {
    const m = machine(settings);
    return [...String(text).toUpperCase()].map(ch => (isLetter(ch) ? m.press(ch) : ch)).join('');
  }


  const api = { ROTORS, REFLECTOR_B, plugboard, machine, encrypt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Enigma = api;
})(this);
