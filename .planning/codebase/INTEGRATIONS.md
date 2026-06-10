# Integrations

**Analysis Date:** 2026-06-10

## External APIs

**Lemon Squeezy (licence management):**
- Used for: licence key activation, deactivation, and validation
- Endpoints called: `https://api.lemonsqueezy.com/v1/licenses/activate`, `/validate`, `/deactivate`
- Called from: `api/activate.js`, `api/validate.js`, `api/deactivate.js` (server-side only)
- Auth: `LEMON_SQUEEZY_API_KEY` — Vercel environment variable, never exposed to browser

**Anthropic Claude API (AI Coach):**
- Used for: AI financial coaching feature (Pro tier)
- Endpoint: `https://api.anthropic.com` (present in CSP `connect-src`)
- Called from: `js/settings.js` and related AI modules (user supplies their own API key, stored encrypted in IDB)
- Auth: user-supplied Claude API key, stored in encrypted IndexedDB via `js/crypto-core.js`

**OpenAI API (AI Coach, alternative provider):**
- Used for: AI financial coaching as an alternative to Claude
- Endpoint: `https://api.openai.com` (present in CSP `connect-src`)
- Called from: `js/settings.js` / AI modules (user supplies their own API key)
- Auth: user-supplied OpenAI key, stored encrypted in IDB

**Open Exchange Rates (FX):**
- Used for: live multi-currency exchange rate lookups
- Endpoint: `https://open.er-api.com/v6/latest/{base}` — public, no API key
- Called from: `js/fx.js`
- Caching: 1-hour sessionStorage cache (`finflow_fx_rates`)

**Resend (transactional email):**
- Used for: contact form email delivery
- Endpoint: `https://api.resend.com/emails`
- Called from: `api/contact.js` (server-side Edge function only)
- Auth: `RESEND_API_KEY` — Vercel environment variable
- From address: `contact@fincwin.com`; delivers to `freetinz@gmail.com`

**Google Drive REST API v3:**
- Used for: optional encrypted cloud backup/sync of user state
- Endpoints: `https://www.googleapis.com/upload/drive/v3/files` (create/update), `https://www.googleapis.com/drive/v3/files` (list/get)
- Called from: `js/providers/gdrive.js` (browser-side, gated behind user OAuth consent)
- Auth: OAuth 2.0 token obtained via Google Identity Services (GIS); token stored in IDB only, never in `S` state or localStorage
- Scope: `https://www.googleapis.com/auth/drive.appdata` (hidden app-data folder only)

## Authentication Providers

**Firebase Authentication:**
- Provider: Google Firebase Auth (modular SDK, vendored at `js/vendor/firebase/`)
- Methods: email/password (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`), password reset, anonymous → linked account upgrade
- Project: `fincwin` (`fincwin.firebaseapp.com`)
- Config: `window.__FINCWIN_CONFIG__` in `js/config.local.js` (public identifiers — not secrets)
- Used in: `js/signin.js`, `js/boot.js` (`_awaitFirebaseUser`), `js/providers/firebase.js`
- Free tier access guard: app requires a Firebase session OR a valid licence key; unauthenticated users are redirected to `signin.html`

**Google Identity Services (GIS) for Drive OAuth:**
- Script loaded lazily: `https://accounts.google.com/gsi/client` (injected by `js/providers/gdrive.js`)
- OAuth 2.0 token client for Drive scope
- `googleClientId` configured in `js/config.local.js`

## Payment Processors

**Lemon Squeezy:**
- Role: sole payment processor / licence management platform
- Integration type: server-side API only (no Lemon Squeezy JS SDK in the browser)
- Pricing: Free tier (no key), Pro ($39/yr), Lifetime ($149) — key format `XXXX-XXXX-XXXX-XXXX` (16 chars)
- Licence flow: user enters key on `signin.html#activate` → `api/activate.js` → Lemon Squeezy → result stored in localStorage + Firestore
- Background revalidation: `_revalidateLicence()` in `js/boot.js` calls `api/validate.js` on each app load; fail-open on network errors

## Analytics & Monitoring

**Google Analytics 4 (GA4):**
- Loaded conditionally via `js/consent.js` — only after visitor grants analytics consent (GDPR/PECR compliant, opt-in)
- GA Measurement ID: configured via `window.FW_GA_ID` (set per-page before `consent.js` loads); not hardcoded in the script itself
- Script source: `https://www.googletagmanager.com/gtag/js?id=...`
- `anonymize_ip: true` is set on load
- No GA tag present in HTML if `FW_GA_ID` is empty — analytics is entirely disabled until the ID is configured

**Error tracking:** none detected (no Sentry, Datadog, Bugsnag, or similar)

**Logging:** browser `console.warn` / `console.error` only; no server-side structured logging service detected

## Storage & Database

**Firebase Firestore:**
- Used for: storing per-user licence key, instance ID, plan, and profile after activation; also used to restore licence on new device sign-in
- Rules: `firestore.rules` — each user can read/write only their own document (`/users/{userId}`); all other paths denied
- SDK: vendored at `js/vendor/firebase/firebase-firestore.js`
- Accessed from: `js/signin.js`, `js/providers/firebase.js`

**Google Drive (appDataFolder):**
- Used for: optional encrypted full-state backup (hidden app-data folder, not visible to user in Drive UI)
- File: `fincwin-state.enc` — AES-GCM encrypted JSON blob
- Provider plugin: `js/providers/gdrive.js`

**IndexedDB (browser-local):**
- Primary data store for all budget/expense/loan/savings state
- AES-GCM-256 encrypted at rest using a PIN-derived key (PBKDF2, 600k iterations)
- Managed in `js/state.js`; opened via `openIDB()`

**File System Access API (browser-local):**
- Optional local file backup — user can persist state to a local `.json` file
- Handle persisted in IDB `meta` store; managed in `js/sync.js`

## Communication Services

**Resend:**
- Purpose: contact form email delivery (inbound customer messages)
- Used in: `api/contact.js` (Edge function)
- No outbound marketing email or transactional user notifications detected beyond this single endpoint

**Web Push / browser notifications:**
- Budget threshold alerts via the browser Notifications API (`checkBudgetThresholds()` in `js/boot.js`)
- No third-party push service (no Firebase Cloud Messaging, OneSignal, etc.) — native browser API only

**Google Fonts:**
- CDN: `https://fonts.googleapis.com` / `https://fonts.gstatic.com`
- Fonts: Hanken Grotesk (200–600), Instrument Serif (italic) — loaded in marketing pages
- Not loaded in the app shell (`app.html`) — fonts are self-hosted or system-fallback there

## Environment Variables (Vercel)

| Variable | Used in | Purpose |
|---|---|---|
| `LEMON_SQUEEZY_API_KEY` | `api/activate.js`, `api/validate.js`, `api/deactivate.js` | Licence API auth |
| `RESEND_API_KEY` | `api/contact.js` | Contact form email relay |
| `ADMIN_TOKEN` | `api/admin.js` | Admin endpoint gate |

Firebase config (`apiKey`, `authDomain`, `projectId`, etc.) and `googleClientId` are public identifiers committed directly to `js/config.local.js` — not secrets, access is enforced by Firestore rules and OAuth authorized origins.

---

*Integration audit: 2026-06-10*
