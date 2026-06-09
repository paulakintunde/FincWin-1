# FincWin Integration Plan

## 1. Architecture Overview

FincWin is a **static HTML application** with a thin serverless layer for licence management only. No financial data ever touches a server.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Static Frontend                          │
│  landing.html / pricing.html / features.html / index.html       │
│  All HTML/CSS/JS — served from CDN (Vercel / Netlify)           │
└────────────────┬─────────────────────────────────────────────────┘
                 │ HTTPS (licence operations only)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Serverless API (3 endpoints)                   │
│  Vercel Functions / Netlify Functions / Cloudflare Workers       │
│  /api/activate  /api/validate  /api/deactivate                  │
└────────────────┬─────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│               Lemon Squeezy License API                          │
│  https://api.lemonsqueezy.com/v1/licenses/activate              │
│  https://api.lemonsqueezy.com/v1/licenses/validate              │
│  https://api.lemonsqueezy.com/v1/licenses/deactivate            │
└─────────────────────────────────────────────────────────────────┘
```

**Data flow:**
- Financial data lives exclusively in `localStorage` on the user's device.
- The serverless layer only handles licence key operations — it never sees any budget, expense, or personal financial data.
- Lemon Squeezy handles all payment processing, checkout, and key generation.

---

## 2. Auth Flow

FincWin uses **licence-key-based access** rather than user accounts. There are no passwords protecting financial data — that is handled by the optional PIN lock stored locally.

```
Purchase → Lemon Squeezy generates key → Email to customer
        → Customer enters key on signin.html
        → Frontend calls /api/activate
        → Key stored in localStorage (fw_license_key, fw_instance_id, fw_plan)
        → App loads with appropriate feature set unlocked
```

**Account (optional):** A FincWin account (email + password) links multiple device activations to one email address, enabling key recovery and device management via `account.html`. The account is not required to use the app.

---

## 3. API Endpoints

### `POST /api/activate`

Activates a licence key for the current device.

**Request body:**
```json
{
  "license_key": "XXXX-XXXX-XXXX-XXXX",
  "instance_name": "Chrome on MacBook (truncated user-agent)"
}
```

**Response (success):**
```json
{
  "activated": true,
  "instance": {
    "id": "uuid-instance-id",
    "name": "Chrome on MacBook"
  },
  "meta": {
    "variant_name": "Pro",
    "customer_email": "user@example.com"
  }
}
```

**Response (failure):**
```json
{
  "activated": false,
  "error": "This key has reached its device limit."
}
```

**Server behaviour:** Proxies to `POST https://api.lemonsqueezy.com/v1/licenses/activate` with the `LEMON_SQUEEZY_API_KEY` server-side secret.

---

### `POST /api/validate`

Validates that a stored key + instance ID is still active. Called on every app load.

**Request body:**
```json
{
  "license_key": "XXXX-XXXX-XXXX-XXXX",
  "instance_id": "uuid-instance-id"
}
```

**Response (success):**
```json
{
  "valid": true,
  "plan": "Pro"
}
```

**Response (failure):**
```json
{
  "valid": false,
  "reason": "key_expired"
}
```

---

### `POST /api/deactivate`

Removes the current device from the licence, freeing up a slot.

**Request body:**
```json
{
  "license_key": "XXXX-XXXX-XXXX-XXXX",
  "instance_id": "uuid-instance-id"
}
```

**Response:**
```json
{
  "deactivated": true
}
```

---

## 4. Frontend Flow

```
landing.html  →  pricing.html  →  Lemon Squeezy Checkout
                                         │
                              Email with licence key
                                         │
                          signin.html?key=XXXX-XXXX-XXXX-XXXX
                                         │
                               POST /api/activate
                                         │
                    Store in localStorage: fw_license_key,
                    fw_instance_id, fw_plan
                                         │
                               index.html (app loads)
                                         │
                         On each load: POST /api/validate
                    ┌──────────────────────────────────────┐
                    │ valid → unlock plan features          │
                    │ invalid → prompt re-activation        │
                    └──────────────────────────────────────┘
```

**Checkout URL construction** (Lemon Squeezy):
```
https://fincwin.lemonsqueezy.com/checkout/buy/{VARIANT_ID}?checkout[custom][user_email]={email}
```

After purchase, configure the Lemon Squeezy webhook to redirect to:
```
https://www.fincwin.com/signin.html?key={license_key}&plan={variant_name}
```

---

## 5. Data Architecture — localStorage Schema

All financial data is stored in `localStorage` under the following keys:

```
fw_license_key        String    "XXXX-XXXX-XXXX-XXXX"
fw_instance_id        String    UUID from Lemon Squeezy activation
fw_plan               String    "Starter" | "Pro" | "Lifetime"
fw_pin_hash           String    SHA-256 hash of PIN (no plaintext stored)
fw_currency           String    ISO 4217 code e.g. "USD"
fw_income             Number    Monthly gross income
fw_envelopes          JSON      Array of {category, budget, spent}
fw_expenses           JSON      Array of {id, name, amount, frequency, category, date}
fw_loans              JSON      Array of {id, name, balance, rate, minPayment, extra}
fw_savings            JSON      Array of {id, name, target, current}
fw_settings           JSON      {theme, notifications, driveBackupEnabled}
fw_last_validated     Number    Unix timestamp of last /api/validate call
```

**Validation caching:** To avoid validating on every single page load, cache the result of `/api/validate` with a 24-hour TTL using `fw_last_validated`. On first load of the day, re-validate.

---

## 6. Serverless Deployment

### Vercel (recommended)

```
/api/
  activate.js   →  /api/activate
  validate.js   →  /api/validate
  deactivate.js →  /api/deactivate
```

`vercel.json`:
```json
{
  "functions": {
    "api/*.js": {
      "maxDuration": 10
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "https://www.fincwin.com" },
        { "key": "Access-Control-Allow-Methods", "value": "POST, OPTIONS" }
      ]
    }
  ]
}
```

**Environment variables** (set in Vercel dashboard):
```
LEMON_SQUEEZY_API_KEY=your_api_key_here
```

### Netlify alternative

Use `netlify/functions/` directory. Same logic, different file location. Set env vars in Netlify dashboard.

### Example activate.js (Vercel)

```javascript
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { license_key, instance_name } = req.body;
  if (!license_key || !instance_name) {
    return res.status(400).json({ activated: false, error: 'Missing fields' });
  }

  const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ license_key, instance_name })
  });

  const data = await response.json();

  if (data.activated) {
    return res.status(200).json({
      activated: true,
      instance: data.instance,
      meta: data.meta
    });
  } else {
    return res.status(200).json({
      activated: false,
      error: data.error || 'Activation failed'
    });
  }
}
```

---

## 7. Security Considerations

### Financial data — zero server exposure
- No financial data is ever transmitted to any server. All budget, expense, loan, and savings data lives in localStorage.
- Even the API endpoints have no ability to access financial data — they only proxy licence operations to Lemon Squeezy.

### Key validation
- The Lemon Squeezy API key is a server-side secret stored only as an environment variable. It is never exposed to the client.
- Licence keys are validated server-side on a daily basis. If a key is revoked (refund processed, fraud detected), the app will deactivate within 24 hours.

### PIN lock
- The PIN is hashed (SHA-256 minimum, bcrypt preferred) before storage in localStorage.
- PIN plaintext is never stored.

### CORS
- API endpoints restrict `Access-Control-Allow-Origin` to `https://www.fincwin.com` only. Local development uses a separate origin whitelist in a dev environment variable.

### Rate limiting
- Implement basic rate limiting on `/api/activate` (max 5 activations per IP per hour) to prevent brute-force key testing. Vercel Edge Middleware or a simple in-memory counter works for low traffic.

### Data export / backup
- When Google Drive backup is enabled (Pro/Lifetime), data is encrypted client-side before upload. Use the Web Crypto API: `AES-GCM` with a key derived from the licence key using `PBKDF2`.
- The server never sees the encryption key.

### Content Security Policy
Add a strict CSP header for all pages:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://api.lemonsqueezy.com;
```
