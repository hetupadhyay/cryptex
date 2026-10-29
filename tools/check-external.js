/*
 * Fails if any page or stylesheet loads a script, stylesheet or font from
 * another site. The site promises no external requests; CI runs this.
 *
 *   node tools/check-external.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['.git', 'node_modules']);
const REMOTE = /^\s*["']?\s*(https?:)?\/\//i;

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (SKIP.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.(html|css)$/.test(entry.name) ? [full] : [];
  });
}

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i'));
  return m ? m[1].replace(/^["']|["']$/g, '') : '';
};

const problems = [];

for (const file of files(ROOT)) {
  const text = fs.readFileSync(file, 'utf8');
  const name = path.relative(ROOT, file);
  const line = index => text.slice(0, index).split('\n').length;
  const report = (index, what) => problems.push(`${name}:${line(index)}: ${what}`);

  if (file.endsWith('.html')) {
    for (const m of text.matchAll(/<script\b[^>]*>/gi)) {
      if (REMOTE.test(attr(m[0], 'src'))) report(m.index, `external script ${attr(m[0], 'src')}`);
    }
    for (const m of text.matchAll(/<link\b[^>]*>/gi)) {
      const rel = attr(m[0], 'rel').toLowerCase();
      if (/stylesheet|preload|modulepreload|font/.test(rel) && REMOTE.test(attr(m[0], 'href'))) {
        report(m.index, `external ${rel} ${attr(m[0], 'href')}`);
      }
    }
  }
  // Stylesheets, and <style> blocks in pages: fonts and imports.
  for (const m of text.matchAll(/@import\s+(url\()?\s*["']?([^"')\s;]+)/gi)) {
    if (REMOTE.test(m[2])) report(m.index, `external @import ${m[2]}`);
  }
  for (const m of text.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) {
    if (REMOTE.test(m[2])) report(m.index, `external url() ${m[2]}`);
  }
}

if (problems.length) {
  console.error('External requests found. Everything has to be served from the site itself:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('No external scripts, stylesheets or fonts.');
