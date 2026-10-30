// Serves the site the way Vercel does: the headers from vercel.json, clean
// URLs, the 404 page, and the account API in api/main.js. Without a
// DATABASE_URL it keeps accounts in an in-memory Postgres, which starts
// empty each time, and prints emails instead of sending them.
//
//   node tools/dev.js [port]       (or npm start)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONF = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
// Folders .vercelignore keeps off the live site stay off this one too.
const IGNORED = new Set(fs.readFileSync(path.join(ROOT, '.vercelignore'), 'utf8').split('\n')
  .map(line => line.trim().replace(/^\/|\/$/g, '')).filter(line => line && !line.startsWith('#')));
['api', 'node_modules', 'package.json', 'package-lock.json'].forEach(name => IGNORED.add(name));

// Enough of path-to-regexp for the patterns in vercel.json.
const RULES = (CONF.headers || []).map(h => ({ rx: new RegExp('^' + h.source.replace(/:(\w+)\*/g, '.*') + '$'), headers: h.headers, has: h.has }));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
};

function headersFor(pathname, search) {
  const out = {};
  for (const rule of RULES) {
    if (!rule.rx.test(pathname)) continue;
    if (rule.has && !rule.has.every(h => h.type !== 'query' || new URLSearchParams(search).has(h.key))) continue;
    for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
}

function resolveFile(pathname) {
  let parts;
  try {
    parts = decodeURIComponent(pathname).split('/').filter(Boolean);
  } catch {
    return null;
  }
  // Only what Vercel would serve: no dot-files, nothing left out.
  if (parts.some(part => part.startsWith('.') || part.includes('\\')) || (parts.length && IGNORED.has(parts[0]))) return null;
  let file = path.join(ROOT, ...parts);
  if (!file.startsWith(ROOT)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && CONF.cleanUrls && fs.existsSync(file + '.html')) file += '.html';
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

async function createServer() {
  const db = require('../api/_lib/db');
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    const { PGlite } = await import('@electric-sql/pglite');
    const pg = new PGlite();
    db.use({ query: async (text, params) => (await pg.query(text, params)).rows });
  }
  const mail = require('../api/_lib/mail');
  if (!process.env.SMTP_URL) mail.capture(message => { createServer.mail.push(message); if (!process.env.QUIET) console.log('\n--- email to', message.to, '---\n' + message.text + '\n'); });
  const api = require('../api/main');

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    const sent = headersFor(url.pathname, url.search);
    for (const [k, v] of Object.entries(sent)) res.setHeader(k, v);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return api(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      return res.end();
    }
    const file = resolveFile(url.pathname);
    const status = file ? 200 : 404;
    const target = file || path.join(ROOT, '404.html');
    res.statusCode = status;
    res.setHeader('Content-Type', sent['Content-Type'] || TYPES[path.extname(target)] || 'application/octet-stream');
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(target).pipe(res);
  });
}
createServer.mail = [];

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.argv[2]) || 8000;
  createServer().then(server => server.listen(port, '127.0.0.1', () => console.log(`Cryptex on http://127.0.0.1:${port}`)));
}
