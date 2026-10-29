"""Serve the site like Vercel does: headers from vercel.json, clean URLs, 404.html.

Usage: python3 tools/serve.py <folder> <port>   (or npm start)
"""
import http.server, json, os, re, sys

ROOT = os.path.abspath(sys.argv[1])
PORT = int(sys.argv[2])
CONF = json.load(open(os.path.join(ROOT, 'vercel.json')))


def to_regex(source):
    # Enough of path-to-regexp for the patterns in vercel.json.
    out = re.sub(r':(\w+)\*', r'.*', source)
    return re.compile('^' + out + '$')


RULES = [(to_regex(h['source']), h['headers']) for h in CONF.get('headers', [])]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def translate_path(self, path):
        p = super().translate_path(path)
        if CONF.get('cleanUrls') and not os.path.exists(p) and os.path.exists(p + '.html'):
            return p + '.html'
        return p

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            body = open(os.path.join(ROOT, '404.html'), 'rb').read()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().send_error(code, message, explain)

    def end_headers(self):
        path = self.path.split('?')[0]
        sent = {}
        for rx, headers in RULES:
            if rx.match(path):
                for h in headers:
                    sent[h['key']] = h['value']
        for k, v in sent.items():
            self.send_header(k, v)
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.webmanifest'):
            return 'application/manifest+json'
        return super().guess_type(path)

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
