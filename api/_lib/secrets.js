// Passwords and random tokens.
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
// scrypt's recommended interactive cost: about 16 MB and a few tens of
// milliseconds per check, which makes guessing slow.
const COST = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, 64, COST);
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64'), key.toString('base64')].join('$');
}

// Without a stored hash it still does the work, so a missing account
// takes as long to reject as a wrong password.
async function checkPassword(password, stored) {
  if (!stored) {
    await hashPassword(password);
    return false;
  }
  const [kind, N, r, p, salt, key] = stored.split('$');
  if (kind !== 'scrypt') return false;
  const want = Buffer.from(key, 'base64');
  const got = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64'), want.length, { N: +N, r: +r, p: +p, maxmem: COST.maxmem });
  return crypto.timingSafeEqual(want, got);
}

const token = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const digest = text => crypto.createHash('sha256').update(text).digest('base64url');

function same(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = { hashPassword, checkPassword, token, digest, same };
