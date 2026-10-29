# Security

Cryptex is a static, educational site about classical ciphers. The ciphers it teaches are all broken; never use them to protect anything real. This page is about the security of the site itself.

## Reporting a problem

- **Something sensitive** (a way to run script on the page, to read someone else's data, or anything you'd rather not post in public): open a private report from the repository's [Security tab](https://github.com/hetupadhyay/Cryptex/security/advisories/new). Only the maintainer can see it.
- **Anything else**: [open an issue](https://github.com/hetupadhyay/Cryptex/issues).

Please say what you found, how to reproduce it, and which browser you used. Reports are read and answered as soon as possible. Please don't test against other people's devices or try to disrupt the hosted site.

## What the site stores

There are no accounts, cookies, analytics, ads or server code. Everything runs in the browser.

Kept on your device, in `localStorage`:

| What | Why |
| --- | --- |
| Day or Night theme | So the theme you picked sticks |
| Cracked intercepts | Your progress through the missions |
| Daily intercept streak | Your streak, from one day to the next |

The service worker also keeps a cache of the site's own files, so it opens offline. Clearing the site's data in your browser removes all of it.

Secret links carry the ciphertext, and the key if you choose to include it, in the URL fragment (after the `#`). Browsers don't send the fragment to servers, so the host never sees it, but anyone with the link does.

The host, Vercel, keeps standard request logs under its own privacy policy.

## Headers

`vercel.json` sends these on every response:

- `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. No inline or external scripts or styles can run. Scripts set the few values they animate as style properties, which the policy allows.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `X-Frame-Options: DENY`

Fonts are cached for a year and images for 30 days. HTML and `sw.js` are sent with `no-cache`, so updates show up on the next visit.

## Audit

The last review was on 29 October 2026. It covered every script on the site:

- **No inline script.** The theme is picked by `js/theme.js` rather than an inline `<script>`. No page uses inline event handlers, `javascript:` URLs, `eval` or `new Function`.
- **No external requests.** Every script, stylesheet and font is served from the site. CI fails if a page loads one from anywhere else (`tools/check-external.js`).
- **`innerHTML`.** Used only with fixed markup written in the scripts. Anything from the user, a link or storage goes in with `textContent`.
- **Secret links.** Treated as untrusted. A link is refused if its fragment is over 8 KB, isn't base64url, or isn't a JSON object with a known cipher and a string ciphertext of at most 4,000 characters. A key that is missing, too long, not a string or not valid for the cipher is dropped. The link is cleared from the address bar once it's read. Links that would be too long to open are refused when you make them.
- **Local storage.** Every read is wrapped in `try`, so blocked or broken storage falls back to defaults. Saved values are checked (the theme must be `day` or `night`; cracked intercepts must be known mission ids) before they're used.
- **Clipboard.** Only written to, and only when you press a Copy button. Nothing is ever read from it.
- **Service worker.** Only handles same-origin `GET` requests, only caches successful responses, and is never registered on `file://` pages.
