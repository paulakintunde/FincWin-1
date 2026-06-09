const _rateMap = new Map();
function rateOk(ip) {
  const now = Date.now();
  const e = _rateMap.get(ip) || { n: 0, reset: now + 60_000 };
  if (now > e.reset) { e.n = 0; e.reset = now + 60_000; }
  _rateMap.set(ip, { n: e.n + 1, reset: e.reset });
  return e.n < 20;
}

async function lsPages(startUrl, apiKey) {
  const items = [];
  const included = [];
  let url = startUrl;
  while (url) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' },
    });
    if (!r.ok) throw new Error(`LS API ${r.status} at ${url}`);
    const j = await r.json();
    items.push(...(j.data || []));
    included.push(...(j.included || []));
    url = j.links?.next ?? null;
  }
  return { items, included };
}

function buildMap(included) {
  const m = {};
  for (const x of included) m[`${x.type}:${x.id}`] = x;
  return m;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!rateOk(ip)) return res.status(429).json({ error: 'rate_limited' });

  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return res.status(503).json({ error: 'Admin not configured — set ADMIN_TOKEN env var' });

  const provided = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!provided || provided !== adminToken) return res.status(401).json({ error: 'Unauthorized' });

  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'LEMON_SQUEEZY_API_KEY not set' });

  try {
    const [lkResult, ordersResult] = await Promise.all([
      lsPages(
        'https://api.lemonsqueezy.com/v1/license-keys?perPage=100&include=variant,order',
        apiKey
      ),
      lsPages('https://api.lemonsqueezy.com/v1/orders?perPage=100', apiKey),
    ]);

    const incMap = buildMap(lkResult.included);

    const stats = { total: 0, active: 0, inactive: 0, expired: 0, disabled: 0, byPlan: {} };

    const licenses = lkResult.items.map(l => {
      const a = l.attributes;
      const status = a.status || 'unknown';
      stats.total++;
      if (status in stats) stats[status]++;

      const variantId = l.relationships?.variant?.data?.id;
      const variant = variantId ? incMap[`variants:${variantId}`] : null;
      const plan = variant?.attributes?.name || a.variant_name || 'Pro';
      stats.byPlan[plan] = (stats.byPlan[plan] || 0) + 1;

      const orderId = l.relationships?.order?.data?.id;
      const order = orderId ? incMap[`orders:${orderId}`] : null;
      const oa = order?.attributes || {};

      return {
        id:                l.id,
        key:               a.key,
        status,
        plan,
        customer_name:     oa.user_name  || '',
        customer_email:    oa.user_email || '',
        activation_limit:  a.activation_limit  ?? 3,
        activations_count: a.activations_count ?? 0,
        created_at:        a.created_at,
        expires_at:        a.expires_at ?? null,
      };
    });

    licenses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let revCents = 0;
    let paidCount = 0;
    for (const o of ordersResult.items) {
      if (o.attributes.status !== 'paid') continue;
      revCents += o.attributes.total ?? 0;
      paidCount++;
    }

    return res.status(200).json({
      stats,
      licenses,
      revenue: {
        total_usd:    (revCents / 100).toFixed(2),
        orders_count: paidCount,
      },
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
