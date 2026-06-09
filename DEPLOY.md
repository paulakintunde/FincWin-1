# Deployment — Vercel

FincWin deploys to Vercel as a **static site + serverless functions**. There is **no build step**: marketing pages are generated locally and committed as plain HTML; Vercel serves them directly and runs the `/api` functions on demand.

```
git push  →  Vercel serves committed static files  +  builds /api functions
```

---

## What gets deployed (the served structure)

```
/                          → landing.html              (static HTML, root + subdirs)
├── *.html                 marketing + app pages (landing, pricing, features, about,
│                          compare, use-cases, contact, changelog, help, legal, 404,
│                          index/app, signin, account, admin, cat-*.html …)
├── compare/*.html         generated competitor pages
├── features/*.html        generated feature sub-pages
├── use-cases/*.html       generated use-case pages
├── blog/                  index, category indexes, posts/*.html
├── js/                    mkt.js, pricing.js, landing.js, features.js, contact.js
├── styles/                mkt.css + page stylesheets
├── assets/                images / static media
├── favicon.svg, icon-*.png, og-image.svg, manifest.json,
│   service-worker.js, robots.txt, sitemap.xml
└── api/                   serverless functions (Node, export default)
    ├── activate.js        license activation     (LEMON_SQUEEZY_API_KEY)
    ├── deactivate.js      license deactivation   (LEMON_SQUEEZY_API_KEY)
    ├── validate.js        license validation     (LEMON_SQUEEZY_API_KEY)
    ├── contact.js         contact form → email   (RESEND_API_KEY)
    └── admin.js           admin endpoint         (ADMIN_TOKEN)
```

The functions are zero-dependency (Node built-ins only). `package.json` has **no runtime dependencies**.

## What is NOT deployed (see `.vercelignore`)

| Excluded | Why |
|---|---|
| `server.js` | local dev server only; Vercel provides the runtime |
| `scripts/` | templating **source** (generator, templates, data, partials) — output HTML is already committed |
| `tests/`, `*.mjs` | test suites and one-off audit scripts |
| `docs/`, `*-STRATEGY.md`, `TEMPLATING-PLAN.md`, `FLOWCHART.md`, `INTEGRATION.md`, `SETUP.md` | internal planning docs |
| `firestore.rules`, `.env.example` | config, not served over HTTP |
| `.claude/` | local agent config |

---

## `vercel.json` responsibilities

- **`installCommand: npm install --omit=dev`** — skips devDependencies (Vitest, Playwright) so the deploy stays fast and never triggers Playwright's browser download. Runtime deps are empty, so nothing is installed.
- **`rewrites`** — clean URLs (`/pricing` → `pricing.html`, `/features/:slug`, `/use-cases/:slug`, `/compare/:slug`, `/blog/:category`).
- **`redirects`** — 301 from the legacy `/blog/posts/ynab-alternative` to `/compare/ynab-alternative`.
- **`cleanUrls: true`, `trailingSlash: false`** — canonical extensionless URLs.
- **`headers`**
  - Security on all routes: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP.
  - **CSP is `script-src 'self'`** (no `'unsafe-inline'`): every page must use **external** scripts. Inline `<script>` and `on*=` handlers are blocked — this is why all page JS lives in `/js/*.js`.
  - Caching: HTML 1h + SWR; `/js` and `/styles` 1h + SWR (not `immutable`, because these filenames are **not** content-hashed); `/assets` immutable 1y.
  - `/api/*` CORS limited to `https://fincwin.com`.

> **If you ever fingerprint assets** (e.g. `mkt.[hash].js`), switch `/js` and `/styles` back to `immutable, max-age=31536000` and bump the references.

---

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Used by | Purpose |
|---|---|---|
| `LEMON_SQUEEZY_API_KEY` | `api/validate.js`, `api/activate.js`, `api/deactivate.js` | license checks |
| `RESEND_API_KEY` | `api/contact.js` | sends contact-form email |
| `ADMIN_TOKEN` | `api/admin.js` | guards the admin endpoint |

See `.env.example` for local setup (`.env.local`).

---

## Local workflow

```bash
# 1. (Re)generate marketing pages after editing templates/data/partials
npm run build:pages          # node scripts/build-all.js → writes committed HTML

# 2. Preview
npm run dev                  # static dev server on http://localhost:4141
#   NOTE: this does NOT apply vercel.json (no CSP, no rewrites).
npx vercel dev               # faithful preview WITH rewrites + headers + CSP + /api

# 3. Test
npm test                     # Vitest (generator integrity, etc.)
```

The dev server ignores `vercel.json`, so use `vercel dev` (or a preview deploy) to verify routing and the CSP before shipping.

---

## Deploy

```bash
# Generate + commit first if templates/data changed
npm run build:pages
git add -A && git commit -m "…"

# Option A — Git integration (recommended): push; Vercel auto-deploys
git push                     # main → production; other branches → preview

# Option B — Vercel CLI
npx vercel                   # preview deployment
npx vercel --prod            # production deployment
```

### Pre-deploy checklist
- [ ] `npm run build:pages` → `Built N/N pages.`
- [ ] `npm test` green
- [ ] No inline `<script>` / `on*=` added to any page (CSP would block it)
- [ ] New routes added to `vercel.json` rewrites **and** `sitemap.xml`
- [ ] Required env vars present in the Vercel project
