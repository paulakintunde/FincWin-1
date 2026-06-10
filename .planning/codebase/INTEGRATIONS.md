# External Integrations

**Analysis Date:** 2026-06-10

## APIs & External Services

### Firebase (Google)

- **What it's used for:** Anonymous auth (automatic sign-in on first use), email/password account upgrade, Firestore document storage for end-to-end encrypted cloud sync
- **SDK/Client:** Firebase Web SDK v9 modular — vendored at `js/vendor/firebase/` (`firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js`)
- **Provider plugin:** `js/providers/firebase.js` — registers itself via `window.registerProvider('firebase', …)`
- **Auth:** Firebase project config injected via `window.__FINCWIN_CONFIG__` (`apiKey`, `authDomain`, `projectId`, etc.) from `js/config.local.js`
- **Data model:** One Firestore document per user at `users/{uid}` containing `ciphertext`, `salt`, `iv`, `lastModified`, `version`; secured by `firestore.rules` (owner-only read/write)
- **Live sync:** `onSnapshot` listener started after successful push; managed in `js/providers/firebase.js` (`startLiveSync` / `stopLiveSync`)

### Google Drive REST API v3

- **What it's used for:** Optional alternative cloud-sync backend; stores encrypted state blob in the user's Google Drive `appDataFolder`
- **SDK/Client:** Direct `fetch` calls to `https://www.googleapis.com/upload/drive/v3/files` and `https://www.googleapis.com/drive/v3/files` — no SDK
- **Auth:** Google Identity Services (GIS) — OAuth 2.0 implicit/token flow; GIS script loaded on demand from `https://accounts.google.com/gsi/client`
- **Provider plugin:** `js/providers/gdrive.js` — registers itself via `window.registerProvider('gdrive', …)`
- **Scope:** `https://www.googleapis.com/auth/drive.appdata` (sandboxed app folder only)
- **Config:** `googleClientId` field in `window.__FINCWIN_CONFIG__`
- **Notes:** Drive is a Pro-plan feature (`requirePlan('pro', …)` gate in `js/providers/gdrive.js`); token stored encrypted in IDB meta store

### Google Identity Services (GIS)

- **What it's used for:** OAuth 2.0 token client for Google Drive authentication; loaded lazily only when user initiates Drive connect
- **Endpoint:** `https://accounts.google.com/gsi/client` (dynamic `<script>` inject)
- **Usage:** `_loadGIS()` in `js/providers/gdrive.js`; also allowed in CSP `script-src-elem`

### Lemon Squeezy

- **What it's used for:** Payment processor and license-key management for Pro plan subscriptions (monthly $4.99 / annual $39)
- **API version:** `https://api.lemonsqueezy.com/v1/`
- **Endpoints used:**
  - `POST /v1/licenses/activate` — `api/activate.js`
  - `POST /v1/licenses/validate` — `api/validate.js`
  - `GET /v1/license-keys` + `GET /v1/orders` — `api/admin.js` (admin dashboard)
- **Auth:** `LEMON_SQUEEZY_API_KEY` env var (Vercel secret)
- **Notes:** All Lemon Squeezy calls are server-side (Vercel Serverless/Edge Functions); the API key is never exposed to the browser

### Resend

- **What it's used for:** Transactional email delivery for the contact form
- **Endpoint:** `POST https://api.resend.com/emails`
- **Implementation:** `api/contact.js` (Vercel Edge Function)
- **Auth:** `RESEND_API_KEY` env var (Vercel secret)
- **From address:** `contact@fincwin.com`
- **To address:** `freetinz@gmail.com`
- **Notes:** Contact form submissions are routed through this; the API key is server-side only

### Anthropic Claude API

- **What it's used for:** AI Coach feature — streaming chat responses analysing user financial data
- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Model:** `claude-sonnet-4-6` (primary); `claude-haiku-4-5-20251001` (connection test)
- **Implementation:** Called directly from the browser in `js/settings.js` (`coachAsk` function) — the Anthropic API key is stored client-side in localStorage by the user
- **Auth:** User-supplied API key stored in `localStorage` under a FincWin key; never transmitted to the FincWin backend
- **Notes:** Pro-plan feature; rate-limited client-side (cooldown enforced in `settings.js`); streaming via SSE

### OpenAI API

- **What it's used for:** Alternative AI Coach backend (user choice — Claude or GPT)
- **Endpoint:** `https://api.openai.com/v1/chat/completions`
- **Models:** `gpt-4o` (primary), `gpt-4o-mini` (connection test)
- **Implementation:** Same `coachAsk` function in `js/settings.js`; toggled by user AI provider selection
- **Auth:** User-supplied API key, same pattern as Anthropic

### Open Exchange Rates API (open.er-api.com)

- **What it's used for:** Live multi-currency FX rates for converting foreign-currency expenses to the user's home currency
- **Endpoint:** `GET https://open.er-api.com/v6/latest/{baseCurrency}`
- **Implementation:** `js/fx.js` — fetches once per session, caches in `sessionStorage` with 1-hour TTL
- **Auth:** No API key required (free tier of open.er-api.com)

## Data Storage

### Firestore (Firebase)

- **Type:** NoSQL document database (Google Cloud)
- **Connection:** Firebase config via `window.__FINCWIN_CONFIG__` (`projectId`)
- **Client:** Firebase Web SDK (vendored) in `js/providers/firebase.js`
- **Schema:** `users/{uid}` → `{ciphertext, salt, iv, lastModified, version}`
- **Rules file:** `firestore.rules` (owner-only access)

### IndexedDB (Browser)

- **Type:** Local browser storage — primary persistence layer
- **What it stores:** Encrypted app state blob (keyed by a session storage key `SK`), IDB meta store for sync handles and tokens
- **Implementation:** `js/state.js` (`idbSet` / `idbGet`); meta store raw access via `_idbGetRaw` / `_idbSetRaw` in `js/sync.js`
- **Notes:** App is fully offline-capable via IDB + Service Worker; Firestore/Drive are optional sync targets

### localStorage (Browser)

- **What it stores:** Theme preferences (`fincwin_design`, `fintone_theme`), dark mode flag, AI provider selection, user-supplied AI API keys, sign-in state flag (`fw_signed_in`), cookie consent choice (`fw_cookie_consent`), collapsed UI state

### sessionStorage (Browser)

- **What it stores:** FX rate cache (`finflow_fx_rates`), XP award dedup keys per session

### File System Access API

- **What it stores:** Optional local file sync — user can choose a local `.json` file as sync target
- **Implementation:** `js/sync.js`; file handle persisted in IDB meta store (`fincwin_fs_handle`)

## Authentication & Identity

### Firebase Authentication

- **Approach:** Anonymous auth by default (automatic, no sign-up required); upgradeable to email/password via `linkAnonymousToEmail` in `js/providers/firebase.js`
- **Flow:** `signInAnonymously` on first cloud sync → uid used as Firestore document key → optional upgrade to permanent account
- **Implementation:** `js/providers/firebase.js`, account management in `js/account.js`

### PIN-based At-Rest Encryption

- **Approach:** User-defined PIN → PBKDF2 → AES-GCM-256 session key; all app data encrypted at rest in IDB
- **Implementation:** `js/crypto-core.js` (key derivation primitives), `js/state.js` (IDB encryption), `js/sync.js` (cloud envelope)

## Monitoring & Observability

### Google Analytics 4 (GA4)

- **What it's used for:** Optional web analytics (consent-gated)
- **Implementation:** `js/consent.js` — loads `https://www.googletagmanager.com/gtag/js` only after the user grants analytics consent (GDPR/PECR compliant)
- **Config:** `window.FW_GA_ID` — GA4 Measurement ID; left empty in current build (no hardcoded ID found), meaning GA is disabled unless `FW_GA_ID` is defined before `consent.js` loads
- **Notes:** Consent banner is self-contained in `js/consent.js`; choice persists 180 days

### Error Tracking

- None detected — no Sentry, Bugsnag, or similar integration

### Logging

- `console.error` / `console.warn` with `[module]` prefixes (e.g. `[sync]`, `[gdrive]`, `[FX]`) — browser DevTools only; no remote log shipping

## CI/CD & Deployment

### Vercel

- **Hosting:** Static site deployment
- **Edge Functions:** `/api/*.js` routes run as Vercel Edge Functions (`export const config = { runtime: 'edge' }` in `api/contact.js`)
- **Serverless Functions:** `api/activate.js`, `api/validate.js`, `api/admin.js` — standard Vercel serverless (no `runtime: 'edge'` export)
- **Config:** `vercel.json` — URL rewrites, clean URLs, security headers, cache control, CORS
- **Install command:** `npm install --omit=dev`

### GitHub Actions (inferred)

- Not present in the repo directly, but `js/config.example.js` documents that the CI workflow writes `js/config.local.js` from repo secrets

## Webhooks & Callbacks

### Incoming

- None detected — no webhook receiver endpoints

### Outgoing

- None detected — no outbound webhook dispatch

## Environment Variables Required

| Variable | Used by | Purpose |
|---|---|---|
| `RESEND_API_KEY` | `api/contact.js` | Contact form email delivery |
| `LEMON_SQUEEZY_API_KEY` | `api/activate.js`, `api/validate.js`, `api/admin.js` | License activation/validation and admin dashboard |
| `ADMIN_TOKEN` | `api/admin.js` | Bearer token protecting the admin API route |

Firebase config (`apiKey`, `authDomain`, `projectId`, etc.) and `googleClientId` are injected at build time into `js/config.local.js` from repo secrets — not stored as Vercel env vars.

---

*Integration audit: 2026-06-10*
