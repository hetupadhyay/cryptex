// Builds the rings and the cipher pad for tools/og.html.
// Six rings, the same build as js/cryptex.js, each turned to a letter.
(function () {
  var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var STEP = 360 / 26;
  var rings = document.querySelector('.rings');
  'SECRET'.split('').forEach(function (ch) {
    var ring = document.createElement('div');
    ring.className = 'ring';
    var turn = document.createElement('div');
    turn.className = 'ring-turn';
    for (var n = 0; n < 26; n++) {
      var face = document.createElement('span');
      face.className = 'ring-face';
      face.textContent = ALPHABET[n];
      face.style.transform = 'rotateX(' + (-n * STEP) + 'deg) translateZ(var(--r))';
      turn.append(face);
    }
    turn.style.transform = 'rotateX(' + ALPHABET.indexOf(ch) * STEP + 'deg)';
    ring.append(turn);
    rings.append(ring);
  });

  // Rows of five-letter code groups, with a few decoded words in red pencil.
  var words = { 2: 'SHIFT', 7: 'TRUTH', 11: 'CLOAK', 16: 'NORTH', 20: 'QUIET' };
  var seed = 7;
  function letter() {
    seed = (seed * 9301 + 49297) % 233280;
    return ALPHABET[Math.floor(seed / 233280 * 26)];
  }
  var rows = [];
  for (var r = 0; r < 23; r++) {
    var groups = [];
    for (var g = 0; g < 18; g++) {
      if (words[r] && g === (r * 5) % 17) {
        groups.push('<b>' + words[r] + '</b>');
        continue;
      }
      var s = '';
      for (var i = 0; i < 5; i++) s += letter();
      groups.push(s);
    }
    rows.push(groups.join('  '));
  }
  document.querySelector('.pad-text').innerHTML = rows.join('\n');
})();
