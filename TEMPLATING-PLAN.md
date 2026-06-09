# FincWin — Templating Plan

## Status (2026-06-08) — BUILT

All six template types are now built and generating from `scripts/generate-page.js`:

- **competitor-alt** (1) — 5 compare pages ✅
- **blog-post** (2) — reference template in use ✅
- **blog-category** (5) — 5 category pages ✅
- **feature-page** (3) — 6 pages under `features/` ✅ *(new)*
- **use-case-page** (4) — 5 pages under `use-cases/` ✅ *(new)*
- **niche-landing** (6) — 3 root-level SEO pages ✅ *(new)*

Shared nav/footer/scripts are extracted to `scripts/partials/` and injected via `{{> name}}` markers — change them once and run `npm run build:pages` to regenerate all 19 manifest pages. The generator fails loudly on any unresolved `{{token}}`. Clean URLs for `/features/:slug` and `/use-cases/:slug` are routed in `vercel.json`; all 14 new pages are in `sitemap.xml`. Integrity is guarded by `tests/generator.test.js`.

**Remaining follow-up:** migrate `blog-post.html` and `blog-category.html` templates to use the shared partials (currently still inline). New blog posts/categories should adopt `{{> nav}}` / `{{> footer}}` / `{{> scripts}}` when next touched.

## Overview

The strategy calls for ~71 new pages across 6 distinct page types. The site is pure static HTML with no build system. This plan introduces a lightweight Node.js generator so templates stay in sync and pages are produced consistently — without adopting a full static site generator or restructuring existing pages.

---

## Build approach

A single script (`scripts/generate-page.js`) reads a template file and a data object (passed as JSON or defined inline), replaces `{{TOKEN}}` placeholders, and writes the output HTML to the correct path.

This means:
- Templates live in `scripts/templates/`
- Generated pages are written to the correct public directory (`compare/`, `features/`, `use-cases/`, `blog/[category]/`)
- Existing handwritten pages are untouched
- Nav or footer changes are made once in the template, not in 71 files

---

## The 6 template types

---

### 1. `competitor-alt.html` — Competitor alternative pages

**Output path:** `compare/[competitor]-alternative.html`  
**Planned pages (5):** mint, ynab, monarch, goodbudget, everydollar  
**Priority:** Phase 1 — immediate

**Structure:**
```
<head> with Article schema + BreadcrumbList
Nav

Hero
  - Eyebrow: "FincWin vs {{COMPETITOR_NAME}}"
  - H1: "The best {{COMPETITOR_NAME}} alternative — {{YEAR}}"  
  - Subhead: {{COMPETITOR_HOOK}} (e.g. "YNAB is $109/year. FincWin is $39.")
  - CTAs: Get started free · See pricing

Price comparison strip
  - Side-by-side: {{COMPETITOR_NAME}} price vs FincWin price/free tier

Feature comparison table
  - Rows: Free tier, Price/year, Lifetime option, Bank connection, Data stored, Offline, Multi-currency, Loan payoff, Savings goals, Analytics, AI coach

"Where {{COMPETITOR_NAME}} is better" section (intellectual honesty)

"Who FincWin is built for" section

How-to-switch section (numbered steps)

Post-CTA block

Related pages grid (2–4 links)

Footer
```

**Key data tokens:**
```
{{COMPETITOR_NAME}}          e.g. "YNAB"
{{COMPETITOR_SLUG}}          e.g. "ynab"
{{COMPETITOR_PRICE_MO}}      e.g. "$14.99/month"
{{COMPETITOR_PRICE_YR}}      e.g. "$109/year"
{{COMPETITOR_HOOK}}          one-sentence problem statement
{{COMPETITOR_PROS}}          2-3 honest advantages (HTML list items)
{{COMPETITOR_CONS}}          3-5 weaknesses (HTML list items)
{{COMPETITOR_SWITCH_STEPS}}  ordered list of migration steps
{{TABLE_ROWS}}               pre-rendered table HTML
{{RELATED_PAGES}}            pre-rendered related links HTML
{{DATE_PUBLISHED}}           e.g. "2026-07-01"
{{CANONICAL_URL}}            e.g. "https://www.fincwin.com/compare/ynab-alternative"
```

---

### 2. `blog-post.html` — Blog posts

**Output path:** `blog/posts/[slug].html`  
**Planned pages:** ~54 new posts across 2 years  
**Priority:** Phase 1–6 ongoing

This template already exists as a de facto standard (`blog/posts/ynab-alternative.html` is the reference). Formalise it with clear token markers.

**Structure:**
```
<head> with Article schema + BreadcrumbList
Nav + blog subnav

Post wrap
  - Breadcrumb nav
  - Category label
  - H1 (with optional <em> on keyword)
  - Intro paragraph (post-intro class)
  - Date + read time (post-meta)
  - Hero image (picsum placeholder → replace with real image)
  
Post body (free-form HTML, written per post)
  - H2 sections
  - Post callout blocks
  - Compare tables where relevant
  
Post CTA block
Related posts grid (4 links, 2×2)

Footer
```

**Key data tokens:**
```
{{POST_TITLE}}               H1 text (may include <em>)
{{POST_TITLE_PLAIN}}         plain text version for schema/meta
{{POST_CATEGORY}}            Budgeting | Debt | Savings | Tools & Tech | Mindset
{{POST_CATEGORY_SLUG}}       budgeting | debt | savings | tools | mindset
{{POST_SLUG}}                e.g. "emergency-fund-guide"
{{POST_INTRO}}               lead paragraph text
{{POST_DATE}}                e.g. "July 2026"
{{POST_DATE_ISO}}            e.g. "2026-07-01"
{{POST_READ_TIME}}           e.g. "6 min read"
{{META_DESCRIPTION}}         140-160 char description
{{OG_DESCRIPTION}}           slightly shorter OG variant
{{POST_BODY}}                full article HTML
{{RELATED_POSTS}}            4 related link cards HTML
{{CANONICAL_URL}}
```

---

### 3. `feature-page.html` — Feature sub-pages

**Output path:** `features/[feature-slug].html`  
**Planned pages (6):** envelope-budgeting, loan-payoff-calculator, savings-goals, analytics-dashboard, google-drive-backup, ai-coach  
**Priority:** Phase 3 (March 2027)

**Structure:**
```
<head> with SoftwareApplication schema + BreadcrumbList
Nav

Feature hero
  - Eyebrow: "FincWin · {{FEATURE_MODULE}}"
  - H1: {{FEATURE_HEADLINE}} (benefit-led, not feature-led)
  - Subhead: one-sentence value prop
  - CTAs: Get started free · See all features

Problem section
  - "The problem" framing in 1-2 paragraphs

How it works section
  - 3-4 steps or a feature walkthrough
  - Screenshot placeholder (or annotated demo)

Key capabilities list (3-6 bullet points)

Pricing note (which plan includes this feature)

Internal links strip
  - Link to features.html + 2 related feature pages + pricing.html

Post-CTA block

Footer
```

**Key data tokens:**
```
{{FEATURE_NAME}}             e.g. "Loan Payoff Calculator"
{{FEATURE_SLUG}}             e.g. "loan-payoff-calculator"
{{FEATURE_MODULE}}           e.g. "Loans"
{{FEATURE_HEADLINE}}         benefit H1 e.g. "Know the exact date you'll be debt-free"
{{FEATURE_SUBHEAD}}
{{FEATURE_PLAN}}             "Free" | "Pro" | "Free & Pro"
{{PROBLEM_BODY}}             HTML paragraphs
{{HOW_IT_WORKS}}             HTML steps or walk-through
{{CAPABILITIES}}             HTML list items
{{RELATED_FEATURES}}         2 related feature page links
{{CANONICAL_URL}}
{{META_DESCRIPTION}}
{{DATE_PUBLISHED}}
```

---

### 4. `use-case-page.html` — Persona sub-pages

**Output path:** `use-cases/[persona-slug].html`  
**Planned pages (5):** paying-off-debt, building-savings, irregular-income, expat-multi-currency, couples-shared-finances  
**Priority:** Phase 3 (February–March 2027)

**Structure:**
```
<head> with HowTo schema + BreadcrumbList
Nav

Persona hero
  - Eyebrow: "FincWin for {{PERSONA_LABEL}}"
  - H1: {{PERSONA_HEADLINE}} (names the situation, not the feature)
  - Subhead: what this type of user needs
  - CTA: Get started free

The situation section
  - 2-3 paragraphs naming the exact problem this persona faces
  - Written in second person ("You're...")

How FincWin helps section
  - 3-4 specific ways the app addresses this persona's situation
  - Each with a named feature + short explanation

Relevant features strip
  - 2-4 feature cards linking to feature sub-pages

Quote/social proof placeholder
  - "{{USER_QUOTE}}" — empty by default, fill when real quotes are available

CTA block

Footer
```

**Key data tokens:**
```
{{PERSONA_LABEL}}            e.g. "people paying off debt"
{{PERSONA_SLUG}}             e.g. "paying-off-debt"
{{PERSONA_HEADLINE}}         e.g. "Know the exact date you'll be debt-free"
{{PERSONA_SUBHEAD}}
{{SITUATION_BODY}}           HTML paragraphs
{{HOW_IT_HELPS}}             HTML feature explanations
{{RELEVANT_FEATURES}}        HTML feature card links
{{USER_QUOTE}}               empty placeholder until real quote available
{{CANONICAL_URL}}
{{META_DESCRIPTION}}
{{DATE_PUBLISHED}}
```

---

### 5. `blog-category.html` — Blog category archive pages

**Output path:** `blog/[category-slug]/index.html`  
**Planned pages (5):** budgeting, debt, savings, tools, mindset  
**Priority:** Phase 1 Month 3 (September 2026)

These replace the current JavaScript-only category filter with real indexed pages that search engines can crawl.

**Structure:**
```
<head> with CollectionPage schema + BreadcrumbList
Nav + blog subnav (category highlighted as active)

Category hero
  - Eyebrow: "FincWin Blog"
  - H1: {{CATEGORY_HEADLINE}} e.g. "Budgeting guides — plainly explained"
  - Subhead: {{CATEGORY_DESCRIPTION}}

Post grid
  - Hardcoded cards for all posts in this category
  - Same card structure as blog/index.html
  - Maintained manually as new posts are added

Cross-category strip
  - Links to the 4 other category pages

Footer
```

**Key data tokens:**
```
{{CATEGORY_NAME}}            e.g. "Budgeting"
{{CATEGORY_SLUG}}            e.g. "budgeting"
{{CATEGORY_HEADLINE}}        H1 text
{{CATEGORY_DESCRIPTION}}     subhead / meta description source
{{POST_CARDS}}               HTML grid of post cards for this category
{{OTHER_CATEGORIES}}         HTML links to the other 4 category pages
{{CANONICAL_URL}}
{{META_DESCRIPTION}}
```

---

### 6. `niche-landing.html` — Standalone SEO landing pages

**Output path:** root-level e.g. `offline-budget-app.html`, `no-bank-sync-budget.html`  
**Planned pages (3–5):** based on Tier 3 keywords from the strategy  
**Priority:** Phase 1–2

Hybrid between a marketing page and a comparison post. Targets a specific search query, doesn't assume brand familiarity.

**Structure:**
```
<head> with SoftwareApplication schema + BreadcrumbList
Nav

Search-intent hero
  - H1 matches the query (e.g. "The best offline personal finance app")
  - Subhead: validates the need, positions FincWin
  - CTAs: Get started free · See pricing

Problem framing
  - Why this type of user has this need
  - 2-3 paragraphs

FincWin as the answer
  - Specific features relevant to this query
  - 3-4 feature callouts with icons

Comparison to alternatives (brief)
  - Table: FincWin vs 2-3 alternatives specifically on the differentiating factor

FAQ section
  - 3-4 questions, FAQPage schema

CTA block

Footer
```

**Key data tokens:**
```
{{PAGE_TITLE}}               e.g. "Best offline personal finance app"
{{TARGET_KEYWORD}}           exact match query
{{HERO_SUBHEAD}}
{{PROBLEM_BODY}}             HTML paragraphs
{{FEATURE_CALLOUTS}}         HTML feature highlights
{{COMPARISON_TABLE}}         HTML table
{{FAQ_ITEMS}}                HTML + JSON-LD FAQ entries
{{CANONICAL_URL}}
{{META_DESCRIPTION}}
{{DATE_PUBLISHED}}
```

---

## File naming and URL conventions

| Page type | File path | Canonical URL |
|---|---|---|
| Competitor alt | `compare/ynab-alternative.html` | `https://www.fincwin.com/compare/ynab-alternative` |
| Blog post | `blog/posts/[slug].html` | `https://www.fincwin.com/blog/posts/[slug]` |
| Feature page | `features/[slug].html` | `https://www.fincwin.com/features/[slug]` |
| Use case page | `use-cases/[slug].html` | `https://www.fincwin.com/use-cases/[slug]` |
| Blog category | `blog/[category]/index.html` | `https://www.fincwin.com/blog/[category]/` |
| Niche landing | `[slug].html` | `https://www.fincwin.com/[slug]` |

Add Vercel rewrites for all new clean URLs (drop `.html`).

---

## Shared elements (not templated — manually keep in sync)

The following repeat across all templates. Update in each template file when they change.

- **Nav HTML** — logo, links, CTA button
- **Footer HTML** — 4-column structure, legal links
- **CSS links** — `styles/mkt.css` (relative path varies by depth)
- **Font link** — Google Fonts (Hanken Grotesk + Instrument Serif)
- **Nav scroll script** — 3-line inline script at bottom of body

If nav/footer changes become frequent, extract them to `scripts/partials/nav.html` and `footer.html` and inject via the generator script.

---

## Generator script (scripts/generate-page.js)

```js
// Usage:
//   node scripts/generate-page.js --template competitor-alt --data scripts/data/ynab-alt.json --out compare/ynab-alternative.html

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i > -1 ? args[i + 1] : null; };

const templateName = get('--template');
const dataFile = get('--data');
const outFile = get('--out');

if (!templateName || !dataFile || !outFile) {
  console.error('Usage: node generate-page.js --template <name> --data <json> --out <path>');
  process.exit(1);
}

const templatePath = path.join(__dirname, 'templates', templateName + '.html');
const template = fs.readFileSync(templatePath, 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, dataFile), 'utf8'));

const output = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
  if (!(key in data)) console.warn(`  Warning: no value for {{${key}}}`);
  return data[key] ?? `{{${key}}}`;
});

const outPath = path.join(process.cwd(), outFile);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, output, 'utf8');
console.log(`  Written: ${outFile}`);
```

Data files live in `scripts/data/[slug].json`. One JSON file per page.

---

## Build order tied to strategy phases

### Phase 1 — Month 1 (July 2026): Technical sprint
- No new templates needed — fix existing pages manually per the issue list

### Phase 1 — Month 1 content (July 2026)
1. Build `competitor-alt.html` template
2. Create `scripts/data/mint-alt.json`
3. Generate `compare/mint-alternative.html`

### Phase 1 — Month 2 (August 2026)
4. Create `scripts/data/ynab-alt.json` → generate `compare/ynab-alternative.html`
   (Move or redirect existing `blog/posts/ynab-alternative.html` — it ranks under blog, confirm with Search Console first)

### Phase 1 — Month 3 (September 2026)
5. Build `blog-category.html` template
6. Generate all 5 category archive pages
7. Update blog post internal links to point to category pages

### Phase 2 (October–December 2026)
8. New blog posts use `blog-post.html` template directly (copy template, fill tokens, save as post slug)
9. Generate remaining competitor alts: monarch, goodbudget, everydollar

### Phase 3 (January–March 2027)
10. Build `feature-page.html` template → generate 6 feature sub-pages
11. Build `use-case-page.html` template → generate 5 persona sub-pages
12. Build `niche-landing.html` template → generate offline-budget-app, no-bank-sync-budget, private-finance-app

### Phase 4+ (2027–2028)
13. New blog posts continue to use blog-post template
14. Niche landing pages generated per keyword opportunity
```

---

## Immediate next steps

1. Create `scripts/` and `scripts/templates/` directories
2. Write `scripts/generate-page.js`
3. Write `scripts/templates/competitor-alt.html` based on the ynab-alternative post structure + the competitor-alt spec above
4. Write `scripts/data/mint-alt.json` with Mint data (the highest-priority content piece)
5. Run generator → review output → publish `compare/mint-alternative.html`
6. Add `compare/` pages to sitemap.xml once the technical sprint (Month 1) is done
