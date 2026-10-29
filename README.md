# Cryptex

Classical ciphers, worked through one letter at a time, and the attacks that break them.

It's one scrolling page:

- **The cryptex.** A brass cylinder lock you can drag and flick. The rings turn together, which is exactly a Caesar cipher.
- **History.** All ten ciphers in the order they entered history, from Atbash around 600 BC to columnar transposition on the Western Front.
- **The lab.** Pick a cipher, type a message, and watch every step: the Caesar alphabet sliding into place, a path through the tabula recta, a Playfair rectangle, the rail fence zig-zag, columns sorting themselves under a keyword. Pause, step, scrub, or change the speed.
- **How long would it take?** Every cipher's key count and brute-force time next to AES-128, plus the shortcut that actually breaks it.
- **The codebreaker's desk.** Try all 25 Caesar shifts, compare letter frequencies with English, or recover a Vigenère key from the index of coincidence.
- **Intercepts.** Eight messages to crack, from Rome to 1917, with hints. Progress is saved in your browser.
- **Send a secret.** Encrypt a message and get a link. The ciphertext travels in the link's `#fragment`, so it never reaches a server.

| Family | Ciphers |
| --- | --- |
| Substitution | Caesar, Atbash, Affine |
| Polyalphabetic | Vigenère, Autokey, Beaufort |
| Grid | Playfair, Polybius |
| Transposition | Rail fence, Columnar |

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
js/spring.js       a small spring for the cryptex
js/cryptex.js      the draggable cryptex at the top
js/lab.js          the lab
js/breaker.js      the codebreaker's desk
js/history.js      the timeline
js/strength.js     the key strength chart
js/intercepts.js   the missions
js/share.js        secret links
js/background.js   the cipher pad behind the page
css/site.css       the page
css/scenes.css     everything drawn on the stage
```

Each scene returns a list of steps and a `show(step, animate)` function that can draw any step from scratch. That's what lets you jump backwards or scrub without the animation getting out of sync.
