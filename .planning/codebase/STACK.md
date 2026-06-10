# Tech Stack

**Analysis Date:** 2026-06-10

## Languages & Runtimes

- **JavaScript (ES2020+)** — primary language for all application code, marketing JS, and serverless API functions
- **HTML5** — static marketing pages, PWA shell (`app.html`, `signin.html`, `account.html`, `admin.html`), blog posts, all served as committed files
- **CSS3** — hand-written styles in `styles/` (no CSS preprocessor)
- **Node.js** — local dev server (`server.js`), build scripts (`scripts/build-all.js`, `scripts/sync-chrome.js`), and Vercel serverless functions (`api/*.js`)

No TypeScript. No JSX. No compile step for runtime code.

## Frameworks & Libraries

**Runtime (vendored into `js/vendor/`, no npm runtime deps):**
- Firebase SDK (modular) — vendored as `js/vendor/firebase/firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js`
- Chart.js — `js/vendor/chart.min.js` (version not pinned in package.json; vendored)
- PapaParse — `js/vendor/papaparse.esm.js` + `papaparse.min.js` (CSV parsing for bank import)
- qr-creator — `js/vendor/qr-creator.es6.min.js` (QR code generation)

`package.json` declares **zero runtime dependencies** — all third-party code is either vendored or loaded from a CDN that is already gated behind consent.

**Dev dependencies (from `package.json`):**
- `vitest ^1.6.1` — unit test runner
- `playwright ^1.60.0` — end-to-end / browser tests

## Build Tools

- **`scripts/build-all.js`** — Node.js page generator; reads templates from `scripts/templates/`, data from `scripts/data/*.json`, and writes output HTML to `compare/`, `features/`, `use-cases/`, blog categories, and niche landing pages. Run via `npm run build:pages`.
- **`scripts/sync-chrome.js`** — dev-only helper, syncs something to Chrome; run via `npm run sync-chrome`.
- **`server.js`** — vanilla Node `http` server for local dev on port 4141. No hot-reload; development-only, not deployed.
- No bundler (Webpack, Vite, Rollup, esbuild) — JS is served as individual plain files.
- No transpiler (Babel) — code targets modern browsers natively.
- Vercel handles the only "build" on deploy: `npm install --omit=dev` (installs nothing at runtime since there are no runtime deps).

## Deployment & Infrastructure

- **Hosting:** [Vercel](https://vercel.com) — static site + serverless functions
- **Deploy model:** push to git → Vercel serves committed static HTML + compiles `api/*.js` as Edge/Node serverless functions on demand
- **Config:** `vercel.json` — clean URLs, rewrites, 301 redirects, security headers (CSP, HSTS, COOP, etc.), per-route cache-control, CORS on `/api/*`
- **No build step on Vercel** — generated HTML is committed; Vercel serves files directly
- **CI/CD:** not detected in repo (no GitHub Actions workflows committed); README mentions a workflow that writes `js/config.local.js` from repo secrets for non-static deploys
- **Containerization:** none

**Serverless functions (`api/`):**
- `activate.js` — licence activation, calls Lemon Squeezy; Node runtime
- `deactivate.js` — licence deactivation, calls Lemon Squeezy; Node runtime
- `validate.js` — licence validation, calls Lemon Squeezy; Node runtime
- `contact.js` — contact form email relay, calls Resend; **Edge runtime** (`export const config = { runtime: 'edge' }`)
- `admin.js` — admin endpoint gated by `ADMIN_TOKEN`

## Development Tools

- **Testing:** `vitest ^1.6.1` (unit, `npm test` / `npm run test:watch`); `playwright ^1.60.0` (E2E)
- **Linting/formatting:** none detected — no `.eslintrc*`, `.prettierrc*`, `biome.json`, or similar config files present
- **Local dev server:** `npm run dev` starts `server.js` on port 4141
- **Audit scripts:** `audit-site.mjs`, `full-audit.mjs`, `diag.mjs` — one-off Node ESM scripts, not deployed

## PWA

- Service worker: `service-worker.js` — cache name `fincwin-v6`, offline-first cache strategy for app shell assets
- Web manifest: `manifest.json`
- Icons: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `icon-maskable.svg`

## Storage (client-side)

- **IndexedDB** — primary encrypted state store; PIN-derived AES-GCM-256 key via PBKDF2 (600k iterations, v2); managed in `js/state.js`
- **localStorage** — licence key cache, session counters, onboarding flags, theme preferences, FX rate cache
- **sessionStorage** — FX rate session cache (`finflow_fx_rates`), budget notification dedup flags
- **Web Cryptography API** — required; app shows a hard error if unavailable; handled in `js/crypto-core.js`

---

*Stack analysis: 2026-06-10*
