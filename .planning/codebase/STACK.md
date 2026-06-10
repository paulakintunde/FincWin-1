# Technology Stack

**Analysis Date:** 2026-06-10

## Languages

**Primary:**
- JavaScript (ES2020+) — all application logic, both browser and server-side
- HTML5 — static page templates and the compiled marketing/landing pages
- CSS3 — custom design system (no CSS framework)

**Secondary:**
- Python — `scripts/relativize-links.py` (one-off link-relativization utility)
- MJS (ESM) — build helpers: `scripts/gen-icons.mjs`, `scripts/gen-og.mjs`, `diag.mjs`, `full-audit.mjs`, `__verify_account.mjs`, `__verify_admin.mjs`

## Runtime

**Environment:**
- Browser — primary runtime; app runs entirely client-side (offline-first PWA)
- Node.js — build scripts and local dev server only (`server.js`, `scripts/`)

**Dev Server:**
- `server.js` — plain Node.js `http` module, port 4141; development only, not deployed

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- None — vanilla JavaScript (no React, Vue, Angular, or similar)

**Testing:**
- Vitest `^1.6.1` — unit test runner; config via `package.json` `"test"` script
- Playwright `^1.60.0` — end-to-end/browser tests

**Build:**
- Node.js build scripts — `scripts/build-all.js` orchestrates page generation via `scripts/generate-page.js` using a `scripts/build-manifest.json` manifest
- No bundler/transpiler (Vite, webpack, etc.) — JS is served as-is; ESM imports used inside async functions only (Firebase SDK)

## Key Dependencies

**Vendored (in `js/vendor/` — committed, not npm):**
- Chart.js — `js/vendor/chart.min.js` — all in-app charts (line, bar, doughnut)
- PapaParse — `js/vendor/papaparse.esm.js` + `papaparse.min.js` — CSV parsing for bank statement import
- qr-creator — `js/vendor/qr-creator.es6.min.js` — QR code generation (sync share feature)
- Firebase Web SDK (modular, v9-compat) — `js/vendor/firebase/firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js` — vendored to allow CSP `script-src 'self'`

**Dev-only (npm, not shipped):**
- `vitest ^1.6.1` — test runner
- `playwright ^1.60.0` — E2E tests

## Configuration

**Environment:**
- App config set via `window.__FINCWIN_CONFIG__` (a plain object injected by `js/config.local.js`)
- `js/config.example.js` — template showing required fields: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`, `googleClientId`
- `js/config.fallback.js` — ensures `window.__FINCWIN_CONFIG__` is `null` (not undefined) if `config.local.js` is absent; required by CSP (no `unsafe-inline`)
- `js/config.local.js` is gitignored; in CI/CD it is written from repo secrets at build time

**Build:**
- `scripts/build-manifest.json` — declarative list of `{template, data, out}` entries
- `scripts/generate-page.js` — Mustache/template-style page generator
- `scripts/build-all.js` — iterates the manifest and calls the generator via `execFileSync`

## PWA

- `manifest.json` — Web App Manifest; `name: "Financial Win — Personal Finance"`, `short_name: "FincWin"`, `start_url: "/app"`, display `standalone`
- `service-worker.js` — Cache-first strategy, cache key `fincwin-v6`; pre-caches all core app assets including vendored JS and CSS
- Icons: PNG (180, 192, 512) + SVG; maskable variant at 512 px

## Security

- Content-Security-Policy enforced via `vercel.json` response headers (no `unsafe-inline` for scripts)
- PBKDF2-HMAC-SHA256 (210k iterations v1, 600k iterations v2 per OWASP 2023) key derivation via `js/crypto-core.js`
- AES-GCM-256 for all at-rest and cloud-sync data encryption
- `crypto.subtle` Web Crypto API — `js/crypto-core.js`

## Platform Requirements

**Development:**
- Node.js (any recent LTS)
- `npm install` installs Vitest + Playwright
- Local dev: `npm run dev` → `node server.js` on port 4141

**Production:**
- Vercel (static hosting with Edge Functions for `/api/*` routes)
- `vercel.json` defines URL rewrites (clean URLs), security headers, cache policies, and CORS for `/api/`
- No server-side rendering; all HTML files are pre-built static assets

---

*Stack analysis: 2026-06-10*
