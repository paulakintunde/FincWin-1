import { checkRateLimit } from '../lib/rate-limit.js';

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

// Non-critical fetch: returns [] on any error so the dashboard still loads.
async function lsPagesSafe(startUrl, apiKey, label) {
  try { return await lsPages(startUrl, apiKey, label); } catch (_) { return []; }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!await checkRateLimit(ip, 'admin', { limit: 20, windowSecs: 60 })) return res.status(429).json({ error: 'rate_limited' });

  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return res.status(503).json({ error: 'Admin not configured — set ADMIN_TOKEN env var' });

  const provided = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!provided || provided !== adminToken) return res.status(401).json({ error: 'Unauthorized' });

  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      ls_configured: false,
      stats: { total: 0, active: 0, inactive: 0, expired: 0, disabled: 0, byPlan: {} },
      licenses: [], revenue: { total_usd: '0.00', orders_count: 0, refunded_usd: '0.00', refunded_count: 0, orders_raw: [] },
      discounts: [], customers: [], subscriptions: [], variants: [], webhooks: [], store_id: null,
    });
  }

  try {
    // Critical: licences + orders must succeed or we return an error.
    const [licenseKeys, orders] = await Promise.all([
      lsPages('https://api.lemonsqueezy.com/v1/license-keys?page[size]=100', apiKey, 'license-keys'),
      lsPages('https://api.lemonsqueezy.com/v1/orders?page[size]=100', apiKey, 'orders'),
    ]);

    // Non-critical: each failure returns [] so the page still loads with partial data.
    const [stores, discountsRaw, variantsRaw, customersRaw, subscriptionsRaw, webhooksRaw] = await Promise.all([
      lsPagesSafe('https://api.lemonsqueezy.com/v1/stores', apiKey, 'stores'),
      lsPagesSafe('https://api.lemonsqueezy.com/v1/discounts?page[size]=100', apiKey, 'discounts'),
      lsPagesSafe('https://api.lemonsqueezy.com/v1/variants?page[size]=100', apiKey, 'variants'),
      lsPagesSafe('https://api.lemonsqueezy.com/v1/customers?page[size]=100', apiKey, 'customers'),
      lsPagesSafe('https://api.lemonsqueezy.com/v1/subscriptions?page[size]=100', apiKey, 'subscriptions'),
      lsPagesSafe('https://api.lemonsqueezy.com/v1/webhooks', apiKey, 'webhooks'),
    ]);

    const storeId = stores[0]?.id || null;

    // Index orders by id for licence enrichment.
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
      const plan = oa.first_order_item?.variant_name || a.variant_name || 'Pro';
      stats.byPlan[plan] = (stats.byPlan[plan] || 0) + 1;

      return {
        id:                l.id,
        key:               a.key,
        status,
        plan,
        disabled:          a.disabled ?? false,
        customer_name:     oa.user_name  || '',
        customer_email:    oa.user_email || '',
        activation_limit:  a.activation_limit  ?? 3,
        activations_count: a.activations_count ?? 0,
        created_at:        a.created_at,
        expires_at:        a.expires_at ?? null,
        order_id:          orderId || null,
      };
    });

    licenses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let revCents = 0, paidCount = 0, refundCents = 0, refundCount = 0;
    for (const o of orders) {
      const s = o.attributes?.status;
      if (s === 'paid')     { revCents   += o.attributes.total ?? 0; paidCount++; }
      if (s === 'refunded') { refundCents += o.attributes.total ?? 0; refundCount++; }
    }

    // Slim order list for client-side monthly chart bucketing.
    const ordersRaw = orders.map(o => ({
      status:     o.attributes?.status || '',
      total:      o.attributes?.total  ?? 0,
      created_at: o.attributes?.created_at || '',
    }));

    const discounts = discountsRaw.map(d => {
      const a = d.attributes || {};
      return {
        id: d.id,
        name: a.name || '',
        code: a.code || '',
        amount: a.amount,
        amount_type: a.amount_type,
        is_limited_redemptions: a.is_limited_redemptions,
        max_redemptions: a.max_redemptions,
        redemptions_count: a.redemptions_count || 0,
        expires_at: a.expires_at,
        created_at: a.created_at,
        status: a.status || 'published',
      };
    });

    const variants = variantsRaw
      .filter(v => (v.attributes?.status || 'published') === 'published')
      .map(v => ({
        id:    v.id,
        name:  v.attributes?.name  || 'Unknown',
        price: v.attributes?.price ?? 0,
      }));

    const customers = customersRaw.map(c => {
      const a = c.attributes || {};
      return {
        id:         c.id,
        name:       a.name    || '',
        email:      a.email   || '',
        status:     a.status  || 'subscribed',
        country:    a.country || '',
        created_at: a.created_at,
      };
    });

    const subscriptions = subscriptionsRaw.map(s => {
      const a = s.attributes || {};
      return {
        id:           s.id,
        status:       a.status       || 'unknown',
        user_name:    a.user_name    || '',
        user_email:   a.user_email   || '',
        variant_name: a.variant_name || '',
        product_name: a.product_name || '',
        renews_at:    a.renews_at,
        ends_at:      a.ends_at,
        pause:        a.pause,
        cancelled:    a.cancelled    || false,
        created_at:   a.created_at,
      };
    });

    const webhooks = webhooksRaw.map(w => ({
      id:         w.id,
      url:        w.attributes?.url    || '',
      events:     w.attributes?.events || [],
      created_at: w.attributes?.created_at,
    }));

    return res.status(200).json({
      stats,
      licenses,
      revenue: {
        total_usd:      (revCents / 100).toFixed(2),
        orders_count:   paidCount,
        refunded_usd:   (refundCents / 100).toFixed(2),
        refunded_count: refundCount,
        orders_raw:     ordersRaw,
      },
      discounts,
      variants,
      customers,
      subscriptions,
      webhooks,
      store_id: storeId,
    });

  } catch (err) {
    const lsMsg = (err.status === 401 || err.status === 403)
      ? `Lemon Squeezy rejected the API key (${err.status}). Check LEMON_SQUEEZY_API_KEY in Vercel — it may be invalid, revoked, or missing read access.`
      : (err.message || 'Upstream request failed');
    return res.status(200).json({
      ls_error: lsMsg,
      stats: { total: 0, active: 0, inactive: 0, expired: 0, disabled: 0, byPlan: {} },
      licenses: [],
      revenue: { total_usd: '0.00', orders_count: 0, refunded_usd: '0.00', refunded_count: 0, orders_raw: [] },
      discounts: [], customers: [], subscriptions: [], variants: [], webhooks: [], store_id: null,
    });
  }
}
