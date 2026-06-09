# Production Setup — Wiring the Whole Stack Together

This is the **single, end‑to‑end guide** to take this app from a fresh clone to a fully working
production deployment. It covers every external service the code actually uses and the order to
configure them in. Follow the phases top to bottom — each ends with a **Checkpoint ✅** you must
confirm before moving on.

For the shorter, deploy‑only references see [VERCEL-SETUP.md](VERCEL-SETUP.md) and [DEPLOY.md](DEPLOY.md).
This document supersedes both when you are setting up from scratch.

---

## 0. What you are wiring together

The app is a **static HTML site + a thin serverless `/api` layer**. No financial data ever touches a
server — budgets/expenses live in the browser, encrypted before any optional cloud sync. The services
split cleanly into two trust zones:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  BROWSER (client)  — config is public, never holds a server secret        │
│                                                                            │
│  Firebase Web SDK  ──▶ Firebase Auth (anonymous) + Firestore (ciphertext) │
│  Google Identity   ──▶ Google Drive appDataFolder (ciphertext)            │
│        ▲  reads window.__FINCWIN_CONFIG__  (from js/config.local.js)        │
└────────┼───────────────────────────────────────────────────────────────────┘
         │ HTTPS (license + contact only — never financial data)
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  VERCEL /api  (serverless, holds the real secrets as env vars)             │
│                                                                            │
│  /api/activate /api/validate /api/deactivate ──▶ Lemon Squeezy License API │
│  /api/admin                                  ──▶ Lemon Squeezy (read-only) │
│  /api/contact                                ──▶ Resend (transactional)    │
│        ▲  reads process.env.LEMON_SQUEEZY_API_KEY / RESEND_API_KEY /        │
│           ADMIN_TOKEN  (Vercel → Settings → Environment Variables)          │
└──────────────────────────────────────────────────────────────────────────┘
```

### The two kinds of credentials — do not mix them up

| Where it lives | What goes there | Secret? | How it ships |
|---|---|---|---|
| **`js/config.local.js`** (committed) | Firebase web config, Google OAuth **client ID** | **No** — these are public identifiers | Committed to the repo and served to the browser |
| **Vercel env vars** (never committed) | `LEMON_SQUEEZY_API_KEY`, `RESEND_API_KEY`, `ADMIN_TOKEN` | **Yes** — server‑side only | Set in the Vercel dashboard; injected into `/api` at runtime |

> **Why Firebase keys and the Google client ID are safe in client code:** they *identify* your project,
> they don't *grant access*. Access is enforced by Firestore security rules ([firestore.rules](firestore.rules))
> and by the OAuth consent/scopes — see [Firebase's own FAQ](https://firebase.google.com/docs/projects/learn-more#api-keys-not-secrets).
> This is why `js/config.local.js` is **committed** (it is *not* in `.gitignore`) for this no‑build static deploy.
> The three real secrets are *never* in the repo — they only exist as Vercel environment variables.

### Service checklist

- [ ] **Domain + DNS** (Phase 1)
- [ ] **Vercel** — hosting + serverless functions (Phase 2)
- [ ] **Lemon Squeezy** — payments + licensing (Phase 3)
- [ ] **Resend** — contact‑form email (Phase 4)
- [ ] **Firebase** — anonymous auth + encrypted Firestore sync (Phase 5)
- [ ] **Google Drive** — optional encrypted backup backend (Phase 6)
- [ ] **Admin token** — guards the license dashboard (Phase 7)
- [ ] **Final wiring + verification** (Phase 8)

---

## ⚠️ Phase 0 — Choose your domain and find the hardcoded references

The code currently ships with **`fincwin.com`** and one personal email baked into a few files. Before you
deploy under a different domain or brand, decide your production domain now and change these. (If you are
genuinely launching as `fincwin.com` with the existing inbox, skip this — but still read it so you know
where the knobs are.)

| File | Line(s) | Current value | Change to |
|---|---|---|---|
| [vercel.json](vercel.json) | CSP `connect-src` + `Access-Control-Allow-Origin` | `https://www.fincwin.com` | your production origin |
| [api/contact.js](api/contact.js) | `from:` | `FincWin Contact <contact@fincwin.com>` | a sender on **your** verified Resend domain |
| [api/contact.js](api/contact.js) | `to:` | `paul.haking@gmail.com` | the inbox that should receive contact form mail |
| [api/contact.js](api/contact.js) | subject prefix | `[FincWin Contact]` | your brand (cosmetic) |
| Lemon Squeezy product **Redirect URL** (Phase 3) | — | `https://www.fincwin.com/...` | your domain |

> Search the repo for `fincwin.com` and `paul.haking@gmail.com` to confirm you caught every occurrence
> before going live.

**Checkpoint ✅** — You have decided your production domain (e.g. `app.example.com`) and the inbox that
should receive contact‑form email.

---

## Phase 1 — Domain & DNS

You need a domain you control. You'll point it at Vercel in Phase 2 and verify it with Resend in Phase 4.

1. Buy/own a domain at any registrar (Namecheap, Cloudflare, Google Domains, etc.).
2. Keep access to its **DNS records** — you will add records for both Vercel (hosting) and Resend (email).
3. You do **not** need email hosting; Resend only needs DNS records to *send* mail, not a mailbox.

**Checkpoint ✅** — You can log into your registrar/DNS provider and add records.

---

## Phase 2 — Vercel (hosting + serverless functions)

This deploys the committed HTML and the `/api` functions. **No build step** — pages are committed as HTML.

### 2.1 Prep the repo

```bash
npm run build:pages      # regenerate committed marketing HTML  → "Built N/N pages."
npm test                 # Vitest should be green
git add -A && git commit -m "chore: prepare for production deploy"
git push origin main
```

### 2.2 Import into Vercel

1. Go to **vercel.com → Add New… → Project → Import Git Repository** and select this repo.
2. On **Configure Project**:
   - **Framework Preset:** `Other` (static site, not Next.js).
   - **Root Directory:** repo root (`./`).
   - **Build Command / Output Directory:** leave **blank** — there is no build.
   - **Install Command:** leave default — `vercel.json` already pins `npm install --omit=dev` (skips Playwright/Vitest).
   - Vercel auto‑detects `/api` as serverless functions — nothing to configure.

### 2.3 Add the three server secrets

**Settings → Environment Variables** — add each for **Production, Preview, and Development**. You'll fill
the real values in later phases; add placeholders now or come back after Phases 3, 4, 7.

| Name | Filled in | Purpose |
|---|---|---|
| `LEMON_SQUEEZY_API_KEY` | Phase 3 | License validate/activate/deactivate + admin |
| `RESEND_API_KEY` | Phase 4 | Contact‑form email |
| `ADMIN_TOKEN` | Phase 7 | Guards `/api/admin` |

> Env‑var changes only take effect on the **next deploy** — redeploy after editing them.

### 2.4 Deploy and add your domain

1. Click **Deploy**, wait ~60s, open the `https://<project>.vercel.app` URL.
2. **Settings → Domains → Add** → enter your domain (apex + `www`).
3. At your registrar add the records Vercel shows (apex **A record** to Vercel's IP, `www` **CNAME** to
   `cname.vercel-dns.com`), or switch to Vercel nameservers. HTTPS is issued automatically.

### 2.5 Update the origin allow‑lists in `vercel.json`

If your domain is **not** `fincwin.com`, edit [vercel.json](vercel.json) and replace `https://www.fincwin.com`
in both the CSP `connect-src` and the `/api` `Access-Control-Allow-Origin`, then commit + redeploy.

**Checkpoint ✅** — These all load on your live URL:

- `/` (landing), `/app` (the dashboard PWA), `/pricing`, `/signin`, `/help`, `/blog`, `/compare/mint-alternative`
- Security headers present:
  ```bash
  curl -sI https://<your-domain>/pricing | grep -i "content-security-policy\|strict-transport"
  ```
- DevTools **Console** shows **no** "Refused to execute inline script" (CSP) errors.

---

## Phase 3 — Lemon Squeezy (payments + licensing)

Creates the checkout, generates license keys on purchase, and backs `/api/activate`, `/api/validate`,
`/api/deactivate`, and `/api/admin`.

### 3.1 Create the store and products

1. Sign up at [app.lemonsqueezy.com](https://app.lemonsqueezy.com) → **Create a store** → complete **payout
   setup** (bank/PayPal — required before you can go live, not before testing).
2. **Products → New Product** for each plan. The app's license tiering (see [api/validate.js](api/validate.js))
   maps any variant whose name contains **"lifetime"** to the `lifetime` tier, everything else to `pro`:

   | Product | Type | License | Activation limit | App tier |
   |---|---|---|---|---|
   | (e.g.) Pro | Software license | Single‑use key | 3 devices | `pro` |
   | (e.g.) Lifetime | Software license | Single‑use key | 5 devices | `lifetime` |

   > The **activation limit** you set here is what `/api/validate` reports back as `activation_limit`.

### 3.2 Note the Variant IDs

Open each product → **Variants** → copy the numeric **Variant ID**. You need these to build checkout URLs.

### 3.3 Set the post‑purchase redirect

In each product's **Checkout** settings → **Redirect URL after purchase**:

```
https://<your-domain>/signin?key={license_key}&plan={variant_name}
```

Lemon Squeezy substitutes `{license_key}` and `{variant_name}`. `signin.html` reads `?key=` and calls
`/api/activate` (see [INTEGRATION.md](INTEGRATION.md) §4 for the full flow).

### 3.4 Create the API key

**Settings → API → Create API key** → name it `<brand> Production` → **copy it now** (shown once).

### 3.5 Put the key in Vercel

**Vercel → Settings → Environment Variables** → set `LEMON_SQUEEZY_API_KEY` to this value (Production +
Preview + Development) → **Redeploy**.

### 3.6 Wire the checkout buttons

On [pricing.html](pricing.html), set each plan CTA's `href` to:

```
https://<your-store>.lemonsqueezy.com/checkout/buy/<VARIANT_ID>
```

**Checkpoint ✅**

- Each pricing button opens a real Lemon Squeezy checkout with the right name/price.
- The activation endpoint reaches Lemon Squeezy (a "key invalid" error is the *success* signal — it means
  the proxy + key work):
  ```bash
  curl -X POST https://<your-domain>/api/activate \
    -H "Content-Type: application/json" \
    -d '{"license_key":"TEST-0000-0000-0000","instance_name":"test"}'
  ```
  Expect JSON like `{"activated":false,"error":"..."}`. A `500 "Server configuration error"` means the env
  var isn't deployed.

---

## Phase 4 — Resend (contact‑form email)

Backs `POST /api/contact` ([api/contact.js](api/contact.js)). The contact form will return **503
"Email service not configured"** until this is done.

### 4.1 Verify your sending domain

1. Sign up at [resend.com](https://resend.com).
2. **Domains → Add Domain** → enter your domain (e.g. `example.com`).
3. Add the **DKIM/SPF (and MX/return‑path) records** Resend shows to your DNS provider (Phase 1).
4. Wait for **Verified** (minutes to a few hours).

> Using a verified domain is what lets you send `from: contact@your-domain`. The unverified `onboarding@resend.dev`
> sandbox sender only delivers to your own account email — fine for a first smoke test, not for production.

### 4.2 Point the function at your domain + inbox

Edit [api/contact.js](api/contact.js):

```js
from: 'YourBrand Contact <contact@your-domain.com>',   // must be on the verified domain
to: ['you@your-inbox.com'],                            // where contact mail should land
```

### 4.3 Create the API key

**Resend → API Keys → Create** (sending permission) → copy it.

### 4.4 Put the key in Vercel

Set `RESEND_API_KEY` in **Vercel → Settings → Environment Variables** (all 3 environments) → **Redeploy**.

**Checkpoint ✅** — Submit the live `/contact` form. You get a success response and the email arrives at your
`to:` inbox. A **502** means the key/domain is wrong; a **503** means the key isn't deployed.

---

## Phase 5 — Firebase (anonymous auth + encrypted Firestore sync)

Optional cloud sync. Data is **encrypted client‑side (AES‑GCM)** before upload — Firestore only ever stores
ciphertext (`ciphertext`, `salt`, `iv`, `lastModified`, `version`; see [js/providers/firebase.js](js/providers/firebase.js)).

### 5.1 Create the project

1. [console.firebase.google.com](https://console.firebase.google.com) → **Create a project** → name it.
2. Disable Google Analytics (not needed) → **Create project**.

### 5.2 Enable Anonymous Authentication

**Authentication → Get started → Sign‑in method → Anonymous → Enable → Save.**

> Each device gets a unique UID with no email/password. Users can later upgrade to email auth in‑app
> (`linkAnonymousToEmail`, [js/providers/firebase.js](js/providers/firebase.js)) — the UID and synced doc are preserved.

### 5.3 Enable Firestore

**Firestore Database → Create database → Start in production mode** (rules are deployed separately in 5.6)
→ pick a region (e.g. `us-central1`) → **Enable**.

### 5.4 Register a Web app and copy the config

**Project settings (gear) → Your apps → `</>` (Web)** → nickname e.g. `web` (no Hosting needed) → copy the
`firebaseConfig`:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",  // newer projects; older show .appspot.com
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
```

### 5.5 Write `js/config.local.js`

The app reads `window.__FINCWIN_CONFIG__`, injected by [js/config.local.js](js/config.local.js). For this
no‑build static deploy this file is **committed** (it's not gitignored — see Phase 0 note). Copy
[js/config.example.js](js/config.example.js) → `js/config.local.js` and fill it in. Leave `googleClientId`
for Phase 6:

```js
// js/config.local.js  — Firebase web config + Google OAuth client ID (both public, safe to commit)
window.__FINCWIN_CONFIG__ = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123",
  googleClientId: ""   // ← fill in Phase 6 (Google Drive); leave "" to disable Drive only
};
```

> Do **not** edit [js/sync.js](js/sync.js) or [js/providers/firebase.js](js/providers/firebase.js) — they read
> `window.__FINCWIN_CONFIG__` at runtime. [js/config.fallback.js](js/config.fallback.js) sets the global to
> `null` if the file is missing, so pages still load (sync just stays off).

### 5.6 Deploy the Firestore security rules

These rules ([firestore.rules](firestore.rules)) restrict every user to their own `/users/{uid}` doc and deny
everything else.

**Option A — Firebase CLI (recommended):**
```bash
npm install -g firebase-tools
firebase login
firebase init firestore     # select your project; accept firestore.rules as the rules file
firebase deploy --only firestore:rules
```

**Option B — Console:** Firestore → **Rules** → paste the full contents of [firestore.rules](firestore.rules) → **Publish**.

### 5.7 Authorize your domain

**Authentication → Settings → Authorized domains → Add domain** → add your production domain (and keep
`localhost` for local testing).

### 5.8 Commit and deploy

```bash
git add js/config.local.js
git commit -m "config: production Firebase web config"
git push        # auto-deploys
```

**Checkpoint ✅**

1. Open `/app` on the live site → **Settings** tab → **Cloud & File** section → **Firebase** row → **Set up**.
2. Enter a passphrase (8+ chars) → **Connect**.
3. Status changes to **Synced ✓** with no console errors about CSP, auth, or `permission-denied`.
   - CSP error → confirm `config.local.js` returns 200 in DevTools → Network.
   - `auth/...` error → Anonymous auth not enabled (5.2) or domain not authorized (5.7).
   - `permission-denied` → rules not deployed (5.6).

---

## Phase 6 — Google Drive (optional encrypted backup backend)

A second sync backend that stores the same client‑encrypted blob in the user's private **Drive
`appDataFolder`** ([js/providers/gdrive.js](js/providers/gdrive.js)). Uses Google Identity Services (GIS) with
the `https://www.googleapis.com/auth/drive.appdata` scope. Requires a Google Cloud OAuth **client ID**.

> The same Google Cloud project sits behind your Firebase project, so you may reuse it.

### 6.1 Configure the OAuth consent screen

1. [console.cloud.google.com](https://console.cloud.google.com) → select the project linked to your Firebase
   project → **APIs & Services → OAuth consent screen**.
2. **User type: External** → fill app name, support email, developer contact.
3. **Scopes → Add** → `.../auth/drive.appdata` (app‑data folder only — it cannot see the user's other files).
4. **Publishing status:**
   - **Testing** (default): only **test users** you add can authorize — no Google review needed. Perfect for
     launch‑with‑yourself and beta users. Add each tester's Google account under **Test users**.
   - **In production:** Drive scopes are **sensitive**, so opening Drive sync to the general public requires
     submitting the app for **OAuth verification** (can take several days). Plan for this if Drive backup is a
     public feature; until then, keep it in Testing and gate it to test users.

### 6.2 Enable the Drive API

**APIs & Services → Library → Google Drive API → Enable.**

### 6.3 Create the OAuth client ID (Web application)

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application.**
2. **Authorized JavaScript origins** — add every origin the app is served from:
   - `https://<your-domain>`
   - `https://<project>.vercel.app` (the Vercel default, if you use it)
   - your local dev origin while testing (e.g. `http://localhost:3000` for `vercel dev`)
3. Create → copy the **Client ID** (looks like `...apps.googleusercontent.com`). No client *secret* is used —
   GIS uses the implicit token flow client‑side.

### 6.4 Add the client ID to config and redeploy

Set `googleClientId` in [js/config.local.js](js/config.local.js) to the value from 6.3, commit, push:

```js
googleClientId: "1234567890-abcd....apps.googleusercontent.com"
```

> If left `""` or `YOUR_GOOGLE_OAUTH_CLIENT_ID`, the app shows "Google Client ID not configured" and Drive
> sync stays disabled — Firebase sync is unaffected.

**Checkpoint ✅** — On `/app` → Settings → Cloud & File → **Google Drive** row → **Connect**. The Google
account picker appears, you grant access, and the row shows connected (and your email if available). A
`redirect_uri_mismatch` / `origin` error means the serving origin isn't in **Authorized JavaScript origins** (6.2).
Drive sync is a Pro‑gated feature (`requirePlan('pro', …)`), so activate a license first if gating is on.

---

## Phase 7 — Admin token (license dashboard)

`GET /api/admin` ([api/admin.js](api/admin.js)) returns license stats + revenue, guarded by a bearer token.

1. Generate a long random string:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **Vercel → Settings → Environment Variables** → set `ADMIN_TOKEN` to it (all 3 environments) → **Redeploy**.
3. The token is supplied as `Authorization: Bearer <ADMIN_TOKEN>` (the `admin.html` page prompts for it).

**Checkpoint ✅**
```bash
curl -s https://<your-domain>/api/admin -H "Authorization: Bearer <ADMIN_TOKEN>"   # → JSON stats
curl -s https://<your-domain>/api/admin                                            # → 401 Unauthorized
```
`503 "Admin not configured"` means the env var isn't deployed.

---

## Phase 8 — Final wiring & full production verification

### 8.1 The single source of truth for each credential

| Credential | Type | Lives in | Set in phase |
|---|---|---|---|
| Firebase web config (6 fields) | public | `js/config.local.js` (committed) | 5 |
| Google OAuth client ID | public | `js/config.local.js` (committed) | 6 |
| `LEMON_SQUEEZY_API_KEY` | **secret** | Vercel env var | 3 |
| `RESEND_API_KEY` | **secret** | Vercel env var | 4 |
| `ADMIN_TOKEN` | **secret** | Vercel env var | 7 |

### 8.2 Confirm the cross‑service references all agree on your domain

- [ ] [vercel.json](vercel.json) CSP `connect-src` and `/api` `Access-Control-Allow-Origin` = your origin
- [ ] [api/contact.js](api/contact.js) `from:` is on your **verified Resend domain**; `to:` is your inbox
- [ ] Lemon Squeezy redirect URLs use your domain
- [ ] Firebase **Authorized domains** include your domain
- [ ] Google OAuth **Authorized JavaScript origins** include your domain (+ vercel.app + localhost)

### 8.3 Full smoke test on the live URL

- [ ] **Pages/routing:** `/`, `/app`, `/pricing`, `/signin`, `/account`, `/admin`, `/blog`, `/features/ai-coach`, `/compare/mint-alternative` all load.
- [ ] **No CSP errors** anywhere in DevTools Console.
- [ ] **Security headers** present (`curl -sI` shows CSP + HSTS).
- [ ] **Interactive UI:** pricing billing toggle, FAQ accordion, features search, mobile hamburger.
- [ ] **Contact form** → success + email received (Resend).
- [ ] **Checkout** → opens correct Lemon Squeezy product (and a real test purchase issues a key + redirects to `/signin?key=...`).
- [ ] **License activate/validate** → `/api/activate` and `/api/validate` return JSON (Lemon Squeezy).
- [ ] **Firebase sync** → connect with passphrase → **Synced ✓**; reload reflects synced data.
- [ ] **Google Drive sync** (if enabled) → connect → backup/restore works.
- [ ] **Admin** → `/api/admin` returns stats with the token, 401 without.
- [ ] **SEO/PWA:** `/robots.txt`, `/sitemap.xml` serve; `/app` is installable.

### 8.4 Ongoing deploys

```bash
npm run build:pages      # if templates/data changed
npm test
git add -A && git commit -m "…"
git push                 # main → production, branches → preview
```
**Before each deploy:** no inline `<script>`/`on*=` added (CSP blocks them — keep JS in `/js/*.js`); new
routes added to both `vercel.json` rewrites **and** `sitemap.xml`.

---

## Security model (what protects what)

- **Financial data never leaves the device unencrypted.** Budgets/expenses live in `localStorage`/IndexedDB
  and are AES‑GCM encrypted (PBKDF2 key from the user's passphrase) before any cloud write. Firebase and Drive
  store **only ciphertext**. The passphrase is held in memory for the session and **never** stored or transmitted.
- **Firestore rules** ([firestore.rules](firestore.rules)) bind every read/write to `request.auth.uid == userId`;
  all other access is denied. Anonymous auth still produces a real UID, so the rule fully applies.
- **Drive `appDataFolder`** scope means the app can only touch its own hidden data file — never the user's documents.
- **Server secrets** (`LEMON_SQUEEZY_API_KEY`, `RESEND_API_KEY`, `ADMIN_TOKEN`) exist only as Vercel env vars,
  never in the repo or the browser. The `/api` functions proxy to Lemon Squeezy/Resend so the keys stay server‑side.
- **CSP** is `script-src 'self' https://accounts.google.com` (no `'unsafe-inline'`) — every script is an external
  file under `/js`. `connect-src` is allow‑listed to Firebase, Google APIs, Lemon Squeezy/Resend (via same‑origin
  `/api`), and the FX/AI endpoints.
- **`/api` rate limiting** is per‑warm‑instance in‑memory (activate 10/min, validate 30/min, admin 20/min). For
  hard cross‑cold‑start limits, back it with Upstash/Redis (noted in [api/activate.js](api/activate.js)).
- **Lost passphrase = unrecoverable cloud data.** Encourage users to export JSON backups (Settings → Export).

---

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| Clean URLs 404 locally | Plain dev server ignores `vercel.json`. Use `npx vercel dev`. They work in production. |
| Page blank below hero / "Refused to execute inline script" | An inline `<script>` or `on*=` was added. Move it to `/js/*.js` (CSP `script-src 'self'`). |
| Contact form → **503** | `RESEND_API_KEY` not deployed. Add env var + redeploy. |
| Contact form → **502** | Resend key invalid, or `from:` not on a verified domain. |
| License check → **500 "Server configuration error"** | `LEMON_SQUEEZY_API_KEY` missing/not redeployed. |
| License check → **502** | Lemon Squeezy unreachable / key wrong. |
| Checkout button goes nowhere | `href` still a placeholder — set the real `…/checkout/buy/<VARIANT_ID>` URL. |
| Firebase row stays "Not set up" | DevTools Console: `permission-denied` → deploy rules (5.6); `auth/*` → enable Anonymous (5.2) / authorize domain (5.7); CSP/404 on `config.local.js` → check it returns 200. |
| Drive: "Google Client ID not configured" | `googleClientId` empty/placeholder in `config.local.js`. Set it (6.4) + redeploy. |
| Drive: `redirect_uri_mismatch` / origin error | Serving origin not in OAuth **Authorized JavaScript origins** (6.3). |
| Drive: only test users can connect | Consent screen is in **Testing** — add the account as a test user, or submit for verification (6.1). |
| `/api/admin` → **503** | `ADMIN_TOKEN` not set/deployed. |
| `/api/admin` → **401** | Missing/wrong `Authorization: Bearer` token. |
| Env‑var change has no effect | Vars apply on the **next deploy** — redeploy after changing them. |
| Updated CSS/JS not showing | `/js` and `/styles` cache 1h + SWR. Hard‑refresh; it self‑updates shortly. |

---

## Rollback

- **Dashboard:** Vercel → **Deployments** → pick a known‑good build → **⋯ → Promote to Production**.
- **CLI:** `vercel rollback <deployment-url>`.
</content>
</invoke>
