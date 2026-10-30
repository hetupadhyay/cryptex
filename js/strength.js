/*
 * How long a brute-force search would take, at a billion keys a second,
 * next to the shortcut that actually breaks each cipher.
 */
(function () {
  'use strict';

  const RATE = 1e9;
  const factorial = n => (n <= 1 ? 1 : n * factorial(n - 1));

  const ROWS = [
    { name: 'Atbash', note: 'no key', keys: 1, how: 'Knowing the method' },
    { name: 'Rail fence', note: '2 to 8 rails', keys: 7, how: 'Trying each rail count' },
    { name: 'Caesar', note: 'shifts 1 to 25', keys: 25, how: 'Trying every key' },
    { name: 'Affine', note: '12 × 26 keys', keys: 312, how: 'Trying every key' },
    { name: 'Columnar', note: '6-letter keyword', keys: factorial(6), how: 'Sliding columns side by side' },
    { name: 'Vigenère', note: '5-letter keyword', keys: 26 ** 5, how: 'Key length, then letter counts' },
    { name: 'Beaufort', note: '5-letter keyword', keys: 26 ** 5, how: 'Key length, then letter counts' },
    { name: 'Autokey', note: '5-letter keyword', keys: 26 ** 5, how: 'Guessing likely words' },
    { name: 'Polybius', note: 'keyed square', keys: factorial(25), how: 'Letter counts' },
    { name: 'Playfair', note: 'keyed square', keys: factorial(25), how: 'Counting letter pairs' },
    { name: 'AES-128', note: 'the kind your browser uses', keys: 2 ** 128, how: 'No known shortcut', modern: true },
  ];

  const maxLog = Math.log10(2 ** 128);

  function power(n) {
    if (n < 1e6) return Math.round(n).toLocaleString('en');
    const exp = Math.floor(Math.log10(n));
    const lead = (n / 10 ** exp).toFixed(1).replace(/\.0$/, '');
    return `${lead} × 10<span class="vh"> to the power of </span><sup>${exp}</sup>`;
  }

  function duration(seconds) {
    const units = [
      [1e-6, 1e-9, 'nanosecond'],
      [1e-3, 1e-6, 'microsecond'],
      [1, 1e-3, 'millisecond'],
      [60, 1, 'second'],
      [3600, 60, 'minute'],
      [86400, 3600, 'hour'],
      [31557600, 86400, 'day'],
    ];
    for (const [limit, size, name] of units) {
      if (seconds < limit) {
        const n = Math.max(1, Math.round(seconds / size));
        return `${n} ${name}${n === 1 ? '' : 's'}`;
      }
    }
    return `${power(seconds / 31557600)} years`;
  }

  const list = document.querySelector('.strength-list');
  for (const row of ROWS) {
    const li = document.createElement('li');
    li.className = 'strength-row' + (row.modern ? ' modern' : '');
    const width = Math.max(0.01, Math.log10(row.keys + 1) / maxLog);
    li.innerHTML = `
      <span class="st-name"></span>
      <div class="st-bar-wrap">
        <span class="st-count">${power(row.keys)} ${row.keys === 1 ? 'key' : 'keys'}</span>
        <span class="st-bar"><i></i></span>
      </div>
      <span class="st-time">${duration(row.keys / RATE)}</span>
      <span class="st-how"></span>`;
    // Set as a property, not a style attribute, which the CSP would block.
    li.querySelector('.st-bar i').style.setProperty('--w', width.toFixed(3));
    li.querySelector('.st-name').innerHTML = `${row.name}<small></small>`;
    li.querySelector('.st-name small').textContent = row.note;
    li.querySelector('.st-how').textContent = (row.modern ? '' : 'Broken by: ') + row.how;
    list.append(li);
  }
})();
