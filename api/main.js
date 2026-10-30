// Every account request comes through here (vercel.json sends /api/* to
// this one function). Accounts are optional: the rest of the site never
// needs them.
const db = require('./_lib/db');
const http = require('./_lib/http');
const { Failure, json, redirect, sameOrigin, origin, cookies, setCookie, clientIp } = http;
const { hashPassword, checkPassword, token, digest, same } = require('./_lib/secrets');
const accounts = require('./_lib/accounts');
const { provider, enabledProviders } = require('./_lib/providers');
const progress = require('./_lib/progress');
const limits = require('./_lib/limits');
const mail = require('./_lib/mail');

const OAUTH = '__Host-cryptex-oauth';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkEmail(value) {
  const email = accounts.normalEmail(value);
  if (!email || email.length > 254 || !EMAIL.test(email)) throw new Failure(400, 'Please enter a valid email address.', { field: 'email' });
  return email;
}

function checkNewPassword(value) {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 8) throw new Failure(400, 'Use at least 8 characters for your password.', { field: 'password' });
  if (password.length > 128) throw new Failure(400, 'Keep your password to 128 characters or fewer.', { field: 'password' });
  return password;
}

const ipKey = req => digest('ip:' + clientIp(req)).slice(0, 22);

async function sendLink(req, user, kind) {
  const t = token();
  const hours = kind === 'verify' ? 48 : 1;
  await db.query('delete from tokens where user_id = $1 and kind = $2', [user.id, kind]);
  await db.query('insert into tokens (token_hash, user_id, kind, expires_at) values ($1, $2, $3, now() + make_interval(hours => $4))', [digest(t), user.id, kind, hours]);
  const base = origin(req);
  if (kind === 'verify') {
    await mail.send({
      to: user.email,
      subject: 'Confirm your email for Cryptex',
      text: `Hello${user.name ? ' ' + user.name : ''},\n\nConfirm this email address for your Cryptex account:\n${base}/api/verify?token=${t}\n\nThe link works for 48 hours. If you didn't create an account, you can ignore this email.\n\nCryptex`,
    });
  } else {
    await mail.send({
      to: user.email,
      subject: 'Reset your Cryptex password',
      text: `Hello${user.name ? ' ' + user.name : ''},\n\nSomeone asked to reset the password for your Cryptex account. To choose a new one, open:\n${base}/reset#token=${t}\n\nThe link works for one hour. If it wasn't you, ignore this email and your password stays the same.\n\nCryptex`,
    });
  }
}

async function useLink(t, kind) {
  if (typeof t !== 'string' || !t) return null;
  return db.one('delete from tokens where token_hash = $1 and kind = $2 and expires_at > now() returning user_id', [digest(t), kind]);
}

const routes = {
  // What the sign-in page can offer.
  'GET config': async () => ({ accounts: db.configured(), providers: enabledProviders(), mail: mail.enabled() }),

  'GET me': async req => {
    const user = await accounts.currentUser(req);
    return { user: user ? await accounts.describe(user) : null };
  },

  'POST signup': async (req, res, body) => {
    const email = checkEmail(body.email);
    const password = checkNewPassword(body.password);
    const name = accounts.cleanName(body.name);
    const key = 'signup:' + ipKey(req);
    if (await limits.tooMany(key, 10, 60)) throw new Failure(429, 'Too many new accounts from here. Please try again in an hour.');
    await limits.note(key);
    if (await db.one('select id from users where email = $1', [email])) {
      throw new Failure(409, 'An account already uses this email. Sign in instead, or reset the password.', { field: 'email' });
    }
    const user = await db.one('insert into users (email, name, password_hash) values ($1, $2, $3) returning *', [email, name, await hashPassword(password)]);
    await accounts.startSession(res, user.id);
    if (mail.enabled()) await sendLink(req, user, 'verify').catch(error => console.error('verify mail', error));
    return { user: await accounts.describe(user) };
  },

  'POST login': async (req, res, body) => {
    const email = accounts.normalEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const byEmail = 'login:' + digest(email).slice(0, 22);
    const byIp = 'login-ip:' + ipKey(req);
    if (await limits.tooMany(byEmail, 10, 15) || await limits.tooMany(byIp, 50, 15)) {
      throw new Failure(429, 'Too many tries. Please wait 15 minutes, then try again.');
    }
    const user = email ? await db.one('select * from users where email = $1', [email]) : null;
    if (!(await checkPassword(password, user && user.password_hash))) {
      await limits.note(byEmail);
      await limits.note(byIp);
      throw new Failure(401, 'That email and password don’t match. If you signed up with Google, GitHub or Apple, use that button instead.');
    }
    await limits.forget(byEmail);
    await accounts.startSession(res, user.id);
    return { user: await accounts.describe(user) };
  },

  'POST logout': async (req, res) => {
    await accounts.endSession(req, res);
    return { ok: true };
  },

  'POST logout-everywhere': async (req, res) => {
    const user = await accounts.requireUser(req);
    await db.query('delete from sessions where user_id = $1', [user.id]);
    setCookie(res, '__Host-cryptex-session', '', { maxAge: 0 });
    return { ok: true };
  },

  'GET progress': async req => {
    const user = await accounts.requireUser(req);
    const row = await db.one('select cracked, daily from progress where user_id = $1', [user.id]);
    return progress.clean(row || {});
  },

  // The page sends what it has; it gets back everything, from every device.
  'PUT progress': async (req, res, body) => {
    const user = await accounts.requireUser(req);
    const row = await db.one('select cracked, daily from progress where user_id = $1', [user.id]);
    const merged = progress.merge(progress.clean(row || {}), progress.clean(body));
    await db.query(
      `insert into progress (user_id, cracked, daily, updated_at) values ($1, $2, $3, now())
       on conflict (user_id) do update set cracked = excluded.cracked, daily = excluded.daily, updated_at = now()`,
      [user.id, JSON.stringify(merged.cracked), JSON.stringify(merged.daily)],
    );
    return merged;
  },

  'POST name': async (req, res, body) => {
    const user = await accounts.requireUser(req);
    const updated = await db.one('update users set name = $2 where id = $1 returning *', [user.id, accounts.cleanName(body.name)]);
    return { user: await accounts.describe(updated) };
  },

  'POST password/change': async (req, res, body) => {
    const user = await accounts.requireUser(req);
    if (user.password_hash && !(await checkPassword(String(body.current || ''), user.password_hash))) {
      throw new Failure(400, 'Your current password isn’t right.', { field: 'current' });
    }
    const password = checkNewPassword(body.password);
    const updated = await db.one('update users set password_hash = $2 where id = $1 returning *', [user.id, await hashPassword(password)]);
    await accounts.endOtherSessions(req, user.id);
    return { user: await accounts.describe(updated) };
  },

  'POST password/forgot': async (req, res, body) => {
    if (!mail.enabled()) throw new Failure(503, 'Password reset by email isn’t switched on yet.');
    const email = checkEmail(body.email);
    const key = 'forgot:' + digest(email).slice(0, 22);
    if (!(await limits.tooMany(key, 5, 60))) {
      await limits.note(key);
      const user = await db.one('select * from users where email = $1', [email]);
      if (user) await sendLink(req, user, 'reset');
    }
    // The same answer whether or not there's an account, so this can't be
    // used to find out who has one.
    return { ok: true };
  },

  'POST password/reset': async (req, res, body) => {
    const password = checkNewPassword(body.password);
    const found = await useLink(body.token, 'reset');
    if (!found) throw new Failure(400, 'This reset link has expired or was already used. Ask for a new one.');
    // Opening the link proves the address is theirs.
    const user = await db.one('update users set password_hash = $2, email_verified = true where id = $1 returning *', [found.user_id, await hashPassword(password)]);
    await db.query('delete from sessions where user_id = $1', [user.id]);
    await accounts.startSession(res, user.id);
    return { user: await accounts.describe(user) };
  },

  'POST verify/resend': async req => {
    const user = await accounts.requireUser(req);
    if (!mail.enabled()) throw new Failure(503, 'Email confirmation isn’t switched on yet.');
    if (user.email_verified) return { ok: true };
    const key = 'verify:' + user.id;
    if (await limits.tooMany(key, 5, 60)) throw new Failure(429, 'We’ve sent a few already. Please check your inbox, or try again in an hour.');
    await limits.note(key);
    await sendLink(req, user, 'verify');
    return { ok: true };
  },

  // The link in the confirmation email. It keeps working until it expires,
  // since mail scanners often open links before the person does; opening
  // it again only confirms the same address again.
  'GET verify': async (req, res, body, url) => {
    const t = url.searchParams.get('token');
    const found = t ? await db.one("select user_id from tokens where token_hash = $1 and kind = 'verify' and expires_at > now()", [digest(t)]) : null;
    if (found) await db.query('update users set email_verified = true where id = $1', [found.user_id]);
    redirect(res, found ? '/account?verified=1' : '/account?verified=0');
  },

  'DELETE account': async (req, res, body) => {
    const user = await accounts.requireUser(req);
    if (body.confirm !== 'delete') throw new Failure(400, 'Type “delete” to confirm.', { field: 'confirm' });
    await db.query('delete from users where id = $1', [user.id]);
    setCookie(res, '__Host-cryptex-session', '', { maxAge: 0 });
    return { ok: true };
  },
};

const KNOWN = new Set(Object.keys(routes).map(key => key.split(' ')[1]));

// /api/auth/<provider>: off to Google, GitHub or Apple. With ?link=1 from
// the account page, the account found is added to the one signed in.
async function startOAuth(req, res, id, url) {
  const p = provider(id);
  if (!p) return redirect(res, '/signin?error=unavailable');
  let linkUser = null;
  if (url.searchParams.get('link') === '1') {
    const user = await accounts.currentUser(req);
    if (user) linkUser = user.id;
  }
  const state = token(18);
  const secret = token(18);
  const verifier = p.pkce ? token(48) : null;
  await db.query("delete from oauth_states where created_at < now() - interval '1 hour'");
  await db.query('insert into oauth_states (id, secret, provider, verifier, link_user) values ($1, $2, $3, $4, $5)', [state, secret, id, verifier, linkUser]);
  // Apple comes back with a cross-site form post, which only carries a
  // cookie marked SameSite=None. It holds a random value, nothing more.
  setCookie(res, OAUTH, secret, { maxAge: 600, sameSite: 'None' });
  redirect(res, p.authorize({ state, redirect: `${origin(req)}/api/auth/${id}/callback`, verifier }));
}

async function finishOAuth(req, res, id, params) {
  const p = provider(id);
  const back = error => redirect(res, `/signin?error=${error}`);
  if (!p) return back('unavailable');
  setCookie(res, OAUTH, '', { maxAge: 0, sameSite: 'None' });
  if (params.error) return back('cancelled');
  const row = typeof params.state === 'string'
    ? await db.one("delete from oauth_states where id = $1 and created_at > now() - interval '10 minutes' returning *", [params.state])
    : null;
  if (!row || row.provider !== id || !same(row.secret, cookies(req)[OAUTH] || '')) return back('expired');
  let userId;
  try {
    const profile = await p.profile({ code: String(params.code || ''), redirect: `${origin(req)}/api/auth/${id}/callback`, verifier: row.verifier, extra: params });
    userId = await accounts.signInWith(id, profile, row.link_user);
  } catch (error) {
    if (error.status === 409) return redirect(res, `/account?error=taken&provider=${id}`);
    if (error.status === 400) return back(`no-email&provider=${id}`);
    console.error('oauth', id, error);
    return back('failed');
  }
  if (!row.link_user) await accounts.startSession(res, userId);
  redirect(res, row.link_user ? `/account?linked=${id}` : '/account?welcome=1');
}

async function unlink(req, id) {
  const user = await accounts.requireUser(req);
  const linked = await db.query('select provider from identities where user_id = $1', [user.id]);
  if (!linked.some(row => row.provider === id)) return { user: await accounts.describe(user) };
  if (linked.length < 2 && !user.password_hash) {
    throw new Failure(400, 'This is your only way to sign in. Set a password or link another account first.');
  }
  await db.query('delete from identities where user_id = $1 and provider = $2', [user.id, id]);
  return { user: await accounts.describe(user) };
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'http://local');
  // vercel.json rewrites /api/<route> to /api/main?route=<route>.
  const route = (url.searchParams.get('route') || url.pathname.replace(/^\/api\/?/, '')).replace(/^\/+|\/+$/g, '');
  const method = req.method;
  try {
    const auth = route.match(/^auth\/(google|github|apple)(\/callback)?$/);
    if (auth) {
      const [, id, callback] = auth;
      if (!callback && method === 'GET') return await startOAuth(req, res, id, url);
      if (!callback && method === 'DELETE') {
        if (!sameOrigin(req)) throw new Failure(403, 'That request came from somewhere else.');
        return json(res, 200, await unlink(req, id));
      }
      if (callback && method === 'GET') return await finishOAuth(req, res, id, Object.fromEntries(url.searchParams));
      if (callback && method === 'POST') return await finishOAuth(req, res, id, await http.body(req));
    }
    const fn = routes[`${method} ${route}`];
    if (!fn) throw new Failure(KNOWN.has(route) ? 405 : 404, 'Not found.');
    // Anything that changes something must come from the site's own pages.
    if (method !== 'GET' && !sameOrigin(req)) throw new Failure(403, 'That request came from somewhere else.');
    const body = method === 'GET' ? {} : await http.body(req);
    const result = await fn(req, res, body, url);
    if (!res.writableEnded) json(res, 200, result);
  } catch (error) {
    if (res.writableEnded) return;
    if (error instanceof Failure || error.status) {
      json(res, error.status, { error: error.message, ...(error.extra || {}) });
    } else {
      console.error(route, error);
      json(res, 500, { error: 'Something went wrong on our side. Please try again.' });
    }
  }
};
