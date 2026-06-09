const _rateMap = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = _rateMap.get(ip) || { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60_000; }
  entry.count++;
  _rateMap.set(ip, entry);
  return entry.count <= 30;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ valid: false, reason: 'rate_limited' });
  }

  const { license_key, instance_id } = req.body || {};
  if (!license_key || !instance_id) {
    return res.status(400).json({ valid: false, reason: 'missing_params' });
  }

  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ valid: false, reason: 'server_error' });
  }

  let lsRes, lsData;
  try {
    lsRes = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ license_key, instance_id }),
    });
    lsData = await lsRes.json();
  } catch (err) {
    // Network failure — tell frontend to allow offline use
    return res.status(502).json({ valid: false, reason: 'network_error' });
  }

  if (!lsRes.ok || !lsData.valid) {
    return res.status(200).json({ valid: false, reason: lsData.error || 'invalid_key' });
  }

  const planName = lsData.meta?.variant_name || 'Pro';
  const planLow  = planName.toLowerCase();
  const tier     = planLow.includes('lifetime') ? 'lifetime' : 'pro';

  return res.status(200).json({
    valid: true,
    tier,
    plan:             planName,
    customer_name:    lsData.meta?.customer_name   || '',
    customer_email:   lsData.meta?.customer_email  || '',
    activation_limit: lsData.license_key?.activation_limit ?? 3,
    activation_usage: lsData.license_key?.activation_usage ?? 1,
    key_status:       lsData.license_key?.status   || 'active',
    expires_at:       lsData.license_key?.expires_at ?? null,
    instance_name:    lsData.instance?.name        || '',
  });
}
