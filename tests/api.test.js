// The account API against a real (in-memory) Postgres, over HTTP, the way
// the pages use it. Google, GitHub and Apple are stood in for.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.QUIET = '1';
process.env.GOOGLE_CLIENT_ID = 'google-client';
process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
process.env.GITHUB_CLIENT_ID = 'github-client';
process.env.GITHUB_CLIENT_SECRET = 'github-secret';
process.env.APPLE_CLIENT_ID = 'apple-client';
process.env.APPLE_TEAM_ID = 'TEAM123';
process.env.APPLE_KEY_ID = 'KEY123';
process.env.APPLE_PRIVATE_KEY = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });

const { createServer } = require('../tools/dev');
const { useFetch } = require('../api/_lib/providers');

let server;
let base;

test.before(async () => {
  server = await createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

// A browser of sorts: keeps its cookies and sends the site's Origin.
function browser() {
  const jar = new Map();
  async function call(method, path, body, { origin = base, raw = false } = {}) {
    const headers = { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') };
    if (origin) headers.Origin = origin;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';');
      const [name, value] = pair.split('=');
      if (attrs.some(a => /max-age=0/i.test(a.trim()))) jar.delete(name);
      else jar.set(name, value);
    }
    if (raw) return res;
    return { status: res.status, data: res.status === 303 ? res.headers.get('location') : await res.json() };
  }
  return { call, jar };
}

const unique = () => `${crypto.randomUUID().slice(0, 8)}@example.com`;

test('signing up signs you in, and only once per email', async () => {
  const b = browser();
  const email = unique();
  const signup = await b.call('POST', '/api/signup', { name: 'Ada', email: email.toUpperCase(), password: 'correct horse' });
  assert.equal(signup.status, 200);
  assert.deepEqual(signup.data.user, { name: 'Ada', email, emailVerified: false, hasPassword: true, linked: [] });
  assert.ok([...b.jar.keys()].includes('__Host-cryptex-session'));
  const me = await b.call('GET', '/api/me');
  assert.equal(me.data.user.email, email);

  const again = await browser().call('POST', '/api/signup', { email, password: 'another one' });
  assert.equal(again.status, 409);
});

test('bad sign-ups are explained', async () => {
  const b = browser();
  assert.equal((await b.call('POST', '/api/signup', { email: 'nope', password: 'long enough' })).data.field, 'email');
  assert.equal((await b.call('POST', '/api/signup', { email: unique(), password: 'short' })).data.field, 'password');
});

test('signing in checks the password, and signing out ends the session', async () => {
  const email = unique();
  await browser().call('POST', '/api/signup', { email, password: 'open sesame' });
  const b = browser();
  assert.equal((await b.call('POST', '/api/login', { email, password: 'wrong guess' })).status, 401);
  assert.equal((await b.call('POST', '/api/login', { email, password: 'open sesame' })).status, 200);
  assert.equal((await b.call('GET', '/api/me')).data.user.email, email);
  await b.call('POST', '/api/logout', {});
  assert.equal((await b.call('GET', '/api/me')).data.user, null);
  assert.equal((await browser().call('POST', '/api/login', { email: unique(), password: 'whatever it is' })).status, 401);
});

test('guessing is slowed down', async () => {
  const email = unique();
  await browser().call('POST', '/api/signup', { email, password: 'the real one' });
  const b = browser();
  for (let i = 0; i < 10; i++) assert.equal((await b.call('POST', '/api/login', { email, password: `guess ${i}` })).status, 401);
  assert.equal((await b.call('POST', '/api/login', { email, password: 'the real one' })).status, 429);
});

test('changes must come from the site itself', async () => {
  const b = browser();
  assert.equal((await b.call('POST', '/api/signup', { email: unique(), password: 'long enough' }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await b.call('POST', '/api/signup', { email: unique(), password: 'long enough' }, { origin: null })).status, 403);
});

test('progress from two devices is put together', async () => {
  const email = unique();
  const phone = browser();
  await phone.call('POST', '/api/signup', { email, password: 'two devices' });
  const laptop = browser();
  await laptop.call('POST', '/api/login', { email, password: 'two devices' });

  await phone.call('PUT', '/api/progress', { cracked: ['rhine'], daily: { days: { '2026-10-29': 2 }, best: 1, hints: { date: '2026-10-29', n: 2 } } });
  const merged = await laptop.call('PUT', '/api/progress', {
    cracked: ['scribe', 'rhine', '<script>'],
    daily: { days: { '2026-10-29': 0, '2026-10-30': 1, bogus: 3 }, best: 2, hints: { date: '2026-10-30', n: 1 } },
  });
  assert.deepEqual(merged.data, {
    cracked: ['rhine', 'scribe'],
    daily: { days: { '2026-10-29': 0, '2026-10-30': 1 }, best: 2, hints: { date: '2026-10-30', n: 1 } },
  });
  assert.deepEqual((await phone.call('GET', '/api/progress')).data, merged.data);
  assert.equal((await browser().call('GET', '/api/progress')).status, 401);
});

test('a password can be changed, which signs out other devices', async () => {
  const email = unique();
  const a = browser();
  await a.call('POST', '/api/signup', { email, password: 'first password' });
  const b = browser();
  await b.call('POST', '/api/login', { email, password: 'first password' });
  assert.equal((await a.call('POST', '/api/password/change', { current: 'not it', password: 'second password' })).status, 400);
  assert.equal((await a.call('POST', '/api/password/change', { current: 'first password', password: 'second password' })).status, 200);
  assert.equal((await a.call('GET', '/api/me')).data.user.email, email);
  assert.equal((await b.call('GET', '/api/me')).data.user, null);
  assert.equal((await browser().call('POST', '/api/login', { email, password: 'second password' })).status, 200);
});

test('email confirmation and password reset work through the emailed links', async () => {
  const { mail } = createServer;
  const email = unique();
  const b = browser();
  await b.call('POST', '/api/signup', { email, password: 'forgetful me' });
  const confirm = mail.findLast(m => m.to === email && /Confirm/.test(m.subject));
  const link = new URL(confirm.text.match(/https?:\/\/\S+/)[0]);
  assert.equal((await b.call('GET', link.pathname + link.search)).data, '/account?verified=1');
  assert.equal((await b.call('GET', '/api/me')).data.user.emailVerified, true);
  // A mail scanner may have opened it first; it still works.
  assert.equal((await browser().call('GET', link.pathname + link.search)).data, '/account?verified=1');
  assert.equal((await b.call('GET', '/api/verify?token=made-up')).data, '/account?verified=0');

  const stranger = browser();
  assert.deepEqual((await stranger.call('POST', '/api/password/forgot', { email: unique() })).data, { ok: true });
  await stranger.call('POST', '/api/password/forgot', { email });
  const reset = mail.findLast(m => m.to === email && /Reset/.test(m.subject));
  const t = reset.text.match(/#token=(\S+)/)[1];
  assert.equal((await stranger.call('POST', '/api/password/reset', { token: t, password: 'remembered now' })).status, 200);
  assert.equal((await stranger.call('POST', '/api/password/reset', { token: t, password: 'again and again' })).status, 400);
  assert.equal((await b.call('GET', '/api/me')).data.user, null, 'old sessions end');
  assert.equal((await browser().call('POST', '/api/login', { email, password: 'remembered now' })).status, 200);
});

// Stands in for a provider: answers the token exchange and profile calls.
function fakeProviders(people) {
  useFetch(async (url, options = {}) => {
    const reply = data => ({ ok: true, json: async () => data });
    const body = new URLSearchParams(options.body || '');
    const jwt = claims => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      const p = people[body.get('code')];
      assert.ok(body.get('code_verifier'), 'Google gets the PKCE verifier');
      return reply({ id_token: jwt({ iss: 'https://accounts.google.com', aud: 'google-client', ...p }) });
    }
    if (url.startsWith('https://github.com/login/oauth/access_token')) return reply({ access_token: body.get('code') });
    if (url === 'https://api.github.com/user') return reply(people[options.headers.Authorization.slice(7)].user);
    if (url === 'https://api.github.com/user/emails') return reply(people[options.headers.Authorization.slice(7)].emails);
    if (url.startsWith('https://appleid.apple.com/auth/token')) {
      const [header] = body.get('client_secret').split('.');
      assert.equal(JSON.parse(Buffer.from(header, 'base64url')).alg, 'ES256');
      return reply({ id_token: jwt({ iss: 'https://appleid.apple.com', aud: 'apple-client', ...people[body.get('code')] }) });
    }
    throw new Error('unexpected ' + url);
  });
}

async function oauth(b, provider, code, { link = false, post = false } = {}) {
  const start = await b.call('GET', `/api/auth/${provider}${link ? '?link=1' : ''}`);
  assert.equal(start.status, 303);
  const state = new URL(start.data).searchParams.get('state');
  if (post) {
    const res = await fetch(`${base}/api/auth/${provider}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://appleid.apple.com', Cookie: [...b.jar].map(([k, v]) => `${k}=${v}`).join('; ') },
      body: new URLSearchParams({ code, state, user: JSON.stringify({ name: { firstName: 'Grace', lastName: 'Hopper' } }) }),
      redirect: 'manual',
    });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const [name, value] = pair.split('=');
      if (/max-age=0/i.test(line)) b.jar.delete(name); else b.jar.set(name, value);
    }
    return res.headers.get('location');
  }
  return (await b.call('GET', `/api/auth/${provider}/callback?code=${code}&state=${state}`)).data;
}

test('Google, GitHub and Apple sign people in and link to one account', async () => {
  const email = unique();
  fakeProviders({
    g1: { sub: 'google-1', email, email_verified: true, name: 'Ada Lovelace' },
    h1: { user: { id: 77, login: 'ada', name: null }, emails: [{ email, primary: true, verified: true }] },
    a1: { sub: 'apple-1', email: 'relay@privaterelay.appleid.com', email_verified: 'true' },
  });
  assert.deepEqual((await browser().call('GET', '/api/config')).data.providers, ['google', 'github', 'apple']);

  const b = browser();
  assert.equal(await oauth(b, 'google', 'g1'), '/account?welcome=1');
  let me = (await b.call('GET', '/api/me')).data.user;
  assert.deepEqual(me, { name: 'Ada Lovelace', email, emailVerified: true, hasPassword: false, linked: ['google'] });

  // Same verified email on GitHub: the same person.
  const other = browser();
  assert.equal(await oauth(other, 'github', 'h1'), '/account?welcome=1');
  assert.deepEqual((await other.call('GET', '/api/me')).data.user.linked, ['google', 'github']);

  // Apple's private relay address only joins up when linked on purpose.
  assert.equal(await oauth(b, 'apple', 'a1', { link: true, post: true }), '/account?linked=apple');
  me = (await b.call('GET', '/api/me')).data.user;
  assert.deepEqual(me.linked, ['google', 'github', 'apple']);

  // Unlinking leaves at least one way in.
  assert.equal((await b.call('DELETE', '/api/auth/apple')).status, 200);
  assert.equal((await b.call('DELETE', '/api/auth/github')).status, 200);
  assert.equal((await b.call('DELETE', '/api/auth/google')).status, 400);
});

test('a sign-in that comes back without its state or cookie is refused', async () => {
  fakeProviders({ g2: { sub: 'google-2', email: unique(), email_verified: true } });
  const b = browser();
  const start = await b.call('GET', '/api/auth/google');
  const state = new URL(start.data).searchParams.get('state');
  const thief = browser();
  assert.equal((await thief.call('GET', `/api/auth/google/callback?code=g2&state=${state}`)).data, '/signin?error=expired');
  assert.equal((await b.call('GET', `/api/auth/google/callback?code=g2&state=made-up`)).data, '/signin?error=expired');
  assert.equal((await b.call('GET', '/api/auth/google/callback?error=access_denied')).data, '/signin?error=cancelled');
});

test('an unconfirmed password account loses its password when the real owner signs in with Google', async () => {
  const email = unique();
  const squatter = browser();
  await squatter.call('POST', '/api/signup', { email, password: 'not my address' });
  fakeProviders({ g3: { sub: 'google-3', email, email_verified: true } });
  const owner = browser();
  await oauth(owner, 'google', 'g3');
  assert.deepEqual((await owner.call('GET', '/api/me')).data.user.hasPassword, false);
  assert.equal((await squatter.call('GET', '/api/me')).data.user, null);
  assert.equal((await browser().call('POST', '/api/login', { email, password: 'not my address' })).status, 401);
});

test('an account can be deleted, and everything with it', async () => {
  const email = unique();
  const b = browser();
  await b.call('POST', '/api/signup', { email, password: 'goodbye now' });
  await b.call('PUT', '/api/progress', { cracked: ['rhine'] });
  assert.equal((await b.call('DELETE', '/api/account', { confirm: 'nope' })).status, 400);
  assert.equal((await b.call('DELETE', '/api/account', { confirm: 'delete' })).status, 200);
  assert.equal((await b.call('GET', '/api/me')).data.user, null);
  assert.equal((await browser().call('POST', '/api/login', { email, password: 'goodbye now' })).status, 401);
  assert.equal((await browser().call('POST', '/api/signup', { email, password: 'hello again' })).status, 200);
});
