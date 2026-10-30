"""Stamps every stylesheet and script link with a hash of the file, and
writes the release's file list and version into sw.js.

The site has no build step, so a changed file needs a new address or
browsers and the offline cache keep the old one. This adds ?v=<hash> to
each css/ and js/ link in the pages, and fills the block between
// stamp:start and // stamp:end in sw.js with every file a page needs,
so the service worker can cache a release as one set. Run it after
changing any CSS, JS, font or page. With --check it only reports what's
out of date (used in CI).
"""
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = sorted(p.name for p in ROOT.glob('*.html'))
# The addresses the pages are served at, cached for reading offline.
ROUTES = ['/', '/learn', '/lab', '/codebreaking', '/terms', '/privacy']
EXTRA = ['manifest.webmanifest', 'img/mark.svg', 'img/icon-192.png', 'img/apple-touch-icon.png']
LINK = re.compile(r'((?:href|src)=")(/?)((?:css|js)/[\w/.-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(")')


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()[:10]


def stamped(text):
    return LINK.sub(lambda m: f'{m[1]}{m[2]}{m[3]}?v={digest(m[3])}{m[4]}', text)


def release(pages):
    files = set()
    for text in pages.values():
        files.update('/' + m[3] + f'?v={digest(m[3])}' for m in LINK.finditer(text))
    fonts = sorted('/' + p.relative_to(ROOT).as_posix() for p in (ROOT / 'fonts').glob('*.woff2'))
    urls = ROUTES + sorted(files) + fonts + ['/' + e for e in EXTRA]
    whole = hashlib.sha256()
    for page in sorted(pages):
        whole.update(pages[page].encode())
    for url in urls[len(ROUTES):]:
        whole.update(url.encode())
    for font in fonts:
        whole.update((ROOT / font.lstrip('/')).read_bytes())
    lines = ',\n'.join(f"  '{u}'" for u in urls)
    return (
        '// stamp:start (written by tools/stamp.py)\n'
        f"const VERSION = '{whole.hexdigest()[:10]}';\n"
        f'const PRECACHE = [\n{lines},\n];\n'
        '// stamp:end'
    )


def main():
    check = '--check' in sys.argv
    stale = []
    pages = {}
    for page in PAGES:
        path = ROOT / page
        text = path.read_text()
        new = stamped(text)
        pages[page] = new
        if new != text:
            stale.append(page)
            if not check:
                path.write_text(new)

    sw = ROOT / 'sw.js'
    text = sw.read_text()
    block = re.compile(r'// stamp:start.*?// stamp:end', re.S)
    if not block.search(text):
        raise SystemExit('sw.js is missing its // stamp:start and // stamp:end markers')
    new = block.sub(lambda m: release(pages), text)
    if new != text:
        stale.append('sw.js')
        if not check:
            sw.write_text(new)

    if check and stale:
        print('Out of date: ' + ', '.join(stale) + '. Run python3 tools/stamp.py.')
        sys.exit(1)
    print('Up to date.' if not stale else 'Stamped ' + ', '.join(stale) + '.')


if __name__ == '__main__':
    main()
