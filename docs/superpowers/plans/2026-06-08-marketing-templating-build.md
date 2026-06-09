# Marketing Page Templating — Phased Build Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the static-HTML templating system so every remaining marketing page type (feature sub-pages, use-case pages, niche landings) is generated from a shared template + JSON data, with nav/footer extracted to DRY partials and all clean URLs routed on Vercel.

**Architecture:** Pure static HTML. A Node generator (`scripts/generate-page.js`) reads a template, injects shared partials (`{{> nav}}`, `{{> footer}}`, `{{> scripts}}`), replaces `{{TOKEN}}` placeholders from a per-page JSON data file, and writes plain `.html` to the public tree. The output committed HTML is what Vercel serves — there is **no build step in deployment**. A manifest + `build-all.js` regenerates the whole site in one command. Vitest guards token integrity and nav/footer consistency.

**Tech Stack:** Node.js (no deps), Vitest (already installed), Vercel static hosting, existing `styles/mkt.css`.

---

## Current state (already built — do not rebuild)

| Asset | Status |
|---|---|
| `scripts/generate-page.js` | ✅ exists — token replacement only, no partials |
| `scripts/templates/competitor-alt.html` | ✅ |
| `scripts/templates/blog-post.html` | ✅ |
| `scripts/templates/blog-category.html` | ✅ |
| `compare/*-alternative.html` (5) | ✅ generated |
| `blog/posts/*.html` (25) | ✅ |
| `blog/{budgeting,debt,savings,tools,mindset}/index.html` (5) | ✅ |
| `server.js` dev server (port 4141) | ✅ running |

## What this plan builds

| Phase | Output |
|---|---|
| 0 | Partials system + generator upgrade + manifest + test harness |
| 1 | `feature-page.html` template + 6 feature pages under `features/` |
| 2 | `use-case-page.html` template + 5 pages under `use-cases/` |
| 3 | `niche-landing.html` template + 3 root-level SEO pages |
| 4 | Vercel rewrites, sitemap, npm scripts, full regeneration |

## File structure after completion

```
scripts/
  generate-page.js          ← upgraded: partial injection + leftover-token guard
  build-all.js              ← NEW: regenerate every page from manifest
  build-manifest.json       ← NEW: list of {template, data, out}
  partials/                 ← NEW: shared, depth-independent (absolute URLs only)
    nav.html
    footer.html
    scripts.html
  templates/
    competitor-alt.html     (existing — migrate to partials in Phase 0)
    blog-post.html          (existing — migrate later, out of scope)
    blog-category.html      (existing — migrate later, out of scope)
    feature-page.html       ← NEW (Phase 1)
    use-case-page.html      ← NEW (Phase 2)
    niche-landing.html      ← NEW (Phase 3)
  data/
    feature-*.json (6)      ← NEW (Phase 1)
    usecase-*.json (5)      ← NEW (Phase 2)
    niche-*.json (3)        ← NEW (Phase 3)
features/                   ← NEW dir, generated pages
use-cases/                  ← NEW dir, generated pages
tests/
  generator.test.js         ← NEW (Phase 0)
```

---

## How the pages work (read before starting)

1. **A template** is a full HTML document with a page-specific `<style>` block in `<head>`, `{{> nav}}` / `{{> footer}}` / `{{> scripts}}` partial markers, and `{{TOKEN}}` content holes in the body.
2. **A data file** (`scripts/data/<slug>.json`) is a flat string→string map. Keys match tokens. Values may contain HTML (table rows, list items) — they are injected verbatim.
3. **The generator** runs locally: it (a) replaces `{{> name}}` with `scripts/partials/name.html`, (b) replaces `{{TOKEN}}` from the JSON, (c) fails loudly if any `{{...}}` remains, (d) writes plain HTML.
4. **Partials are depth-independent** because nav/footer use absolute URLs (`/features`, `/`). Depth-sensitive links (`../styles/mkt.css`, favicon) stay in each template's `<head>`, which knows its own directory depth.
5. **Vercel serves the committed `.html`**. Rewrites map clean URLs (`/features/loan-payoff-calculator` → `/features/loan-payoff-calculator.html`). No generator runs on deploy.

---

## Phase 0 — Partials, generator upgrade, test harness

### Task 0.1: Extract the nav partial

**Files:**
- Create: `scripts/partials/nav.html`

- [ ] **Step 1: Write the partial** (verbatim copy of the canonical nav from `landing.html` / `competitor-alt.html` lines 206-217)

```html
<nav id="mainNav">
  <a href="/" class="nav-logo">Finc<span>Win</span></a>
  <div class="nav-links">
    <a href="/features">Features</a>
    <a href="/pricing">Pricing</a>
    <a href="/compare">Compare</a>
    <a href="/use-cases">Use cases</a>
    <a href="/blog">Blog</a>
    <a href="/app">App</a>
    <a href="/app" class="nav-cta">Get started free</a>
  </div>
</nav>
```

- [ ] **Step 2: Commit**

```bash
git add scripts/partials/nav.html
git commit -m "feat(templating): extract shared nav partial"
```

### Task 0.2: Extract the footer partial

**Files:**
- Create: `scripts/partials/footer.html`

- [ ] **Step 1: Write the partial** (verbatim copy of footer from `competitor-alt.html` lines 315-336)

```html
<footer class="mkt-footer">
  <div class="footer-inner">
    <div class="footer-top">
      <div class="footer-brand">
        <a href="/" class="footer-logo">Finc<span>Win</span></a>
        <p>The personal finance dashboard for people who want clarity, not complexity.</p>
      </div>
      <div class="footer-col"><h4>Product</h4><a href="/features">Features</a><a href="/pricing">Pricing</a><a href="/compare">Compare</a><a href="/use-cases">Use cases</a><a href="/app">Open app</a></div>
      <div class="footer-col"><h4>Company</h4><a href="/about">About</a><a href="/changelog">Changelog</a><a href="/contact">Contact</a></div>
      <div class="footer-col"><h4>Learn</h4><a href="/blog">Blog</a><a href="/help">Help guide</a></div>
    </div>
    <hr class="footer-divider">
    <div class="footer-bottom">
      <p class="footer-copy">© <span class="copy-year">2026</span> FincWin.</p>
      <div class="footer-legal">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/cookie-policy">Cookies</a>
      </div>
    </div>
  </div>
</footer>
```

- [ ] **Step 2: Commit**

```bash
git add scripts/partials/footer.html
git commit -m "feat(templating): extract shared footer partial"
```

### Task 0.3: Extract the scripts partial

**Files:**
- Create: `scripts/partials/scripts.html`

- [ ] **Step 1: Write the partial** (the two bottom-of-body scripts from `competitor-alt.html` lines 338-342)

```html
<script>
const nav = document.getElementById('mainNav');
window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 20), { passive: true });
</script>
<script>document.querySelectorAll('.copy-year').forEach(function(e){e.textContent=new Date().getFullYear();});</script>
```

- [ ] **Step 2: Commit**

```bash
git add scripts/partials/scripts.html
git commit -m "feat(templating): extract shared bottom scripts partial"
```

### Task 0.4: Upgrade the generator to inject partials and guard leftover tokens

**Files:**
- Modify: `scripts/generate-page.js`
- Test: `tests/generator.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/generator.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-'));

function run(args) {
  return execFileSync('node', ['scripts/generate-page.js', ...args], {
    cwd: ROOT, encoding: 'utf8',
  });
}

describe('generate-page.js', () => {
  it('injects nav, footer and scripts partials', () => {
    const out = path.join(tmp, 'mint.html');
    run(['--template', 'competitor-alt', '--data', 'scripts/data/mint-alt.json', '--out', path.relative(ROOT, out)]);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).toContain('id="mainNav"');           // nav partial
    expect(html).toContain('class="mkt-footer"');      // footer partial
    expect(html).toContain("getElementById('mainNav')"); // scripts partial
  });

  it('leaves no unreplaced {{TOKEN}} or {{> partial}} markers', () => {
    const out = path.join(tmp, 'mint2.html');
    run(['--template', 'competitor-alt', '--data', 'scripts/data/mint-alt.json', '--out', path.relative(ROOT, out)]);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).not.toMatch(/\{\{\s*>?\s*\w+\s*\}\}/);
  });

  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/generator.test.js`
Expected: FAIL — current generator does not process `{{> nav}}`, so partial markers remain (second test fails) and partial content is absent (first test fails). *Note: this test only fully passes after Task 0.5 migrates `competitor-alt.html` to use the partial markers.*

- [ ] **Step 3: Rewrite `scripts/generate-page.js`**

```js
#!/usr/bin/env node
// Usage:
//   node scripts/generate-page.js --template feature-page --data scripts/data/feature-loan-payoff-calculator.json --out features/loan-payoff-calculator.html

'use strict';

const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const get  = (flag) => { const i = args.indexOf(flag); return i > -1 ? args[i + 1] : null; };

const templateName = get('--template');
const dataFile     = get('--data');
const outFile      = get('--out');

if (!templateName || !dataFile || !outFile) {
  console.error('Usage: node scripts/generate-page.js --template <name> --data <json> --out <path>');
  process.exit(1);
}

const templatePath = path.join(__dirname, 'templates', templateName + '.html');
if (!fs.existsSync(templatePath)) {
  console.error(`Template not found: ${templatePath}`);
  process.exit(1);
}

const dataPath = path.join(process.cwd(), dataFile);
if (!fs.existsSync(dataPath)) {
  console.error(`Data file not found: ${dataPath}`);
  process.exit(1);
}

let html      = fs.readFileSync(templatePath, 'utf8');
const data    = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const partDir = path.join(__dirname, 'partials');

// 1) Inject partials: {{> name}} -> scripts/partials/name.html
html = html.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, name) => {
  const p = path.join(partDir, name + '.html');
  if (!fs.existsSync(p)) { console.error(`Partial not found: ${p}`); process.exit(1); }
  return fs.readFileSync(p, 'utf8').trimEnd();
});

// 2) Replace {{TOKEN}} from data
const warnings = [];
html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
  if (!(key in data)) { warnings.push(key); return `{{${key}}}`; }
  return data[key];
});

// 3) Guard: fail if any marker survived
const leftover = html.match(/\{\{\s*>?\s*\w+\s*\}\}/g);
if (leftover) {
  console.error(`ERROR: unresolved markers in output: ${[...new Set(leftover)].join(', ')}`);
  process.exit(1);
}

const outPath = path.join(process.cwd(), outFile);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');

if (warnings.length) console.warn(`  Warning: no data value for: ${[...new Set(warnings)].join(', ')}`);
console.log(`  Written: ${outFile}`);
```

- [ ] **Step 4: Commit the generator (tests still red until 0.5)**

```bash
git add scripts/generate-page.js tests/generator.test.js
git commit -m "feat(templating): partial injection + leftover-token guard in generator"
```

### Task 0.5: Migrate `competitor-alt.html` to use partial markers

**Files:**
- Modify: `scripts/templates/competitor-alt.html:206-217` (nav), `:315-336` (footer), `:338-342` (scripts)

- [ ] **Step 1: Replace the inline nav block** (lines 206-217) with:

```html
{{> nav}}
```

- [ ] **Step 2: Replace the inline footer block** (lines 315-336) with:

```html
{{> footer}}
```

- [ ] **Step 3: Replace the two inline scripts** (lines 338-342) with:

```html
{{> scripts}}
```

- [ ] **Step 4: Run the generator test**

Run: `npx vitest run tests/generator.test.js`
Expected: PASS (both tests green)

- [ ] **Step 5: Regenerate all 5 compare pages and confirm no diff in rendered output**

```bash
node scripts/generate-page.js --template competitor-alt --data scripts/data/mint-alt.json --out compare/mint-alternative.html
node scripts/generate-page.js --template competitor-alt --data scripts/data/ynab-alt.json --out compare/ynab-alternative.html
node scripts/generate-page.js --template competitor-alt --data scripts/data/monarch-alt.json --out compare/monarch-alternative.html
node scripts/generate-page.js --template competitor-alt --data scripts/data/goodbudget-alt.json --out compare/goodbudget-alternative.html
node scripts/generate-page.js --template competitor-alt --data scripts/data/everydollar-alt.json --out compare/everydollar-alternative.html
git diff --stat compare/
```

Expected: either no diff, or whitespace-only diff (the partials are byte-identical to the originals). Inspect with `git diff compare/mint-alternative.html` to confirm only formatting changed.

- [ ] **Step 6: Commit**

```bash
git add scripts/templates/competitor-alt.html compare/
git commit -m "refactor(templating): competitor-alt uses shared partials"
```

### Task 0.6: Create the build manifest and build-all script

**Files:**
- Create: `scripts/build-manifest.json`
- Create: `scripts/build-all.js`

- [ ] **Step 1: Write the manifest** (the 5 existing compare pages; later phases append to this)

```json
[
  { "template": "competitor-alt", "data": "scripts/data/mint-alt.json",        "out": "compare/mint-alternative.html" },
  { "template": "competitor-alt", "data": "scripts/data/ynab-alt.json",        "out": "compare/ynab-alternative.html" },
  { "template": "competitor-alt", "data": "scripts/data/monarch-alt.json",     "out": "compare/monarch-alternative.html" },
  { "template": "competitor-alt", "data": "scripts/data/goodbudget-alt.json",  "out": "compare/goodbudget-alternative.html" },
  { "template": "competitor-alt", "data": "scripts/data/everydollar-alt.json", "out": "compare/everydollar-alternative.html" }
]
```

- [ ] **Step 2: Write build-all.js**

```js
#!/usr/bin/env node
'use strict';
const { execFileSync } = require('node:child_process');
const fs   = require('node:fs');
const path = require('node:path');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'build-manifest.json'), 'utf8'));
let failed = 0;

for (const { template, data, out } of manifest) {
  try {
    execFileSync('node', [path.join(__dirname, 'generate-page.js'),
      '--template', template, '--data', data, '--out', out],
      { cwd: process.cwd(), stdio: 'inherit' });
  } catch {
    console.error(`  FAILED: ${out}`);
    failed++;
  }
}

console.log(`\nBuilt ${manifest.length - failed}/${manifest.length} pages.`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: Run it**

Run: `node scripts/build-all.js`
Expected: `Built 5/5 pages.`

- [ ] **Step 4: Commit**

```bash
git add scripts/build-manifest.json scripts/build-all.js
git commit -m "feat(templating): build manifest + build-all regeneration script"
```

---

## Phase 1 — Feature sub-pages

Output dir: `features/`. Six pages: envelope-budgeting, loan-payoff-calculator, savings-goals, analytics-dashboard, google-drive-backup, ai-coach. Schema: `SoftwareApplication` + `BreadcrumbList`. CSS path depth = 1, so head uses `../styles/mkt.css` and `../favicon.svg` (identical to compare pages).

### Task 1.1: Create the feature-page template

**Files:**
- Create: `scripts/templates/feature-page.html`

- [ ] **Step 1: Write the template** (mirrors competitor-alt head/schema/partials conventions)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{META_TITLE}}</title>
  <meta name="description" content="{{META_DESCRIPTION}}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{{CANONICAL_URL}}">
  <link rel="alternate" hreflang="en" href="{{CANONICAL_URL}}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{{CANONICAL_URL}}">
  <meta property="og:title" content="{{META_TITLE}}">
  <meta property="og:description" content="{{OG_DESCRIPTION}}">
  <meta property="og:image" content="https://fincwin.com/og-image.svg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{{META_TITLE}}">
  <meta name="twitter:description" content="{{OG_DESCRIPTION}}">
  <meta name="twitter:image" content="https://fincwin.com/og-image.svg">
  <link rel="icon" type="image/svg+xml" href="../favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@200;300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../styles/mkt.css">
  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "FincWin — {{FEATURE_NAME}}",
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Web, iOS, Android (PWA)",
  "description": "{{META_DESCRIPTION}}",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "publisher": { "@type": "Organization", "name": "FincWin", "url": "https://fincwin.com" }
}
</script>
  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home",     "item": "https://fincwin.com"},
    {"@type": "ListItem", "position": 2, "name": "Features",  "item": "https://fincwin.com/features"},
    {"@type": "ListItem", "position": 3, "name": "{{FEATURE_NAME}}", "item": "{{CANONICAL_URL}}"}
  ]
}
</script>
  <style>
    .ft-hero { min-height: 64vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 140px 24px 64px; position: relative; overflow: hidden; }
    .ft-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 70% 50% at 50% -5%, rgba(90,110,63,.08) 0%, transparent 65%); pointer-events: none; }
    .ft-hero .eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: var(--sage); margin-bottom: 28px; display: block; opacity: 0; animation: fadeUp .6s .1s forwards; }
    .ft-hero h1 { font-family: var(--serif); font-size: clamp(38px, 6vw, 68px); font-weight: 400; line-height: 1.08; color: var(--ink); max-width: 760px; opacity: 0; animation: fadeUp .7s .2s forwards; }
    .ft-hero h1 em { font-style: italic; color: var(--sage); }
    .ft-hero-sub { margin-top: 24px; font-size: clamp(16px, 2vw, 19px); font-weight: 300; color: var(--muted); max-width: 540px; line-height: 1.65; opacity: 0; animation: fadeUp .7s .35s forwards; }
    .ft-hero-actions { margin-top: 40px; display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; opacity: 0; animation: fadeUp .7s .5s forwards; }
    .ft-section { max-width: 820px; margin: 0 auto; padding: 64px 24px; }
    .ft-section .section-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--sage); margin-bottom: 16px; display: block; }
    .ft-section h2 { font-family: var(--serif); font-size: clamp(28px, 4vw, 40px); font-weight: 400; color: var(--ink); margin-bottom: 24px; line-height: 1.15; }
    .ft-section h2 em { font-style: italic; color: var(--sage); }
    .ft-section p { font-size: 16px; font-weight: 300; color: var(--muted); line-height: 1.8; margin-bottom: 16px; }
    .ft-steps { list-style: none; padding: 0; counter-reset: steps; display: flex; flex-direction: column; gap: 14px; }
    .ft-steps li { counter-increment: steps; display: flex; align-items: flex-start; gap: 16px; font-size: 15px; font-weight: 300; color: var(--muted); line-height: 1.7; }
    .ft-steps li::before { content: counter(steps); min-width: 28px; height: 28px; border-radius: 50%; background: var(--sage); color: #fff; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
    .ft-steps strong { color: var(--ink); font-weight: 500; }
    .cap-list { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
    .cap-list li { font-size: 15px; font-weight: 300; color: var(--muted); line-height: 1.6; display: flex; gap: 12px; padding: 16px 20px; background: var(--faint); border: 1px solid var(--border); border-radius: 10px; }
    .cap-list .li-icon { color: var(--sage); flex-shrink: 0; }
    .cap-list strong { color: var(--ink); font-weight: 500; }
    .plan-note { max-width: 820px; margin: 0 auto; padding: 0 24px 16px; }
    .plan-note .badge { display: inline-block; font-size: 12px; font-weight: 600; color: var(--sage); background: rgba(90,110,63,.08); border: 1px solid rgba(90,110,63,.25); border-radius: 999px; padding: 6px 14px; }
    .ft-cta-wrap { max-width: 860px; margin: 0 auto; }
    .ft-cta { background: var(--ink); border-radius: 20px; padding: 64px 40px; text-align: center; margin: 48px 24px 80px; }
    .ft-cta h2 { font-family: var(--serif); font-size: clamp(28px, 4vw, 44px); font-weight: 400; color: #fff; margin-bottom: 14px; line-height: 1.1; }
    .ft-cta h2 em { font-style: italic; color: #a8c48a; }
    .ft-cta p { font-size: 16px; color: rgba(255,255,255,.5); margin-bottom: 28px; line-height: 1.65; }
    .related-section { max-width: 860px; margin: 0 auto; padding: 0 24px 96px; }
    .related-section h4 { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 20px; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
    .related-link { text-decoration: none; color: inherit; border: 1px solid var(--border); border-radius: 10px; padding: 16px; transition: border-color .2s; display: block; }
    .related-link:hover { border-color: rgba(90,110,63,.35); }
    .related-link span { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--sage); display: block; margin-bottom: 6px; }
    .related-link p { font-size: 14px; font-weight: 400; color: var(--ink); margin: 0; line-height: 1.4; }
    @media (max-width: 768px) { .ft-cta { margin: 32px 16px 64px; padding: 40px 24px; } }
  </style>
</head>
<body>

{{> nav}}

<section class="ft-hero">
  <span class="eyebrow">FincWin · {{FEATURE_MODULE}}</span>
  <h1>{{FEATURE_HEADLINE}}</h1>
  <p class="ft-hero-sub">{{FEATURE_SUBHEAD}}</p>
  <div class="ft-hero-actions">
    <a href="/app" class="btn-primary">Get started free →</a>
    <a href="/features" class="btn-ghost">See all features</a>
  </div>
</section>

<div class="ft-section">
  <span class="section-eyebrow">The problem</span>
  <h2>{{PROBLEM_HEADLINE}}</h2>
  {{PROBLEM_BODY}}
</div>

<div class="ft-section">
  <span class="section-eyebrow">How it works</span>
  <h2>How <em>{{FEATURE_NAME}}</em> works in FincWin</h2>
  <ol class="ft-steps">
    {{HOW_IT_WORKS}}
  </ol>
</div>

<div class="ft-section">
  <span class="section-eyebrow">Capabilities</span>
  <h2>What you get</h2>
  <ul class="cap-list">
    {{CAPABILITIES}}
  </ul>
</div>

<div class="plan-note">
  <span class="badge">Included in: {{FEATURE_PLAN}}</span>
</div>

<div class="ft-cta-wrap">
  <div class="ft-cta">
    <h2>{{CTA_HEADLINE}}</h2>
    <p>Free plan is permanent. No card, no account required.</p>
    <a href="/app" class="btn-primary">Open FincWin free →</a>
  </div>
</div>

<div class="related-section">
  <h4>Related features</h4>
  <div class="related-grid">
    {{RELATED_FEATURES}}
  </div>
</div>

{{> footer}}

{{> scripts}}
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add scripts/templates/feature-page.html
git commit -m "feat(templating): add feature-page template"
```

### Task 1.2: Author the first feature data file (worked example — loan-payoff-calculator)

**Files:**
- Create: `scripts/data/feature-loan-payoff-calculator.json`

- [ ] **Step 1: Write the data file** (complete, real copy)

```json
{
  "META_TITLE": "Loan Payoff Calculator — See Your Debt-Free Date | FincWin",
  "META_DESCRIPTION": "FincWin's loan payoff calculator shows the exact date you'll be debt-free using snowball or avalanche, with interest saved and month-by-month projections.",
  "OG_DESCRIPTION": "Snowball or avalanche — FincWin projects your exact debt-free date and total interest saved. Free to start.",
  "CANONICAL_URL": "https://fincwin.com/features/loan-payoff-calculator",
  "FEATURE_NAME": "Loan Payoff Calculator",
  "FEATURE_MODULE": "Loans",
  "FEATURE_HEADLINE": "Know the exact date you'll be <em>debt-free</em>",
  "FEATURE_SUBHEAD": "Add your loans once. FincWin projects your payoff date, total interest, and the fastest route out — snowball or avalanche.",
  "PROBLEM_HEADLINE": "Most people have no idea when their debt ends",
  "PROBLEM_BODY": "<p>You make payments every month, but the finish line is invisible. Spreadsheets go stale, and bank apps only show this month's minimum — not what happens if you pay $50 more.</p><p>FincWin turns your loans into a clear timeline: a real date, a real number, and the order to attack them in.</p>",
  "HOW_IT_WORKS": "<li><strong>Add each loan</strong> — balance, interest rate, and minimum payment. Takes about a minute per loan.</li>\n    <li><strong>Pick a strategy</strong> — snowball (smallest balance first, for momentum) or avalanche (highest rate first, for lowest cost).</li>\n    <li><strong>Set your extra payment</strong> — any amount above the minimums. Watch the debt-free date move earlier instantly.</li>\n    <li><strong>Track it on your dashboard</strong> — progress updates automatically as you log payments.</li>",
  "CAPABILITIES": "<li><span class=\"li-icon\">✓</span><span><strong>Snowball &amp; avalanche</strong> side by side so you can compare cost vs momentum.</span></li>\n    <li><span class=\"li-icon\">✓</span><span><strong>Exact payoff date</strong> recalculated every time you change a payment.</span></li>\n    <li><span class=\"li-icon\">✓</span><span><strong>Total interest saved</strong> versus paying minimums only.</span></li>\n    <li><span class=\"li-icon\">✓</span><span><strong>Month-by-month schedule</strong> for every loan.</span></li>\n    <li><span class=\"li-icon\">✓</span><span><strong>Multi-currency</strong> — works for any currency, any country.</span></li>\n    <li><span class=\"li-icon\">✓</span><span><strong>Offline</strong> — runs fully in your browser, no bank login.</span></li>",
  "FEATURE_PLAN": "Free & Pro",
  "CTA_HEADLINE": "See your debt-free date in <em>two minutes.</em>",
  "RELATED_FEATURES": "<a href=\"/features/savings-goals\" class=\"related-link\"><span>Feature</span><p>Savings Goals</p></a>\n    <a href=\"/features/analytics-dashboard\" class=\"related-link\"><span>Feature</span><p>Analytics Dashboard</p></a>\n    <a href=\"/blog/posts/debt-snowball-vs-avalanche\" class=\"related-link\"><span>Debt</span><p>Debt Snowball vs Avalanche</p></a>\n    <a href=\"/use-cases/paying-off-debt\" class=\"related-link\"><span>Use case</span><p>Paying Off Debt</p></a>"
}
```

- [ ] **Step 2: Generate the page**

Run:
```bash
node scripts/generate-page.js --template feature-page --data scripts/data/feature-loan-payoff-calculator.json --out features/loan-payoff-calculator.html
```
Expected: `Written: features/loan-payoff-calculator.html` with no warnings.

- [ ] **Step 3: Verify in the running server**

Run: `curl -s -o NUL -w "%{http_code}\n" http://localhost:4141/features/loan-payoff-calculator.html`
Expected: `200`. Then open `http://localhost:4141/features/loan-payoff-calculator.html` in a browser and confirm nav, hero, steps, capabilities, CTA, footer all render.

- [ ] **Step 4: Commit**

```bash
git add scripts/data/feature-loan-payoff-calculator.json features/loan-payoff-calculator.html
git commit -m "feat(content): loan payoff calculator feature page"
```

### Task 1.3: Author the remaining 5 feature data files

**Files:**
- Create: `scripts/data/feature-envelope-budgeting.json`
- Create: `scripts/data/feature-savings-goals.json`
- Create: `scripts/data/feature-analytics-dashboard.json`
- Create: `scripts/data/feature-google-drive-backup.json`
- Create: `scripts/data/feature-ai-coach.json`

Each file uses the **identical key set** from Task 1.2 (`META_TITLE`, `META_DESCRIPTION`, `OG_DESCRIPTION`, `CANONICAL_URL`, `FEATURE_NAME`, `FEATURE_MODULE`, `FEATURE_HEADLINE`, `FEATURE_SUBHEAD`, `PROBLEM_HEADLINE`, `PROBLEM_BODY`, `HOW_IT_WORKS`, `CAPABILITIES`, `FEATURE_PLAN`, `CTA_HEADLINE`, `RELATED_FEATURES`). Authoring values per page:

- [ ] **Step 1: `feature-envelope-budgeting.json`** — `FEATURE_NAME` "Envelope Budgeting", `FEATURE_MODULE` "Budgeting", `CANONICAL_URL` `https://fincwin.com/features/envelope-budgeting`, `FEATURE_PLAN` "Free & Pro". Headline: "Give every dollar <em>a job</em>". 14 categories, 5 frequencies as the core capability. Cross-link to `/blog/posts/envelope-budgeting-method` and `/features/savings-goals`.

- [ ] **Step 2: `feature-savings-goals.json`** — `FEATURE_NAME` "Savings Goals", `FEATURE_MODULE` "Savings", canonical `.../features/savings-goals`, plan "Free & Pro". Headline: "Watch every goal <em>fill up</em>". Capabilities: named goals, progress tracking, target dates, sinking funds. Cross-link `/blog/posts/sinking-funds`, `/features/loan-payoff-calculator`.

- [ ] **Step 3: `feature-analytics-dashboard.json`** — `FEATURE_NAME` "Analytics Dashboard", `FEATURE_MODULE` "Insights", canonical `.../features/analytics-dashboard`, plan "Free & Pro". Headline: "See where your money <em>actually goes</em>". Capabilities: net flow over time, category breakdowns, smart insights, net worth. Cross-link `/blog/posts/net-worth-tracking`, `/features/envelope-budgeting`.

- [ ] **Step 4: `feature-google-drive-backup.json`** — `FEATURE_NAME` "Google Drive Backup", `FEATURE_MODULE` "Sync & Backup", canonical `.../features/google-drive-backup`, plan "Free & Pro". Headline: "Your data, <em>your</em> Google Drive". Capabilities: encrypted backup, restore on any device, you own the file, no FincWin server storage. Cross-link `/privacy`, `/features/ai-coach`.

- [ ] **Step 5: `feature-ai-coach.json`** — `FEATURE_NAME` "AI Coach", `FEATURE_MODULE` "Insights", canonical `.../features/ai-coach`, plan "Pro". Headline: "A money coach that <em>knows your numbers</em>". Capabilities: BYOK (OpenAI or Anthropic), runs on your data locally, spending Q&A, plan suggestions. Cross-link `/blog/posts/ai-financial-coach`, `/features/analytics-dashboard`.

- [ ] **Step 6: Generate all five**

```bash
node scripts/generate-page.js --template feature-page --data scripts/data/feature-envelope-budgeting.json   --out features/envelope-budgeting.html
node scripts/generate-page.js --template feature-page --data scripts/data/feature-savings-goals.json        --out features/savings-goals.html
node scripts/generate-page.js --template feature-page --data scripts/data/feature-analytics-dashboard.json  --out features/analytics-dashboard.html
node scripts/generate-page.js --template feature-page --data scripts/data/feature-google-drive-backup.json  --out features/google-drive-backup.html
node scripts/generate-page.js --template feature-page --data scripts/data/feature-ai-coach.json             --out features/ai-coach.html
```
Expected: 5× `Written:` lines, zero warnings (any warning = a missing key; fix the JSON).

- [ ] **Step 7: Commit**

```bash
git add scripts/data/feature-*.json features/
git commit -m "feat(content): remaining 5 feature sub-pages"
```

### Task 1.4: Add the 6 feature pages to the build manifest

**Files:**
- Modify: `scripts/build-manifest.json`

- [ ] **Step 1: Append these entries** (before the closing `]`)

```json
,
  { "template": "feature-page", "data": "scripts/data/feature-loan-payoff-calculator.json", "out": "features/loan-payoff-calculator.html" },
  { "template": "feature-page", "data": "scripts/data/feature-envelope-budgeting.json",     "out": "features/envelope-budgeting.html" },
  { "template": "feature-page", "data": "scripts/data/feature-savings-goals.json",          "out": "features/savings-goals.html" },
  { "template": "feature-page", "data": "scripts/data/feature-analytics-dashboard.json",    "out": "features/analytics-dashboard.html" },
  { "template": "feature-page", "data": "scripts/data/feature-google-drive-backup.json",    "out": "features/google-drive-backup.html" },
  { "template": "feature-page", "data": "scripts/data/feature-ai-coach.json",               "out": "features/ai-coach.html" }
```

- [ ] **Step 2: Verify full rebuild**

Run: `node scripts/build-all.js`
Expected: `Built 11/11 pages.`

- [ ] **Step 3: Commit**

```bash
git add scripts/build-manifest.json
git commit -m "chore(templating): add feature pages to build manifest"
```

---

## Phase 2 — Use-case sub-pages

Output dir: `use-cases/`. Five pages: paying-off-debt, building-savings, irregular-income, expat-multi-currency, couples-shared-finances. Schema: `HowTo` + `BreadcrumbList`. Depth = 1 (`../styles/mkt.css`).

### Task 2.1: Create the use-case-page template

**Files:**
- Create: `scripts/templates/use-case-page.html`

- [ ] **Step 1: Write the template** (same head/partial pattern as feature-page; body sections: hero, the situation, how FincWin helps, relevant features, optional quote, CTA, related)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{META_TITLE}}</title>
  <meta name="description" content="{{META_DESCRIPTION}}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{{CANONICAL_URL}}">
  <link rel="alternate" hreflang="en" href="{{CANONICAL_URL}}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{{CANONICAL_URL}}">
  <meta property="og:title" content="{{META_TITLE}}">
  <meta property="og:description" content="{{OG_DESCRIPTION}}">
  <meta property="og:image" content="https://fincwin.com/og-image.svg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{{META_TITLE}}">
  <meta name="twitter:description" content="{{OG_DESCRIPTION}}">
  <meta name="twitter:image" content="https://fincwin.com/og-image.svg">
  <link rel="icon" type="image/svg+xml" href="../favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@200;300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../styles/mkt.css">
  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "{{META_TITLE}}",
  "description": "{{META_DESCRIPTION}}",
  "step": {{HOWTO_STEPS_JSON}}
}
</script>
  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home",      "item": "https://fincwin.com"},
    {"@type": "ListItem", "position": 2, "name": "Use cases", "item": "https://fincwin.com/use-cases"},
    {"@type": "ListItem", "position": 3, "name": "{{PERSONA_LABEL}}", "item": "{{CANONICAL_URL}}"}
  ]
}
</script>
  <style>
    .uc-hero { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 140px 24px 64px; position: relative; overflow: hidden; }
    .uc-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 70% 50% at 50% -5%, rgba(90,110,63,.08) 0%, transparent 65%); pointer-events: none; }
    .uc-hero .eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: var(--sage); margin-bottom: 28px; display: block; opacity: 0; animation: fadeUp .6s .1s forwards; }
    .uc-hero h1 { font-family: var(--serif); font-size: clamp(38px, 6vw, 66px); font-weight: 400; line-height: 1.08; color: var(--ink); max-width: 780px; opacity: 0; animation: fadeUp .7s .2s forwards; }
    .uc-hero h1 em { font-style: italic; color: var(--sage); }
    .uc-hero-sub { margin-top: 24px; font-size: clamp(16px, 2vw, 19px); font-weight: 300; color: var(--muted); max-width: 560px; line-height: 1.65; opacity: 0; animation: fadeUp .7s .35s forwards; }
    .uc-hero-actions { margin-top: 40px; opacity: 0; animation: fadeUp .7s .5s forwards; }
    .uc-section { max-width: 820px; margin: 0 auto; padding: 64px 24px; }
    .uc-section .section-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--sage); margin-bottom: 16px; display: block; }
    .uc-section h2 { font-family: var(--serif); font-size: clamp(28px, 4vw, 40px); font-weight: 400; color: var(--ink); margin-bottom: 24px; line-height: 1.15; }
    .uc-section h2 em { font-style: italic; color: var(--sage); }
    .uc-section p { font-size: 16px; font-weight: 300; color: var(--muted); line-height: 1.8; margin-bottom: 16px; }
    .help-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .help-list li { font-size: 15px; font-weight: 300; color: var(--muted); line-height: 1.7; display: flex; gap: 12px; padding: 16px 20px; background: var(--faint); border: 1px solid var(--border); border-radius: 10px; }
    .help-list .li-icon { color: var(--sage); flex-shrink: 0; margin-top: 2px; }
    .help-list strong { color: var(--ink); font-weight: 500; }
    .uc-quote { max-width: 720px; margin: 0 auto; padding: 0 24px 16px; }
    .uc-quote blockquote { font-family: var(--serif); font-size: clamp(20px, 3vw, 28px); font-style: italic; color: var(--ink); line-height: 1.5; border-left: 3px solid var(--sage); padding-left: 24px; margin: 0; }
    .uc-cta-wrap { max-width: 860px; margin: 0 auto; }
    .uc-cta { background: var(--ink); border-radius: 20px; padding: 64px 40px; text-align: center; margin: 48px 24px 80px; }
    .uc-cta h2 { font-family: var(--serif); font-size: clamp(28px, 4vw, 44px); font-weight: 400; color: #fff; margin-bottom: 14px; line-height: 1.1; }
    .uc-cta h2 em { font-style: italic; color: #a8c48a; }
    .uc-cta p { font-size: 16px; color: rgba(255,255,255,.5); margin-bottom: 28px; line-height: 1.65; }
    .related-section { max-width: 860px; margin: 0 auto; padding: 0 24px 96px; }
    .related-section h4 { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 20px; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
    .related-link { text-decoration: none; color: inherit; border: 1px solid var(--border); border-radius: 10px; padding: 16px; transition: border-color .2s; display: block; }
    .related-link:hover { border-color: rgba(90,110,63,.35); }
    .related-link span { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--sage); display: block; margin-bottom: 6px; }
    .related-link p { font-size: 14px; font-weight: 400; color: var(--ink); margin: 0; line-height: 1.4; }
    @media (max-width: 768px) { .uc-cta { margin: 32px 16px 64px; padding: 40px 24px; } }
  </style>
</head>
<body>

{{> nav}}

<section class="uc-hero">
  <span class="eyebrow">FincWin for {{PERSONA_LABEL}}</span>
  <h1>{{PERSONA_HEADLINE}}</h1>
  <p class="uc-hero-sub">{{PERSONA_SUBHEAD}}</p>
  <div class="uc-hero-actions">
    <a href="/app" class="btn-primary">Get started free →</a>
  </div>
</section>

<div class="uc-section">
  <span class="section-eyebrow">The situation</span>
  <h2>{{SITUATION_HEADLINE}}</h2>
  {{SITUATION_BODY}}
</div>

<div class="uc-section">
  <span class="section-eyebrow">How FincWin helps</span>
  <h2>What FincWin does for <em>{{PERSONA_LABEL}}</em></h2>
  <ul class="help-list">
    {{HOW_IT_HELPS}}
  </ul>
</div>

<div class="uc-quote">
  <blockquote>{{USER_QUOTE}}</blockquote>
</div>

<div class="uc-cta-wrap">
  <div class="uc-cta">
    <h2>{{CTA_HEADLINE}}</h2>
    <p>Free plan is permanent. No card, no account required.</p>
    <a href="/app" class="btn-primary">Open FincWin free →</a>
  </div>
</div>

<div class="related-section">
  <h4>Related</h4>
  <div class="related-grid">
    {{RELEVANT_FEATURES}}
  </div>
</div>

{{> footer}}

{{> scripts}}
</body>
</html>
```

> **Note on `{{USER_QUOTE}}`:** until real quotes exist, set the data value to a benefit restatement (not a fabricated testimonial). The `uc-quote` block is acceptable as an editorial pull-quote. Do **not** invent attributed customer quotes.

- [ ] **Step 2: Commit**

```bash
git add scripts/templates/use-case-page.html
git commit -m "feat(templating): add use-case-page template"
```

### Task 2.2: Author the first use-case data file (worked example — paying-off-debt)

**Files:**
- Create: `scripts/data/usecase-paying-off-debt.json`

- [ ] **Step 1: Write the data file** (complete copy; note `HOWTO_STEPS_JSON` is a JSON array string matching the on-page help items)

```json
{
  "META_TITLE": "Budgeting for Paying Off Debt — FincWin",
  "META_DESCRIPTION": "A budgeting setup built for paying off debt: snowball or avalanche planning, a real debt-free date, and envelope budgeting to free up payments. Free to start.",
  "OG_DESCRIPTION": "Paying off debt? FincWin gives you a debt-free date, snowball/avalanche planning, and envelopes to find the extra payment.",
  "CANONICAL_URL": "https://fincwin.com/use-cases/paying-off-debt",
  "PERSONA_LABEL": "people paying off debt",
  "PERSONA_HEADLINE": "Know the exact date you'll be <em>debt-free</em>",
  "PERSONA_SUBHEAD": "FincWin turns scattered balances into one plan: a payoff date, the cheapest route, and the budget to get there.",
  "SITUATION_HEADLINE": "You're paying every month but the end never feels closer",
  "SITUATION_BODY": "<p>You have a few balances — a card, maybe a loan — and you're making payments. But nothing tells you when it actually ends, or whether paying one down first would save you money.</p><p>That uncertainty is exhausting. FincWin replaces it with a single, moving target you can plan around.</p>",
  "HOW_IT_HELPS": "<li><span class=\"li-icon\">→</span><span><strong>A real debt-free date:</strong> add your loans and FincWin projects exactly when you'll be done.</span></li>\n    <li><span class=\"li-icon\">→</span><span><strong>Snowball or avalanche:</strong> compare momentum vs lowest cost and pick your route.</span></li>\n    <li><span class=\"li-icon\">→</span><span><strong>Find the extra payment:</strong> envelope budgeting surfaces money you can redirect to debt.</span></li>\n    <li><span class=\"li-icon\">→</span><span><strong>Stay motivated:</strong> achievements and a health score keep you going through the long haul.</span></li>",
  "HOWTO_STEPS_JSON": "[{\"@type\":\"HowToStep\",\"name\":\"Add your loans\",\"text\":\"Enter each balance, rate and minimum payment.\"},{\"@type\":\"HowToStep\",\"name\":\"Choose snowball or avalanche\",\"text\":\"Pick momentum or lowest total interest.\"},{\"@type\":\"HowToStep\",\"name\":\"Set an extra payment\",\"text\":\"Add any amount above minimums to pull your debt-free date earlier.\"},{\"@type\":\"HowToStep\",\"name\":\"Budget the rest\",\"text\":\"Use envelopes to protect the extra payment each month.\"}]",
  "USER_QUOTE": "The first time I saw an actual debt-free date instead of a vague ‘someday,’ the whole thing finally felt possible.",
  "CTA_HEADLINE": "Get your debt-free date <em>today.</em>",
  "RELEVANT_FEATURES": "<a href=\"/features/loan-payoff-calculator\" class=\"related-link\"><span>Feature</span><p>Loan Payoff Calculator</p></a>\n    <a href=\"/features/envelope-budgeting\" class=\"related-link\"><span>Feature</span><p>Envelope Budgeting</p></a>\n    <a href=\"/blog/posts/debt-snowball-vs-avalanche\" class=\"related-link\"><span>Debt</span><p>Snowball vs Avalanche</p></a>\n    <a href=\"/blog/posts/stop-paycheck-to-paycheck\" class=\"related-link\"><span>Budgeting</span><p>Stop Living Paycheck to Paycheck</p></a>"
}
```

- [ ] **Step 2: Generate, then validate the JSON-LD is valid JSON**

```bash
node scripts/generate-page.js --template use-case-page --data scripts/data/usecase-paying-off-debt.json --out use-cases/paying-off-debt.html
node -e "const fs=require('fs');const h=fs.readFileSync('use-cases/paying-off-debt.html','utf8');const m=[...h.matchAll(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/g)];m.forEach((x,i)=>{JSON.parse(x[1]);console.log('LD block '+i+' OK');});"
```
Expected: `Written: use-cases/paying-off-debt.html`, then `LD block 0 OK` / `LD block 1 OK`. If `JSON.parse` throws, the `HOWTO_STEPS_JSON` string has a quoting error — fix it.

- [ ] **Step 3: Verify in browser** — `http://localhost:4141/use-cases/paying-off-debt.html` → `200`, all sections render.

- [ ] **Step 4: Commit**

```bash
git add scripts/data/usecase-paying-off-debt.json use-cases/paying-off-debt.html
git commit -m "feat(content): paying-off-debt use-case page"
```

### Task 2.3: Author the remaining 4 use-case data files

**Files:**
- Create: `scripts/data/usecase-building-savings.json`
- Create: `scripts/data/usecase-irregular-income.json`
- Create: `scripts/data/usecase-expat-multi-currency.json`
- Create: `scripts/data/usecase-couples-shared-finances.json`

Identical key set to Task 2.2. Per-page authoring:

- [ ] **Step 1: `usecase-building-savings.json`** — `PERSONA_LABEL` "people building savings", canonical `.../use-cases/building-savings`. Lean on savings goals + sinking funds. Relevant features: `/features/savings-goals`, `/blog/posts/sinking-funds`, `/blog/posts/emergency-fund-guide`.

- [ ] **Step 2: `usecase-irregular-income.json`** — `PERSONA_LABEL` "people with irregular income", canonical `.../use-cases/irregular-income`. Lean on budgeting from variable pay. Relevant: `/blog/posts/irregular-income-budgeting`, `/features/envelope-budgeting`, `/features/analytics-dashboard`.

- [ ] **Step 3: `usecase-expat-multi-currency.json`** — `PERSONA_LABEL` "expats and multi-currency households", canonical `.../use-cases/expat-multi-currency`. Lean on multi-currency support + offline. Relevant: `/blog/posts/multi-currency-budgeting`, `/features/analytics-dashboard`, `/compare/mint-alternative`.

- [ ] **Step 4: `usecase-couples-shared-finances.json`** — `PERSONA_LABEL` "couples sharing finances", canonical `.../use-cases/couples-shared-finances`. Lean on shared categories + Google Drive backup for sharing the file. Relevant: `/features/google-drive-backup`, `/features/envelope-budgeting`, `/blog/posts/budget-categories`.

- [ ] **Step 5: Generate all four**

```bash
node scripts/generate-page.js --template use-case-page --data scripts/data/usecase-building-savings.json          --out use-cases/building-savings.html
node scripts/generate-page.js --template use-case-page --data scripts/data/usecase-irregular-income.json          --out use-cases/irregular-income.html
node scripts/generate-page.js --template use-case-page --data scripts/data/usecase-expat-multi-currency.json      --out use-cases/expat-multi-currency.html
node scripts/generate-page.js --template use-case-page --data scripts/data/usecase-couples-shared-finances.json   --out use-cases/couples-shared-finances.html
```
Expected: 4× `Written:`, zero warnings. Validate each one's LD-JSON with the one-liner from Task 2.2 Step 2 (swap the filename).

- [ ] **Step 6: Commit**

```bash
git add scripts/data/usecase-*.json use-cases/
git commit -m "feat(content): remaining 4 use-case pages"
```

### Task 2.4: Add use-case pages to the manifest

**Files:**
- Modify: `scripts/build-manifest.json`

- [ ] **Step 1: Append 5 entries** (mirror the feature-page block: `template` "use-case-page", `data` `scripts/data/usecase-<slug>.json`, `out` `use-cases/<slug>.html` for paying-off-debt, building-savings, irregular-income, expat-multi-currency, couples-shared-finances).

- [ ] **Step 2: Rebuild**

Run: `node scripts/build-all.js`
Expected: `Built 16/16 pages.`

- [ ] **Step 3: Commit**

```bash
git add scripts/build-manifest.json
git commit -m "chore(templating): add use-case pages to build manifest"
```

---

## Phase 3 — Niche landing pages

Root-level output (depth 0). Three pages: `offline-budget-app.html`, `no-bank-sync-budget.html`, `private-finance-app.html`. Schema: `SoftwareApplication` + `FAQPage` + `BreadcrumbList`. **Depth = 0**, so this template's head uses `styles/mkt.css` and `favicon.svg` (no `../`).

### Task 3.1: Create the niche-landing template

**Files:**
- Create: `scripts/templates/niche-landing.html`

- [ ] **Step 1: Write the template.** Start from `feature-page.html` (Task 1.1) and make exactly these changes:
  1. Head `<link rel="stylesheet" href="styles/mkt.css">` (remove `../`).
  2. Head `<link rel="icon" type="image/svg+xml" href="favicon.svg">` (remove `../`).
  3. Replace the two JSON-LD blocks with the three below.
  4. Body sections: hero → problem → "FincWin as the answer" (capabilities grid) → comparison table → FAQ → CTA → related. Reuse the `cap-list`, `cmp-table` (copy the `.cmp-table*` rules from `competitor-alt.html:126-146` into this template's `<style>`), and `related-*` styles.
  5. Use `{{> nav}}`, `{{> footer}}`, `{{> scripts}}`.

JSON-LD blocks for the head:

```html
  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "FincWin",
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Web, iOS, Android (PWA)",
  "description": "{{META_DESCRIPTION}}",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
}
</script>
  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": {{FAQ_JSON}}
}
</script>
  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://fincwin.com"},
    {"@type": "ListItem", "position": 2, "name": "{{PAGE_TITLE}}", "item": "{{CANONICAL_URL}}"}
  ]
}
</script>
```

FAQ body block (place before the CTA):

```html
<div class="ft-section">
  <span class="section-eyebrow">FAQ</span>
  <h2>Common questions</h2>
  <div class="faq-list">
    {{FAQ_ITEMS}}
  </div>
</div>
```

FAQ styles to add to `<style>`:

```css
.faq-list { display: flex; flex-direction: column; gap: 14px; }
.faq-list .faq-q { font-size: 16px; font-weight: 500; color: var(--ink); margin-bottom: 8px; }
.faq-list .faq-a { font-size: 15px; font-weight: 300; color: var(--muted); line-height: 1.7; }
.faq-list .faq-item { padding: 20px; background: var(--faint); border: 1px solid var(--border); border-radius: 12px; }
```

Comparison table body block (place after capabilities):

```html
<div class="ft-section">
  <span class="section-eyebrow">How it compares</span>
  <h2>{{COMPARISON_HEADLINE}}</h2>
  <div class="cmp-table-wrap">
    <table class="cmp-table">
      <thead><tr><th>Feature</th><th class="fw-col">FincWin</th><th>{{COMPARISON_RIVAL}}</th></tr></thead>
      <tbody>{{COMPARISON_TABLE}}</tbody>
    </table>
  </div>
</div>
```

Full token set for this template: `META_TITLE`, `META_DESCRIPTION`, `OG_DESCRIPTION`, `CANONICAL_URL`, `PAGE_TITLE`, `TARGET_KEYWORD`, `HERO_HEADLINE`, `HERO_SUBHEAD`, `PROBLEM_HEADLINE`, `PROBLEM_BODY`, `CAPABILITIES`, `COMPARISON_HEADLINE`, `COMPARISON_RIVAL`, `COMPARISON_TABLE`, `FAQ_ITEMS`, `FAQ_JSON`, `CTA_HEADLINE`, `RELATED_FEATURES`.

- [ ] **Step 2: Commit**

```bash
git add scripts/templates/niche-landing.html
git commit -m "feat(templating): add niche-landing template"
```

### Task 3.2: Author the first niche data file (worked example — offline-budget-app)

**Files:**
- Create: `scripts/data/niche-offline-budget-app.json`

- [ ] **Step 1: Write the data file** (complete copy)

```json
{
  "META_TITLE": "The Best Offline Budget App (Works With No Internet) — FincWin",
  "META_DESCRIPTION": "FincWin is a full offline budget app — a PWA that installs to your home screen and works with no internet, no bank login, and no account. Free to start.",
  "OG_DESCRIPTION": "An offline-first budget app that works with no internet and no bank login. Installs as a PWA. Free.",
  "CANONICAL_URL": "https://fincwin.com/offline-budget-app",
  "PAGE_TITLE": "Offline Budget App",
  "TARGET_KEYWORD": "offline budget app",
  "HERO_HEADLINE": "A budget app that works <em>with no internet</em>",
  "HERO_SUBHEAD": "FincWin installs to your phone or desktop as an app and runs entirely offline. No bank login, no account, no connection required.",
  "PROBLEM_HEADLINE": "Most budget apps break the moment you go offline",
  "PROBLEM_BODY": "<p>They need a constant connection to sync with your bank, and they store your data on someone else's server. On a plane, on patchy signal, or if you simply don't want a bank link — they stop working.</p><p>FincWin is built the opposite way: your data lives in your browser, and the app works whether you're online or not.</p>",
  "CAPABILITIES": "<li><span class=\"li-icon\">✓</span><span><strong>Installs as a PWA</strong> on iOS, Android, Windows and Mac.</span></li>\n    <li><span class=\"li-icon\">✓</span><span><strong>Full offline use</strong> — every feature works with no connection.</span></li>\n    <li><span class=\"li-icon\">✓</span><span><strong>No bank login</strong> — add transactions manually or by CSV.</span></li>\n    <li><span class=\"li-icon\">✓</span><span><strong>Your data stays local</strong> — nothing on our servers.</span></li>",
  "COMPARISON_HEADLINE": "FincWin vs typical cloud budget apps",
  "COMPARISON_RIVAL": "Cloud budget apps",
  "COMPARISON_TABLE": "<tr><td>Works offline</td><td class=\"fw-col yes\">Yes — full PWA</td><td class=\"no\">No</td></tr>\n        <tr><td>Bank login required</td><td class=\"fw-col yes\">No</td><td class=\"no\">Usually yes</td></tr>\n        <tr><td>Data location</td><td class=\"fw-col yes\">Your browser</td><td class=\"no\">Their servers</td></tr>\n        <tr><td>Account required</td><td class=\"fw-col yes\">No</td><td class=\"part\">Usually</td></tr>",
  "FAQ_ITEMS": "<div class=\"faq-item\"><p class=\"faq-q\">Does FincWin really work with no internet?</p><p class=\"faq-a\">Yes. Once loaded, it runs from your device. You can budget on a plane and it syncs nothing because there's nothing to sync — your data is already local.</p></div>\n    <div class=\"faq-item\"><p class=\"faq-q\">Where is my data stored?</p><p class=\"faq-a\">In your browser's local storage. Optionally you can back it up to your own Google Drive. FincWin keeps no copy.</p></div>\n    <div class=\"faq-item\"><p class=\"faq-q\">Is it free?</p><p class=\"faq-a\">Yes — the free plan is permanent. Pro ($39/year or $149 lifetime) adds CSV import and AI coaching.</p></div>",
  "FAQ_JSON": "[{\"@type\":\"Question\",\"name\":\"Does FincWin really work with no internet?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Yes. Once loaded it runs from your device with nothing to sync.\"}},{\"@type\":\"Question\",\"name\":\"Where is my data stored?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"In your browser's local storage, optionally backed up to your own Google Drive.\"}},{\"@type\":\"Question\",\"name\":\"Is it free?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Yes, the free plan is permanent. Pro is $39/year or $149 lifetime.\"}}]",
  "CTA_HEADLINE": "Budget anywhere — <em>even offline.</em>",
  "RELATED_FEATURES": "<a href=\"/blog/posts/offline-personal-finance-apps\" class=\"related-link\"><span>Tools &amp; Tech</span><p>Offline Personal Finance Apps</p></a>\n    <a href=\"/blog/posts/pwa-finance-apps\" class=\"related-link\"><span>Tools &amp; Tech</span><p>PWA Finance Apps</p></a>\n    <a href=\"/features/google-drive-backup\" class=\"related-link\"><span>Feature</span><p>Google Drive Backup</p></a>\n    <a href=\"/privacy\" class=\"related-link\"><span>Trust</span><p>Privacy</p></a>"
}
```

- [ ] **Step 2: Generate (note: out path is root-level, no subdir)**

```bash
node scripts/generate-page.js --template niche-landing --data scripts/data/niche-offline-budget-app.json --out offline-budget-app.html
```
Expected: `Written: offline-budget-app.html`. Validate all three LD-JSON blocks with the validator one-liner from Task 2.2 (filename `offline-budget-app.html`); expect `LD block 0/1/2 OK`.

- [ ] **Step 3: Verify** — `http://localhost:4141/offline-budget-app.html` → `200`. Confirm CSS loads (page is styled — proves the depth-0 `styles/mkt.css` path is correct).

- [ ] **Step 4: Commit**

```bash
git add scripts/data/niche-offline-budget-app.json offline-budget-app.html
git commit -m "feat(content): offline-budget-app niche landing page"
```

### Task 3.3: Author the remaining 2 niche data files

**Files:**
- Create: `scripts/data/niche-no-bank-sync-budget.json`
- Create: `scripts/data/niche-private-finance-app.json`

Identical key set to Task 3.2.

- [ ] **Step 1: `niche-no-bank-sync-budget.json`** — `TARGET_KEYWORD` "budget app without bank sync", canonical `.../no-bank-sync-budget`, `out` `no-bank-sync-budget.html`. Angle: manual + CSV entry, no Plaid/bank credentials. Related: `/blog/posts/import-bank-statements`, `/features/envelope-budgeting`, `/compare/mint-alternative`, `/privacy`.

- [ ] **Step 2: `niche-private-finance-app.json`** — `TARGET_KEYWORD` "private finance app", canonical `.../private-finance-app`, `out` `private-finance-app.html`. Angle: local-first, no server storage, optional encryption, your-own-Drive backup. Related: `/features/google-drive-backup`, `/privacy`, `/blog/posts/offline-personal-finance-apps`, `/compare/mint-alternative`.

- [ ] **Step 3: Generate both + validate LD-JSON**

```bash
node scripts/generate-page.js --template niche-landing --data scripts/data/niche-no-bank-sync-budget.json --out no-bank-sync-budget.html
node scripts/generate-page.js --template niche-landing --data scripts/data/niche-private-finance-app.json  --out private-finance-app.html
```
Expected: 2× `Written:`, zero warnings; LD-JSON valid for both.

- [ ] **Step 4: Commit**

```bash
git add scripts/data/niche-*.json no-bank-sync-budget.html private-finance-app.html
git commit -m "feat(content): remaining 2 niche landing pages"
```

### Task 3.4: Add niche pages to the manifest

**Files:**
- Modify: `scripts/build-manifest.json`

- [ ] **Step 1: Append 3 entries** (`template` "niche-landing", root-level `out` paths).
- [ ] **Step 2: Rebuild** — Run: `node scripts/build-all.js` → Expected: `Built 19/19 pages.`
- [ ] **Step 3: Commit**

```bash
git add scripts/build-manifest.json
git commit -m "chore(templating): add niche landing pages to build manifest"
```

---

## Phase 4 — Routing, sitemap, npm scripts, final verification

### Task 4.1: Add Vercel rewrites for the new clean URLs

**Files:**
- Modify: `vercel.json:8-13` (insert after the `/features` rewrite and after `/use-cases`)

- [ ] **Step 1: Add a `/features/:slug` rewrite** right after the existing `{ "source": "/features", ... }` line:

```json
    { "source": "/features",      "destination": "/features.html" },
    { "source": "/features/:slug","destination": "/features/:slug.html" },
```

- [ ] **Step 2: Add a `/use-cases/:slug` rewrite** right after the existing `{ "source": "/use-cases", ... }` line:

```json
    { "source": "/use-cases",     "destination": "/use-cases.html" },
    { "source": "/use-cases/:slug","destination": "/use-cases/:slug.html" },
```

> Niche landing pages are root-level (`offline-budget-app.html`); `cleanUrls: true` already maps `/offline-budget-app` → that file, so no extra rewrite is needed.

- [ ] **Step 3: Validate the JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'));console.log('vercel.json OK')"`
Expected: `vercel.json OK`

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "feat(routing): clean URLs for feature and use-case sub-pages"
```

### Task 4.2: Add the new pages to sitemap.xml

**Files:**
- Modify: `sitemap.xml`

- [ ] **Step 1: Add 14 `<url>` entries** (6 features, 5 use-cases, 3 niche) using the existing entry format in the file. Use the clean URLs (no `.html`):
  - `https://fincwin.com/features/{loan-payoff-calculator,envelope-budgeting,savings-goals,analytics-dashboard,google-drive-backup,ai-coach}`
  - `https://fincwin.com/use-cases/{paying-off-debt,building-savings,irregular-income,expat-multi-currency,couples-shared-finances}`
  - `https://fincwin.com/{offline-budget-app,no-bank-sync-budget,private-finance-app}`

- [ ] **Step 2: Validate XML well-formedness**

Run: `node -e "const s=require('fs').readFileSync('sitemap.xml','utf8');const o=(s.match(/<url>/g)||[]).length,c=(s.match(/<\/url>/g)||[]).length;if(o!==c)throw new Error('unbalanced url tags '+o+'/'+c);console.log('sitemap urls:',o)"`
Expected: balanced count, prints total (previous total + 14).

- [ ] **Step 3: Commit**

```bash
git add sitemap.xml
git commit -m "chore(seo): add feature, use-case and niche pages to sitemap"
```

### Task 4.3: Wire generation into package.json

**Files:**
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Add two scripts** to the existing `"scripts"` block:

```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "sync-chrome": "node scripts/sync-chrome.js",
    "build:pages": "node scripts/build-all.js",
    "dev": "node server.js"
  }
```

- [ ] **Step 2: Verify both**

Run: `npm run build:pages`
Expected: `Built 19/19 pages.`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add build:pages and dev npm scripts"
```

### Task 4.4: Add an integration test that every manifest page builds clean

**Files:**
- Modify: `tests/generator.test.js`

- [ ] **Step 1: Append a test** that runs the full build and asserts no leftover markers in any output

```js
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT2 = path.resolve(__dirname, '..');

describe('full site build', () => {
  it('builds every manifest page with no leftover markers', () => {
    execFileSync('node', ['scripts/build-all.js'], { cwd: ROOT2, encoding: 'utf8' });
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT2, 'scripts/build-manifest.json'), 'utf8'));
    for (const { out } of manifest) {
      const html = fs.readFileSync(path.join(ROOT2, out), 'utf8');
      expect(html, `${out} has leftover marker`).not.toMatch(/\{\{\s*>?\s*\w+\s*\}\}/);
      expect(html, `${out} missing nav`).toContain('id="mainNav"');
      expect(html, `${out} missing footer`).toContain('class="mkt-footer"');
    }
  });
});
```

- [ ] **Step 2: Run the full suite**

Run: `npx vitest run`
Expected: all tests PASS, including the new full-build test (19 pages checked).

- [ ] **Step 3: Commit**

```bash
git add tests/generator.test.js
git commit -m "test(templating): full-build integrity check across manifest"
```

### Task 4.5: Update TEMPLATING-PLAN.md to reflect built state

**Files:**
- Modify: `TEMPLATING-PLAN.md`

- [ ] **Step 1:** Add a short "Status (2026-06-08)" note near the top recording that templates 1–3 (competitor-alt, blog-post, blog-category) and templates 3–6 (feature, use-case, niche) are built, partials extracted, and `npm run build:pages` regenerates all 19 generated pages. Mention blog-post/blog-category partial migration is the one remaining follow-up.

- [ ] **Step 2: Commit**

```bash
git add TEMPLATING-PLAN.md
git commit -m "docs: record templating build status"
```

---

## Self-review checklist (run before declaring done)

1. **Spec coverage:** All 3 remaining template types from TEMPLATING-PLAN (feature, use-case, niche) built ✓; partials extraction (line 360) done ✓; clean-URL rewrites (line 346) done ✓; sitemap (line 447) done ✓.
2. **Token consistency:** `feature-page` keys defined in 1.2 are reused verbatim in 1.3; `use-case-page` keys in 2.2 reused in 2.3; `niche-landing` keys in 3.2 reused in 3.3. Generator warns on any missing key.
3. **Depth correctness:** features/ and use-cases/ are depth 1 (`../styles/mkt.css`); niche pages are depth 0 (`styles/mkt.css`) — called out explicitly in Task 3.1 Step 1.
4. **No fabricated testimonials:** `USER_QUOTE` guidance in Task 2.1 forbids attributed fake quotes.
5. **Deployment unchanged:** every generated `.html` is committed; Vercel serves static files; no build step added to deploy.

---

## How the finished system connects (one-paragraph mental model)

Edit nav once in `scripts/partials/nav.html` → run `npm run build:pages` → all 19 generated pages get the new nav and re-emit as plain committed HTML → push → Vercel serves them at clean URLs via `vercel.json` rewrites. New page = new `scripts/data/<slug>.json` + one manifest line + rebuild. The dev server (`npm run dev`, port 4141, already running) serves the exact files Vercel will.
