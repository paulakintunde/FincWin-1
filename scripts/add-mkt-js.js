#!/usr/bin/env node
/* One-time codemod: ensure every marketing page that has the shared nav also
   loads /js/mkt.js (CSP-safe). Idempotent — skips files that already have it. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', 'js', 'styles', 'api', 'assets', 'tests', 'docs']);
const TAG = '<script src="/js/mkt.js" defer></script>';

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full);
    const top = rel.split(path.sep)[0];
    if (SKIP_DIRS.has(top)) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
}

const files = [];
walk(ROOT, files);
const changed = [];

for (const f of files) {
  let html = fs.readFileSync(f, 'utf8');
  if (!html.includes('id="mainNav"')) continue;   // not a nav page
  if (html.includes('/js/mkt.js')) continue;       // already wired
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) continue;
  html = html.slice(0, idx) + TAG + '\n' + html.slice(idx);
  fs.writeFileSync(f, html, 'utf8');
  changed.push(path.relative(ROOT, f));
}

console.log(`Scanned ${files.length} HTML files; updated ${changed.length}:`);
changed.forEach(c => console.log('  + ' + c));
