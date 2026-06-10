# Codebase Concerns

**Analysis Date:** 2026-06-10

---

## Critical Issues

**Firebase config committed to git with real production values:**
- Issue: `js/config.local.js` is intentionally committed and contains the live Firebase `apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`, and `googleClientId` for the `fincwin` Firebase project. The file's comment correctly explains these are public identifiers, not secrets, and that security is enforced by Firestore rules and OAuth authorized-origins — this is the documented Firebase pattern.
- Files: `js/config.local.js`
- Risk: Low for a correctly-configured Firebase project, but any misconfiguration of Firestore rules would expose all user data to anyone with the project ID. The rules must always match `firestore.rules` exactly in the live project.
- Mitigation: `firestore.rules` correctly restricts access to `request.auth.uid == userId`. Deploy rules must be verified on every Firebase project change.

**`api/deactivate.js` has no rate limiting:**
- Issue: `api/activate.js` enforces 10 requests/IP/60s and `api/validate.js` enforces 30/min, but `api/deactivate.js` has zero rate limiting — anyone can flood licence deactivation requests.
- Files: `api/deactivate.js`
- Impact: A malicious user could repeatedly deactivate a victim's licence instance, preventing them from using the app.
- Fix: Add the same `checkRateLimit` guard used in `api/activate.js` (5–10 req/min is sufficient).

---

## Security Concerns

**In-memory rate limits reset on every cold start (all API endpoints):**
- Risk: Vercel serverless functions spin up fresh instances under load. The `_rateMap = new Map()` in `api/activate.js`, `api/validate.js`, and `api/admin.js` is per-warm-instance, not cross-instance. Under parallel cold starts, the rate limit is effectively bypassed.
- Files: `api/activate.js`, `api/validate.js`, `api/admin.js`
- Current mitigation: The code itself documents this: `// For cross-cold-start enforcement, replace with an Upstash/Redis counter.`
- Fix approach: Replace `_rateMap` with an Upstash Redis counter (one `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env var each). The pattern is already described in the code comments.

**`style-src 'unsafe-inline'` in CSP:**
- Risk: The `Content-Security-Policy` in `vercel.json` uses `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`. This weakens CSS injection protection — an XSS vector that bypasses `script-src 'self'` via style injection (CSS exfiltration, content spoofing) remains viable.
- Files: `vercel.json` line 36
- Current mitigation: `script-src` is strict (`'self'` only), so arbitrary code execution via XSS is blocked.
- Fix approach: Audit all inline `style=""` attributes and move them to external classes; replace `'unsafe-inline'` with a CSP nonce or hash.

**PBKDF2 legacy 210k-iteration key derivation still in use:**
- Risk: `js/crypto-core.js` keeps `PBKDF2_ITERS = 210000` for backward compatibility with v1 encrypted data. The v2 path uses 600k iterations (OWASP 2023 guidance). Users who set their PIN before the v2 upgrade still have data protected by the weaker key.
- Files: `js/crypto-core.js` lines 19, 49
- Impact: Weaker brute-force resistance for legacy users who have never changed their PIN.
- Fix approach: On next successful PIN unlock with a v1 key, transparently re-derive and re-encrypt with v2 key (migrate-on-unlock pattern). Requires a version flag in the IDB meta store.

**Upgrade wall hardcodes price ($39/yr):**
- Risk: The upgrade wall modal in `js/state.js` (line 740) hardcodes `"Upgrade to Pro — $39/yr →"`. If pricing changes, users see stale pricing until state.js is manually updated.
- Files: `js/state.js` line 740
- Fix approach: Read the price from a central constant or the pricing.html data, or remove the price from the CTA label.

**Personal email address in production API code:**
- Risk: `api/contact.js` has `to: ['freetinz@gmail.com']` — a personal Gmail address receiving all contact-form submissions. This is the documented current state (see `PRODUCTION-SETUP.md` Phase 0 checklist).
- Files: `api/contact.js` line 66
- Fix approach: Route to a domain-verified inbox (`support@fincwin.com`) to avoid Gmail deliverability limits and to match the brand domain.

**Licence key stored in `localStorage` is readable by any same-origin JS:**
- Risk: `localStorage.getItem('fw_license_key')` is accessible to all scripts on the origin. The key itself is the access credential for the Pro tier. Any future XSS vulnerability would expose it.
- Files: `js/state.js` function `getPlan()` line 707
- Current mitigation: Strong CSP `script-src 'self'` blocks third-party script injection.

---

## Performance Concerns

**`js/state.js` is 1,846 lines — the largest file in the project:**
- Problem: Single monolithic state module combines IDB storage, encryption, PIN management, plan gating, BroadcastChannel sync, and undo logic.
- Files: `js/state.js`
- Impact: Hard to tree-shake; all features load even when unused. Any parse error in the file breaks the entire app.
- Improvement path: Extract PIN/lock logic, plan gating, and crypto wrappers into separate files. The code already has a `// FUTURE (Tier 5): when converting to ES6 modules` comment acknowledging this.

**`js/boot.js` is 1,294 lines and includes both UI logic and PWA registration:**
- Problem: Boot file mixes confetti engine, navigation, envelope budget rendering, PWA install prompt, swipe navigation, keyboard shortcuts, online/offline detection, and the main `boot()` async function.
- Files: `js/boot.js`
- Impact: Any render error in one section (e.g., envelope grid) risks crashing the entire boot sequence since it runs in a single IIFE context.
- Improvement path: Extract confetti, PWA prompt, and swipe nav into separate files. The rest of the `boot()` function benefits from being explicit.

**Service worker cache list is manually maintained:**
- Problem: `service-worker.js` has a hardcoded `ASSETS` array listing every file to precache. The cache version string (`fincwin-v6`) must be manually bumped on every deploy. A mismatch means stale JS/CSS is served to PWA users.
- Files: `service-worker.js` line 3
- Impact: Developers who forget to bump `CACHE` ship invisible regressions to installed PWA users.
- Improvement path: Generate the ASSETS list and version hash from `scripts/build-all.js` as part of `npm run build:pages`.

**JS and CSS assets are not content-hashed:**
- Problem: `/js` and `/styles` cache for 1 hour with `stale-while-revalidate`. Files like `mkt.js`, `boot.js`, and `base.css` use static names — a 1-hour stale window means users may see old code after a deploy.
- Files: `vercel.json` lines 54–61; `DEPLOY.md` ("If you ever fingerprint assets…")
- Impact: Users on mobile or slow connections may get stale JS for up to 1 hour.
- Improvement path: Content-hash filenames via `scripts/build-all.js` (already mentioned in `DEPLOY.md`); switch cache to `immutable, max-age=31536000`.

---

## Scalability Concerns

**All user financial data lives in one Firestore document per user:**
- Problem: Cloud sync writes the entire encrypted state blob to a single Firestore document at `/users/{uid}`. There is no pagination or partial update — every save overwrites the entire document.
- Files: `js/providers/firebase.js`
- Limit: Firestore has a 1MB document size limit. A user with many months/transactions could hit this.
- Scaling path: Partition data by year or by month into sub-collections; implement partial/incremental sync.

**Category keyword matching is O(n×m) on every expense item:**
- Problem: `getCat()` in `js/constants.js` iterates over all entries in `CAT_MAP`, then all user keywords in `S.categoryKeywords`, on every expense item lookup. With a large transaction import, this runs thousands of times synchronously.
- Files: `js/constants.js` function `getCat()` line 76
- Scaling path: Build an inverted keyword → category index on first load; invalidate on settings save.

---

## Maintainability Issues

**169 `innerHTML` assignments spread across 13+ JS files:**
- Issue: The project uses `innerHTML` extensively for rendering. A `safeHTML` tagged template and `esc()` helper exist in `js/constants.js` but are not uniformly applied. Some `innerHTML` template literals mix `esc()` calls with raw interpolations (e.g., `js/analytics.js` line 95-96 inlines month keys from `S.months` which are user-controlled strings).
- Files: `js/analytics.js`, `js/boot.js`, `js/modals.js` (most heavily)
- Risk: Inconsistent escaping increases the surface area for future XSS bugs when code is modified.
- Fix approach: Establish a convention that all `innerHTML` template literals use `safeHTML` or `esc()` for every interpolated value; add a lint rule.

**All JS loaded as classic (non-module) scripts:**
- Issue: Every `.js` file in `/js` uses `'use strict'` but not `type="module"`. All state is on `window`. The comment in `js/crypto-core.js` line 15 acknowledges this: `// FUTURE (Tier 5): when converting to ES6 modules`.
- Files: All of `js/`
- Impact: No tree-shaking, no import isolation, no dead code elimination. Every file pollutes the global scope. Naming collisions are a latent risk as the codebase grows.

**`js/state.js` mixes storage, encryption, PIN, plan-gating, and undo into one file:**
- Issue: 1,846 lines in a single file handles fundamentally distinct concerns. Tracking which section a given function belongs to requires reading the whole file.
- Files: `js/state.js`
- Fix approach: Start extraction with plan-gating (`getPlan`, `requirePlan`, `_showUpgradeWall`) as a standalone `js/tier.js`; then extract PIN/lock logic.

**Committed marketing HTML is generated but also manually editable:**
- Issue: `scripts/build-all.js` generates marketing pages from templates, but the output HTML is committed to git. Developers can accidentally hand-edit a generated file — the next `npm run build:pages` silently overwrites it.
- Files: `scripts/build-all.js`, all HTML files in root and `compare/`, `features/`, `use-cases/`
- Fix approach: Add a generator comment header to each generated file; `build-all.js` should detect and warn on uncommitted hand-edits.

---

## Dependency Risks

**Vendored Firebase SDK (no version pinning):**
- Risk: Firebase SDK files in `js/vendor/firebase/` are hand-copied and not version-pinned by `package.json`. If the SDK is updated manually, there is no record of which version is in use.
- Files: `js/vendor/firebase/firebase-app.js`, `js/vendor/firebase/firebase-auth.js`, `js/vendor/firebase/firebase-firestore.js`
- Impact: Security patches or API changes in Firebase SDK require manual file replacement; no automated update path exists.

**`js/vendor/chart.min.js` has no version record:**
- Risk: Chart.js is vendored as a minified file with no version number in the filename or in `package.json`.
- Files: `js/vendor/chart.min.js`
- Impact: Unknown version means no way to check CVEs or whether a newer version is needed.

**No runtime dependencies in `package.json`:**
- Note: The zero-dependency API approach is by design (documented in `DEPLOY.md`). However, it means no `npm audit` can catch vulnerabilities in API code that manually implements patterns (rate limiting, validation) that libraries would provide with better coverage.

---

## Missing Functionality

**WebAuthn / biometric unlock is a stub:**
- Issue: `js/state.js` line 1442 has `if(key==='bio'){ /* future: WebAuthn */ return; }`. The biometric unlock button in the lock screen UI calls `lockKeyPress('bio')` but does nothing.
- Files: `js/state.js` line 1442
- Impact: Users who see a biometric button in the UI expect it to work. This is a silent no-op.

**Cross-cold-start rate limiting is unimplemented:**
- Issue: All three API endpoints document the gap: `// For cross-cold-start enforcement, replace with an Upstash/Redis counter.`
- Files: `api/activate.js` line 2
- Impact: Under load (or intentional abuse), rate limits do not hold across parallel serverless instances.

**Google Drive OAuth consent screen is in "Testing" mode by default:**
- Issue: `PRODUCTION-SETUP.md` Phase 6.1 notes that Drive's sensitive `drive.appdata` scope requires Google verification to open to the general public. Until submitted and approved, Drive sync only works for manually added test users.
- Files: Deployment configuration, not code
- Impact: Drive sync is gated behind OAuth verification — any user who is not a manually-added test user will be blocked by Google's consent screen.

---

## Operational Concerns

**Service worker cache version requires manual bump on every deploy:**
- Issue: `CACHE = 'fincwin-v6'` in `service-worker.js` must be manually incremented. There is no automated mechanism — the pre-deploy checklist in `DEPLOY.md` does not explicitly include this step.
- Files: `service-worker.js` line 3
- Risk: Deploying changed JS without bumping the cache version means PWA users silently run stale code until they manually clear the cache.

**No error monitoring or alerting configured:**
- Issue: No Sentry, Datadog, or equivalent error tracking is integrated. API errors are logged only to Vercel's function logs (requires login to observe). Client-side errors are silent unless the user opens DevTools.
- Impact: Production bugs and API failures are invisible until a user reports them.
- Fix approach: Add Sentry (or a free-tier equivalent) to the `/api` functions; add `window.onerror` reporting on the client side.

**No database backup strategy for Firestore:**
- Issue: User data synced to Firestore has no automated export or backup schedule configured in the codebase or documentation.
- Impact: A Firestore misconfiguration, accidental rule change, or Google account issue could result in irreversible data loss for synced users.
- Fix approach: Enable Firestore scheduled exports to Google Cloud Storage (free tier for small datasets); document the restore procedure.

**Lost sync passphrase = unrecoverable cloud data (documented but no mitigation):**
- Issue: `PRODUCTION-SETUP.md` acknowledges this: `"Lost passphrase = unrecoverable cloud data."` There is a recovery-KEK mechanism in `crypto-core.js` but it requires the user to have set a recovery passphrase in addition to their PIN.
- Files: `js/crypto-core.js`, `js/state.js`
- Impact: Users who lose their passphrase and have no local backup lose all synced data permanently.
- Mitigation needed: Prompt users to export a JSON backup at regular intervals; show a persistent warning when cloud sync is enabled but no backup has been exported in >30 days.

**`INTEGRATION.md` was deleted (references remain in `PRODUCTION-SETUP.md`):**
- Issue: `PRODUCTION-SETUP.md` Phase 3.3 references `[INTEGRATION.md](INTEGRATION.md) §4 for the full flow` — but the git status shows `INTEGRATION.md` was deleted (`D INTEGRATION.md`).
- Files: `PRODUCTION-SETUP.md` line referring to INTEGRATION.md
- Impact: The cross-reference is broken; developers following the setup guide will hit a 404.

---

*Concerns audit: 2026-06-10*
