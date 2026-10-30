# Cryptex

Classical ciphers, worked through one letter at a time, and the attacks that break them.

Live at https://cryptexciphers.vercel.app. A personal project by Het Upadhyay.

Four main pages, optional accounts, and terms, privacy and a 404 page:

- **Home.** A brass cryptex you can drag, flick or tap (its rings turn together, which is exactly a Caesar cipher), today's intercept, and the way into the rest.
- **Learn.** Twenty-six centuries of secret writing as one essay, with a year rail beside it: all ten ciphers in the order they entered history and how each one fell, a working Enigma, the one-time pad, how long a brute-force search would take, and why it matters for the padlock in your browser.
- **Lab.** Pick a cipher from the codebook, type a message, and watch every step: the Caesar alphabet sliding into place, a path through the tabula recta, a Playfair rectangle, the rail fence zig-zag, columns sorting themselves under a keyword. Pause, step, scrub, change the speed, or send the result as a secret link.
- **Codebreaking.** Three folders: today's intercept (a new message every day, with streaks), eight missions from a Roman courier to the Western Front, and the desk, which breaks Caesar, affine, rail fence, Vigenère and Beaufort without the key.

- **Accounts (optional).** Sign up with an email and password, or with Google, GitHub or Apple, and your cracked missions and daily streak follow you to every device. Everything else works without one.

| Family | Ciphers |
| --- | --- |
| Substitution | Caesar, Atbash, Affine |
| Polyalphabetic | Vigenère, Autokey, Beaufort |
| Grid | Playfair, Polybius |
| Transposition | Rail fence, Columnar |

## Running it

There's no build step. Install the account code's packages once, then serve the site the way Vercel does, with clean URLs, the security headers from `vercel.json` and the account API:

```sh
npm install
npm start        # node tools/dev.js 8000
```

Then open http://127.0.0.1:8000. Locally, accounts live in an in-memory Postgres that starts empty each time, and emails are printed in the terminal instead of being sent.

The ciphers and everything else run in the page, and nothing is loaded from other sites. The fonts, Courier Prime and Hanken Grotesk, are in `fonts/` with their SIL Open Font License files.

## Accounts

The pages call one serverless function, `api/main.js` (`vercel.json` sends every `/api/*` request to it). It keeps accounts in Postgres and creates its tables on first use.

| Variable | What it's for | Needed |
| --- | --- | --- |
| `DATABASE_URL` | The Postgres database. Vercel sets it when you add a Neon database to the project. | Yes, for accounts |
| `SMTP_URL`, `MAIL_FROM` | Sends the emails that confirm an address and reset a password, e.g. `smtps://you%40gmail.com:app-password@smtp.gmail.com:465` | For those two emails |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Continue with Google | For that button |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Continue with GitHub | For that button |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Continue with Apple (needs an Apple Developer membership) | For that button |

Each sign-in button only appears once its keys are set. The address to give each provider as the callback is `https://<your site>/api/auth/<google|github|apple>/callback`. Without a database the site works as before and the sign-in page says accounts aren't switched on yet.

## Tests

The ciphers, the attacks, the Enigma machine and the daily puzzle are checked against worked examples and round trips, and the account API is tested over HTTP against a real Postgres (in memory), with Google, GitHub and Apple stood in for:

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
- opening offline;
- accounts: signing up and in, progress following you to a second browser, deleting an account, and no account requests at all from a visitor who never signs in.

It has its own `package.json`:

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
tools/dev.js          a local server that behaves like Vercel, account API included
api/main.js           the account API: sign-up, sign-in, sessions, progress
api/_lib/             its parts: database, passwords, providers, email, limits
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
js/account.js         the masthead's sign-in state and syncing progress
js/auth.js            the sign-in, account and reset-password pages
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
