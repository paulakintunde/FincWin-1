# FincWin — Go-Live Setup Guide

Follow these phases in order. Each phase has a checkpoint — confirm it works before moving on.

---

## Phase 1 — Deploy to Vercel

### What this does
Puts all your HTML pages on the internet with clean URLs (`/app`, `/pricing`, etc.) and deploys the API endpoints automatically on every git push.

### Steps

**1. Create a Vercel account**
- Go to https://vercel.com
- Click **Sign Up** → **Continue with GitHub** (use the same GitHub account that owns this repo)

**2. Import the project**
- On the Vercel dashboard click **Add New → Project**
- Find `freetinz-stack/projectstack` in the list → click **Import**
- On the configuration screen:
  - Framework Preset: **Other**
  - Root Directory: leave blank (`.`)
  - Build Command: leave blank
  - Output Directory: leave blank
- Click **Deploy**

**3. Wait ~60 seconds**
Vercel builds and deploys. You'll get a URL like `https://projectstack-abc123.vercel.app`.

**4. Checkpoint ✅**
Visit these URLs — all should load correctly:
- `https://your-project.vercel.app/` → `landing.html`
- `https://your-project.vercel.app/app` → `index.html` (the app)
- `https://your-project.vercel.app/signin` → `signin.html`
- `https://your-project.vercel.app/pricing` → `pricing.html`
- `https://your-project.vercel.app/help` → `help.html`

**5. Add a custom domain (optional but recommended)**
- In Vercel dashboard → your project → **Settings → Domains**
- Add `fincwin.com` (or whatever domain you own)
- Follow the DNS instructions (add an A record or CNAME at your domain registrar)
- SSL is automatic — Vercel handles it

---

## Phase 2 — Lemon Squeezy Store

### What this does
Creates the checkout pages where customers pay, and generates license keys automatically after purchase.

### Steps

**1. Create a Lemon Squeezy account**
- Go to https://app.lemonsqueezy.com
- Sign up → Create a Store → Store name: **FincWin**
- Complete the payout setup (bank account or PayPal — required before going live)

**2. Create three products**

For each product below, go to **Products → Add Product → Software license**:

| Product Name | Price | License type | Activations |
|---|---|---|---|
| FincWin Starter | $49 | One-time | 1 device |
| FincWin Pro | $89 | One-time | 3 devices |
| FincWin Lifetime | $149 | One-time | 5 devices |

For each product:
- Type: **Software license**
- License key type: **Single use**

**3. Note the Variant IDs**
After creating each product, go to the product → **Variants** tab → copy the numeric **Variant ID** for each plan. You'll need these in Phase 2b.

**4. Set the post-purchase redirect**

In each product → **Checkout** tab → **Redirect URL**, set:
```
https://www.fincwin.com/signin?key={license_key}&plan={variant_name}
```
*(Lemon Squeezy replaces `{license_key}` and `{variant_name}` automatically)*

**5. Get your API key**
- Go to **Settings → API** → **Create API key**
- Name it: `FincWin Production`
- Copy the key — **you only see it once**. Save it somewhere safe (password manager).

**6. Add the API key to Vercel**
- Vercel dashboard → your project → **Settings → Environment Variables**
- Add:
  - Name: `LEMON_SQUEEZY_API_KEY`
  - Value: *(paste the key from step 5)*
  - Environments: Production, Preview, Development (tick all three)
- Click **Save** → then go to **Deployments → Redeploy** (so the new env var takes effect)

**7. Checkpoint ✅**
Test the API endpoint from your terminal:
```bash
curl -X POST https://your-project.vercel.app/api/activate \
  -H "Content-Type: application/json" \
  -d '{"license_key":"TEST-0000-0000-0000","instance_name":"test"}'
```
You should get a JSON response (an error about invalid key is fine — it means the API reached Lemon Squeezy).

---

## Phase 2b — Wire Checkout Buttons

### What this does
Makes the "Get Started" / "Buy" buttons on `pricing.html` open real Lemon Squeezy checkouts.

### Steps

**1. Build the checkout URLs**
For each plan, your checkout URL is:
```
https://fincwin.lemonsqueezy.com/checkout/buy/{VARIANT_ID}
```
Replace `{VARIANT_ID}` with the numeric ID from Phase 2 step 3.

**2. Update `pricing.html`**

Find each plan's CTA button and replace the `href="#"` placeholder:

```html
<!-- Starter plan button -->
<a href="https://fincwin.lemonsqueezy.com/checkout/buy/YOUR_STARTER_VARIANT_ID" class="...">
  Get Starter →
</a>

<!-- Pro plan button -->
<a href="https://fincwin.lemonsqueezy.com/checkout/buy/YOUR_PRO_VARIANT_ID" class="...">
  Get Pro →
</a>

<!-- Lifetime plan button -->
<a href="https://fincwin.lemonsqueezy.com/checkout/buy/YOUR_LIFETIME_VARIANT_ID" class="...">
  Get Lifetime →
</a>
```

**3. Checkpoint ✅**
Click each button on `pricing.html` — it should open a Lemon Squeezy checkout page with the correct product name and price.

---

## Phase 3 — Wire `signin.html` to the API

> This phase is already coded in `api/activate.js`. This step connects the sign-in form to that endpoint.

*(Implementation coming in next session — the signin.html JS will be updated to call /api/activate)*

---

## Phase 4 — License Gate in the App

> Adds the license check to `js/boot.js` so unlicensed users are redirected to `/signin`.

*(Implementation coming after Phase 3 is confirmed working)*

---

## Local Development

To test API endpoints locally before deploying:

**1. Install Vercel CLI**
```bash
npm i -g vercel
```

**2. Link to your project**
```bash
vercel link
```

**3. Pull environment variables**
```bash
vercel env pull .env.local
```
This creates `.env.local` with your real `LEMON_SQUEEZY_API_KEY`.

**4. Run locally**
```bash
vercel dev
```
Your site runs at `http://localhost:3000` with the API endpoints working.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| API returns 500 "Server configuration error" | The `LEMON_SQUEEZY_API_KEY` env var is missing or not deployed. Redeploy after adding it. |
| API returns 502 | The Lemon Squeezy API is unreachable. Check your key is correct. |
| Clean URLs (`/app`, `/signin`) 404 | `vercel.json` rewrites aren't deployed. Check the file exists and redeploy. |
| Domain not working | DNS propagation can take up to 48 hours. Use the `.vercel.app` URL in the meantime. |
| Checkout button goes nowhere | Replace the `href="#"` placeholder in `pricing.html` with the real Lemon Squeezy URL. |
