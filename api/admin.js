const _rateMap = new Map();
function rateOk(ip) {
  const now = Date.now();
  const e = _rateMap.get(ip) || { n: 0, reset: now + 60_000 };
  if (now > e.reset) { e.n = 0; e.reset = now + 60_000; }
  _rateMap.set(ip, { n: e.n + 1, reset: e.reset });
  return e.n < 20;
}

// Fetch every page of a Lemon Squeezy REST collection, following JSON:API
// `links.next`. Throws a descriptive error (with .status) on a non-2xx reply so
// the handler can distinguish an auth problem from a transient upstream error.
async function lsPages(startUrl, apiKey, label) {
  const items = [];
  let url = startUrl;
  while (url) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json' },
    });
    if (!r.ok) {
      let detail = '';
      try { const e = await r.json(); detail = e?.errors?.[0]?.detail || ''; } catch (_) {}
      const err = new Error(
        `Lemon Squeezy ${label} request failed (${r.status})` + (detail ? `: ${detail}` : '')
      );
      err.status = r.status;
      throw err;
    }
    const j = await r.json();
    items.push(...(j.data || []));
    url = j.links?.next ?? null;
  }
  return items;
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
    // `page[size]` is the JSON:API page param Lemon Squeezy expects (not `perPage`).
    // No `include` — we cross-reference orders ourselves, which avoids 400s from
    // invalid include paths and keeps the request robust.
    const [licenseKeys, orders] = await Promise.all([
      lsPages('https://api.lemonsqueezy.com/v1/license-keys?page[size]=100', apiKey, 'license-keys'),
      lsPages('https://api.lemonsqueezy.com/v1/orders?page[size]=100', apiKey, 'orders'),
    ]);

    // Index orders by id so each licence can resolve its customer + plan.
    const orderMap = {};
    for (const o of orders) orderMap[o.id] = o.attributes || {};

    const stats = { total: 0, active: 0, inactive: 0, expired: 0, disabled: 0, byPlan: {} };

    const licenses = licenseKeys.map(l => {
      const a = l.attributes || {};
      const status = a.status || 'unknown';
      stats.total++;
      if (status in stats) stats[status]++;

      const orderId = l.relationships?.order?.data?.id;
      const oa = (orderId && orderMap[orderId]) || {};
      // LS order attributes carry `first_order_item.variant_name` for the plan.
      const plan = oa.first_order_item?.variant_name || a.variant_name || 'Pro';
      stats.byPlan[plan] = (stats.byPlan[plan] || 0) + 1;

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
    for (const o of orders) {
      if (o.attributes?.status !== 'paid') continue;
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
    // Surface an actionable message instead of a bare 502.
    if (err.status === 401 || err.status === 403) {
      return res.status(502).json({
        error: 'Lemon Squeezy rejected the API key (' + err.status + '). Check LEMON_SQUEEZY_API_KEY ' +
               'in Vercel — it may be invalid, revoked, or missing read access.'
      });
    }
    return res.status(502).json({ error: err.message || 'Upstream request failed' });
  }
}
