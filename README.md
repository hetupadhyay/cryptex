# Cryptex

Classical ciphers, worked through one letter at a time, and the attacks that break them.

Live at https://cryptexciphers.vercel.app. A personal project by Het Upadhyay.

Four main pages, plus terms, privacy and a 404 page:

- **Home.** A brass cryptex you can drag, flick or tap (its rings turn together, which is exactly a Caesar cipher), today's intercept, and the way into the rest.
- **Learn.** Twenty-six centuries of secret writing as one essay, with a year rail beside it: all ten ciphers in the order they entered history and how each one fell, a working Enigma, the one-time pad, how long a brute-force search would take, and why it matters for the padlock in your browser.
- **Lab.** Pick a cipher from the codebook, type a message, and watch every step: the Caesar alphabet sliding into place, a path through the tabula recta, a Playfair rectangle, the rail fence zig-zag, columns sorting themselves under a keyword. Pause, step, scrub, change the speed, or send the result as a secret link.
- **Codebreaking.** Three folders: today's intercept (a new message every day, with streaks), eight missions from a Roman courier to the Western Front, and the desk, which breaks Caesar, affine, rail fence, Vigenère and Beaufort without the key.

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

Everything runs in the page, and nothing is loaded from other sites. The fonts, Courier Prime and Hanken Grotesk, are in `fonts/` with their SIL Open Font License files.

## Tests

The ciphers, the attacks, the Enigma machine and the daily puzzle are checked against worked examples and round trips:

```sh
npm test
```

CI also checks that no page loads anything from another site, that the shared masthead and footer are in sync, and that the file stamps are current.

### In a browser

`tests/browser/` checks the site in Chromium, served with the headers from `vercel.json`. It covers:

- every page in day and night at three widths, with no script errors, blocked requests, requests to other sites, or sideways scrolling;
- all ten ciphers there and back;
- a mission cracked and kept;
- the desk, secret links and the phone menu;
- opening offline.

It has its own `package.json`, so the site itself still has nothing to install:

```sh
cd tests/browser
npm ci
npx playwright install chromium   # once
cd ../..
npm run test:browser
```

These tests run on every push and pull request too.

## After changing a file

- **The masthead or footer** (`tools/shell/`): run `python3 tools/sync-shell.py` to copy them into every page.
- **Any page, stylesheet, script or font**: run `python3 tools/stamp.py`. It adds a hash of each stylesheet and script to its link (`?v=...`), so browsers and the offline cache never keep an old copy, and writes the release's file list into `sw.js`.

## How it's put together

```
index.html learn.html lab.html codebreaking.html   the four main pages
terms.html privacy.html 404.html                   the standalone pages
tools/shell/          the masthead and footer every page shares
tools/sync-shell.py   copies them into each page
tools/stamp.py        file stamps and the offline file list
tools/serve.py        a local server that behaves like Vercel
tools/check-external.js  CI check: nothing loaded from other sites
tools/render-images.js   redraws the icons and the sharing image
sw.js                 the offline cache, one release at a time
speculation-rules.json  lets the browser load the next page early
js/theme.js           sets day or night before the page paints
js/site.js            the lamp, the phone menu, today's number, the signature
js/sheet.js           phone sheets: Back closes them, swipe them away
js/pwa.js             registers the offline cache
js/handoff.js         carries work from one page to another
js/ciphers.js         the ciphers themselves, no DOM
js/analysis.js        letter statistics for the attacks
js/enigma.js          the Enigma machine, no DOM
js/stage.js           the step player: play, pause, seek, flying letters
js/scenes/*.js        one animated scene per kind of cipher
js/lab.js             the lab
js/share.js           secret links
js/history.js         the Learn year rail and links into the lab
js/story.js           the Enigma and one-time pad figures on Learn
js/strength.js        the key strength chart
js/breaker.js         the codebreaker's desk
js/intercepts.js      the missions
js/daily.js           the daily intercept (the puzzle part runs in Node too)
js/codebreaking.js    the folder tabs
js/home.js            Home: today's strip, the doors, old links
js/cryptex.js         the cryptex on Home
js/spring.js          the spring the cryptex rings turn on
js/background.js      the cipher pad behind Home
css/site.css          tokens and shared components
css/shell.css         masthead and footer
css/*.css             one stylesheet per page or part
```

Each scene returns a list of steps and a `show(step, animate)` function that can draw any step from scratch. That's what lets you jump backwards or scrub without the animation getting out of sync.

## Adding a cipher

1. Add its entry to the list in `js/ciphers.js`: keys, a key check, encrypt, decrypt, and the about and weakness lines.
2. Pick a scene in `js/scenes/`, or write a new one and add its script to `lab.html`.
3. Give it a key count in `KEYSPACE` in `js/lab.js` and a row in `js/strength.js`.
4. Write its entry on Learn in `learn.html`, and its year on Home.
5. Add a known answer to `tests/ciphers.test.js`, then run `npm test` and `python3 tools/stamp.py`.

## Licence

The code is under the MIT License. The fonts are under the SIL Open Font License; see `fonts/`. The Cryptex name and key logo aren't covered by the MIT License.
