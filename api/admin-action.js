import { checkRateLimit } from '../lib/rate-limit.js';

const LS = 'https://api.lemonsqueezy.com/v1';

function jsonHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
  };
}

async function lsReq(method, url, apiKey, body) {
  const opts = { method, headers: jsonHeaders(apiKey) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  if (!r.ok && r.status !== 204) {
    let detail = '';
    try { const e = await r.json(); detail = e?.errors?.[0]?.detail || ''; } catch (_) {}
    const err = new Error(`LS ${r.status}${detail ? ': ' + detail : ''}`);
    err.status = r.status;
    throw err;
  }
  if (r.status === 204 || r.headers.get('content-length') === '0') return {};
  return r.json();
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!await checkRateLimit(ip, 'admin', { limit: 30, windowSecs: 60 })) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return res.status(503).json({ error: 'Admin not configured' });
  const provided = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!provided || provided !== adminToken) return res.status(401).json({ error: 'Unauthorized' });

  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Lemon Squeezy not configured' });

  const body = req.body || {};
  const { action } = body;

  try {

    // ── PHASE 1: LICENCE KEY ACTIONS ─────────────────────────────────────────

    if (action === 'disable_key' || action === 'enable_key') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await lsReq('PATCH', `${LS}/license-keys/${id}`, apiKey, {
        data: { type: 'license-keys', id: String(id), attributes: { disabled: action === 'disable_key' } },
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'update_key_limit') {
      const { id, activation_limit } = body;
      if (!id || activation_limit == null) return res.status(400).json({ error: 'id and activation_limit required' });
      await lsReq('PATCH', `${LS}/license-keys/${id}`, apiKey, {
        data: { type: 'license-keys', id: String(id), attributes: { activation_limit: Number(activation_limit) } },
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'update_key_expiry') {
      const { id, expires_at } = body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await lsReq('PATCH', `${LS}/license-keys/${id}`, apiKey, {
        data: { type: 'license-keys', id: String(id), attributes: { expires_at: expires_at || null } },
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'list_instances') {
      const { key_id } = body;
      if (!key_id) return res.status(400).json({ error: 'key_id required' });
      const j = await lsReq('GET', `${LS}/license-key-instances?filter[license_key_id]=${encodeURIComponent(key_id)}`, apiKey);
      return res.status(200).json({
        ok: true,
        instances: (j.data || []).map(inst => ({
          id: inst.id,
          name: inst.attributes?.name || 'Unknown device',
          created_at: inst.attributes?.created_at,
        })),
      });
    }

    if (action === 'deactivate_instance') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await lsReq('DELETE', `${LS}/license-key-instances/${id}`, apiKey);
      return res.status(200).json({ ok: true });
    }

    // ── PHASE 2: DISCOUNT ACTIONS ────────────────────────────────────────────

    if (action === 'create_discount') {
      const { store_id, name, code, amount, amount_type, is_limited_redemptions, max_redemptions, expires_at } = body;
      if (!store_id || !name || !code || amount == null || !amount_type) {
        return res.status(400).json({ error: 'store_id, name, code, amount, amount_type are required' });
      }
      const j = await lsReq('POST', `${LS}/discounts`, apiKey, {
        data: {
          type: 'discounts',
          attributes: {
            name,
            code: String(code).toUpperCase(),
            amount: Number(amount),
            amount_type,
            is_limited_redemptions: Boolean(is_limited_redemptions),
            max_redemptions: is_limited_redemptions ? (Number(max_redemptions) || 1) : null,
            expires_at: expires_at || null,
            duration: 'once',
            duration_in_months: null,
            is_limited_to_products: false,
          },
          relationships: { store: { data: { type: 'stores', id: String(store_id) } } },
        },
      });
      return res.status(200).json({ ok: true, id: j.data?.id, code: j.data?.attributes?.code });
    }

    if (action === 'delete_discount') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await lsReq('DELETE', `${LS}/discounts/${id}`, apiKey);
      return res.status(200).json({ ok: true });
    }

    // ── PHASE 3: GIFT CHECKOUT ───────────────────────────────────────────────

    if (action === 'create_gift_checkout') {
      const { store_id, variant_id, email } = body;
      if (!store_id || !variant_id) return res.status(400).json({ error: 'store_id and variant_id required' });
      const j = await lsReq('POST', `${LS}/checkouts`, apiKey, {
        data: {
          type: 'checkouts',
          attributes: {
            custom_price: 0,
            checkout_data: email ? { email } : {},
          },
          relationships: {
            store:   { data: { type: 'stores',   id: String(store_id) } },
            variant: { data: { type: 'variants', id: String(variant_id) } },
          },
        },
      });
      return res.status(200).json({ ok: true, url: j.data?.attributes?.url || null });
    }

    // ── PHASE 4: CUSTOMER ACTIONS ────────────────────────────────────────────

    if (action === 'get_portal_url') {
      const { customer_id } = body;
      if (!customer_id) return res.status(400).json({ error: 'customer_id required' });
      const j = await lsReq('GET', `${LS}/customers/${customer_id}`, apiKey);
      return res.status(200).json({ ok: true, url: j.data?.attributes?.urls?.customer_portal || null });
    }

    // ── PHASE 6: SUBSCRIPTION ACTIONS ───────────────────────────────────────

    if (action === 'pause_subscription') {
      const { id, mode } = body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await lsReq('PATCH', `${LS}/subscriptions/${id}`, apiKey, {
        data: { type: 'subscriptions', id: String(id), attributes: { pause: { mode: mode || 'void' } } },
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'resume_subscription') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await lsReq('PATCH', `${LS}/subscriptions/${id}`, apiKey, {
        data: { type: 'subscriptions', id: String(id), attributes: { pause: null, cancelled: false } },
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'cancel_subscription') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await lsReq('DELETE', `${LS}/subscriptions/${id}`, apiKey);
      return res.status(200).json({ ok: true });
    }

    // ── PHASE 7: WEBHOOK ACTIONS ─────────────────────────────────────────────

    if (action === 'create_webhook') {
      const { store_id, url: wUrl, events, secret } = body;
      if (!store_id || !wUrl || !events || !secret) {
        return res.status(400).json({ error: 'store_id, url, events, secret required' });
      }
      const j = await lsReq('POST', `${LS}/webhooks`, apiKey, {
        data: {
          type: 'webhooks',
          attributes: { url: wUrl, events: Array.isArray(events) ? events : [events], secret },
          relationships: { store: { data: { type: 'stores', id: String(store_id) } } },
        },
      });
      return res.status(200).json({ ok: true, id: j.data?.id });
    }

    if (action === 'delete_webhook') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'id required' });
      await lsReq('DELETE', `${LS}/webhooks/${id}`, apiKey);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('[admin-action]', err.message);
    const status = (err.status >= 400 && err.status < 600) ? err.status : 500;
    return res.status(status).json({ error: err.message || 'Internal error' });
  }
}
