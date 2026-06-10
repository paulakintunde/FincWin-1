#!/usr/bin/env node
/**
 * remove-root-dupes.js
 *
 * Removes duplicate inline CSS that mkt.css already provides:
 *  - *, *::before, *::after { box-sizing: ... } reset
 *  - :root { --sage: ... } variable block
 *  - html { scroll-behavior: smooth; } (single-line only — multi-line is page-specific)
 *  - body { font-family: var(--sans); ... } ONLY when it's the exact shared baseline
 *    (pages with custom body backgrounds etc. are left alone)
 *
 * Only runs on pages that load mkt.css. Safe to re-run (idempotent).
 *
 * Usage:
 *   node scripts/remove-root-dupes.js          # dry-run
 *   node scripts/remove-root-dupes.js --write  # apply
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT  = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

// Pages that load mkt.css and have inline :root dupes
// (account.html and admin.html are excluded — they don't load mkt.css)
const TARGETS = [
  '404.html',
  'budget-categories.html',
  'cookie-policy.html',
  'help.html',
  'pricing.html',
  'privacy.html',
  'terms.html',
  'cat-banking.html', 'cat-clothing.html', 'cat-dining.html',
  'cat-education.html', 'cat-entertainment.html', 'cat-groceries.html',
  'cat-healthcare.html', 'cat-housing.html', 'cat-other.html',
  'cat-personal.html', 'cat-subscriptions.html', 'cat-telecom.html',
  'cat-transport.html', 'cat-utilities.html',
];

// ── Patterns to strip ─────────────────────────────────────────────────────────

// 1. box-sizing reset line (with optional leading whitespace)
const BOX_SIZING_RE = /[ \t]*\*,\s*\*::before,\s*\*::after\s*\{\s*box-sizing:\s*border-box;\s*margin:\s*0;\s*padding:\s*0;\s*\}\n?/g;

// 2. :root block — matches the entire block from ':root {' to closing '}'
//    (single-level nesting only — CSS :root has no nested rules)
const ROOT_BLOCK_RE = /[ \t]*:root\s*\{[^}]*\}\n?/g;

// 3. html { scroll-behavior: smooth; } — single-line version only
const HTML_SCROLL_RE = /[ \t]*html\s*\{\s*scroll-behavior:\s*smooth;\s*\}\n?/g;

// 4. The exact shared body baseline — only remove when it's the minimal version
//    (pages that override background or have multi-property body blocks are left alone)
const BODY_BASELINE_RE = /[ \t]*body\s*\{\s*font-family:\s*var\(--sans\);\s*font-weight:\s*300;\s*color:\s*var\(--ink\);\s*background:\s*var\(--white\);\s*-webkit-font-smoothing:\s*antialiased;\s*(?:overflow-x:\s*hidden;\s*)?\}\n?/g;

function clean(html) {
  let out = html;
  out = out.replace(BOX_SIZING_RE, '');
  out = out.replace(ROOT_BLOCK_RE, '');
  out = out.replace(HTML_SCROLL_RE, '');
  out = out.replace(BODY_BASELINE_RE, '');
  // Collapse consecutive blank lines left after removal (max 1 blank line)
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

let changed = 0;
for (const rel of TARGETS) {
  const fp  = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) { console.warn(`  skip (not found): ${rel}`); continue; }
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
