// Users, their sessions, and the accounts linked to them.
const { query, one } = require('./db');
const { cookies, setCookie, Failure } = require('./http');
const { token, digest } = require('./secrets');
const { NAMES } = require('./providers');

const SESSION = '__Host-cryptex-session';
const SESSION_DAYS = 30;

const normalEmail = email => String(email || '').trim().toLowerCase();

async function startSession(res, userId) {
  // Now and then, clear out sessions and emailed links that have expired.
  if (Math.random() < 0.05) {
    await query('delete from sessions where expires_at < now()');
    await query('delete from tokens where expires_at < now()');
  }
  const t = token();
  await query(`insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(days => $3))`, [digest(t), userId, SESSION_DAYS]);
  setCookie(res, SESSION, t, { maxAge: SESSION_DAYS * 86400 });
}

function sessionHash(req) {
  const t = cookies(req)[SESSION];
  return t ? digest(t) : null;
}

async function currentUser(req) {
  const hash = sessionHash(req);
  if (!hash) return null;
  return one(`select u.* from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now()`, [hash]);
}

async function requireUser(req) {
  const user = await currentUser(req);
  if (!user) throw new Failure(401, 'Please sign in first.');
  return user;
}

async function endSession(req, res) {
  const hash = sessionHash(req);
  if (hash) await query('delete from sessions where token_hash = $1', [hash]);
  setCookie(res, SESSION, '', { maxAge: 0 });
}

async function endOtherSessions(req, userId) {
  await query('delete from sessions where user_id = $1 and token_hash <> $2', [userId, sessionHash(req) || '']);
}

// What the pages are told about the person signed in. No hashes, no ids.
async function describe(user) {
  const linked = await query('select provider from identities where user_id = $1 order by created_at', [user.id]);
  return {
    name: user.name,
    email: user.email,
    emailVerified: user.email_verified,
    hasPassword: Boolean(user.password_hash),
    linked: linked.map(row => row.provider),
  };
}

// Someone back from Google, GitHub or Apple. They're the same person as
// before if that account is already linked. Otherwise a verified email
// that matches an existing user joins them up; if that user's address was
// never confirmed, the password set on it is dropped, since whoever chose
// it may not own the address.
async function signInWith(providerId, profile, linkUserId) {
  const known = await one('select user_id from identities where provider = $1 and subject = $2', [providerId, profile.subject]);
  if (linkUserId) {
    if (known && known.user_id !== linkUserId) throw new Failure(409, `That ${NAMES[providerId]} account is already linked to another Cryptex account.`);
    if (!known) await query('insert into identities (provider, subject, user_id, email) values ($1, $2, $3, $4)', [providerId, profile.subject, linkUserId, profile.email || null]);
    return linkUserId;
  }
  if (known) {
    await query('update identities set email = $3 where provider = $1 and subject = $2', [providerId, profile.subject, profile.email || null]);
    return known.user_id;
  }
  const email = normalEmail(profile.email);
  if (!email || !profile.emailVerified) {
    throw new Failure(400, `Your ${NAMES[providerId]} account needs a confirmed email address to sign in here.`);
  }
  let user = await one('select * from users where email = $1', [email]);
  if (user && !user.email_verified) {
    await query('update users set password_hash = null, email_verified = true where id = $1', [user.id]);
    await query('delete from sessions where user_id = $1', [user.id]);
  } else if (!user) {
    user = await one('insert into users (email, email_verified, name) values ($1, true, $2) returning *', [email, cleanName(profile.name)]);
  }
  await query('insert into identities (provider, subject, user_id, email) values ($1, $2, $3, $4)', [providerId, profile.subject, user.id, email]);
  return user.id;
}

function cleanName(name) {
  return String(name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60);
}

module.exports = { startSession, currentUser, requireUser, endSession, endOtherSessions, describe, signInWith, normalEmail, cleanName };
