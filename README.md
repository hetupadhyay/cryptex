# Cryptex

Classical ciphers, worked through one letter at a time, and the attacks that break them.

Four pages:

- **Home.** A brass cryptex you can drag and flick (its rings turn together, which is exactly a Caesar cipher), today's intercept, and the way into the rest.
- **Learn.** Two thousand years of secret writing as one essay, with a year rail beside it: all ten ciphers in the order they entered history, a working Enigma, the one-time pad, how long a brute-force search would take, and why it matters for the padlock in your browser.
- **Lab.** Pick a cipher from the codebook, type a message, and watch every step: the Caesar alphabet sliding into place, a path through the tabula recta, a Playfair rectangle, the rail fence zig-zag, columns sorting themselves under a keyword. Pause, step, scrub, change the speed, or send the result as a secret link.
- **Codebreaking.** Three folders: today's intercept (a new message every day, with streaks), eight missions from Rome to 1917, and the desk, which breaks Caesar, affine, rail fence, Vigenère and Beaufort without the key.

| Family | Ciphers |
| --- | --- |
| Substitution | Caesar, Atbash, Affine |
| Polyalphabetic | Vigenère, Autokey, Beaufort |
| Grid | Playfair, Polybius |
| Transposition | Rail fence, Columnar |

## Running it

There's no build step and nothing to install. Serve the folder the way Vercel does, with clean URLs and the security headers from `vercel.json`:

```sh
npm start        # python3 tools/serve.py . 8000
```

Then open http://127.0.0.1:8000.

Everything runs in the page. There are no network requests; the fonts (Courier Prime and Hanken Grotesk, both under the SIL Open Font License) are in `fonts/`.

## Tests

The cipher and analysis code is checked against textbook examples and round trips:

```sh
npm test
```

## How it's put together

```
index.html learn.html lab.html codebreaking.html   the four pages
tools/shell/        the masthead and footer every page shares
tools/sync-shell.py copies them into each page (CI checks they match)
js/site.js          the lamp, the phone menu, today's number, the signature
js/handoff.js       carries work from one page to another
js/ciphers.js       the ciphers themselves, no DOM
js/analysis.js      letter statistics for the attacks
js/stage.js         the step player: play, pause, seek, flying letters
js/scenes/*.js      one animated scene per kind of cipher
js/lab.js           the lab
js/share.js         secret links
js/history.js       the Learn essay's cipher entries and year rail
js/story.js         Enigma and the one-time pad
js/strength.js      the key strength chart
js/breaker.js       the codebreaker's desk
js/intercepts.js    the missions
js/daily.js         the daily intercept
js/codebreaking.js  the folder tabs
js/cryptex.js       the draggable cryptex on Home
js/background.js    the cipher pad behind Home
css/site.css        tokens and shared components
css/shell.css       masthead and footer
css/*.css           one stylesheet per page or part
```

The masthead and footer live in `tools/shell/`. After editing them, run `python3 tools/sync-shell.py`.

Each scene returns a list of steps and a `show(step, animate)` function that can draw any step from scratch. That's what lets you jump backwards or scrub without the animation getting out of sync.
