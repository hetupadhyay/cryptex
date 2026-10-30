// Small helpers for reading requests and writing responses, the same on
// Vercel and on the local server.

const MAX_BODY = 256 * 1024;

class Failure extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function readStream(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Failure(413, 'That’s too much to send at once.'));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Vercel parses the body itself and offers it as req.body; the local
// server leaves the stream to be read.
async function body(req) {
  let raw;
  if ('body' in req) {
    let parsed;
    try {
      parsed = req.body;
    } catch {
      throw new Failure(400, 'That request couldn’t be read.');
    }
    if (parsed && typeof parsed === 'object' && !Buffer.isBuffer(parsed)) return parsed;
    raw = Buffer.isBuffer(parsed) ? parsed.toString('utf8') : parsed || '';
  } else {
    raw = await readStream(req);
  }
  if (!raw) return {};
  if (raw.length > MAX_BODY) throw new Failure(413, 'That’s too much to send at once.');
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type === 'application/x-www-form-urlencoded') return Object.fromEntries(new URLSearchParams(raw));
  try {
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    throw new Failure(400, 'That request couldn’t be read.');
  }
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function redirect(res, to) {
  res.statusCode = 303;
  res.setHeader('Location', to);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    const name = part.slice(0, at).trim();
    try {
      out[name] = decodeURIComponent(part.slice(at + 1).trim());
    } catch {}
  }
  return out;
}

// Every cookie here is HTTP-only, secure and for the whole site.
function setCookie(res, name, value, { maxAge, sameSite = 'Lax' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'Secure', `SameSite=${sameSite}`];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : prev ? [prev] : []), parts.join('; ')]);
}

function origin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || (req.socket && req.socket.encrypted ? 'https' : 'http')).split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${proto}://${host}`;
}

// A change made with the site's own scripts carries the site's own Origin.
// A form or script on another site can't, so this stops cross-site requests.
function sameOrigin(req) {
  return req.headers.origin === origin(req);
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
}

module.exports = { Failure, body, json, redirect, cookies, setCookie, origin, sameOrigin, clientIp };
