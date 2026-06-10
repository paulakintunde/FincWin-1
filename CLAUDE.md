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
