# CLAUDE.md — FincWin (freetinz-stack)

## Auth-cloak script hash

`app.html` contains a synchronous inline `<script>` at the top of `<body>` (the auth-cloak block). Because the CSP in `vercel.json` has `script-src-attr 'none'` and no `'unsafe-inline'`, this script is allowed via a SHA-256 hash:

```
'sha256-ieEn92sbm3d5ynC5UAuzysHSqmki48Th1Nn3lCzbIsI='
```

**If you ever edit the content of that script block, recompute the hash and update `vercel.json`:**

```powershell
$html = Get-Content app.html -Raw
$script = ([regex]::Matches($html, '(?<=<script>)([\s\S]*?)(?=</script>)'))[0].Value
$script = $script -replace "`r`n", "`n"  # browsers normalise to LF before hashing
$bytes = [System.Text.Encoding]::UTF8.GetBytes($script)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
"'sha256-$([Convert]::ToBase64String($hash))'"
```

Then replace the old hash value in `vercel.json`'s `Content-Security-Policy` header.

---

## CSP rules

- `script-src-attr 'none'` — all `onclick`/`onchange`/`oninput` HTML attributes are blocked. Use `data-action` delegation (handled by `js/events.js`) for app interactions, or delegated event listeners in the relevant JS file for marketing pages.
- `style-src 'unsafe-inline'` — inline `<style>` blocks and `style=` attributes are allowed.
- `https://www.googletagmanager.com` is whitelisted in `script-src` so gtag.js loads without CSP errors once GA4 is configured.

---

## Rate limiting (Upstash Redis)

API rate limiting uses `lib/rate-limit.js`, which calls the Upstash Redis REST API via `fetch`. No npm package is needed.

**Required Vercel env vars — add in Vercel project → Settings → Environment Variables:**

| Variable | Where to find it |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash console → your database → REST API → Endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console → your database → REST API → Token |

**Setup steps (one-time):**
1. Create a free account at [upstash.com](https://upstash.com)
2. Create a new Redis database (region: closest to your Vercel deployment — typically `us-east-1`)
3. Copy the REST URL and token from the Upstash console
4. Add both env vars to Vercel (all environments)
5. Redeploy — rate limiting is then persistent across cold starts and instances

**Until the env vars are set,** `lib/rate-limit.js` falls back to the in-memory Map() (same behaviour as before). No deploy will break.

Per-endpoint limits:
- `activate` — 10 req / 60 s per IP
- `validate` — 30 req / 60 s per IP
- `admin`    — 20 req / 60 s per IP

---

## GA4 Analytics

GA4 is wired up in `js/consent.js` — analytics load only after the visitor grants consent (PECR-compliant). Measurement ID: `G-Y6VE3LV949`.

Replace `'G-XXXXXXXXXX'` with your actual `G-...` ID from Google Analytics → Admin → Data Streams.

---

## LemonSqueezy webhook

`api/webhook.js` handles subscription cancellations and refunds. It verifies the `X-Signature` HMAC-SHA256 header using the `LEMON_SQUEEZY_WEBHOOK_SECRET` env var, then deactivates all licence instances via the LS API so the next `validate.js` call downgrades the user.

**Setup steps:**
1. In Vercel → Settings → Environment Variables, add `LEMON_SQUEEZY_WEBHOOK_SECRET` (any strong random string you choose).
2. In LemonSqueezy → Settings → Webhooks, add your endpoint URL: `https://www.fincwin.com/api/webhook`
3. Set the same secret in the LS webhook config.
4. Subscribe to events: `order_refunded`, `subscription_expired`, `license_key_disabled`.

**Events handled:**
- `order_refunded` — immediately deactivates all licence instances for the order
- `subscription_expired` — deactivates when the billing period ends
- `license_key_disabled` — deactivates if manually disabled in LS dashboard
- `subscription_cancelled` — no-op (key stays valid until period end; `validate.js` handles expiry on next app open)

---

## localStorage key namespace

All user-facing localStorage/sessionStorage keys use the `fincwin_` prefix. A one-time migration function in `js/darkmode.js` (runs before any reads) renames legacy `finflow_*` keys from users who installed before the rebrand.

**Do NOT rename these keys** — they are IDB identifiers and renaming would corrupt existing user data:
- `SK = 'finflow_v5'` in `js/constants.js` (IDB store name)
- `finflow_pin_hash`, `finflow_pin_lockout`, `finflow_pin_len` in `js/state.js` (IDB)
- `finflow_salt_v1` in `js/state.js` (PIN hash salt — changing this would reset all user PINs)

---

## Firestore rules guard

`.github/workflows/ci.yml` runs on every push/PR and fails the build if `firestore.rules` contains `allow read, write: if true`. Never loosen that rule without re-reviewing the CI check.

---

## Password reset (self-hosted)

Password resets do **not** use Firebase's client-side `sendPasswordResetEmail()` (that sends from `*.firebaseapp.com` → spam, ugly subject, `firebaseapp.com` link). Instead:

- `js/signin.js` `showForgot()` POSTs the email to `api/forgot-password.js`.
- `api/forgot-password.js` (Node runtime) uses the **Firebase Admin SDK** `generatePasswordResetLink()` to mint the `oobCode`, rewrites the link to `https://www.fincwin.com/reset?oobCode=…`, and sends a branded email via **Resend** from `noreply@fincwin.com` (authenticated domain → inbox, not spam). It always returns a generic `{ok:true}` so the endpoint can't enumerate accounts.
- `reset.html` + `js/reset.js` read the `oobCode`, call `verifyPasswordResetCode` → `confirmPasswordReset` with the vendored Firebase Auth SDK, then send the user to sign in. Routed via `/reset` rewrite in `vercel.json`.

**Required Vercel env vars:**

| Variable | Where to find it |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Project Settings → Service accounts → Generate new private key. Paste the **entire JSON** as a single env var value. |
| `RESEND_API_KEY` | Already set (shared with `api/contact.js`). |

`firebase-admin` is a runtime `dependency` in `package.json`. After adding it, run `npm install` to update `package-lock.json`.

**To polish the email further** (sender name, layout), edit `emailHtml()` / `emailText()` in `api/forgot-password.js`. No Firebase Console template changes are needed anymore — the old Authentication → Templates → Password reset email is no longer used.
