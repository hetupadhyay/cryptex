# Cryptex

Classical ciphers, worked through one letter at a time, and the attacks that break them.

**Encrypt / Decrypt** has ten ciphers. Pick one, type a message, and watch every step on the stage: the Caesar alphabet sliding into place, a path through the tabula recta, a Playfair rectangle being swapped, the rail fence zig-zag, columns sorting themselves under a keyword. You can pause, step back and forth, scrub, or change the speed.

| Family | Ciphers |
| --- | --- |
| Substitution | Caesar, Atbash, Affine |
| Polyalphabetic | Vigenère, Autokey, Beaufort |
| Grid | Playfair, Polybius |
| Transposition | Rail fence, Columnar |

**Break it** shows why none of them are safe:

- **Try every shift.** All 25 Caesar decryptions, ranked by how close their letter counts are to English (chi-squared).
- **Count the letters.** Your text's letter frequencies against English. Slide the bars until the peaks line up to read off the shift. It also spots transposition ciphers, whose counts already look like English.
- **Find a Vigenère key.** The index of coincidence for each key length gives away the period. Each column is then a Caesar cipher on its own, so the key falls out letter by letter.

## Running it

There's no build step and nothing to install. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server
```

Everything runs in the page. There are no network requests; the fonts (Courier Prime and Hanken Grotesk, both under the SIL Open Font License) are in `fonts/`.

## Tests

The cipher and analysis code is checked against textbook examples and round trips:

```sh
npm test
```

## How it's put together

```
js/ciphers.js      the ciphers themselves, no DOM
js/analysis.js     letter statistics for the attacks
js/stage.js        the step player: play, pause, seek, flying letters
js/scenes/*.js     one animated scene per kind of cipher
js/breaker.js      the Break it tab
js/app.js          wiring for the page
```

Each scene returns a list of steps and a `show(step, animate)` function that can draw any step from scratch. That's what lets you jump backwards or scrub without the animation getting out of sync.
