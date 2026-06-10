<!-- refreshed: 2026-06-10 -->
# File Structure

**Analysis Date:** 2026-06-10

## Root Layout

```
freetinz-stack/
├── index.html              Marketing homepage (FincWin)
├── app.html                SPA app shell — the full finance dashboard
├── signin.html             Auth page (sign in / register / activate)
├── account.html            User account management
├── admin.html              Internal admin panel
├── pricing.html            Pricing / upgrade page
├── features.html           Features overview page
├── compare.html            Competitor comparison hub
├── use-cases.html          Use-cases hub
├── about.html              About page
├── changelog.html          Product changelog
├── help.html               Help/FAQ
├── contact.html            Contact form page
├── privacy.html            Privacy policy
├── terms.html              Terms of service
├── cookie-policy.html      Cookie policy
├── 404.html                Not-found page
├── no-bank-sync-budget.html   Niche landing (generated)
├── offline-budget-app.html    Niche landing (generated)
├── private-finance-app.html   Niche landing (generated)
├── budget-categories.html  Standalone SEO page
├── cat-*.html              Category pages (14 files: banking, dining, etc.)
├── manifest.json           PWA web app manifest
├── service-worker.js       Offline cache service worker (cache: fincwin-v6)
├── robots.txt              Search crawler directives
├── sitemap.xml             XML sitemap
├── firestore.rules         Firebase security rules (committed, deployed via CLI)
├── vercel.json             Deployment config — rewrites, redirects, headers, CSP
├── package.json            Dev scripts + devDependencies (vitest, playwright)
├── server.js               Local dev HTTP server (port 4141, development only)
├── favicon.svg / favicon-32.png  Site favicon
├── icon-*.png / icon.svg   PWA icons (180, 192, 512, maskable)
├── og-image.png            Open Graph image
├── *.mjs                   One-off audit/diagnostic scripts (not part of app)
└── node_modules/           Dev dependencies only
```

## Directory Map

### `js/` — Client-side JavaScript

All scripts are loaded as classic (non-module) `<script>` tags. Dependency order matters.

```
js/
├── config.local.js         window.__FINCWIN_CONFIG__ — Firebase public config + Google client ID
├── config.example.js       Template for config.local.js (safe to commit example)
├── config.fallback.js      Offline fallback config values
├── crypto-core.js          window.CRYPTO — AES-GCM-256 + PBKDF2 primitives (loaded first)
├── constants.js            Global constants: CAT_MAP, month names, storage key SK='finflow_v5'
├── state.js                Global state S, IndexedDB engine, PIN/session/encryption management
├── sync.js                 Sync orchestrator, provider plugin registry, file-system backup
├── boot.js                 App boot sequence, tab switching, confetti engine, nav init
├── darkmode.js             Theme/dark-mode toggling (loaded before body in app.html)
├── modals.js               Modal open/close/confirm utilities
├── expenses.js             Expenses tab logic
├── revenue.js              Income/revenue tab logic
├── loans.js                Loan payoff tab logic
├── savings.js              Savings goals tab logic
├── analytics.js            Analytics dashboard logic
├── calendar.js             Budget calendar logic
├── archive.js              Transaction archive/history
├── health.js               Financial health score computation
├── settings.js             Settings panel logic
├── import-bank.js          CSV bank statement importer
├── onboarding.js           First-run onboarding flow
├── gamification.js         Badges, streaks, confetti triggers
├── search.js               In-app search
├── fx.js                   Foreign exchange / multi-currency
├── investments.js          Investment tracking
├── bulk-add.js             Bulk transaction entry
├── calendar.js             Calendar view
├── tour.js                 Product tour
├── demo-profiles.js        Demo data profiles
├── events.js               Custom event bus
├── features.js             Feature-flag checks
├── icons.js                Icon rendering helpers
├── landing.js              Marketing page interactivity
├── mkt.js                  Marketing analytics / tracking helpers
├── pricing.js              Pricing page logic
├── signin.js               Auth flow (Firebase sign in / register / Google OAuth)
├── account.js              Account page logic
├── admin.js                Admin page logic
├── contact.js              Contact form submission
├── consent.js              Cookie consent banner
├── providers/
│   ├── firebase.js         Firebase Firestore sync provider (self-registers via registerProvider)
│   └── gdrive.js           Google Drive sync provider (self-registers via registerProvider)
└── vendor/
    ├── chart.min.js         Chart.js (bundled, no CDN)
    ├── papaparse.esm.js     CSV parser ESM build
    ├── papaparse.min.js     CSV parser classic build
    ├── qr-creator.es6.min.js  QR code generator
    └── firebase/
        ├── firebase-app.js
        ├── firebase-auth.js
        └── firebase-firestore.js
```

### `styles/` — CSS

```
styles/
├── base.css         CSS custom properties, resets, typography — app shell
├── layout.css       Grid, sidebar, tab layout — app shell
├── components.css   UI components (cards, modals, buttons, forms) — app shell
├── dark.css         Dark mode overrides — app shell
├── themes.css       Theme variants (Light Glass, etc.) — app shell
├── mkt.css          All marketing page styles (single file covers all mkt pages)
├── auth-tokens.css  Auth page specific styles
└── tests/           CSS regression test snapshots
```

### `api/` — Vercel Edge / Serverless Functions

```
api/
├── activate.js      POST — License activation via Lemon Squeezy (Node serverless)
├── deactivate.js    POST — License deactivation via Lemon Squeezy
├── validate.js      POST — License validation
├── contact.js       POST — Contact form email via Resend (Edge runtime)
└── admin.js         POST — Admin operations (guarded)
```

### `scripts/` — Build tooling

```
scripts/
├── build-all.js         Iterates build-manifest.json and calls generate-page.js for each entry
├── generate-page.js     Template engine: resolves {{> partial}} and {{TOKEN}} substitutions
├── build-manifest.json  Declares all template-generated pages (template + data + output path)
├── sync-chrome.js       Chrome extension sync helper
├── add-mkt-js.js        Injects marketing JS snippet into HTML files
├── fix-footers.js       Footer consistency fixer script
├── relativize-links.py  Python utility to make links relative
├── gen-icons.mjs        PWA icon generation script
├── gen-og.mjs           OG image generation script
├── templates/           HTML templates for generated pages
│   ├── feature-page.html
│   ├── competitor-alt.html
│   ├── use-case-page.html
│   ├── niche-landing.html
│   ├── blog-post.html
│   └── blog-category.html
├── partials/            Shared HTML fragments injected into templates
│   ├── nav.html         Global navigation bar (uses {{BASE}} for root-relative links)
│   ├── footer.html      Global footer
│   └── scripts.html     Common script tags
├── data/                JSON data files — one per generated page
│   ├── feature-*.json   Feature page data (6 features)
│   ├── *-alt.json       Competitor alternative page data (5 competitors)
│   ├── usecase-*.json   Use-case page data (5 use-cases)
│   └── niche-*.json     Niche landing page data (3 niches)
└── images/              Static build images
```

### `blog/` — Blog content

```
blog/
├── index.html           Blog hub
├── budgeting/index.html Category index
├── debt/index.html      Category index
├── mindset/index.html   Category index
├── savings/index.html   Category index
├── tools/index.html     Category index
└── posts/               Individual blog post HTML files (30+ posts)
```

### `features/` — Feature detail pages (generated)

All files in this directory are outputs of the build pipeline (`scripts/build-all.js`). Do not edit directly — edit the corresponding `scripts/data/feature-*.json` and regenerate.

### `compare/` — Competitor alternative pages (generated)

Same as `features/` — all outputs from the build pipeline via `competitor-alt` template.

### `use-cases/` — Use-case landing pages (generated)

Generated from `use-case-page` template + `scripts/data/usecase-*.json`.

### `assets/` — Static assets

Static images and media used by marketing pages.

### `docs/` — Internal documentation

Logo concepts and design exploration files. Not served as part of the app.

## Page Organization

### Routing (Vercel)

`vercel.json` maps clean URLs to HTML files:

| Clean URL | HTML file |
|-----------|-----------|
| `/` | `index.html` |
| `/app` | `app.html` |
| `/signin` | `signin.html` |
| `/features/:slug` | `features/:slug.html` |
| `/compare/:slug` | `compare/:slug.html` |
| `/use-cases/:slug` | `use-cases/:slug.html` |
| `/blog/:category` | `blog/:category/index.html` |

`cleanUrls: true` and `trailingSlash: false` are set globally.

### Page categories

- **App pages** (noindex): `app.html`, `signin.html`, `account.html`, `admin.html`
- **Core marketing** (hand-authored): `index.html`, `pricing.html`, `features.html`, `compare.html`, `about.html`, etc.
- **Generated marketing** (build pipeline output): all files under `features/`, `compare/`, `use-cases/`, plus the three niche landing pages at root
- **Blog** (hand-authored): all files under `blog/`
- **Category SEO pages** (hand-authored): `cat-*.html` at root
- **Legal/policy** (hand-authored): `privacy.html`, `terms.html`, `cookie-policy.html`

## Asset Organization

### CSS load strategy

- Marketing pages: load `styles/mkt.css` only (single file, all mkt styles)
- App shell: loads `styles/base.css` + `layout.css` + `components.css` + `dark.css` + `themes.css` in order
- `styles/auth-tokens.css` used on auth pages only

### JS load strategy

- Marketing pages: minimal JS via `js/landing.js`, `js/mkt.js`, `js/consent.js`
- App shell: ordered classic script tags — `config.local.js` → `crypto-core.js` → `constants.js` → `state.js` → `sync.js` → provider scripts → feature modules → `boot.js`
- Vendor libraries: bundled locally under `js/vendor/` (no CDN dependencies for app-critical code)
- Firebase SDK: lazy-loaded via dynamic `import()` inside async functions; not loaded until first auth/sync action

### Images/icons

- PWA icons: root-level (`icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`)
- OG image: `og-image.png` at root
- SVG icon sprite: inline in `app.html` DOM (`<span id="svgSprite">`)
- Marketing images: `assets/` directory

## Notable Files

| File | Purpose |
|------|---------|
| `vercel.json` | Routing rewrites, security headers, CSP, cache headers — single source of truth for deployment config |
| `firestore.rules` | Firebase per-user data isolation rules — must be deployed via Firebase CLI on changes |
| `js/config.local.js` | `window.__FINCWIN_CONFIG__` — Firebase public identifiers. Intentionally committed. |
| `js/crypto-core.js` | Cryptographic primitives — load before all other app JS |
| `js/state.js` | Owns all app state, IDB engine, PIN/session management, encryption wrappers |
| `js/sync.js` | Provider plugin registry, file-system backup, cloud push/pull orchestration |
| `service-worker.js` | PWA offline cache — bump `CACHE` constant on every static-asset deploy |
| `scripts/build-manifest.json` | Authoritative list of all build-generated pages; add entries here to create new templated pages |
| `scripts/generate-page.js` | Template engine implementation — the only place `{{TOKEN}}` syntax is processed |
| `manifest.json` | PWA manifest — icons, theme color, display mode |

## Where to Add New Code

**New app feature tab:**
- Implementation: `js/{feature-name}.js` (new classic script file)
- Add `<script src="js/{feature-name}.js">` to `app.html` after `sync.js` and before `boot.js`
- Add tab DOM and `<section class="section" id="{feature-name}">` to `app.html`

**New marketing page (one-off):**
- Author directly as a new `.html` file at root or in appropriate subdirectory
- Add clean-URL rewrite to `vercel.json`
- Add to `sitemap.xml`

**New templated marketing page (e.g., new competitor alt, new feature page):**
- Create `scripts/data/{page-slug}.json` with all `{{TOKEN}}` values
- Add entry to `scripts/build-manifest.json`
- Run `npm run build:pages`
- Add clean-URL rewrite to `vercel.json` and entry to `sitemap.xml`

**New API endpoint:**
- Create `api/{name}.js` as an Edge or Node serverless function
- Add `source`/`destination` rewrite to `vercel.json` if a clean URL is needed
- Secrets go in Vercel environment variables only

**New shared partial (nav/footer change):**
- Edit `scripts/partials/{partial-name}.html`
- Re-run `npm run build:pages` to propagate to all generated pages
- Hand-authored pages must be updated manually

---

*Structure analysis: 2026-06-10*
