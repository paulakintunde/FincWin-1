# Codebase Concerns

**Analysis Date:** 2026-06-10

---

## 1. Security

### CSP Violation: Inline `<script>` Blocks Across All Pages [HIGH]
- **Issue:** `vercel.json` sets `script-src 'self'` with no `'unsafe-inline'` and `script-src-attr 'none'`. However, 84 inline `<script>` blocks exist across HTML files. Notable examples:
  - `app.html` line 48: auth-cloak inline script (runs before deferred scripts load — intentional, but blocked by CSP)
  - `app.html` line 593: `onclick="window.open(...)"` on mobile menu Help button
  - `app.html` line 1549: `onchange="saveAutoLockMins(this.value)"` on auto-lock select
  - `blog/index.html` line 93: `onclick="filterCat('all')"` on category filter button
  - All 20 blog posts: inline scroll handler `const nav=document.getElementById('mainNav'); window.addEventListener('scroll',…)`
- **Impact:** These handlers are silently blocked in browsers that honour the CSP header. The auth cloak in `app.html` fails, the Help button in the mobile menu does nothing, the auto-lock setting cannot be changed, and blog category filtering breaks.
- **Fix:** Move inline handlers to the appropriate external JS file (`mkt.js` for marketing, `boot.js`/`events.js` for app). The auth-cloak script can use a `nonce` attribute (requires Vercel Edge middleware to inject it).

### In-Memory Rate Limiting Resets on Cold Starts [MEDIUM]
- **Files:** `api/activate.js`, `api/validate.js`, `api/admin.js`
- **Issue:** All three API endpoints use a module-level `Map()` for rate limiting. Vercel Serverless functions are stateless — the map is wiped on every cold start. A burst of requests spread across multiple function instances bypasses the limit entirely.
- **Impact:** Licence activation and validation endpoints can be hammered; admin brute-force window is wider than intended.
- **Fix:** Replace the in-memory map with Upstash Redis or Vercel KV for persistent cross-instance rate limiting. The code comments already acknowledge this gap (`// For cross-cold-start enforcement, replace with an Upstash/Redis counter`).

### Contact API Has No Origin/CSRF Check [MEDIUM]
- **File:** `api/contact.js`
- **Issue:** The edge function validates input but does not verify the `Origin` or `Referer` header. While the Vercel-level CORS header restricts `Access-Control-Allow-Origin` to `https://www.fincwin.com`, this only blocks cross-origin *browser* `fetch` calls — it does not prevent direct `curl`/bot submissions from any origin.
- **Impact:** The contact form can be used as a spam relay. There is no rate limit on this endpoint either.
- **Fix:** Add an `Origin` header check inside the handler and add per-IP rate limiting consistent with the other API endpoints.

### `config.local.js` Is Intentionally Committed with Live Firebase Keys [LOW — acknowledged]
- **File:** `js/config.local.js`
- **Issue:** Firebase API key, project ID, app ID, and Google OAuth client ID are committed to the repo. The comment explains this is intentional for a no-build static deployment and that these are public identifiers.
- **Risk:** If `firestore.rules` is ever loosened (e.g., during debugging), the committed keys make exploitation trivial. The current rules are correctly locked (`allow read, write: if request.auth.uid == userId`).
- **Recommendation:** Add a CI check that fails if `firestore.rules` ever contains `allow read, write: if true`.

### Admin Title Has UTF-8 BOM Encoding Artefact [LOW]
- **File:** `admin.html`
- **Issue:** The file was saved with a UTF-8 BOM. The title reads `Admin â€" FincWin` in source (mojibake for an em-dash) and the `placeholder` attributes on lines 248 and 367 contain garbage characters (`â€¢` for bullet, `â€¦` for ellipsis). Browsers render it correctly, but the raw HTML source is corrupted.
- **Fix:** Re-save `admin.html` as UTF-8 without BOM and replace the literal unicode bullets/ellipses with proper HTML entities or their correct UTF-8 codepoints.

---

## 2. SEO / Crawlability

### `robots.txt` Disallows `.html` Extension URLs; Sitemap Uses Clean URLs [HIGH]
- **Files:** `robots.txt`, `sitemap.xml`
- **Issue:** `robots.txt` lists `Disallow: /cat-housing.html` (with `.html`). Vercel's `cleanUrls: true` means the public URLs are `/cat-housing` (no extension). Googlebot follows the clean URL, which is not disallowed — the `.html` disallow rule is a no-op. Separately, `sitemap.xml` *includes* all 14 `cat-*` pages with priority 0.7, while `robots.txt` was apparently meant to exclude them.
- **Impact:** The pages are indexed (or not) based on their on-page `<meta name="robots" content="index, follow">` tag, which says index them — the `robots.txt` intent is ignored. This is a contradictory and confusing state: if these pages should be indexed, remove them from `robots.txt`; if they should not be indexed, add the correct clean-URL paths and add `noindex` meta tags.
- **Fix:** Decide on intent. If indexable (they have unique SEO content and canonical tags): remove from `robots.txt`. If not: update `robots.txt` to use `/cat-housing` (no `.html`), remove from `sitemap.xml`, and add `noindex` meta.

### Blog Post Pages Have No Route in `vercel.json` Rewrites [MEDIUM]
- **Files:** `vercel.json`, `blog/posts/*.html`
- **Issue:** `vercel.json` has an explicit rewrite for `/blog/:category` → `blog/:category/index.html` but no rewrite for `/blog/posts/:slug`. The 20 blog post pages rely entirely on Vercel's `cleanUrls: true` to strip `.html`. This works, but if Vercel ever changes its `cleanUrls` behaviour, or if the site is moved to another host, all blog post URLs would break.
- **Impact:** Low immediate risk, but fragile. Also, the sitemap lists `/blog/posts/ynab-alternative` which now 301-redirects to `/compare/ynab-alternative` — the old canonical is still in `sitemap.xml` as the redirect source rather than the new target.
- **Fix:** Either add explicit rewrites for blog posts, or at minimum update the sitemap to replace the ynab-alternative blog entry with the compare page entry (the current entry just creates a needless redirect crawl step).

### `og:image`, `og:description`, and Twitter Card Tags Missing from Legal/Auth Pages [LOW]
- **Files:** `privacy.html`, `terms.html`, `cookie-policy.html`, `account.html`, `signin.html`, `404.html`, `admin.html`
- **Issue:** Seven pages have no Open Graph or Twitter Card tags. These pages will show a blank or auto-generated preview when shared.
- **Impact:** Minor for legal/auth pages, but `privacy.html` and `terms.html` are occasionally linked from external sources.
- **Fix:** Add at minimum `og:title`, `og:description`, and `og:image` using the default `og-image.png` to these pages.

### `admin.html` Missing Canonical Tag [LOW]
- **File:** `admin.html`
- **Issue:** `admin.html` has `noindex, nofollow` but no canonical tag. While noindex prevents indexing, a canonical is good hygiene in case the no-index is ever removed or the page is referenced from another domain.

---

## 3. Branding Remnants / Inconsistencies

### localStorage Keys Still Use `finflow_*` Prefix from Original Brand [MEDIUM]
- **Files:** `js/constants.js` (line 4: `const SK='finflow_v5'`), `js/boot.js` (lines 880–919: `finflow_session_count`, `finflow_install_banner_dismissed`), `js/onboarding.js`, `js/settings.js`, `js/fx.js`, `js/demo-profiles.js`, `js/state.js`
- **Issue:** The product has been through two rebrands (Freetinz → FincWin). The primary data storage key `finflow_v5` still references the original brand name. Mixed namespace: some newer keys use `fincwin_*` (e.g. `fincwin_design`, `fincwin_coach_collapsed`, encryption keys in `state.js`) while older keys remain `finflow_*`.
- **Impact:** No user-facing bug since keys are consistent within the codebase, but a future developer could add a key with the wrong prefix and create a namespace clash. If a proper migration to `fincwin_*` is ever attempted, the `finflow_*` keys become orphaned garbage in users' storage.
- **Fix:** Create a storage migration function (or append to the existing IDB migration in `state.js` line 199) that reads old `finflow_*` keys, writes them under `fincwin_*` names, and deletes the old keys. Then standardise all new keys to `fincwin_*`.

### Contact Email Still Routes to `freetinz@gmail.com` (Old Brand Inbox) [LOW]
- **File:** `api/contact.js` line 66
- **Issue:** The `to` field in the Resend API call is hardcoded as `freetinz@gmail.com`. The `from` is correctly `contact@fincwin.com`, creating a mismatched sender/recipient for the business.
- **Impact:** Contact form messages arrive in the old brand's Gmail. If that inbox is abandoned, contact submissions are lost.
- **Fix:** Update `to` to the appropriate `@fincwin.com` address, or move the destination to a `CONTACT_TO_EMAIL` environment variable so it can be changed without a code deploy.

### `package-lock.json` `name` Field Uses Old Brand [LOW]
- **File:** `package-lock.json` line 2: `"name": "freetinz-stack"`
- **Issue:** Minor cosmetic inconsistency. Not user-visible.
- **Fix:** Update `package.json` `name` field to `fincwin` and regenerate the lock file.

---

## 4. Technical Debt

### `app.html` Is a 2,765-Line Monolith [MEDIUM]
- **File:** `app.html`
- **Issue:** The entire application shell — 25+ modal dialogs, the onboarding wizard, all section markup, all inline styles for the hero and dark theme — is in a single HTML file of 2,765 lines, loading 30 deferred script tags.
- **Impact:** Difficult to maintain. Adding a new modal requires editing a file where one wrong change (a missing `</div>`, a broken `data-action` attribute) can silently break the entire app. No partial reloads or component isolation.
- **Fix (incremental):** Extract modal HTML into JS-rendered templates (as `boot.js` partially already does), or adopt a minimal template-injection pattern for modals. At minimum, move per-section inline `<style>` blocks to `components.css`.

### Pricing Is Hardcoded in 96 Places Across HTML [MEDIUM]
- **Files:** Multiple HTML and JS files
- **Issue:** `$39`, `$149`, `$4.99` appear hardcoded in page titles, meta descriptions, OG tags, inline JS (in `pricing.js`), and body copy across at least 96 tag instances. The `pricing.js` script sets button text like `'Get Pro — $39/yr'` as a string literal.
- **Impact:** A price change requires a global find-and-replace across HTML, meta tags, JS strings, and JSON-LD — with high risk of missing an occurrence. The title tag of `pricing.html` (`FincWin Pricing — Free, Pro $39/yr, Lifetime $149 · YNAB Alternative`) would need manual updating.
- **Fix:** Define pricing constants in one place (e.g., a `js/pricing-config.js` file) and render all price displays from that. For static meta tags, use the build script (`scripts/build-all.js`) to inject values from a single source.

### `investments.js` Not Pre-Cached by Service Worker [MEDIUM]
- **Files:** `service-worker.js` (ASSETS array), `js/investments.js`
- **Issue:** The service worker pre-caches 30 assets on install but omits `./js/investments.js`, which is loaded by `app.html` with `<script defer>`. On a first install + immediate offline use, the investments module will fail to load with a network error, and `app.html`'s investment portfolio section will be non-functional.
- **Impact:** Broken offline experience for the investments feature specifically.
- **Fix:** Add `'./js/investments.js'` to the `ASSETS` array in `service-worker.js`, and bump `CACHE` from `fincwin-v6` to `fincwin-v7`.

### Duplicate Nav Scroll Handler: Inline Script + `mkt.js` [LOW]
- **Files:** All 20 blog post files (`blog/posts/*.html`) and `mkt.js`
- **Issue:** Each blog post inlines `const nav=document.getElementById('mainNav'); window.addEventListener('scroll',…)` immediately before loading `<script src="../../js/mkt.js" defer>`. `mkt.js` also attaches an identical scroll listener. Both run, attaching two `scroll` listeners that do the same `classList.toggle`.
- **Impact:** Minor redundancy — two identical scroll listeners per blog post page. The inline one fires from the non-deferred execution context, the `mkt.js` one fires after DOM-ready. No visible bug but wasteful.
- **Fix:** Remove the inline scroll script from all 20 blog post templates/files; let `mkt.js` handle it exclusively.

### Internal Tooling / Audit Scripts Committed to Repo Root [LOW]
- **Files:** `audit-site.mjs` (34KB), `full-audit.mjs` (29KB), `diag.mjs` (7KB), `__verify_account.mjs` (20KB), `__verify_admin.mjs` (16KB)`
- **Issue:** Five large Playwright-based audit/verification scripts live in the repo root. With `cleanUrls: true`, Vercel will not serve `.mjs` files as HTML pages, but these files are deployed to production alongside the app. They are accessible at their direct paths (e.g., `https://www.fincwin.com/audit-site.mjs`) and expose internal testing logic, local server addresses (`http://localhost:4141`), and mock API payload shapes.
- **Impact:** Information disclosure. Not exploitable on its own, but reveals internal test structure and mock data shapes.
- **Fix:** Move to a `scripts/` or `tests/` subdirectory that is excluded from the Vercel deployment (add to `.vercelignore`), or add a `.vercelignore` entry for `*.mjs` and `__verify_*.mjs`.

### `docs/logo-concepts.html` Is a Design Artefact Deployed to Production [LOW]
- **File:** `docs/logo-concepts.html`
- **Issue:** An internal logo exploration page is deployed to production. It has no `noindex` tag, no canonical, and is accessible at `https://www.fincwin.com/docs/logo-concepts`. It is not in `robots.txt` or `sitemap.xml`.
- **Fix:** Add to `.vercelignore`, or add `<meta name="robots" content="noindex, nofollow">`.

---

## 5. Consent / Privacy

### GA4 Measurement ID Not Configured — Analytics Banner Fires But Collects Nothing [MEDIUM]
- **File:** `js/consent.js` line 32
- **Issue:** `GA_MEASUREMENT_ID` is an empty string. The consent banner is fully functional and stores user preferences, but since there is no GA4 ID, `loadAnalytics()` is a no-op. Users are asked for analytics consent, but nothing is actually measured.
- **Impact:** The consent UX is deceptive if analytics is not planned; if analytics is planned, there is a gap in tracking setup. The GTM domain (`https://www.googletagmanager.com`) is whitelisted in the CSP — this allowance serves no purpose while `GA_MEASUREMENT_ID` is empty.
- **Fix:** Either configure a real GA4 measurement ID in `window.FW_GA_ID` (set via a script tag before `consent.js` loads, or via a Vercel Edge middleware-injected environment value), or simplify the consent banner to necessary-only until analytics is wired up.

### `copy-year` Elements Use Hardcoded `2026` as Fallback [LOW]
- **Files:** Multiple HTML files — footer `<span class="copy-year">2026</span>`
- **Issue:** `mkt.js` updates `.copy-year` spans dynamically, but the static HTML value is hardcoded as `2026`. If `mkt.js` fails to load (network error, CSP block), the footer displays the hardcoded year. This will become visibly wrong in 2027+.
- **Impact:** Minor. Only appears if JS fails.

---

## 6. Legal / Operational

### Privacy Policy Omits Legal Entity Name and Jurisdiction [MEDIUM]
- **File:** `privacy.html` line 149
- **Issue:** The policy states: *"FincWin is operated by the company behind FincWin."* This is a circular, legally meaningless statement. GDPR (Art. 13/14) and UK PECR require the data controller's identity, registered address, and contact details.
- **Impact:** Non-compliant privacy policy for EU/UK users. A regulator complaint would be difficult to defend.
- **Fix:** Add the actual legal entity name, country of incorporation, and business address. If operating as a sole trader, a business address or P.O. box is sufficient.

### No LemonSqueezy Webhook Endpoint — Subscription Cancellations Are Not Auto-Processed [MEDIUM]
- **Files:** `api/` directory (no webhook endpoint exists)
- **Issue:** There is no `/api/webhook` or equivalent endpoint to receive LemonSqueezy subscription lifecycle events (cancellation, expiry, refund, upgrade/downgrade). The licence validation API (`api/validate.js`) checks the key on each app load, which will eventually catch a cancelled key — but only on the next app open. A user who cancels could have continued Pro access for the remainder of their session or even the full billing period before the next validation call returns `invalid`.
- **Impact:** Moderate revenue impact if users exploit this. Also means billing disputes and refunds are not automatically reflected in the app's access control.
- **Fix:** Add a `/api/webhook` endpoint, verify the LemonSqueezy webhook signature (`X-Signature` header with HMAC-SHA256), and update Firestore user records on `subscription_cancelled`, `subscription_expired`, and `order_refunded` events.

### `account.html` Upgrade Box Points to `pricing.html`, Not a Checkout URL [LOW]
- **File:** `account.html` line 523, `js/account.js`
- **Issue:** The in-app upgrade CTA for signed-in Free users says "Upgrade to Lifetime — $149" but the button links to `pricing.html` ("Learn more") rather than directly to a LemonSqueezy checkout. Users must navigate to pricing, then click a CTA there (which sends them to `signin.html#register`), creating a confusing three-step flow for existing signed-in users.
- **Impact:** Conversion friction for Free → Lifetime upgrades.
- **Fix:** Link the upgrade box directly to the LemonSqueezy checkout URL for the Lifetime product variant.

---

## 7. Performance

### No Font Display Swap Specified for Google Fonts [LOW]
- **Files:** All HTML pages that load Google Fonts (nearly all marketing pages)
- **Issue:** The Google Fonts `<link>` tag does not include `&display=swap` in the query string. The current URL is `family=Hanken+Grotesk:wght@200;300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap` — actually `display=swap` IS present. Confirmed acceptable.

### 30 Deferred Script Requests on `app.html` Startup [LOW]
- **File:** `app.html`
- **Issue:** The app shell fires 30 individual `<script defer>` tag requests on page load. While most will be served from the service worker cache after the first visit, on first install each is a separate HTTP request. No JS bundling or concatenation is in place.
- **Impact:** First-load performance on slow connections may be noticeably slow before the service worker is installed.
- **Fix:** A simple concatenation build step (no bundler required) that merges the 30 app JS files into one `app.bundle.js` would halve first-load request count. This is a low-effort improvement given the existing `scripts/build-all.js` infrastructure.

---

## Summary Table

| Concern | Severity | File(s) |
|---|---|---|
| CSP blocks inline scripts and `onclick` handlers | High | `app.html`, `blog/posts/*.html`, `blog/index.html` |
| `robots.txt` disallows `.html` URLs; live URLs are clean | High | `robots.txt`, `sitemap.xml` |
| In-memory rate limiting resets on cold starts | Medium | `api/activate.js`, `api/validate.js`, `api/admin.js` |
| No CSRF/origin check on contact API | Medium | `api/contact.js` |
| Blog post routes not in `vercel.json` rewrites | Medium | `vercel.json` |
| `finflow_*` localStorage keys mixed with `fincwin_*` | Medium | `js/constants.js`, `js/boot.js`, `js/settings.js`, `js/state.js` |
| Pricing hardcoded in 96+ places | Medium | `pricing.html`, `pricing.js`, meta tags site-wide |
| `investments.js` missing from service worker cache | Medium | `service-worker.js` |
| GA4 ID not configured — consent banner collects nothing | Medium | `js/consent.js` |
| Privacy policy lacks legal entity identity | Medium | `privacy.html` |
| No LemonSqueezy webhook for subscription lifecycle | Medium | `api/` (missing) |
| Contact email still routes to old brand inbox | Low | `api/contact.js` |
| Duplicate nav scroll handler on all blog posts | Low | `blog/posts/*.html`, `mkt.js` |
| Audit/test scripts deployed to production root | Low | `*.mjs` in root |
| `docs/logo-concepts.html` publicly deployed | Low | `docs/logo-concepts.html` |
| `admin.html` BOM encoding artefacts in title/placeholders | Low | `admin.html` |
| Missing OG/Twitter tags on legal and auth pages | Low | `privacy.html`, `terms.html`, etc. |
| Upgrade CTA routes to pricing page, not checkout | Low | `account.html` |
| `app.html` 2,765-line monolith | Medium | `app.html` |

---

*Concerns audit: 2026-06-10*
