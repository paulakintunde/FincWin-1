// admin.js — FincWin admin dashboard

const SESSION_KEY = 'fw_admin_token';

// ── State ────────────────────────────────────────────────────────────────────
let _data           = null;
let _allLicences    = [];
let _filteredLics   = [];
let _statusFilter   = 'all';
let _sortCol        = 'created_at';
let _sortDir        = 'desc';
let _drawerLicence  = null;
let _drawerLimitVal = 3;
let _autoRefresh    = false;
let _autoTimer      = null;
let _revenueChart   = null;

// ── Auth ─────────────────────────────────────────────────────────────────────
function getToken() { return sessionStorage.getItem(SESSION_KEY) || ''; }

async function unlock() {
  const input = document.getElementById('token-input');
  const token = input.value.trim();
  if (!token) { showAuthError('Enter your admin token.'); return; }

  const btn = document.getElementById('btn-unlock');
  btn.disabled = true; btn.textContent = 'Verifying…';
  hideAuthError();

  try {
    const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { showAuthError('Invalid token.'); btn.disabled = false; btn.textContent = 'Unlock dashboard →'; return; }
    if (res.status === 503) { showAuthError('Admin not configured. Set ADMIN_TOKEN in Vercel.'); btn.disabled = false; btn.textContent = 'Unlock dashboard →'; return; }
    if (!res.ok) {
      let msg = 'Server error (' + res.status + '). Try again.';
      try { const e = await res.json(); if (e?.error) msg = e.error; } catch (_) {}
      showAuthError(msg); btn.disabled = false; btn.textContent = 'Unlock dashboard →'; return;
    }
    sessionStorage.setItem(SESSION_KEY, token);
    input.value = '';
    renderDashboard(await res.json());
  } catch {
    showAuthError('Network error — could not reach the server.');
    btn.disabled = false; btn.textContent = 'Unlock dashboard →';
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  _data = null;
  stopAutoRefresh();
  document.getElementById('auth-screen').style.display = '';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('token-input').value = '';
}

function showAuthError(msg) { const el = document.getElementById('auth-error'); el.textContent = msg; el.style.display = 'block'; }
function hideAuthError()    { document.getElementById('auth-error').style.display = 'none'; }

// ── Auto-login ────────────────────────────────────────────────────────────────
(async function tryAutoLogin() {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { if (res.status === 401 || res.status === 403) sessionStorage.removeItem(SESSION_KEY); return; }
    renderDashboard(await res.json());
  } catch { /* keep token, show auth screen */ }
})();

// ── Refresh ───────────────────────────────────────────────────────────────────
async function refreshData() {
  const token = getToken();
  if (!token) return;
  const btn = document.getElementById('btn-refresh');
  if (btn) { btn.disabled = true; btn.textContent = 'Refreshing…'; }
  try {
    const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) { logout(); return; }
    if (res.ok) { renderDashboard(await res.json()); showToast('Dashboard refreshed'); }
  } catch { showToast('Network error — refresh failed'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Refresh'; } }
}

// ── Auto-refresh toggle ───────────────────────────────────────────────────────
function toggleAutoRefresh() {
  _autoRefresh = !_autoRefresh;
  const btn = document.getElementById('btn-auto-refresh');
  if (_autoRefresh) {
    btn.textContent = 'Auto-refresh: On';
    btn.classList.add('active');
    _autoTimer = setInterval(refreshData, 5 * 60 * 1000);
  } else {
    stopAutoRefresh();
  }
}
function stopAutoRefresh() {
  _autoRefresh = false;
  clearInterval(_autoTimer);
  const btn = document.getElementById('btn-auto-refresh');
  if (btn) { btn.textContent = 'Auto-refresh: Off'; btn.classList.remove('active'); }
}

// ── callAction ────────────────────────────────────────────────────────────────
async function callAction(action, params = {}) {
  const token = getToken();
  if (!token) { logout(); return null; }
  const res = await fetch('/api/admin-action', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  if (res.status === 401 || res.status === 403) { logout(); return null; }
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

// ── Render dashboard ──────────────────────────────────────────────────────────
function renderDashboard(data) {
  _data = data;
  _allLicences = data.licenses || [];

  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';

  if (data.ls_configured === false) {
    showLsNotice('Lemon Squeezy is not configured. Set LEMON_SQUEEZY_API_KEY in Vercel to enable licence and revenue data.');
  } else if (data.ls_error) {
    showLsNotice('Lemon Squeezy error: ' + data.ls_error);
  } else {
    hideLsNotice();
  }

  const now = new Date().toLocaleString();
  document.getElementById('nav-meta').textContent = _allLicences.length + ' licences · refreshed ' + now;
  document.getElementById('overview-updated').textContent = 'Last refreshed ' + now;

  renderOverview(data);
  applyLicenceFilter();
  renderRevenue(data);
  renderCustomers(data.customers || []);
  renderSubscriptions(data.subscriptions || []);
  renderDiscounts(data.discounts || []);
  renderWebhooks(data.webhooks || []);

  // Populate gift modal variant dropdown
  populateVariantSelect(data.variants || []);

  document.getElementById('overview-loading').style.display = 'none';
  document.getElementById('overview-content').style.display = 'block';
}

// ── Overview ──────────────────────────────────────────────────────────────────
function renderOverview(data) {
  const s = data.stats;
  const r = data.revenue;
  const bad = (s.expired || 0) + (s.inactive || 0) + (s.disabled || 0);
  const activeRate = s.total ? Math.round((s.active / s.total) * 100) : 0;

  // Delta: licences added today
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = _allLicences.filter(l => (l.created_at || '').startsWith(today)).length;
  const deltaHtml = todayCount > 0 ? `<span class="stat-delta">+${todayCount} today</span>` : '';

  document.getElementById('st-total').innerHTML    = s.total + deltaHtml;
  document.getElementById('st-total-sub').textContent =
    Object.entries(s.byPlan).map(([k, v]) => v + ' ' + k).join(' · ') || '—';
  document.getElementById('st-active').textContent    = s.active;
  document.getElementById('st-active-sub').textContent = activeRate + '% of all licences';
  document.getElementById('st-bad').textContent        = bad;
  document.getElementById('st-bad-sub').textContent    = (s.expired || 0) + ' expired · ' + (s.inactive || 0) + ' inactive';
  document.getElementById('st-rev').textContent        = '$' + Number(r.total_usd).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  document.getElementById('st-rev-sub').textContent    = r.orders_count + ' paid orders';

  const total = s.total || 1;
  const rows = Object.entries(s.byPlan).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
    const pct = Math.round((count / total) * 100);
    return `<div class="plan-row-item">
      <span class="plan-name">${esc(name)}</span>
      <div class="plan-bar-wrap"><div class="plan-bar" style="width:${pct}%"></div></div>
      <span class="plan-count">${count}</span>
    </div>`;
  }).join('');
  document.getElementById('plan-breakdown-rows').innerHTML = rows || '<p style="font-size:13px;color:var(--muted)">No plan data available.</p>';

  document.getElementById('recent-tbody').innerHTML = recentRows(_allLicences.slice(0, 10));
}

function recentRows(list) {
  if (!list.length) return `<tr><td colspan="5" class="td-empty">No licences yet.</td></tr>`;
  return list.map(l => `
    <tr>
      <td>
        <div style="font-size:13px;font-weight:400">${esc(l.customer_name || '—')}</div>
        <div class="td-email">${esc(l.customer_email || '—')}</div>
      </td>
      <td>${esc(l.plan)}</td>
      <td>${statusBadge(l.status)}</td>
      <td class="td-devices">
        <span class="${l.activations_count >= l.activation_limit ? 'full' : ''}">${l.activations_count}</span>
        <span style="color:var(--muted)"> / ${l.activation_limit}</span>
      </td>
      <td class="td-date">${fmtDate(l.created_at)}</td>
    </tr>`).join('');
}

// ── Licences ──────────────────────────────────────────────────────────────────
function applyLicenceFilter() {
  const q = (document.getElementById('search-input')?.value || '').toLowerCase();
  let list = _allLicences;

  if (_statusFilter !== 'all') {
    list = list.filter(l => {
      if (_statusFilter === 'disabled') return l.disabled;
      return (l.status || '').toLowerCase() === _statusFilter;
    });
  }

  if (q) {
    list = list.filter(l =>
      (l.customer_email || '').toLowerCase().includes(q) ||
      (l.customer_name  || '').toLowerCase().includes(q) ||
      (l.key            || '').toLowerCase().includes(q) ||
      (l.plan           || '').toLowerCase().includes(q)
    );
  }

  list = sortLicences(list);
  _filteredLics = list;
  renderLicences(list);
}

function sortLicences(list) {
  return [...list].sort((a, b) => {
    let va = a[_sortCol] ?? '';
    let vb = b[_sortCol] ?? '';
    if (_sortCol === 'created_at') { va = new Date(va); vb = new Date(vb); }
    else if (_sortCol === 'activations_count') { va = Number(va); vb = Number(vb); }
    else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
    if (va < vb) return _sortDir === 'asc' ? -1 : 1;
    if (va > vb) return _sortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderLicences(list) {
  document.getElementById('lic-count').textContent = list.length + ' licence' + (list.length === 1 ? '' : 's');
  document.getElementById('licences-tbody').innerHTML = list.length
    ? list.map(l => `
      <tr class="clickable" data-lic-id="${esc(l.id)}">
        <td>
          <div style="font-size:13px;font-weight:400">${esc(l.customer_name || '—')}</div>
          <div class="td-email">${esc(l.customer_email || '—')}</div>
        </td>
        <td>${esc(l.plan)}</td>
        <td>${statusBadge(l.disabled ? 'disabled' : l.status)}</td>
        <td class="td-devices">
          <span class="${l.activations_count >= l.activation_limit ? 'full' : ''}">${l.activations_count}</span>
          <span style="color:var(--muted)"> / ${l.activation_limit}</span>
        </td>
        <td><span class="td-key" title="${esc(l.key)}">${maskKey(l.key)}</span></td>
        <td class="td-date">${fmtDate(l.created_at)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" class="td-empty">No licences match your filter.</td></tr>`;
}

// ── Revenue ───────────────────────────────────────────────────────────────────
function renderRevenue(data) {
  const r = data.stats ? data : _data;
  const rev = r.revenue;
  const s   = r.stats;
  const totalUsd  = Number(rev.total_usd);
  const avg       = rev.orders_count ? (totalUsd / rev.orders_count).toFixed(0) : 0;
  const activeRate = s.total ? Math.round((s.active / s.total) * 100) : 0;

  document.getElementById('rev-total').textContent     = '$' + totalUsd.toLocaleString('en', { minimumFractionDigits: 0 });
  document.getElementById('rev-orders').textContent    = rev.orders_count + ' paid orders';
  document.getElementById('rev-avg').textContent       = '$' + avg;
  document.getElementById('rev-rate').textContent      = activeRate + '%';
  document.getElementById('rev-refunded').textContent  = '$' + Number(rev.refunded_usd || 0).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  document.getElementById('rev-refunded-sub').textContent = (rev.refunded_count || 0) + ' refunded orders';

  const total = s.total || 1;
  const planRows = Object.entries(s.byPlan).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
    const pct = Math.round((count / total) * 100);
    return `<div class="plan-row-item">
      <span class="plan-name">${esc(name)}</span>
      <div class="plan-bar-wrap"><div class="plan-bar" style="width:${pct}%"></div></div>
      <span class="plan-count">${count}</span>
    </div>`;
  }).join('');
  document.getElementById('rev-plan-rows').innerHTML = planRows || '<p style="font-size:13px;color:var(--muted)">No plan data.</p>';

  // Monthly breakdown
  const monthly = buildMonthlyData(rev.orders_raw || []);
  renderMonthlyTable(monthly);
  renderRevenueChart(monthly);
}

function buildMonthlyData(ordersRaw) {
  const map = {};
  for (const o of ordersRaw) {
    if (o.status !== 'paid') continue;
    const d = new Date(o.created_at);
    if (isNaN(d)) continue;
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!map[key]) map[key] = { orders: 0, cents: 0 };
    map[key].orders++;
    map[key].cents += o.total || 0;
  }

  // Last 12 months in order
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
    months.push({ key, label, orders: map[key]?.orders || 0, usd: (map[key]?.cents || 0) / 100 });
  }
  return months;
}

function renderMonthlyTable(months) {
  const tbody = document.getElementById('monthly-tbody');
  if (!tbody) return;
  const rows = months.filter(m => m.orders > 0).reverse().map(m =>
    `<tr>
      <td>${esc(m.label)}</td>
      <td>${m.orders}</td>
      <td>$${m.usd.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>`
  ).join('');
  tbody.innerHTML = rows || `<tr><td colspan="3" class="td-empty">No paid orders recorded.</td></tr>`;
}

function renderRevenueChart(months) {
  const canvas = document.getElementById('revenue-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (_revenueChart) { _revenueChart.destroy(); _revenueChart = null; }
  _revenueChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        data: months.map(m => m.usd),
        backgroundColor: 'rgba(90,110,63,0.75)',
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => '$' + ctx.raw.toFixed(2) } } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { callback: v => '$' + v, font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      },
    },
  });
}

// ── Customers ─────────────────────────────────────────────────────────────────
function renderCustomers(customers) {
  document.getElementById('cust-count').textContent = customers.length + ' customer' + (customers.length === 1 ? '' : 's');

  if (!customers.length) {
    document.getElementById('customers-tbody').innerHTML = `<tr><td colspan="5" class="td-empty">No customers found.</td></tr>`;
    return;
  }

  // Count active licences per email
  const licsByEmail = {};
  for (const l of _allLicences) {
    const e = (l.customer_email || '').toLowerCase();
    if (!licsByEmail[e]) licsByEmail[e] = 0;
    if (!l.disabled && l.status === 'active') licsByEmail[e]++;
  }

  document.getElementById('customers-tbody').innerHTML = customers.map(c => {
    const lics = licsByEmail[(c.email || '').toLowerCase()] || 0;
    return `<tr>
      <td>
        <div style="font-size:13px;font-weight:400">${esc(c.name || '—')}</div>
        <div class="td-email">${esc(c.email || '—')}</div>
      </td>
      <td class="td-date">${esc(c.country || '—')}</td>
      <td>${lics > 0 ? `<span class="badge active"><span class="badge-dot"></span>${lics} active</span>` : '<span style="color:var(--muted);font-size:12px">—</span>'}</td>
      <td class="td-date">${fmtDate(c.created_at)}</td>
      <td class="td-actions">
        <button type="button" class="btn-action-sm" data-action="copy-portal" data-customer-id="${esc(c.id)}">Portal link</button>
      </td>
    </tr>`;
  }).join('');
}

function filterCustomers() {
  const q = (document.getElementById('cust-search')?.value || '').toLowerCase();
  const customers = _data?.customers || [];
  if (!q) { renderCustomers(customers); return; }
  renderCustomers(customers.filter(c =>
    (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
  ));
}

// ── Subscriptions ─────────────────────────────────────────────────────────────
function renderSubscriptions(subs) {
  document.getElementById('sub-count').textContent = subs.length + ' subscription' + (subs.length === 1 ? '' : 's');

  if (!subs.length) {
    document.getElementById('subscriptions-tbody').innerHTML = `<tr><td colspan="5" class="td-empty">No subscriptions found.</td></tr>`;
    return;
  }

  document.getElementById('subscriptions-tbody').innerHTML = subs.map(s => {
    const statusKey = s.pause ? 'paused' : (s.cancelled ? 'cancelled' : s.status);
    const renews = s.renews_at || s.ends_at;
    return `<tr>
      <td>
        <div style="font-size:13px;font-weight:400">${esc(s.user_name || '—')}</div>
        <div class="td-email">${esc(s.user_email || '—')}</div>
      </td>
      <td>${esc(s.variant_name || s.product_name || '—')}</td>
      <td>${statusBadge(statusKey)}</td>
      <td class="td-date">${renews ? fmtDate(renews) : '—'}</td>
      <td class="td-actions" style="display:flex;gap:6px;padding-top:14px">
        ${!s.cancelled && !s.pause ? `<button type="button" class="btn-action-sm" data-action="pause-sub" data-id="${esc(s.id)}">Pause</button>` : ''}
        ${s.pause ? `<button type="button" class="btn-action-sm" data-action="resume-sub" data-id="${esc(s.id)}">Resume</button>` : ''}
        ${!s.cancelled ? `<button type="button" class="btn-danger-sm" data-action="cancel-sub" data-id="${esc(s.id)}">Cancel</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

// ── Discounts ─────────────────────────────────────────────────────────────────
function renderDiscounts(discounts) {
  document.getElementById('disc-count').textContent = discounts.length + ' discount' + (discounts.length === 1 ? '' : 's');

  if (!discounts.length) {
    document.getElementById('discounts-tbody').innerHTML = `<tr><td colspan="6" class="td-empty">No discount codes. Create one to get started.</td></tr>`;
    return;
  }

  document.getElementById('discounts-tbody').innerHTML = discounts.map(d => {
    const amt = d.amount_type === 'percent' ? d.amount + '%' : '$' + (d.amount / 100).toFixed(2);
    const limit = d.is_limited_redemptions ? d.max_redemptions : '∞';
    return `<tr>
      <td>
        <span style="font-family:monospace;font-size:12px;font-weight:500;letter-spacing:1px">${esc(d.code)}</span>
        <div class="td-email">${esc(d.name)}</div>
      </td>
      <td>${esc(amt)}</td>
      <td>${d.redemptions_count} / ${limit}</td>
      <td class="td-date">${d.expires_at ? fmtDate(d.expires_at) : 'Never'}</td>
      <td>${statusBadge(d.status === 'published' ? 'active' : 'inactive')}</td>
      <td class="td-actions">
        <button type="button" class="btn-danger-sm" data-action="delete-discount" data-id="${esc(d.id)}" data-code="${esc(d.code)}">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Webhooks ──────────────────────────────────────────────────────────────────
function renderWebhooks(webhooks) {
  document.getElementById('hook-count').textContent = webhooks.length + ' webhook' + (webhooks.length === 1 ? '' : 's');

  if (!webhooks.length) {
    document.getElementById('webhooks-tbody').innerHTML = `<tr><td colspan="4" class="td-empty">No webhooks configured.</td></tr>`;
    return;
  }

  document.getElementById('webhooks-tbody').innerHTML = webhooks.map(w => {
    const chips = (w.events || []).map(e => `<span class="event-chip">${esc(e)}</span>`).join('');
    return `<tr>
      <td style="font-family:monospace;font-size:12px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(w.url)}</td>
      <td><div class="webhook-events">${chips || '—'}</div></td>
      <td class="td-date">${fmtDate(w.created_at)}</td>
      <td class="td-actions">
        <button type="button" class="btn-danger-sm" data-action="delete-webhook" data-id="${esc(w.id)}">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Key Drawer ────────────────────────────────────────────────────────────────
function openDrawer(licenceId) {
  const licence = _allLicences.find(l => String(l.id) === String(licenceId));
  if (!licence) return;
  _drawerLicence  = licence;
  _drawerLimitVal = licence.activation_limit ?? 3;

  document.getElementById('drawer-customer-name').textContent = licence.customer_name || '—';
  document.getElementById('drawer-customer-email').textContent = licence.customer_email || '—';
  document.getElementById('drawer-key-code').textContent     = licence.key || '—';
  document.getElementById('drawer-plan').textContent          = licence.plan || '—';
  document.getElementById('drawer-issued').textContent        = fmtDate(licence.created_at);
  document.getElementById('drawer-expires').textContent       = licence.expires_at ? fmtDate(licence.expires_at) : 'Never';
  document.getElementById('drawer-limit-val').textContent     = _drawerLimitVal;
  document.getElementById('drawer-status').innerHTML          = statusBadge(licence.disabled ? 'disabled' : licence.status);

  // Expiry input
  const expiryInput = document.getElementById('drawer-expiry-input');
  expiryInput.value = licence.expires_at ? licence.expires_at.slice(0, 10) : '';

  // Toggle button
  const toggleBtn = document.getElementById('drawer-toggle-btn');
  if (licence.disabled) {
    toggleBtn.textContent = 'Enable Key';
    toggleBtn.className = 'btn-enable';
  } else {
    toggleBtn.textContent = 'Disable Key';
    toggleBtn.className = 'btn-disable';
  }

  // LS link
  const lsLink = document.getElementById('drawer-ls-link');
  lsLink.href = licence.order_id
    ? `https://app.lemonsqueezy.com/orders/${licence.order_id}`
    : 'https://app.lemonsqueezy.com/orders';

  // Load instances
  document.getElementById('drawer-instances').innerHTML = '<div class="loading-small">Loading devices…</div>';
  loadInstances(licence.id);

  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('key-drawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('key-drawer').classList.remove('open');
  _drawerLicence = null;
}

async function loadInstances(keyId) {
  try {
    const result = await callAction('list_instances', { key_id: keyId });
    if (!result) return;
    const { instances } = result;
    const el = document.getElementById('drawer-instances');
    if (!instances.length) { el.innerHTML = '<div class="empty-small">No active devices.</div>'; return; }
    el.innerHTML = `<div class="instance-list">${instances.map(inst => `
      <div class="instance-row">
        <div>
          <div class="instance-name">${esc(inst.name)}</div>
          <div class="instance-date">Activated ${fmtDate(inst.created_at)}</div>
        </div>
        <button type="button" class="btn-danger-sm" data-action="deactivate-instance" data-instance-id="${esc(inst.id)}">Deactivate</button>
      </div>`).join('')}</div>`;
  } catch (err) {
    document.getElementById('drawer-instances').innerHTML = `<div class="empty-small" style="color:var(--danger)">${esc(err.message)}</div>`;
  }
}

// ── Drawer action handlers ────────────────────────────────────────────────────
async function toggleKey() {
  if (!_drawerLicence) return;
  const action = _drawerLicence.disabled ? 'enable_key' : 'disable_key';
  const btn = document.getElementById('drawer-toggle-btn');
  btn.disabled = true;
  try {
    await callAction(action, { id: _drawerLicence.id });
    _drawerLicence.disabled = !_drawerLicence.disabled;
    // Update local data array
    const idx = _allLicences.findIndex(l => l.id === _drawerLicence.id);
    if (idx >= 0) _allLicences[idx].disabled = _drawerLicence.disabled;

    if (_drawerLicence.disabled) {
      btn.textContent = 'Enable Key'; btn.className = 'btn-enable';
    } else {
      btn.textContent = 'Disable Key'; btn.className = 'btn-disable';
    }
    document.getElementById('drawer-status').innerHTML = statusBadge(_drawerLicence.disabled ? 'disabled' : _drawerLicence.status);
    applyLicenceFilter();
    showToast(action === 'disable_key' ? 'Key disabled' : 'Key enabled');
  } catch (err) { showToast('Error: ' + err.message); }
  finally { btn.disabled = false; }
}

async function saveLimit() {
  if (!_drawerLicence) return;
  const btn = document.getElementById('btn-save-limit');
  btn.disabled = true;
  try {
    await callAction('update_key_limit', { id: _drawerLicence.id, activation_limit: _drawerLimitVal });
    _drawerLicence.activation_limit = _drawerLimitVal;
    const idx = _allLicences.findIndex(l => l.id === _drawerLicence.id);
    if (idx >= 0) _allLicences[idx].activation_limit = _drawerLimitVal;
    applyLicenceFilter();
    showToast('Device limit updated to ' + _drawerLimitVal);
  } catch (err) { showToast('Error: ' + err.message); }
  finally { btn.disabled = false; }
}

async function saveExpiry() {
  if (!_drawerLicence) return;
  const val = document.getElementById('drawer-expiry-input').value;
  const expiresAt = val ? new Date(val).toISOString() : null;
  try {
    await callAction('update_key_expiry', { id: _drawerLicence.id, expires_at: expiresAt });
    _drawerLicence.expires_at = expiresAt;
    const idx = _allLicences.findIndex(l => l.id === _drawerLicence.id);
    if (idx >= 0) _allLicences[idx].expires_at = expiresAt;
    document.getElementById('drawer-expires').textContent = expiresAt ? fmtDate(expiresAt) : 'Never';
    showToast(expiresAt ? 'Expiry set to ' + fmtDate(expiresAt) : 'Expiry cleared');
  } catch (err) { showToast('Error: ' + err.message); }
}

async function deactivateInstance(instanceId, btn) {
  if (!confirm('Deactivate this device? The user will need to re-activate.')) return;
  btn.disabled = true; btn.textContent = '…';
  try {
    await callAction('deactivate_instance', { id: instanceId });
    btn.closest('.instance-row').remove();
    // Decrement count in local data
    if (_drawerLicence) {
      _drawerLicence.activations_count = Math.max(0, (_drawerLicence.activations_count || 1) - 1);
      const idx = _allLicences.findIndex(l => l.id === _drawerLicence.id);
      if (idx >= 0) _allLicences[idx].activations_count = _drawerLicence.activations_count;
      applyLicenceFilter();
    }
    showToast('Device deactivated');
  } catch (err) { btn.disabled = false; btn.textContent = 'Deactivate'; showToast('Error: ' + err.message); }
}

// ── Gift modal ────────────────────────────────────────────────────────────────
function openGiftModal() {
  document.getElementById('gift-form').style.display = 'block';
  document.getElementById('gift-result').classList.remove('show');
  document.getElementById('gift-email').value = '';
  document.getElementById('btn-generate-gift').disabled = false;
  document.getElementById('btn-generate-gift').textContent = 'Generate link →';
  document.getElementById('gift-modal').classList.add('open');
}

function closeGiftModal() { document.getElementById('gift-modal').classList.remove('open'); }

function populateVariantSelect(variants) {
  const sel = document.getElementById('gift-variant');
  if (!sel) return;
  sel.innerHTML = variants.length
    ? variants.map(v => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('')
    : '<option value="">No variants found</option>';
}

async function submitGift() {
  if (!_data?.store_id) { showToast('Store ID not available — refresh the dashboard'); return; }
  const variantId = document.getElementById('gift-variant').value;
  if (!variantId) { showToast('Select a plan'); return; }
  const email = document.getElementById('gift-email').value.trim();
  const btn = document.getElementById('btn-generate-gift');
  btn.disabled = true; btn.textContent = 'Generating…';
  try {
    const result = await callAction('create_gift_checkout', {
      store_id: _data.store_id, variant_id: variantId, email: email || undefined,
    });
    if (result?.url) {
      document.getElementById('gift-url').textContent = result.url;
      document.getElementById('gift-form').style.display = 'none';
      document.getElementById('gift-result').classList.add('show');
    } else {
      showToast('No URL returned — check LS API key permissions');
    }
  } catch (err) { showToast('Error: ' + err.message); btn.disabled = false; btn.textContent = 'Generate link →'; }
}

// ── Discount modal ────────────────────────────────────────────────────────────
function openDiscountModal() {
  document.getElementById('disc-name').value    = '';
  document.getElementById('disc-code').value    = '';
  document.getElementById('disc-amount').value  = '';
  document.getElementById('disc-expires').value = '';
  document.getElementById('disc-max').value     = '';
  document.getElementById('disc-limit-check').checked = false;
  document.getElementById('disc-type').value    = 'percent';
  document.getElementById('disc-amount-label').textContent = 'Amount (1–100)';
  document.getElementById('disc-amount').placeholder       = '20';
  document.getElementById('btn-create-discount').disabled = false;
  document.getElementById('btn-create-discount').textContent = 'Create discount →';
  document.getElementById('discount-modal').classList.add('open');
}

function closeDiscountModal() { document.getElementById('discount-modal').classList.remove('open'); }

async function submitDiscount() {
  if (!_data?.store_id) { showToast('Store ID not available'); return; }
  const name        = document.getElementById('disc-name').value.trim();
  const code        = document.getElementById('disc-code').value.trim();
  const amount      = document.getElementById('disc-amount').value;
  const amount_type = document.getElementById('disc-type').value;
  const expires     = document.getElementById('disc-expires').value;
  const isLimited   = document.getElementById('disc-limit-check').checked;
  const maxRed      = document.getElementById('disc-max').value;

  if (!name || !code || !amount) { showToast('Name, code and amount are required'); return; }

  const btn = document.getElementById('btn-create-discount');
  btn.disabled = true; btn.textContent = 'Creating…';

  try {
    const result = await callAction('create_discount', {
      store_id: _data.store_id,
      name, code,
      amount: amount_type === 'fixed' ? Math.round(parseFloat(amount) * 100) : parseInt(amount),
      amount_type,
      expires_at: expires ? new Date(expires).toISOString() : null,
      is_limited_redemptions: isLimited,
      max_redemptions: isLimited ? parseInt(maxRed) || 1 : null,
    });
    closeDiscountModal();
    showToast('Discount ' + (result?.code || code.toUpperCase()) + ' created');
    // Optimistic local add — real data will arrive on next refresh
    if (_data.discounts) {
      _data.discounts.unshift({
        id: result?.id || 'new', name, code: code.toUpperCase(),
        amount: amount_type === 'fixed' ? Math.round(parseFloat(amount) * 100) : parseInt(amount),
        amount_type, is_limited_redemptions: isLimited,
        max_redemptions: isLimited ? parseInt(maxRed) || 1 : null,
        redemptions_count: 0, expires_at: expires || null, status: 'published',
      });
      renderDiscounts(_data.discounts);
    }
  } catch (err) { showToast('Error: ' + err.message); btn.disabled = false; btn.textContent = 'Create discount →'; }
}

async function deleteDiscount(id, code, btn) {
  if (!confirm(`Delete discount code "${code}"? This cannot be undone.`)) return;
  btn.disabled = true;
  try {
    await callAction('delete_discount', { id });
    if (_data.discounts) {
      _data.discounts = _data.discounts.filter(d => d.id !== id);
      renderDiscounts(_data.discounts);
    }
    showToast('Discount deleted');
  } catch (err) { btn.disabled = false; showToast('Error: ' + err.message); }
}

// ── Webhook modal ─────────────────────────────────────────────────────────────
function openWebhookModal() {
  document.getElementById('hook-url').value    = '';
  document.getElementById('hook-secret').value = '';
  document.getElementById('btn-create-webhook').disabled = false;
  document.getElementById('btn-create-webhook').textContent = 'Add webhook →';
  document.getElementById('webhook-modal').classList.add('open');
}

function closeWebhookModal() { document.getElementById('webhook-modal').classList.remove('open'); }

async function submitWebhook() {
  if (!_data?.store_id) { showToast('Store ID not available'); return; }
  const url    = document.getElementById('hook-url').value.trim();
  const secret = document.getElementById('hook-secret').value.trim();
  if (!url || !secret) { showToast('URL and secret are required'); return; }

  const eventBoxes = document.querySelectorAll('.form-events-grid input[type="checkbox"]:checked');
  const events = Array.from(eventBoxes).map(cb => cb.value);
  if (!events.length) { showToast('Select at least one event'); return; }

  const btn = document.getElementById('btn-create-webhook');
  btn.disabled = true; btn.textContent = 'Adding…';

  try {
    await callAction('create_webhook', { store_id: _data.store_id, url, events, secret });
    closeWebhookModal();
    showToast('Webhook added — refresh to see it');
  } catch (err) { showToast('Error: ' + err.message); btn.disabled = false; btn.textContent = 'Add webhook →'; }
}

async function deleteWebhook(id, btn) {
  if (!confirm('Delete this webhook? Lemon Squeezy will stop sending events to it.')) return;
  btn.disabled = true;
  try {
    await callAction('delete_webhook', { id });
    if (_data.webhooks) {
      _data.webhooks = _data.webhooks.filter(w => w.id !== id);
      renderWebhooks(_data.webhooks);
    }
    showToast('Webhook deleted');
  } catch (err) { btn.disabled = false; showToast('Error: ' + err.message); }
}

// ── Subscription actions ──────────────────────────────────────────────────────
async function pauseSubscription(id, btn) {
  if (!confirm('Pause this subscription? The customer will lose access until resumed.')) return;
  btn.disabled = true;
  try {
    await callAction('pause_subscription', { id, mode: 'void' });
    showToast('Subscription paused');
    const sub = _data?.subscriptions?.find(s => s.id === id);
    if (sub) { sub.pause = { mode: 'void' }; renderSubscriptions(_data.subscriptions); }
  } catch (err) { btn.disabled = false; showToast('Error: ' + err.message); }
}

async function resumeSubscription(id, btn) {
  btn.disabled = true;
  try {
    await callAction('resume_subscription', { id });
    showToast('Subscription resumed');
    const sub = _data?.subscriptions?.find(s => s.id === id);
    if (sub) { sub.pause = null; sub.cancelled = false; renderSubscriptions(_data.subscriptions); }
  } catch (err) { btn.disabled = false; showToast('Error: ' + err.message); }
}

async function cancelSubscription(id, btn) {
  if (!confirm('Cancel this subscription? The key stays valid until the end of the billing period.')) return;
  btn.disabled = true;
  try {
    await callAction('cancel_subscription', { id });
    showToast('Subscription cancelled');
    const sub = _data?.subscriptions?.find(s => s.id === id);
    if (sub) { sub.cancelled = true; renderSubscriptions(_data.subscriptions); }
  } catch (err) { btn.disabled = false; showToast('Error: ' + err.message); }
}

// ── Customer portal ───────────────────────────────────────────────────────────
async function copyPortalLink(customerId, btn) {
  btn.disabled = true; btn.textContent = '…';
  try {
    const result = await callAction('get_portal_url', { customer_id: customerId });
    if (result?.url) {
      await navigator.clipboard.writeText(result.url);
      showToast('Portal link copied to clipboard');
    } else {
      showToast('No portal URL returned');
    }
  } catch (err) { showToast('Error: ' + err.message); }
  finally { btn.disabled = false; btn.textContent = 'Portal link'; }
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCsv() {
  const rows = [['Customer', 'Email', 'Plan', 'Status', 'Devices', 'Limit', 'Key', 'Issued', 'Expires']];
  for (const l of _filteredLics) {
    rows.push([
      l.customer_name  || '',
      l.customer_email || '',
      l.plan           || '',
      l.disabled ? 'disabled' : (l.status || ''),
      l.activations_count,
      l.activation_limit,
      l.key || '',
      l.created_at ? new Date(l.created_at).toLocaleDateString() : '',
      l.expires_at    ? new Date(l.expires_at).toLocaleDateString() : '',
    ]);
  }
  const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'fincwin-licences-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showView(name, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');
  if (btn) btn.classList.add('active');
}

function showLsNotice(msg) {
  document.getElementById('ls-notice-msg').textContent = msg;
  document.getElementById('ls-notice').style.display = 'flex';
}
function hideLsNotice() { document.getElementById('ls-notice').style.display = 'none'; }

function statusBadge(status) {
  const s = (status || 'unknown').toLowerCase();
  const label = s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
  return `<span class="badge ${s}"><span class="badge-dot"></span>${label}</span>`;
}

function maskKey(key) {
  if (!key) return '—';
  const parts = key.split('-');
  if (parts.length < 2) return key.slice(0, 4) + '-••••-••••-••••';
  return parts[0] + '-••••-••••-' + parts[parts.length - 1];
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Delegated click handler ───────────────────────────────────────────────────
document.addEventListener('click', async function (e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  switch (action) {

    // Drawer
    case 'close-drawer':     closeDrawer(); break;
    case 'copy-key':
      if (_drawerLicence?.key) {
        await navigator.clipboard.writeText(_drawerLicence.key);
        showToast('Key copied');
      }
      break;
    case 'toggle-key':       toggleKey(); break;
    case 'decrement-limit':
      if (_drawerLimitVal > 1) { _drawerLimitVal--; document.getElementById('drawer-limit-val').textContent = _drawerLimitVal; }
      break;
    case 'increment-limit':
      if (_drawerLimitVal < 20) { _drawerLimitVal++; document.getElementById('drawer-limit-val').textContent = _drawerLimitVal; }
      break;
    case 'save-limit':       saveLimit(); break;
    case 'save-expiry':      saveExpiry(); break;
    case 'clear-expiry':     document.getElementById('drawer-expiry-input').value = ''; saveExpiry(); break;
    case 'deactivate-instance': deactivateInstance(btn.dataset.instanceId, btn); break;

    // Gift modal
    case 'open-gift-modal':  openGiftModal(); break;
    case 'close-gift-modal': closeGiftModal(); break;
    case 'submit-gift':      submitGift(); break;
    case 'copy-gift-url': {
      const url = document.getElementById('gift-url').textContent;
      if (url) { await navigator.clipboard.writeText(url); showToast('URL copied'); }
      break;
    }

    // Discount modal
    case 'open-discount-modal':  openDiscountModal(); break;
    case 'close-discount-modal': closeDiscountModal(); break;
    case 'submit-discount':      submitDiscount(); break;
    case 'delete-discount':      deleteDiscount(btn.dataset.id, btn.dataset.code, btn); break;

    // Webhook modal
    case 'open-webhook-modal':   openWebhookModal(); break;
    case 'close-webhook-modal':  closeWebhookModal(); break;
    case 'submit-webhook':       submitWebhook(); break;
    case 'delete-webhook':       deleteWebhook(btn.dataset.id, btn); break;

    // Subscriptions
    case 'pause-sub':    pauseSubscription(btn.dataset.id, btn); break;
    case 'resume-sub':   resumeSubscription(btn.dataset.id, btn); break;
    case 'cancel-sub':   cancelSubscription(btn.dataset.id, btn); break;

    // Customers
    case 'copy-portal':  copyPortalLink(btn.dataset.customerId, btn); break;
  }
});

// Close drawer/modals on overlay click
document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);
document.getElementById('gift-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeGiftModal(); });
document.getElementById('discount-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeDiscountModal(); });
document.getElementById('webhook-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeWebhookModal(); });

// Licence row click → open drawer
document.getElementById('licences-tbody').addEventListener('click', e => {
  const row = e.target.closest('tr[data-lic-id]');
  if (row) openDrawer(row.dataset.licId);
});

// Auth
document.getElementById('token-input').addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
document.getElementById('btn-unlock').addEventListener('click', unlock);
document.getElementById('btn-logout').addEventListener('click', logout);
document.getElementById('btn-refresh').addEventListener('click', refreshData);
document.getElementById('btn-auto-refresh').addEventListener('click', toggleAutoRefresh);

// Sidebar nav
document.querySelectorAll('.sidebar-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view, btn));
});
document.getElementById('btn-ls-link')?.addEventListener('click', () => window.open('https://app.lemonsqueezy.com', '_blank'));

// Licences: search + status tabs + sort + export
document.getElementById('search-input').addEventListener('input', applyLicenceFilter);
document.getElementById('btn-export-csv').addEventListener('click', exportCsv);
document.getElementById('cust-search').addEventListener('input', filterCustomers);

document.getElementById('status-tabs').addEventListener('click', e => {
  const tab = e.target.closest('[data-status]');
  if (!tab) return;
  _statusFilter = tab.dataset.status;
  document.querySelectorAll('#status-tabs .status-tab').forEach(t => t.classList.toggle('active', t === tab));
  applyLicenceFilter();
});

// Column sorting
document.querySelector('#view-licences thead').addEventListener('click', e => {
  const th = e.target.closest('th[data-sort]');
  if (!th) return;

  const col = th.dataset.sort;
  if (_sortCol === col) { _sortDir = _sortDir === 'asc' ? 'desc' : 'asc'; }
  else { _sortCol = col; _sortDir = 'asc'; }

  document.querySelectorAll('#view-licences thead th').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
  th.classList.add(_sortDir === 'asc' ? 'sort-asc' : 'sort-desc');

  applyLicenceFilter();
});

// Discount type → update amount label + placeholder
document.getElementById('disc-type').addEventListener('change', function () {
  const isFixed = this.value === 'fixed';
  document.getElementById('disc-amount-label').textContent = isFixed ? 'Amount (in $)' : 'Amount (1–100)';
  document.getElementById('disc-amount').placeholder       = isFixed ? '5.00'          : '20';
});

// Keyboard: Escape closes drawer / modals
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('key-drawer').classList.contains('open')) { closeDrawer(); return; }
  if (document.getElementById('gift-modal').classList.contains('open')) { closeGiftModal(); return; }
  if (document.getElementById('discount-modal').classList.contains('open')) { closeDiscountModal(); return; }
  if (document.getElementById('webhook-modal').classList.contains('open')) { closeWebhookModal(); return; }
});
