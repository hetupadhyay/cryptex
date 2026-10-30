# Security

Cryptex is a static, educational site about classical ciphers. The ciphers it teaches are all broken; never use them to protect anything real. This page is about the security of the site itself.

## Reporting a problem

- **Something sensitive** (a way to run script on the page, to read someone else's data, or anything you'd rather not post in public): open a private report from the repository's [Security tab](https://github.com/hetupadhyay/Cryptex/security/advisories/new). Only the maintainer can see it.
- **Anything else**: [open an issue](https://github.com/hetupadhyay/Cryptex/issues).

Please say what you found, how to reproduce it, and which browser you used. Reports are read and answered as soon as possible. Please don't test against other people's devices or try to disrupt the hosted site.

## What the site stores

There are no accounts, cookies, analytics, ads or server code. Everything runs in the browser.

Kept on your device, in `localStorage`:

| Key | What | Why |
| --- | --- | --- |
| `cryptex-theme` | Whether the night lamp is on | So the look you picked sticks |
| `cryptex-cracked` | Ids of the missions you've cracked | Your progress through the eight missions |
| `cryptex-daily` | The dates you cracked today's intercept, the hints used on each, hints used today, and your best streak | Your streak and record |

Kept for a moment, in `sessionStorage`: `cryptex-handoff`, the text (up to 20,000 characters) and settings you send from one page to another with Send to the desk or Open in the lab. The page it's for deletes it as soon as it reads it, and it's ignored after a minute.

The service worker also keeps a cache of the site's own files, so it opens offline. Clearing the site's data in your browser removes all of it.

Secret links carry the ciphertext, and the key if you choose to include it, in the URL fragment (after the `#`). Browsers don't send the fragment to servers, so the host never sees it, but anyone with the link does.

The host, Vercel, keeps standard request logs under its own privacy policy. Because of `speculation-rules.json`, a browser may load a page in the background when you point at a link to it, so that request can appear in those logs too.

## Headers

`vercel.json` sends these on every response:

- `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. No inline or external scripts or styles can run. Scripts set the few values they animate as style properties, which the policy allows.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `X-Frame-Options: DENY`
- `Speculation-Rules: "/speculation-rules.json"`, which lets the browser load the next page early

Stylesheets and scripts are linked with a hash of their contents (`?v=...`, written by `tools/stamp.py`) and cached for a year, as are fonts. Images are cached for 30 days. HTML and `sw.js` are sent with `no-cache`. The service worker fetches pages from the network first, so a new release shows up on the next page view.

## Audit

The last review was on 30 October 2026. It covered every script on the site:

- **No inline script.** The theme is picked by `js/theme.js` rather than an inline `<script>`. No page uses inline event handlers, `javascript:` URLs, `eval` or `new Function`.
- **No external requests.** Every script, stylesheet and font is served from the site. CI fails if a page loads one from anywhere else (`tools/check-external.js`).
- **`innerHTML`.** Used only with fixed markup written in the scripts. Anything from the user, a link or storage goes in with `textContent`.
- **Secret links.** Treated as untrusted. A link is refused if its fragment is over 8 KB, isn't base64url, or isn't a JSON object with a known cipher and a string ciphertext of at most 4,000 characters. A key that is missing, too long, not a string or not valid for the cipher is dropped. The link is cleared from the address bar once it's read. Links that would be too long to open are refused when you make them.
- **Local storage.** Every read is wrapped in `try`, so blocked or broken storage falls back to defaults. Saved values are checked (the theme must be `day` or `night`; cracked missions must be known mission ids; daily records must be dates and small whole numbers) before they're used. Hand-offs between pages are checked for size and age, and an unknown desk attack falls back to the first one.
- **Clipboard.** Only written to, and only when you press a Copy button. Nothing is ever read from it.
- **Service worker.** Only handles same-origin `GET` requests, only caches successful responses, and is never registered on `file://` pages. It caches each release as one set, so a page never runs against files from another release.

## Supported versions

Only the live site and the `main` branch. Fixes go out as soon as they're merged.
