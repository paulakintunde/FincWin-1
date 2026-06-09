/**
 * sync-chrome.js
 * Single source of truth for FincWin marketing nav and footer.
 *
 * Run:  node scripts/sync-chrome.js
 * npm:  npm run sync-chrome
 *
 * Rewrites <nav id="mainNav"> and <footer class="mkt-footer"> in every
 * marketing page (root + blog hub + blog posts). Pages outside the mkt
 * system (index.html, signin.html, privacy.html, terms.html, help.html,
 * admin.html, account.html) are intentionally excluded.
 *
 * To change nav or footer for every page: edit the CANONICAL constants
 * below, then re-run the script.
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// ── CANONICAL NAV ──────────────────────────────────────────────────────────
// {{P}}   = path prefix  (""  for root, "../" for blog/, "../../" for blog/posts/)
// {{BLOG}}= blog index path, optionally with class="active"
const NAV = (p, blogHref, blogActive) => `<nav id="mainNav">
  <a href="${p}index.html" class="nav-logo">Finc<span>Win</span></a>
  <div class="nav-links">
    <a href="${p}features.html">Features</a>
    <a href="${p}pricing.html">Pricing</a>
    <a href="${p}compare.html">Compare</a>
    <a href="${blogHref}"${blogActive ? ' class="active"' : ''}>Blog</a>
    <a href="${p}app.html">App</a>
    <a href="${p}app.html" class="nav-cta">Get started free</a>
  </div>
</nav>`;

// ── CANONICAL FOOTER ───────────────────────────────────────────────────────
const FOOTER = (p) => `<footer class="mkt-footer">
  <div class="footer-inner">
    <div class="footer-top">
      <div class="footer-brand"><a href="${p}index.html" class="footer-logo">Finc<span>Win</span></a><p>The personal finance dashboard for people who want clarity, not complexity.</p></div>
      <div class="footer-col"><h4>Product</h4><a href="${p}features.html">Features</a><a href="${p}pricing.html">Pricing</a><a href="${p}compare.html">Compare</a><a href="${p}app.html">Open app</a></div>
      <div class="footer-col"><h4>Company</h4><a href="${p}about.html">About</a><a href="${p}changelog.html">Changelog</a><a href="${p}contact.html">Contact</a></div>
      <div class="footer-col"><h4>Legal</h4><a href="${p}privacy.html">Privacy</a><a href="${p}terms.html">Terms</a><a href="${p}cookie-policy.html">Cookies</a></div>
    </div>
    <hr class="footer-divider">
    <div class="footer-bottom"><p class="footer-copy">© 2026 FincWin.</p><div class="footer-legal"><a href="${p}privacy.html">Privacy</a><a href="${p}terms.html">Terms</a><a href="${p}cookie-policy.html">Cookies</a></div></div>
  </div>
</footer>`;

// ── PAGE LIST ──────────────────────────────────────────────────────────────
// { file, prefix, blogHref, blogActive? }
const pages = [
  // Root marketing pages (nav + mkt-footer)
  ...['landing','features','about','contact','changelog','use-cases','compare'].map(name => ({
    file:       `${name}.html`,
    prefix:     '',
    blogHref:   'blog/index.html',
    blogActive: false,
  })),
  // legal pages — use mkt.css nav + mkt-footer
  { file: 'cookie-policy.html', prefix: '', blogHref: 'blog/index.html', blogActive: false },
  // pricing.html — custom dark footer; sync nav only (footer won't match mkt-footer regex)
  { file: 'pricing.html', prefix: '', blogHref: 'blog/index.html', blogActive: false },
  // Blog hub
  { file: 'blog/index.html', prefix: '../',  blogHref: 'index.html',   blogActive: true },
];

// Auto-discover blog posts
const postsDir = path.join(ROOT, 'blog', 'posts');
if (fs.existsSync(postsDir)) {
  fs.readdirSync(postsDir)
    .filter(f => f.endsWith('.html'))
    .forEach(f => pages.push({
      file:       `blog/posts/${f}`,
      prefix:     '../../',
      blogHref:   '../index.html',
      blogActive: true,
    }));
}

// ── REGEXES ────────────────────────────────────────────────────────────────
// Match the whole nav block (lazy — stops at first </nav>)
const NAV_RX    = /<nav id="mainNav">[\s\S]*?<\/nav>/;
// Match the whole footer block
const FOOTER_RX = /<footer class="mkt-footer">[\s\S]*?<\/footer>/;

// ── RUN ────────────────────────────────────────────────────────────────────
let updated = 0, skipped = 0, errors = 0;

for (const page of pages) {
  const filePath = path.join(ROOT, page.file);

  if (!fs.existsSync(filePath)) {
    console.warn(`  SKIP  (missing) ${page.file}`);
    skipped++;
    continue;
  }

  let html = fs.readFileSync(filePath, 'utf8');
  const newNav    = NAV(page.prefix, page.blogHref, page.blogActive);
  const newFooter = FOOTER(page.prefix);

  const hadNav    = NAV_RX.test(html);
  const hadFooter = FOOTER_RX.test(html);

  if (!hadNav && !hadFooter) {
    console.warn(`  SKIP  (no targets) ${page.file}`);
    skipped++;
    continue;
  }

  if (hadNav)    html = html.replace(NAV_RX,    newNav);
  if (hadFooter) html = html.replace(FOOTER_RX, newFooter);

  try {
    fs.writeFileSync(filePath, html, 'utf8');
    const tags = [hadNav && 'nav', hadFooter && 'footer'].filter(Boolean).join('+');
    console.log(`  ✓  (${tags}) ${page.file}`);
    updated++;
  } catch (err) {
    console.error(`  ERROR ${page.file}: ${err.message}`);
    errors++;
  }
}

console.log(`\nDone — updated: ${updated}  skipped: ${skipped}  errors: ${errors}`);
if (errors) process.exit(1);
