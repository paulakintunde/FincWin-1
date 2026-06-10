# CLAUDE.md — FincWin (freetinz-stack)

## Auth-cloak script hash

`app.html` contains a synchronous inline `<script>` at the top of `<body>` (the auth-cloak block). Because the CSP in `vercel.json` has `script-src-attr 'none'` and no `'unsafe-inline'`, this script is allowed via a SHA-256 hash:

```
'sha256-gw7SZHihwz7i5wcEaI3Uy5Rw8imTQx634rVV+vcZIho='
```

**If you ever edit the content of that script block, recompute the hash and update `vercel.json`:**

```powershell
$html = Get-Content app.html -Raw
$script = ([regex]::Matches($html, '(?<=<script>)([\s\S]*?)(?=</script>)'))[0].Value
$bytes = [System.Text.Encoding]::UTF8.GetBytes($script)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
"'sha256-$([Convert]::ToBase64String($hash))'"
```

Then replace the old hash value in `vercel.json`'s `Content-Security-Policy` header.

---

## CSP rules

- `script-src-attr 'none'` — all `onclick`/`onchange`/`oninput` HTML attributes are blocked. Use `data-action` delegation (handled by `js/events.js`) for app interactions, or delegated event listeners in the relevant JS file for marketing pages.
- `style-src 'unsafe-inline'` — inline `<style>` blocks and `style=` attributes are allowed.
- GTM domain is whitelisted in `connect-src` and `script-src-elem` but GA4 (`GA_MEASUREMENT_ID`) is not yet configured in `js/consent.js` — see Phase 3 backlog.

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

## Firestore rules guard

`.github/workflows/ci.yml` runs on every push/PR and fails the build if `firestore.rules` contains `allow read, write: if true`. Never loosen that rule without re-reviewing the CI check.
