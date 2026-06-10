<!-- refreshed: 2026-06-10 -->
# Architecture

**Analysis Date:** 2026-06-10

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    Marketing Site (public, indexed)                   │
│  index.html  features/*.html  compare/*.html  use-cases/*.html        │
│  blog/**/*.html  pricing.html  about.html  etc.                       │
│  Stylesheet: styles/mkt.css  Scripts: js/mkt.js, js/consent.js       │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │  CTA links → /signin
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Auth Gate  (signin.html)                          │
│  js/signin.js  →  Firebase Auth (vendored SDK)                        │
│  styles/auth-tokens.css                                               │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │  on success → /app
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      PWA App Shell  (app.html)                        │
│  styles/base.css + layout.css + components.css + dark.css + themes   │
│  ┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ expenses │ │revenue │ │  loans   │ │ savings  │ │  analytics  │ │
│  │  .js     │ │  .js   │ │  .js     │ │  .js     │ │  .js        │ │
│  └──────────┘ └────────┘ └──────────┘ └──────────┘ └─────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │   state.js  (central mutable state + IDB persistence)            │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────┐  ┌────────────┐  ┌────────────────────────────────┐ │
│  │ crypto-core │  │  sync.js   │  │  boot.js (auth-cloak + nav)    │ │
│  └─────────────┘  └────────────┘  └────────────────────────────────┘ │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
             ┌───────────────┼──────────────────┐
             ▼               ▼                  ▼
       IndexedDB        Firebase           Google Drive
   (primary storage)  Firestore/Auth     (optional backup)
                      (optional sync)
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Marketing shell | Public SEO pages, nav, footer, consent | `index.html`, `styles/mkt.css`, `js/mkt.js` |
| Auth gate | Sign-in / register / password reset | `signin.html`, `js/signin.js` |
| PWA app shell | Tab-based SPA dashboard, offline-first | `app.html` |
| State manager | Central mutable state, IDB read/write, undo, encryption | `js/state.js` |
| Boot guard | Auth cloak, tab navigation, confetti, SW registration | `js/boot.js` |
| Crypto core | PBKDF2 key derivation, AES-GCM encrypt/decrypt | `js/crypto-core.js` |
| Sync layer | File System Access API, Firebase Firestore, Google Drive | `js/sync.js` |
| Firebase provider | Firestore read/write/live-sync plugin | `js/providers/firebase.js` |
| Google Drive provider | Drive backup/restore plugin | `js/providers/gdrive.js` |
| Build system | Template + data → rendered HTML pages | `scripts/generate-page.js`, `scripts/build-all.js` |
| Dev server | Local static file server with CSP headers | `server.js` |
| Serverless API | License validation, activation, contact form | `api/*.js` |

## Pattern Overview

**Overall:** Static-first multi-page site with an embedded offline-first SPA PWA

**Key Characteristics:**
- Marketing pages are static HTML rendered at build-time from templates; zero JavaScript framework
- The app shell (`app.html`) is a single-page tab-SPA: all UI in one HTML file, views toggled via `switchTab()` in `js/boot.js`
- All app data lives in the browser (IndexedDB primary, localStorage for auth signals); no backend data store for end-users
- Cloud sync (Firebase/Drive) is optional and provider-agnostic via a plugin registry in `sync.js`
- No bundler (webpack/Vite/Rollup): all scripts are plain classic globals loaded in order via `<script>` tags; `js/vendors/firebase/` SDK files are the only ES modules (loaded via dynamic `import()`)

## Layers

**Marketing Layer:**
- Purpose: Public-facing SEO and conversion pages
- Location: root `.html` files + `blog/`, `compare/`, `features/`, `use-cases/` directories
- Contains: Static HTML with inline JSON-LD structured data, `styles/mkt.css`, `js/mkt.js`, `js/consent.js`
- Depends on: Build system (template-generated pages), `styles/mkt.css`, Google Fonts
- Used by: Organic search traffic, social sharing

**Auth Layer:**
- Purpose: Sign-in, registration, session initialisation
- Location: `signin.html`, `account.html`, `js/signin.js`, `js/account.js`
- Contains: Firebase Auth integration, license key storage, redirect logic
- Depends on: `js/vendors/firebase/`, `styles/auth-tokens.css`, `js/config.local.js`
- Used by: Boot guard (redirects unauthenticated users here)

**App Layer:**
- Purpose: The interactive finance dashboard
- Location: `app.html`, `js/boot.js`, all `js/*.js` feature modules
- Contains: Tab navigation, all feature modules (expenses, revenue, loans, savings, analytics, etc.)
- Depends on: `js/state.js` (all reads/writes), `js/crypto-core.js`, `js/sync.js`
- Used by: Authenticated users only (`noindex, nofollow` on the page)

**State Layer:**
- Purpose: Single source of truth for all user data; IndexedDB persistence; session encryption
- Location: `js/state.js`
- Contains: Global `S` object, IDB helpers, PIN/AES-GCM session key, undo, BroadcastChannel cross-tab sync
- Depends on: `js/crypto-core.js`
- Used by: Every feature module (`expenses.js`, `revenue.js`, `loans.js`, `savings.js`, `analytics.js`, etc.)

**Sync Layer:**
- Purpose: Optional cloud backup/restore; provider plugin system
- Location: `js/sync.js`, `js/providers/firebase.js`, `js/providers/gdrive.js`
- Contains: Provider registry (`window.registerProvider`), IDB meta store, passphrase-encrypted sync payloads
- Depends on: `js/crypto-core.js`, `js/state.js`, dynamic `import()` of Firebase SDK
- Used by: `js/settings.js` (user-triggered sync)

**Build System:**
- Purpose: Render templated marketing/SEO pages at development time
- Location: `scripts/generate-page.js`, `scripts/build-all.js`, `scripts/build-manifest.json`
- Contains: Mustache-style `{{TOKEN}}` substitution, `{{> partial}}` injection, `{{BASE}}` depth calculation
- Depends on: `scripts/templates/*.html`, `scripts/data/*.json`, `scripts/partials/*.html`
- Used by: `npm run build:pages`

**API Layer:**
- Purpose: Serverless edge/Node functions deployed on Vercel
- Location: `api/validate.js`, `api/activate.js`, `api/deactivate.js`, `api/admin.js`, `api/contact.js`
- Contains: LemonSqueezy license validation, contact form email relay
- Depends on: `LEMON_SQUEEZY_API_KEY` env var, Vercel serverless runtime
- Used by: `js/pricing.js` (checkout flow), `js/contact.js`

## Data Flow

### Marketing Page Request

1. Browser requests `/features/ai-coach` → Vercel rewrites to `/features/ai-coach.html`
2. Static HTML served — pre-rendered by build system from `scripts/templates/feature-page.html` + `scripts/data/feature-ai-coach.json`
3. `styles/mkt.css` + `js/mkt.js` (defer) + `js/consent.js` (defer) load
4. `js/consent.js` checks `fw_cookie_consent` in localStorage; shows GDPR banner if absent; gates GA4 behind opt-in

### App Boot Sequence

1. Browser requests `/app` → Vercel rewrites to `app.html`
2. Inline script in `<head>` checks `localStorage.getItem('fw_license_key')` — if absent, applies `auth-cloak` CSS class hiding the dashboard
3. `js/darkmode.js` runs synchronously (before FOUC) to apply theme
4. `js/config.local.js` loads Firebase config into `window.__FINCWIN_CONFIG__` (network-first by service worker)
5. `js/crypto-core.js` → `js/constants.js` → `js/state.js` → feature modules load in order
6. `js/boot.js` runs: registers service worker, calls `initState()` (IDB load + optional cloud pull), removes auth-cloak, activates default tab
7. `js/sync.js` + `js/providers/firebase.js` + `js/providers/gdrive.js` load last; providers self-register

### User Data Write Path

1. Feature module (e.g. `expenses.js`) calls a state mutation function in `js/state.js`
2. `state.js` updates the in-memory `S` object
3. `_doPersist()` is called: if PIN/encryption active, AES-GCM encrypts the blob via `js/crypto-core.js`
4. Encrypted (or plain) JSON written to IndexedDB key `finflow_v5` (constant `SK` in `js/constants.js`)
5. BroadcastChannel notifies sibling tabs
6. `window.fileWrite` hook (if File System Access enabled) writes to disk
7. `window.cloudSyncPush` hook (if Firebase/Drive enabled) triggers cloud upload

### License Validation

1. User enters license key on `pricing.html` or in app settings
2. `js/pricing.js` POSTs `{ license_key, instance_id }` to `/api/validate`
3. `api/validate.js` (Vercel serverless) proxies to `https://api.lemonsqueezy.com/v1/licenses/validate`
4. On success: `fw_license_key`, `fw_plan` written to localStorage; user redirected to `/app`

**State Management:**
- App state: in-memory `S` (global) + persisted to IndexedDB (`finflow_v5` key)
- Auth state: `fw_signed_in`, `fw_license_key`, `fw_plan`, `fw_instance_id` in localStorage
- Session encryption: `_sessionKey` (AES-GCM CryptoKey) in module closure of `state.js` — never leaves the module
- Consent: `fw_cookie_consent` in localStorage (180-day TTL)
- UI state: CSS classes on `document.documentElement` (`auth-cloak`, `fw-authed`, dark mode class)

## Key Abstractions

**Template + Data → HTML (Build System):**
- Purpose: Produce SEO-optimised static HTML without a framework
- Examples: `scripts/templates/feature-page.html`, `scripts/data/feature-ai-coach.json` → `features/ai-coach.html`
- Pattern: `{{TOKEN}}` replaced from JSON data; `{{> partial}}` inlined from `scripts/partials/`; `{{BASE}}` computed from output depth

**Provider Plugin Registry:**
- Purpose: Decouple sync destinations from sync orchestration
- Examples: `js/providers/firebase.js`, `js/providers/gdrive.js`
- Pattern: Each provider calls `window.registerProvider('name', plugin)` on load; `sync.js` dispatches to registered plugins

**Auth Cloak:**
- Purpose: Prevent unauthenticated flash of dashboard content
- Location: `app.html` inline `<style>` + inline `<script>`
- Pattern: `html.auth-cloak body > :not(#auth-splash) { visibility: hidden }` — removed by `boot.js` after session confirmed

## Entry Points

**Marketing Home:**
- Location: `index.html`
- Triggers: Direct URL, SEO
- Responsibilities: Hero, features overview, social proof, CTA to `/signin#register`

**App Shell:**
- Location: `app.html`
- Triggers: Post-auth redirect, PWA launch (`start_url: /app` in `manifest.json`)
- Responsibilities: Full dashboard; loads all feature JS modules; registers service worker

**Sign In / Register:**
- Location: `signin.html`, `js/signin.js`
- Triggers: Nav CTA, auth-guard redirect from `app.html`
- Responsibilities: Firebase email/password + Google OAuth; license key capture; session cookie write

**Serverless API:**
- Location: `api/*.js`
- Triggers: HTTP POST from browser JS
- Responsibilities: License validate/activate/deactivate (LemonSqueezy proxy), contact form (email relay), admin operations

## PWA Setup

**Manifest:** `manifest.json`
- `start_url: /app`, `display: standalone`, `scope: /`
- Icons: 180/192/512px PNG + SVG maskable variants (`icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`)

**Service Worker:** `service-worker.js` (cache name `fincwin-v6`)
- Install: caches all app shell assets individually (failures silently skipped)
- Activate: purges old caches; posts `SW_UPDATED` message to all clients
- Fetch strategy:
  - App JS modules (`/js/*.js`, non-vendor): **network-first**, fallback to cache
  - Vendor JS + CSS + HTML + images: **cache-first**
  - `config.local.js`: always **network-first** (holds live Firebase credentials)
  - External APIs (Anthropic, OpenAI, Firebase, Google): **bypass** (never cached)

**Offline Capability:** Full offline operation for existing data; sync features degrade gracefully

## Architectural Constraints

- **No bundler:** All JS files are globals concatenated via `<script>` load order. Load order in `app.html` is critical: `crypto-core.js` → `constants.js` → `state.js` → feature modules → `boot.js` → `sync.js`
- **Global state:** `S` (app data), `CRYPTO` (crypto helpers), `launchConfetti`, `registerProvider`, `stopProvider`, and all feature functions are on `window`. Tight coupling between modules via globals.
- **Circular import risk:** All modules share the `window` namespace; there are no true ES modules in the app shell (vendor Firebase SDKs are the exception, loaded via dynamic `import()`)
- **Threading:** Single-threaded. Service worker runs in its own thread but communicates via `postMessage` only.
- **CSP:** Both dev server (`server.js`) and Vercel (`vercel.json`) enforce `script-src 'self'` — no inline scripts except those already in HTML files. No `unsafe-eval`.

## Anti-Patterns

### Global Namespace Pollution
**What happens:** All app module functions (`switchTab`, `openModal`, feature functions) are assigned directly to `window`  
**Why it's wrong:** Any two modules can accidentally shadow each other; no encapsulation; hard to trace call sites  
**Do this instead:** When refactoring, scope functions inside IIFE closures and expose only intentional public APIs (pattern already used in `crypto-core.js` and `mkt.js`)

### Script Load Order Dependency
**What happens:** `app.html` script tags must appear in a precise order for globals to be defined before consumers run  
**Why it's wrong:** Adding a new module requires knowing the dependency graph by convention, not tooling  
**Do this instead:** Long-term, migrate app shell to ES modules with `import`/`export` (noted in `crypto-core.js` comments as "FUTURE Tier 5")

## Error Handling

**Strategy:** Fail-soft with user-visible toasts for recoverable errors; hard exceptions surface to console

**Patterns:**
- Sync failures: caught in `sync.js` async functions; `showToast()` called with error message
- Service worker cache misses: `.catch(() => {})` swallows individual asset failures at install
- API calls: `try/catch` in all `api/*.js` handlers; structured JSON error responses with HTTP status codes
- Auth failures: Firebase error codes mapped to user-facing messages in `signin.js`

## Cross-Cutting Concerns

**Logging:** `console.log/warn/error` only; no structured logging framework  
**Validation:** Input validation in API handlers (`api/*.js`); client-side form validation in feature JS modules  
**Authentication:** Firebase Auth (email/password + Google OAuth) for cloud features; license key in localStorage gates Pro features; `noindex` on all authenticated pages  
**Analytics:** GA4 via `consent.js` — loaded only after user opts in; `FW_GA_ID` must be set via `window.FW_GA_ID` before `consent.js` loads

---

*Architecture analysis: 2026-06-10*
