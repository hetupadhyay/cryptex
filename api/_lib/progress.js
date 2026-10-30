// Saved progress: the missions cracked and the daily intercept record,
// in the same shape the pages keep in local storage. Anything else in a
// request is dropped.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MISSION = /^[a-z0-9-]{1,32}$/;
const count = n => Number.isInteger(n) && n >= 0 && n < 1e6;
const MAX_DAYS = 4000;

function clean(input) {
  const p = input && typeof input === 'object' ? input : {};
  const cracked = Array.isArray(p.cracked)
    ? [...new Set(p.cracked.filter(id => typeof id === 'string' && MISSION.test(id)))].slice(0, 64)
    : [];
  const d = p.daily && typeof p.daily === 'object' && !Array.isArray(p.daily) ? p.daily : {};
  const days = {};
  if (d.days && typeof d.days === 'object' && !Array.isArray(d.days)) {
    for (const [day, hints] of Object.entries(d.days).slice(0, MAX_DAYS * 2)) {
      if (DAY.test(day) && count(hints)) days[day] = hints;
    }
  }
  const h = d.hints;
  const hints = h && typeof h === 'object' && typeof h.date === 'string' && (h.date === '' || DAY.test(h.date)) && count(h.n)
    ? { date: h.date, n: h.n }
    : { date: '', n: 0 };
  return { cracked, daily: { days, best: count(d.best) ? d.best : 0, hints } };
}

// Two devices' progress put together: every mission cracked on either,
// every day cracked on either (with the fewer hints), the better streak.
function merge(a, b) {
  const days = { ...a.daily.days };
  for (const [day, hints] of Object.entries(b.daily.days)) days[day] = day in days ? Math.min(days[day], hints) : hints;
  const kept = Object.keys(days).sort().slice(-MAX_DAYS);
  const ha = a.daily.hints;
  const hb = b.daily.hints;
  const hints = ha.date === hb.date ? { date: ha.date, n: Math.max(ha.n, hb.n) } : ha.date > hb.date ? ha : hb;
  return {
    cracked: [...new Set([...a.cracked, ...b.cracked])].slice(0, 64),
    daily: { days: Object.fromEntries(kept.map(day => [day, days[day]])), best: Math.max(a.daily.best, b.daily.best), hints },
  };
}

module.exports = { clean, merge };
