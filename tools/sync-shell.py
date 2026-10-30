"""Copies the shared masthead and footer from tools/shell/ into every page.

The site has no build step, so each page carries its own copy of the shell
between <!-- shell:header --> and <!-- shell:footer --> markers. Run this
after editing tools/shell/*.html. With --check it only reports pages that
are out of date (used in CI).
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ['index.html', 'learn.html', 'lab.html', 'codebreaking.html', 'terms.html', 'privacy.html', '404.html',
         'signin.html', 'account.html', 'reset.html']
PARTS = {name: (ROOT / 'tools' / 'shell' / f'{name}.html').read_text().rstrip('\n') for name in ('header', 'footer')}


def synced(text):
    for name, body in PARTS.items():
        pattern = re.compile(rf'<!-- shell:{name} -->.*?<!-- /shell:{name} -->', re.S)
        if not pattern.search(text):
            raise SystemExit(f'missing shell:{name} markers')
        block = f'<!-- shell:{name} -->\n{body}\n  <!-- /shell:{name} -->'
        text = pattern.sub(lambda m: block, text)
    return text


def main():
    check = '--check' in sys.argv
    stale = []
    for page in PAGES:
        path = ROOT / page
        text = path.read_text()
        new = synced(text)
        if new != text:
            stale.append(page)
            if not check:
                path.write_text(new)
    if check and stale:
        print('Shell out of date in: ' + ', '.join(stale) + '. Run python3 tools/sync-shell.py.')
        sys.exit(1)
    print('Shell up to date.' if check else f'Updated {len(stale)} page(s).')


main()
