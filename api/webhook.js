import crypto from 'crypto';

// Disable Vercel's automatic body parsing — HMAC verification requires the raw bytes.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

// Find all license keys for a given LemonSqueezy order ID, then deactivate every instance.
async function deactivateByOrderId(orderId, apiKey) {
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' };
  const lkRes = await fetch(
    `https://api.lemonsqueezy.com/v1/license-keys?filter[order_id]=${encodeURIComponent(orderId)}`,
    { headers }
  );
  if (!lkRes.ok) return;
  const lkData = await lkRes.json();
  for (const lk of (lkData.data || [])) {
    await deactivateLicenseKeyInstances(String(lk.id), lk.attributes?.key, apiKey);
  }
}

// Deactivate every active instance of a specific license key.
async function deactivateLicenseKeyInstances(lkId, licenseKey, apiKey) {
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' };
  const instRes = await fetch(
    `https://api.lemonsqueezy.com/v1/license-key-instances?filter[license_key_id]=${encodeURIComponent(lkId)}`,
    { headers }
  );
  if (!instRes.ok) return;
  const instData = await instRes.json();
  for (const inst of (instData.data || [])) {
    await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ license_key: licenseKey || '', instance_id: inst.id }),
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'not_configured' });

  const buf = await readRawBody(req);
  const sig = req.headers['x-signature'] || '';

  const expected = crypto.createHmac('sha256', secret).update(buf).digest('hex');
  // timingSafeEqual requires equal-length buffers — reject on length mismatch first.
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return res.status(401).json({ error: 'invalid_signature' });
  }

  let event;
  try {
    event = JSON.parse(buf.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }

  const eventName = event.meta?.event_name || '';
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'api_key_missing' });

  try {
    if (eventName === 'order_refunded') {
      // Immediate invalidation: deactivate all instances tied to the refunded order.
      const orderId = event.data?.id;
      if (orderId) await deactivateByOrderId(String(orderId), apiKey);

    } else if (eventName === 'subscription_expired') {
      // Subscription billing period ended; key is now truly expired.
      const orderId = event.data?.attributes?.order_id;
      if (orderId) await deactivateByOrderId(String(orderId), apiKey);

    } else if (eventName === 'license_key_disabled') {
      // Key was disabled manually in the LS dashboard.
      const lkId = event.data?.id;
      const licenseKey = event.data?.attributes?.key;
      if (lkId) await deactivateLicenseKeyInstances(String(lkId), licenseKey, apiKey);
    }
    // subscription_cancelled: key stays valid until period end; validate.js handles expiry on next app open.
  } catch (err) {
    // Log but return 200 so LemonSqueezy does not retry indefinitely.
    console.error('webhook error:', err.message);
  }

  return res.status(200).json({ received: true });
}
