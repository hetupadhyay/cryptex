// Slows down guessing: failed sign-ins and sign-ups are counted for a
// while, per email address and per network address (hashed).
const { query, one } = require('./db');

async function tooMany(key, max, minutes) {
  const row = await one('select count(*)::int as n from attempts where key = $1 and at > now() - make_interval(mins => $2)', [key, minutes]);
  return row.n >= max;
}

async function note(key) {
  await query('insert into attempts (key) values ($1)', [key]);
  // Now and then, forget attempts old enough not to matter.
  if (Math.random() < 0.05) await query("delete from attempts where at < now() - interval '1 day'");
}

async function forget(key) {
  await query('delete from attempts where key = $1', [key]);
}

module.exports = { tooMany, note, forget };
