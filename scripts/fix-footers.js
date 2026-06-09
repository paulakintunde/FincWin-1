#!/usr/bin/env node
// scripts/fix-footers.js
// Standardises the footer across all marketing pages:
//   - Removes the "Legal" column (links live in footer-bottom only)
//   - Ensures footer-bottom has Privacy · Terms · Cookies
//   - Makes the copyright year dynamic via .copy-year span + JS
//   - Normalises footer brand tagline

'use strict';

const fs   = require('fs');
const path = require('path');
const BASE = path.resolve(__dirname, '..');

function read(rel)       { return fs.readFileSync(path.join(BASE, rel), 'utf8'); }
function write(rel, html){ fs.writeFileSync(path.join(BASE, rel), html, 'utf8'); }

function patch(rel, fns) {
  let html = read(rel);
  const before = html;
  for (const fn of fns) html = fn(html);
  if (html !== before) { write(rel, html); console.log('  ✓', rel); return true; }
  console.log('  —', rel, '(no change)');
  return false;
}

// ── YEAR SCRIPT ───────────────────────────────────────────────────────────────
const YEAR_SCRIPT = `<script>document.querySelectorAll('.copy-year').forEach(function(e){e.textContent=new Date().getFullYear();});</script>`;

// ── TRANSFORMS ────────────────────────────────────────────────────────────────

// Remove single-line mkt-footer Legal column
// Matches: <div class="footer-col"><h4>Legal</h4>...(any links)...</div>
function stripLegalSingle(html) {
  return html.replace(
    /<div class="footer-col"><h4>Legal<\/h4>(?:<a [^>]*>[^<]*<\/a>)*<\/div>/,
    ''
  );
}

// Remove multi-line inline-footer Legal block (pricing, help, privacy, terms)
// Uses \s* to handle both \n and \r\n (Windows CRLF) line endings
function stripLegalMulti(html) {
  return html.replace(
    /<div>\s*<h4>Legal<\/h4>[\s\S]*?<\/div>/,
    ''
  );
}

// Replace the mkt-footer footer-bottom with standardised version
// Handles: Privacy+Terms only, Privacy+Terms+Cookies, aria-current variants
function fixMktBottom(prefix) {
  return function(html) {
    const fb = `<div class="footer-bottom"><p class="footer-copy">© <span class="copy-year">2026</span> FincWin.</p><div class="footer-legal"><a href="${prefix}privacy.html">Privacy</a><a href="${prefix}terms.html">Terms</a><a href="${prefix}cookie-policy.html">Cookies</a></div></div>`;
    // Match from opening tag to the nested </div></div> that closes it
    return html.replace(
      /<div class="footer-bottom"><p class="footer-copy">©[^<]*<\/p><div class="footer-legal">[\s\S]*?<\/div><\/div>/,
      fb
    );
  };
}

// Replace inline footer-bottom (plain text) with structured version + legal links
// Also injects required CSS rules for .footer-legal and .footer-copy if absent
function fixInlineBottom(prefix) {
  return function(html) {
    // Inject .footer-legal CSS after .footer-bottom rule if missing
    if (!html.includes('.footer-legal')) {
      html = html.replace(
        /(\.footer-bottom\s*\{[^}]*\})/,
        `$1\n    .footer-copy { font-size: 12px; }\n    .footer-legal { display: flex; gap: 20px; }\n    .footer-legal a { color: rgba(255,255,255,.4); text-decoration: none; transition: color .2s; }\n    .footer-legal a:hover { color: rgba(255,255,255,.7); }`
      );
      // Ensure .footer-bottom itself is flex so copy and legal sit side-by-side
      html = html.replace(
        /\.footer-bottom\s*\{([^}]*)?\}/,
        (m, inner) => {
          if (/display\s*:/.test(inner)) return m;
          return `.footer-bottom {${inner}  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }`;
        }
      );
    }
    // Replace the plain-text footer-bottom
    return html.replace(
      /<div class="footer-bottom">© 2026 FincWin\. All rights reserved\.<\/div>/,
      `<div class="footer-bottom"><p class="footer-copy">© <span class="copy-year">2026</span> FincWin.</p><div class="footer-legal"><a href="${prefix}privacy.html">Privacy</a><a href="${prefix}terms.html">Terms</a><a href="${prefix}cookie-policy.html">Cookies</a></div></div>`
    );
  };
}

// Normalise footer brand tagline to the canonical version
const CANONICAL_TAGLINE = '<p>The personal finance dashboard for people who want clarity, not complexity.</p>';
function normTagline(html) {
  return html
    .replace(/<p>Income, spending, debt, and savings — one clear view\.<\/p>/, CANONICAL_TAGLINE)
    .replace(/<p>Personal finance clarity, offline and private\.<\/p>/,       CANONICAL_TAGLINE);
}

// Inject year script before </body> (idempotent)
function addYearScript(html) {
  if (!html.includes('copy-year'))  return html; // span not present yet, skip
  if (html.includes(YEAR_SCRIPT))   return html; // already there
  return html.replace('</body>', YEAR_SCRIPT + '\n</body>');
}

// ── ROOT MKT-FOOTER PAGES ─────────────────────────────────────────────────────
console.log('\nRoot marketing pages:');
const MKT_ROOT = [
  'landing.html', 'about.html', 'compare.html', 'changelog.html',
  'contact.html', 'use-cases.html', 'features.html', 'cookie-policy.html',
];
for (const f of MKT_ROOT) {
  patch(f, [stripLegalSingle, fixMktBottom(''), addYearScript]);
}

// ── CUSTOM INLINE-FOOTER PAGES ────────────────────────────────────────────────
console.log('\nCustom inline-footer pages:');
const INLINE_ROOT = ['pricing.html', 'help.html', 'privacy.html', 'terms.html'];
for (const f of INLINE_ROOT) {
  patch(f, [stripLegalMulti, normTagline, fixInlineBottom(''), addYearScript]);
}

// ── BLOG INDEX ────────────────────────────────────────────────────────────────
console.log('\nBlog index:');
patch('blog/index.html', [stripLegalSingle, fixMktBottom('../'), addYearScript]);

// ── BLOG POSTS ────────────────────────────────────────────────────────────────
console.log('\nBlog posts:');
const POSTS = fs.readdirSync(path.join(BASE, 'blog/posts')).filter(f => f.endsWith('.html'));
for (const f of POSTS) {
  patch(`blog/posts/${f}`, [stripLegalSingle, fixMktBottom('../../'), addYearScript]);
}

console.log('\nDone.');
