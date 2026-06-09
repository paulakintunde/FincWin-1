# Installing FincWin on Vercel — Step by Step

This is the first-time setup process to get the site live on Vercel. It deploys as a
**static site + `/api` serverless functions** with **no build step** (pages are committed
as HTML). For the ongoing structure/reference, see [DEPLOY.md](DEPLOY.md).

Pick **one** path:
- **Path A — Vercel Dashboard (Git import)** — recommended; auto-deploys on every push.
- **Path B — Vercel CLI** — deploy from your terminal.

---

## 0. Prerequisites

- [ ] A [Vercel account](https://vercel.com/signup) (free Hobby tier is fine to start).
- [ ] The three secrets ready (see [.env.example](.env.example)):
  - `LEMON_SQUEEZY_API_KEY` — license validation/activation
  - `RESEND_API_KEY` — contact-form email
  - `ADMIN_TOKEN` — admin endpoint guard (any long random string)
- [ ] Code pushed to GitHub/GitLab/Bitbucket (Path A) **or** Node + npm installed locally (Path B).
- [ ] Generated pages are up to date and committed:
  ```bash
  npm run build:pages      # writes/refreshes the committed HTML
  npm test                 # should be green
  git add -A && git commit -m "chore: prepare for deploy"
  ```

---

## Path A — Vercel Dashboard (recommended)

### A1. Push your repo to Git
```bash
git remote -v                       # confirm a remote exists
git push origin main                # push your branch
```

### A2. Import the project
1. Go to **vercel.com → Add New… → Project**.
2. **Import Git Repository** and select this repo (authorize the Git provider if asked).

### A3. Configure project settings
On the “Configure Project” screen:
- **Framework Preset:** `Other` (this is a static site, not Next.js/etc.).
- **Root Directory:** leave as the repo root (`./`).
- **Build & Output Settings:** leave **everything blank / default.**
  - Build Command: *(empty)* — there is no build.
  - Output Directory: *(empty)* — files are served from the root.
  - Install Command: *(leave default)* — `vercel.json` already pins `npm install --omit=dev`.
- Vercel auto-detects the `/api` folder as serverless functions — nothing to configure.

### A4. Add environment variables
Expand **Environment Variables** and add all three (apply to **Production**, **Preview**, and **Development**):

| Name | Value |
|---|---|
| `LEMON_SQUEEZY_API_KEY` | *your key* |
| `RESEND_API_KEY` | *your key* |
| `ADMIN_TOKEN` | *a long random string* |

### A5. Deploy
Click **Deploy**. Wait for the build to finish, then open the generated
`https://<project>.vercel.app` URL. Continue to [§3 Verification](#3-verify-the-deployment).

> From now on, **every `git push` auto-deploys**: pushes to `main` → Production, other branches → Preview URLs.

---

## Path B — Vercel CLI (alternative)

### B1. Install and log in
```bash
npm i -g vercel
vercel login
```

### B2. Link the project (first run)
From the project root:
```bash
vercel link        # creates .vercel/ locally (already gitignored)
```
Accept the prompts (scope/account, “link to existing?” → No to create new, keep the directory as-is).

### B3. Add environment variables
```bash
vercel env add LEMON_SQUEEZY_API_KEY production
vercel env add RESEND_API_KEY production
vercel env add ADMIN_TOKEN production
# repeat with "preview" (and "development") if you want those environments populated
```
Each command prompts for the value.

### B4. Deploy
```bash
vercel           # creates a PREVIEW deployment (safe to test first)
vercel --prod    # promotes to PRODUCTION
```

---

## 1. (Optional) Test it faithfully before going live

The plain dev server ignores `vercel.json` (no CSP, no clean URLs). To preview the **real**
routing + headers locally:
```bash
npx vercel dev      # http://localhost:3000 with rewrites, CSP, and /api functions
```

---

## 2. Add your custom domain

1. **Project → Settings → Domains → Add** → enter `fincwin.com` (and `www.fincwin.com`).
2. Vercel shows the DNS records to set at your registrar:
   - Apex `fincwin.com` → **A record** to Vercel’s IP (shown in the UI), or use Vercel nameservers.
   - `www` → **CNAME** to `cname.vercel-dns.com`.
3. Wait for DNS to verify (minutes to a few hours). Vercel issues HTTPS automatically.

> The CSP and `/api` CORS in `vercel.json` already reference `https://fincwin.com`. If you launch
> on a **different** domain, update the `connect-src`/CSP and the `Access-Control-Allow-Origin`
> value in `vercel.json` to match, then redeploy.

---

## 3. Verify the deployment

Run through this on the live (or preview) URL:

- [ ] **Clean URLs** resolve: `/pricing`, `/features`, `/features/ai-coach`, `/blog`, `/compare/mint-alternative`.
- [ ] **Security headers present:**
  ```bash
  curl -sI https://<your-domain>/pricing | grep -i "content-security-policy\|strict-transport"
  ```
- [ ] **No CSP errors:** open a page → DevTools **Console** → no “Refused to execute inline script”.
- [ ] **Content renders** below the hero on `/pricing` and `/` (cards, tables, FAQ).
- [ ] **Interactive bits work:** pricing billing toggle, FAQ accordion, features search, mobile hamburger.
- [ ] **Contact form** submits and returns success (needs `RESEND_API_KEY`).
- [ ] **License API** responds: `POST /api/validate` (needs `LEMON_SQUEEZY_API_KEY`).
- [ ] **SEO files** serve: `/robots.txt`, `/sitemap.xml`.
- [ ] **PWA**: `/app` loads the dashboard and is installable.

---

## 4. Ongoing deploys

```bash
# After editing templates/data, regenerate the committed HTML first:
npm run build:pages
npm test

git add -A && git commit -m "…"
git push                 # Path A: auto-deploys
# or
vercel --prod            # Path B
```

**Before each deploy:**
- [ ] `npm run build:pages` → `Built N/N pages.`
- [ ] No inline `<script>` / `on*=` added to any page (the CSP blocks them — keep JS in `/js/*.js`).
- [ ] New routes added to `vercel.json` rewrites **and** `sitemap.xml`.

---

## 5. Rollback

- **Dashboard:** Project → **Deployments** → pick a previous good deployment → **⋯ → Promote to Production**.
- **CLI:** `vercel rollback <deployment-url>`.

---

## 6. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| Clean URLs 404 locally | The plain dev server doesn’t read `vercel.json`. Use `vercel dev`. In production they work via `vercel.json`. |
| Page blank below the hero / console shows “Refused to execute inline script” | An inline `<script>` or `on*=` handler was added. Move it to a file under `/js/` (CSP is `script-src 'self'`). |
| Contact form returns 500 | `RESEND_API_KEY` missing/invalid in the deployed environment. |
| License check fails | `LEMON_SQUEEZY_API_KEY` missing/invalid. |
| Function build pulls in Playwright / slow install | Ensure `vercel.json` keeps `"installCommand": "npm install --omit=dev"`. |
| Updated CSS/JS not showing | `/js` and `/styles` cache for ~1h (SWR). Hard-refresh, or it self-updates shortly. |
| Env var change not taking effect | Env vars apply on the **next deploy** — redeploy after changing them. |
