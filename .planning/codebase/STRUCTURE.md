<!-- refreshed: 2026-06-10 -->
# Codebase Structure

**Analysis Date:** 2026-06-10

## Directory Layout

```
freetinz-stack/
├── index.html                  # Marketing home page (hand-authored)
├── app.html                    # PWA app shell (hand-authored, noindex)
├── signin.html                 # Auth page (hand-authored, noindex)
├── account.html                # Account management (hand-authored, noindex)
├── admin.html                  # Admin panel (hand-authored, noindex)
├── pricing.html                # Pricing page (hand-authored)
├── features.html               # Features index (hand-authored)
├── compare.html                # Compare index (hand-authored)
├── use-cases.html              # Use cases index (hand-authored)
├── about.html                  # About page (hand-authored)
├── changelog.html              # Changelog (hand-authored)
├── contact.html                # Contact page (hand-authored)
├── help.html                   # Help guide (hand-authored)
├── privacy.html                # Privacy policy (hand-authored)
├── terms.html                  # Terms of service (hand-authored)
├── cookie-policy.html          # Cookie policy (hand-authored)
├── 404.html                    # Custom 404 page
├── budget-categories.html      # SEO landing page (hand-authored)
├── no-bank-sync-budget.html    # Niche landing (BUILD-GENERATED)
├── offline-budget-app.html     # Niche landing (BUILD-GENERATED)
├── private-finance-app.html    # Niche landing (BUILD-GENERATED)
│
│   # Expense category pages (hand-authored, noindex per robots.txt)
├── cat-banking.html
├── cat-clothing.html  ...      # cat-*.html (14 files total)
│
├── features/                   # Feature detail pages (BUILD-GENERATED)
│   ├── ai-coach.html
│   ├── analytics-dashboard.html
│   ├── envelope-budgeting.html
│   ├── google-drive-backup.html
│   ├── loan-payoff-calculator.html
│   └── savings-goals.html
│
├── compare/                    # Competitor alternative pages (BUILD-GENERATED)
│   ├── everydollar-alternative.html
│   ├── goodbudget-alternative.html
│   ├── mint-alternative.html
│   ├── monarch-alternative.html
│   └── ynab-alternative.html
│
├── use-cases/                  # Use case pages (BUILD-GENERATED)
│   ├── building-savings.html
│   ├── couples-shared-finances.html
│   ├── expat-multi-currency.html
│   ├── irregular-income.html
│   └── paying-off-debt.html
│
├── blog/
│   ├── index.html              # Blog hub (hand-authored)
│   ├── budgeting/index.html    # Category hub
│   ├── debt/index.html
│   ├── mindset/index.html
│   ├── savings/index.html
│   ├── tools/index.html
│   └── posts/                  # Individual blog posts (hand-authored)
│       ├── 50-30-20-rule.html
│       ├── ai-financial-coach.html
│       └── ...                 # 22 posts total
│
├── styles/
│   ├── mkt.css                 # Marketing site stylesheet (all public pages)
│   ├── base.css                # App shell design tokens + reset
│   ├── layout.css              # App shell layout grid
│   ├── components.css          # App shell UI components
│   ├── dark.css                # Dark mode overrides
│   ├── themes.css              # Colour theme variants
│   └── auth-tokens.css         # Shared tokens for signin/account pages
│
├── js/
│   ├── boot.js                 # App init: SW registration, nav, auth-cloak removal
│   ├── state.js                # Central state, IDB persistence, encryption
│   ├── crypto-core.js          # PBKDF2 + AES-GCM primitives
│   ├── constants.js            # App-wide constants, category maps
│   ├── sync.js                 # Sync orchestration + provider registry
│   ├── providers/
│   │   ├── firebase.js         # Firebase Firestore provider plugin
│   │   └── gdrive.js           # Google Drive provider plugin
│   ├── expenses.js             # Expenses feature module
│   ├── revenue.js              # Revenue / income feature module
│   ├── loans.js                # Loans feature module
│   ├── savings.js              # Savings goals feature module
│   ├── analytics.js            # Charts + analytics feature module
│   ├── health.js               # Financial health score
│   ├── calendar.js             # Calendar view
│   ├── archive.js              # Data archiving
│   ├── gamification.js         # Achievements / badges
│   ├── import-bank.js          # CSV/OFX bank statement import
│   ├── search.js               # Global search
│   ├── modals.js               # Modal management
│   ├── settings.js             # Settings panel
│   ├── onboarding.js           # First-run onboarding
│   ├── bulk-add.js             # Bulk transaction entry
│   ├── fx.js                   # Foreign exchange rate lookup
│   ├── investments.js          # Investments tracker
│   ├── tour.js                 # Guided tour
│   ├── darkmode.js             # Theme/dark mode (runs sync before DOM)
│   ├── events.js               # Centralised event delegation
│   ├── icons.js                # SVG icon helpers
│   ├── features.js             # Feature flag / plan gating
│   ├── demo-profiles.js        # Demo data profiles
│   ├── signin.js               # Sign-in / register page JS
│   ├── account.js              # Account page JS
│   ├── pricing.js              # Pricing page: billing toggle, FAQ
│   ├── contact.js              # Contact form submission
│   ├── landing.js              # Landing page interactions
│   ├── mkt.js                  # Shared marketing: nav, hamburger, copyright year
│   ├── consent.js              # GDPR cookie consent banner + GA4 gating
│   ├── config.local.js         # Firebase config (real credentials, gitignored)
│   ├── config.example.js       # Config template (committed)
│   ├── config.fallback.js      # Ensures window.__FINCWIN_CONFIG__ = null if absent
│   └── vendor/
│       ├── chart.min.js        # Chart.js (vendored, cache-first)
│       ├── papaparse.esm.js    # PapaParse CSV parser (ESM)
│       ├── papaparse.min.js    # PapaParse CSV parser (classic)
│       ├── qr-creator.es6.min.js  # QR code generator
│       └── firebase/
│           ├── firebase-app.js
│           ├── firebase-auth.js
│           └── firebase-firestore.js
│
├── api/                        # Vercel serverless functions
│   ├── validate.js             # POST /api/validate — LemonSqueezy license check
│   ├── activate.js             # POST /api/activate — license activation
│   ├── deactivate.js           # POST /api/deactivate — license deactivation
│   ├── admin.js                # POST /api/admin — admin operations
│   └── contact.js              # POST /api/contact — contact form (Edge runtime)
│
├── scripts/                    # Build tooling (dev-only, not deployed)
│   ├── build-all.js            # Runs all entries in build-manifest.json
│   ├── build-manifest.json     # [ { template, data, out }, ... ] build registry
│   ├── generate-page.js        # Core template renderer ({{TOKEN}}, {{> partial}})
│   ├── templates/
│   │   ├── feature-page.html   # Template for features/* pages
│   │   ├── competitor-alt.html # Template for compare/* pages
│   │   ├── use-case-page.html  # Template for use-cases/* pages
│   │   ├── niche-landing.html  # Template for root niche pages
│   │   ├── blog-category.html  # Template for blog category hubs
│   │   └── blog-post.html      # Template for blog/posts/* pages
│   ├── partials/
│   │   ├── nav.html            # Shared nav markup (uses {{BASE}})
│   │   ├── footer.html         # Shared footer markup (uses {{BASE}})
│   │   └── scripts.html        # Shared script tags (mkt.js + consent.js)
│   ├── data/
│   │   ├── feature-*.json      # Data for features/* pages
│   │   ├── *-alt.json          # Data for compare/* pages
│   │   ├── usecase-*.json      # Data for use-cases/* pages
│   │   ├── niche-*.json        # Data for niche landing pages
│   │   └── cat-*.json          # Data for blog category hubs
│   ├── add-mkt-js.js           # One-off script: add mkt.js tag to HTML files
│   ├── fix-footers.js          # One-off script: normalise footer markup
│   ├── sync-chrome.js          # Chrome extension sync utility
│   ├── gen-icons.mjs           # PWA icon generation
│   ├── gen-og.mjs              # OG image generation
│   └── relativize-links.py     # Python utility: convert absolute to relative links
│
├── assets/
│   └── images/
│       └── blog/               # .webp images for blog posts (22 images)
│
├── styles/tests/               # Unit tests (co-located with styles dir — naming anomaly)
│   ├── crypto.test.js
│   ├── generator.test.js
│   ├── state-dispatch.test.js
│   └── sync-fingerprint.test.js
│
├── docs/
│   ├── logo-concepts.html      # Design artefact
│   └── superpowers/plans/      # Internal planning docs
│
├── manifest.json               # PWA web app manifest
├── service-worker.js           # PWA service worker (cache: fincwin-v6)
├── vercel.json                 # Vercel routing, CSP headers, redirects
├── server.js                   # Dev server (Node, port 4141)
├── package.json                # npm scripts + devDependencies (vitest, playwright)
├── robots.txt                  # Disallows app/admin/account/signin/api/cat-*
├── sitemap.xml                 # Static sitemap
├── favicon.svg / favicon-32.png
├── icon.svg / icon-180.png / icon-192.png / icon-512.png / icon-maskable*.png
├── og-image.png / og-image.svg
├── icons.svg                   # Inline SVG sprite
└── .claude/skills/             # SEO skill definitions for Claude agents
```

## Directory Purposes

**Root `.html` files:**
- Purpose: Hand-authored marketing and app pages not covered by the build system
- Contains: `index.html` (home), `app.html` (PWA shell), `signin.html`, `pricing.html`, `about.html`, policy pages, niche landings (BUILD-GENERATED), `cat-*.html`

**`features/`:**
- Purpose: Feature detail pages for SEO (`/features/ai-coach`, etc.)
- Contains: BUILD-GENERATED HTML only — never edit these files directly; edit `scripts/data/feature-*.json` and re-run `npm run build:pages`

**`compare/`:**
- Purpose: Competitor alternative pages for SEO (`/compare/ynab-alternative`, etc.)
- Contains: BUILD-GENERATED HTML only

**`use-cases/`:**
- Purpose: Use-case scenario pages for SEO (`/use-cases/paying-off-debt`, etc.)
- Contains: BUILD-GENERATED HTML only

**`blog/`:**
- Purpose: Educational content for organic search
- Contains: Hand-authored `index.html` hub + category `index.html` hubs + `posts/*.html` individual posts
- Key files: `blog/index.html`, `blog/posts/zero-based-budgeting.html`

**`styles/`:**
- Purpose: All CSS — split into app-shell styles and marketing styles
- Key split: `mkt.css` (marketing, all public pages) vs `base.css` + `layout.css` + `components.css` + `dark.css` + `themes.css` (app shell only)

**`js/`:**
- Purpose: All client-side JavaScript
- Key split: app modules (loaded in `app.html`) vs marketing scripts (`mkt.js`, `consent.js`, `pricing.js`, `contact.js`, `landing.js`) vs shared infrastructure (`crypto-core.js`, `state.js`, `sync.js`, `boot.js`)

**`js/vendor/`:**
- Purpose: Vendored third-party libraries (not loaded from CDN — required for CSP `script-src 'self'`)
- Contains: Chart.js, PapaParse, qr-creator, Firebase SDKs
- Generated: Yes (copied from node_modules or downloaded manually)
- Committed: Yes

**`api/`:**
- Purpose: Vercel serverless functions — deployed as `/api/*` routes
- Contains: License lifecycle endpoints + contact form
- Note: `contact.js` uses Vercel Edge Runtime (`export const config = { runtime: 'edge' }`); others use Node runtime

**`scripts/`:**
- Purpose: Build tooling — runs on developer machine, never deployed
- Contains: Template renderer, build manifest, data JSONs, partials, one-off utilities

**`scripts/templates/`:**
- Purpose: HTML templates for build-generated pages
- Contains: `{{TOKEN}}` placeholders and `{{> partial}}` includes
- Key files: `feature-page.html`, `competitor-alt.html`, `use-case-page.html`, `niche-landing.html`

**`scripts/partials/`:**
- Purpose: Shared HTML fragments injected into templates at build time
- Contains: `nav.html` (global nav), `footer.html` (global footer), `scripts.html` (mkt.js + consent.js tags)
- Note: Uses `{{BASE}}` placeholder for root-relative path prefix; resolved per output file depth

**`scripts/data/`:**
- Purpose: JSON data files — one per generated page; supplies all `{{TOKEN}}` values
- Naming: `feature-*.json`, `*-alt.json`, `usecase-*.json`, `niche-*.json`, `cat-*.json`

**`assets/images/blog/`:**
- Purpose: Optimised `.webp` images for blog posts
- Committed: Yes (22 images)
- Immutable cache: Served with `max-age=31536000, immutable` by Vercel headers

**`styles/tests/`:**
- Purpose: Unit test files (despite being inside `styles/` — naming anomaly from project history)
- Contains: Vitest test suites for `crypto-core.js`, build generator, state dispatch, sync fingerprinting

## Key File Locations

**Entry Points:**
- `index.html`: Marketing home
- `app.html`: PWA dashboard shell
- `signin.html`: Authentication
- `api/validate.js`: License validation endpoint

**Configuration:**
- `vercel.json`: Routing rewrites, redirects, CSP headers, cache headers
- `manifest.json`: PWA manifest (`start_url`, icons, display mode)
- `service-worker.js`: Cache strategy and asset list
- `js/config.local.js`: Firebase credentials (gitignored in production; must be provided)
- `js/config.example.js`: Template showing expected config shape
- `scripts/build-manifest.json`: Registry of all build-generated pages

**Core App Logic:**
- `js/state.js`: All data read/write; must be loaded before feature modules
- `js/boot.js`: App initialisation sequence; must be loaded after all feature modules
- `js/crypto-core.js`: Encryption; must be first script in load order

**Styling:**
- `styles/mkt.css`: Use for all marketing pages
- `styles/base.css`: Use for app shell pages; do not use on marketing pages

**Build System:**
- `scripts/generate-page.js`: Core renderer — invoke via `node scripts/generate-page.js --template <name> --data <json> --out <path>`
- `scripts/build-all.js`: Build all pages listed in manifest — invoke via `npm run build:pages`

**Testing:**
- `styles/tests/crypto.test.js`
- `styles/tests/state-dispatch.test.js`
- `styles/tests/sync-fingerprint.test.js`
- `styles/tests/generator.test.js`

## Naming Conventions

**Files:**
- HTML pages: `kebab-case.html` (e.g. `envelope-budgeting.html`, `ai-coach.html`)
- JS modules: `kebab-case.js` (e.g. `import-bank.js`, `crypto-core.js`)
- CSS files: `kebab-case.css` (e.g. `auth-tokens.css`)
- Data JSONs: `<type>-<slug>.json` (e.g. `feature-ai-coach.json`, `usecase-paying-off-debt.json`)
- Blog images: `<topic-slug>.webp` (e.g. `ai-finance-coach.webp`)

**Directories:**
- Feature groups: lowercase plural nouns (`features/`, `compare/`, `use-cases/`, `blog/`)
- Blog categories: lowercase noun (`budgeting/`, `debt/`, `savings/`, `mindset/`, `tools/`)
- Build artefacts: `scripts/templates/`, `scripts/data/`, `scripts/partials/`

**Template Tokens:**
- All caps with underscores: `{{META_TITLE}}`, `{{CANONICAL_URL}}`, `{{FEATURE_NAME}}`
- Reserved: `{{BASE}}` (auto-computed path prefix), `{{> partial_name}}` (partial injection)

**URL Slugs (via vercel.json rewrites):**
- Marketing pages: `/features/:slug`, `/compare/:slug`, `/use-cases/:slug`
- Blog: `/blog/:category`, `/blog/posts/:slug` (not currently in rewrites — served as directory index)
- App pages: `/app`, `/signin`, `/account`, `/admin`
- `cleanUrls: true` + `trailingSlash: false` enforced globally by Vercel

## Where to Add New Code

**New feature detail page** (e.g. `features/multi-currency.html`):
1. Create data file: `scripts/data/feature-multi-currency.json` — copy shape from `scripts/data/feature-ai-coach.json`
2. Add entry to `scripts/build-manifest.json`: `{ "template": "feature-page", "data": "scripts/data/feature-multi-currency.json", "out": "features/multi-currency.html" }`
3. Run `npm run build:pages` — output file is generated automatically
4. Add Vercel rewrite if a new slug pattern is needed (usually already covered by `/features/:slug`)

**New competitor compare page** (e.g. `compare/copilot-alternative.html`):
1. Create `scripts/data/copilot-alt.json` — copy shape from `scripts/data/ynab-alt.json`
2. Add entry to `scripts/build-manifest.json` with `"template": "competitor-alt"`
3. Run `npm run build:pages`

**New use-case page:**
1. Create `scripts/data/usecase-<slug>.json`
2. Add entry to `scripts/build-manifest.json` with `"template": "use-case-page"`
3. Run `npm run build:pages`

**New blog post:**
- Location: `blog/posts/<slug>.html` — hand-authored (no template system currently used for blog posts)
- Use `styles/mkt.css`; include `js/mkt.js` and `js/consent.js` via `<script defer>`
- Add hero image to `assets/images/blog/<slug>.webp`
- Add to category index and `blog/index.html` manually

**New app feature module:**
- Implementation: `js/<feature-name>.js` (plain script, globals on `window`)
- Load order: add `<script src="js/<feature-name>.js">` in `app.html` before `boot.js`
- State access: call functions exposed by `js/state.js` (read via global `S`, write via state mutation functions)
- Do not add new feature modules to marketing pages

**New marketing page (hand-authored):**
- Add `.html` at root or inside appropriate subdirectory
- Link `styles/mkt.css`, add `js/mkt.js defer` and `js/consent.js defer`
- Add route rewrite to `vercel.json` if needed
- Add `<link rel="canonical">` and robots meta

**Shared nav/footer changes:**
- Edit `scripts/partials/nav.html` or `scripts/partials/footer.html`
- Re-run `npm run build:pages` to regenerate all build-generated pages
- Hand-authored pages embed their own nav — update those separately

**New serverless endpoint:**
- Create `api/<name>.js` following the pattern in `api/validate.js` (Node) or `api/contact.js` (Edge)
- Edge: `export const config = { runtime: 'edge' }` + `export default async function handler(req)`
- Node: `export default async function handler(req, res)`
- No additional configuration needed — Vercel auto-discovers `api/*.js`

## Special Directories

**`js/vendor/`:**
- Purpose: Vendored third-party libraries required by CSP `script-src 'self'`
- Generated: Manually copied or via `scripts/sync-chrome.js`
- Committed: Yes — must be in repo for PWA offline caching

**`scripts/`:**
- Purpose: Build tooling only — never deployed to Vercel
- Generated: No
- Committed: Yes

**`node_modules/`:**
- Purpose: Dev dependencies (vitest, playwright) — installed by `npm install --omit=dev` is skipped on Vercel deploy per `vercel.json` `installCommand`
- Committed: No

**`.claude/skills/`:**
- Purpose: SEO skill definitions consumed by Claude agent tooling
- Committed: Yes — part of the agentic workflow

**`docs/`:**
- Purpose: Internal design artefacts and planning documents
- Committed: Yes — not served publicly

---

*Structure analysis: 2026-06-10*
