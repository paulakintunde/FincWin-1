<!-- refreshed: 2026-06-10 -->
# Architecture

**Analysis Date:** 2026-06-10

## System Overview

FincWin is a freemium personal finance PWA (Progressive Web App) deployed as a static site on Vercel. The product has two distinct layers:

1. **Marketing site** — a collection of static HTML pages (landing, blog, compare, features, use-cases) targeting SEO-driven traffic. Pages in templated sections are generated at build time via a lightweight Node.js template engine.

2. **App shell** — `app.html` is an offline-first single-page application. All financial data is stored in the user's browser (IndexedDB primary, localStorage fallback). Optional cloud sync is provided via Firebase Firestore or Google Drive, both encrypted client-side before leaving the device.

There is no application server. "Backend" logic runs as Vercel Edge Functions under `api/`.

## Frontend Architecture

### App Shell (`app.html` + `js/`)

- **Rendering:** Vanilla JS, no framework. The DOM is manipulated directly by module files loaded as classic `<script>` tags in dependency order.
- **Routing:** Tab-based within `app.html`. `switchTab(name, btn)` in `js/boot.js` drives all in-app navigation. No URL routing inside the app.
- **State management:** A single global mutable object `S` managed exclusively in `js/state.js`. All other modules read/write state through functions exported onto `window`. `BroadcastChannel` notifies sibling tabs of writes.
- **Storage engine:** `js/state.js` exposes `idbGet`/`idbSet` (IndexedDB `FinFlow` DB, stores `state` and `meta`) with a `localStorage` fallback for `file://` contexts.
- **Encryption:** Optional at-rest encryption via AES-GCM-256. `js/crypto-core.js` exposes `window.CRYPTO` with PBKDF2 key derivation (210 000 / 600 000 iterations). The `CryptoKey` never leaves `state.js` scope; external modules call purpose-specific wrappers (`sessionKeyEncrypt` / `sessionKeyDecrypt`).
- **Service Worker:** `service-worker.js` (cache name `fincwin-v6`) pre-caches the full app shell for offline use. Cache is versioned by a string constant that must be bumped on each static-asset deploy.

### Marketing Pages

- **Rendering:** Static HTML files. Pages authored by hand or generated from `scripts/templates/*.html` + `scripts/data/*.json` at build time.
- **Template engine:** `scripts/generate-page.js` — resolves `{{> partial}}` includes and `{{TOKEN}}` substitutions. `{{BASE}}` is computed from output path depth to produce root-relative asset links.
- **Styles:** `styles/mkt.css` for all marketing pages. `styles/base.css`, `layout.css`, `components.css`, `dark.css`, `themes.css` for the app shell.

## Backend Architecture

All server-side logic is Vercel Edge / Serverless Functions under `api/`:

| File | Runtime | Purpose |
|------|---------|---------|
| `api/activate.js` | Node (serverless) | License activation via Lemon Squeezy |
| `api/deactivate.js` | Node (serverless) | License deactivation |
| `api/validate.js` | Node (serverless) | License validation |
| `api/contact.js` | Edge | Contact form — sends email via Resend |
| `api/admin.js` | Edge | Admin operations (guarded) |

Secrets (`LEMON_SQUEEZY_API_KEY`, `RESEND_API_KEY`) live exclusively in Vercel environment variables — never in client-side code. Firebase public config lives in `js/config.local.js` (intentionally committed; enforced by Firestore rules, not secrecy).

## Data Flow

### Primary (offline-first) path

1. User enters data in `app.html` → event handler in a module file (e.g., `js/expenses.js`)
2. Handler mutates the global `S` object via `js/state.js` functions
3. `_doPersist()` in `js/state.js` serialises `S` to JSON, optionally AES-GCM encrypts it, and writes to IndexedDB (`idbSet`) plus fires sync hooks
4. On load, `initState()` reads from IDB, decrypts if needed, and populates `S`

### Cloud sync path (optional)

1. `js/sync.js` exposes `window.cloudSyncPush` and `window.cloudPullOnLoad`
2. Providers (`js/providers/firebase.js`, `js/providers/gdrive.js`) self-register via `window.registerProvider(name, plugin)`
3. On push: `sync.js` calls the active provider's `push(encryptedPayload)` — payload is already encrypted before leaving `state.js`
4. Google Drive stores `fincwin-state.enc` in the app's isolated `appDataFolder`
5. Firebase Firestore stores per-user docs under `users/{uid}` (Firestore rules enforce `request.auth.uid == userId`)

### Auth path

1. `signin.html` + `js/signin.js` — Firebase Auth (email/password + Google OAuth via GIS)
2. On `onAuthStateChanged`: Firestore doc checked for `licenseKey`, written to `localStorage`, then redirect to `app.html`
3. License activation: `app.html` → `api/activate.js` → Lemon Squeezy API → writes plan/key to `localStorage` + Firestore user doc

## Auth & Security Model

- **Identity:** Firebase Authentication (email/password + Google one-tap)
- **Authorisation:** Firestore rules enforce single-user document ownership (`request.auth.uid == userId`). No server-side session; auth state lives in Firebase SDK's `localStorage` persistence.
- **License gate:** `fw_license_key` and `fw_plan` in `localStorage`. Validated server-side via `api/validate.js` against Lemon Squeezy on sensitive operations.
- **PIN lock:** Optional 6-digit PIN stored as a PBKDF2 hash in IDB `meta` store. Session unlocked via `sessionStorage` token; auto-lock after configurable inactivity timeout (`S.autoLockMins`, default 240 min).
- **At-rest encryption:** Optional AES-GCM-256 keyed from PIN. Encrypted blob written to IDB; cloud sync payload also encrypted before upload.
- **Transport security:** Vercel headers enforce HSTS, `X-Frame-Options: DENY`, strict CSP, `COOP: same-origin`, and referrer policy. CSP `connect-src` whitelists Anthropic/OpenAI (AI coach), Firebase, Google APIs, and exchange-rate API.
- **Cross-tab isolation:** `BroadcastChannel('fw_state_sync')` warns on concurrent writes; no shared mutable cross-tab state.

## Key Design Patterns

- **Offline-first PWA** — full feature set without network; sync is additive
- **Vanilla JS module-per-feature** — each `js/*.js` file owns one domain (expenses, loans, savings, etc.), loaded as classic scripts to avoid ES-module CORS issues in `file://` context
- **Provider plugin registry** — `js/sync.js` exposes `window.registerProvider`; storage backends register themselves without sync.js knowing their internals
- **Static-site + Edge API hybrid** — marketing/app assets are pure static; only thin API handlers require server execution
- **Build-time templating** — repeated page types (features, competitor alts, use-cases, niche landings) are authored as data + template, rendered to plain HTML at build time; zero runtime templating overhead
- **Secret-free client config** — Firebase keys are public identifiers committed to source; real secrets only in Vercel env vars

---

*Architecture analysis: 2026-06-10*
