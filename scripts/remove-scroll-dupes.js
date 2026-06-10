#!/usr/bin/env node
/**
 * remove-scroll-dupes.js
 *
 * Removes inline scroll-handler <script> blocks that duplicate the same
 * logic already in mkt.js:
 *
 *   <script>
 *     const nav = document.getElementById('mainNav');
 *     window.addEventListener('scroll', () => nav.classList.toggle('scrolled', ...), { passive: true });
 *   </script>
 *
 * Also removes the inline copy-year script that mkt.js already handles.
 * Safe to re-run (idempotent).
 *
 * Usage:
 *   node scripts/remove-scroll-dupes.js          # dry-run
 *   node scripts/remove-scroll-dupes.js --write  # apply
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT  = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

// Auto-discover blog posts + category indexes + root pages known to have the dupe
const TARGETS = [];

function collect(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (entry.name.endsWith('.html')) TARGETS.push(full);
  }
}
collect(path.join(ROOT, 'blog'));
for (const f of ['404.html','changelog.html','cookie-policy.html','privacy.html','terms.html']) {
  TARGETS.push(path.join(ROOT, f));
}

// Pattern 1: The nav + scroll listener block (with optional leading whitespace/newlines)
const SCROLL_BLOCK_RE = /<script>\s*\n?\s*const nav\s*=\s*document\.getElementById\(['"]mainNav['"]\);\s*\n?\s*window\.addEventListener\(['"]scroll['"][^<]+\);\s*\n?\s*<\/script>\s*\n?/g;

// Pattern 2: Standalone copy-year script (mkt.js handles this)
const COPY_YEAR_RE = /<script>document\.querySelectorAll\(['"]\.copy-year['"]\)\.forEach\([^<]+<\/script>\s*\n?/g;

function clean(html) {
  let out = html;
  out = out.replace(SCROLL_BLOCK_RE, '');
  out = out.replace(COPY_YEAR_RE, '');
  return out;
}

let changed = 0;
for (const fp of TARGETS) {
  const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
  const src = fs.readFileSync(fp, 'utf8');
  const out = clean(src);
  if (out === src) { console.log(`  unchanged: ${rel}`); continue; }
  changed++;
  if (WRITE) {
    fs.writeFileSync(fp, out, 'utf8');
    console.log(`  updated:   ${rel}`);
  } else {
    console.log(`  would update: ${rel}`);
  }
}

if (!WRITE && changed > 0) {
  console.log(`\nDry run: ${changed} file(s) would change. Re-run with --write to apply.`);
} else if (WRITE) {
  console.log(`\nDone. ${changed} file(s) updated.`);
} else {
  console.log('\nAll up-to-date.');
}
