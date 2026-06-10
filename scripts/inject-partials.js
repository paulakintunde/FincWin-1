#!/usr/bin/env node
/**
 * inject-partials.js
 *
 * Injects nav, footer, and scripts partials into hand-written HTML pages.
 * Safe to re-run: replaces existing inline nav/footer/scripts with the
 * canonical partial content, resolving {{BASE}} for each file's depth.
 *
 * Usage:
 *   node scripts/inject-partials.js            # dry-run (prints changed files)
 *   node scripts/inject-partials.js --write    # applies changes
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const PARTIAL  = path.join(__dirname, 'partials');
const WRITE    = process.argv.includes('--write');

// ── Pages to process ─────────────────────────────────────────────────────────
// Paths are relative to ROOT.
// Pages with no nav/footer (app.html, signin.html, account.html, admin.html)
// are intentionally excluded.
const TARGETS = [
  // Root marketing pages
  'index.html',
  'pricing.html',
  'features.html',
  'compare.html',
  'use-cases.html',
  'about.html',
  'changelog.html',
  'contact.html',
  'help.html',
  'privacy.html',
  'terms.html',
  'cookie-policy.html',
  'budget-categories.html',
  '404.html',
  // Budget category pages
  'cat-banking.html',
  'cat-clothing.html',
  'cat-dining.html',
  'cat-education.html',
  'cat-entertainment.html',
  'cat-groceries.html',
  'cat-healthcare.html',
  'cat-housing.html',
  'cat-other.html',
  'cat-personal.html',
  'cat-subscriptions.html',
  'cat-telecom.html',
  'cat-transport.html',
  'cat-utilities.html',
  // Niche landing pages (these are also covered by the build system,
  // but partial injection keeps them in sync between rebuilds)
  'no-bank-sync-budget.html',
  'offline-budget-app.html',
  'private-finance-app.html',
  // Blog index + category index pages
  'blog/index.html',
  'blog/budgeting/index.html',
  'blog/debt/index.html',
  'blog/savings/index.html',
  'blog/mindset/index.html',
  'blog/tools/index.html',
];

// Auto-discover all blog posts
const postsDir = path.join(ROOT, 'blog', 'posts');
if (fs.existsSync(postsDir)) {
  for (const f of fs.readdirSync(postsDir)) {
    if (f.endsWith('.html')) TARGETS.push(`blog/posts/${f}`);
  }
}

// ── Partial content ───────────────────────────────────────────────────────────
const NAV_PARTIAL     = fs.readFileSync(path.join(PARTIAL, 'nav.html'),     'utf8').trimEnd();
const FOOTER_PARTIAL  = fs.readFileSync(path.join(PARTIAL, 'footer.html'),  'utf8').trimEnd();
const SCRIPTS_PARTIAL = fs.readFileSync(path.join(PARTIAL, 'scripts.html'), 'utf8').trimEnd();

// ── Regex patterns ────────────────────────────────────────────────────────────
// Matches any existing <nav id="mainNav">...</nav> block (single-line or multi-line)
const NAV_RE    = /<nav\s+id="mainNav"[\s\S]*?<\/nav>/;
// Matches <footer class="mkt-footer">...</footer>
const FOOTER_RE = /<footer\s+class="mkt-footer"[\s\S]*?<\/footer>/;
// Matches the pair of mkt.js + consent.js script tags (with any relative prefix)
const SCRIPTS_RE = /<script[^>]+(?:\.\.\/)*js\/mkt\.js[^>]*><\/script>\s*\n?\s*<script[^>]+(?:\.\.\/)*js\/consent\.js[^>]*><\/script>/;

function resolveBase(relPath) {
  const depth = relPath.replace(/^\.?\//, '').split('/').length - 1;
  return '../'.repeat(depth);
}

function applyPartials(html, base) {
  const nav     = NAV_PARTIAL.replace(/\{\{BASE\}\}/g, base);
  const footer  = FOOTER_PARTIAL.replace(/\{\{BASE\}\}/g, base);
  const scripts = SCRIPTS_PARTIAL.replace(/\{\{BASE\}\}/g, base);

  let out = html;
  out = out.replace(NAV_RE,     nav);
  out = out.replace(FOOTER_RE,  footer);
  out = out.replace(SCRIPTS_RE, scripts);
  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────────
let changed = 0;

for (const rel of TARGETS) {
  const filePath = path.join(ROOT, rel);
  if (!fs.existsSync(filePath)) {
    console.warn(`  skip (not found): ${rel}`);
    continue;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const base     = resolveBase(rel);
  const updated  = applyPartials(original, base);

  if (updated === original) {
    console.log(`  unchanged: ${rel}`);
    continue;
  }

  changed++;
  if (WRITE) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`  updated:   ${rel}`);
  } else {
    console.log(`  would update: ${rel}`);
  }
}

if (!WRITE && changed > 0) {
  console.log(`\nDry run complete. ${changed} file(s) would be updated.`);
  console.log('Run with --write to apply changes.');
} else if (WRITE) {
  console.log(`\nDone. ${changed} file(s) updated.`);
} else {
  console.log('\nAll files already up-to-date.');
}
