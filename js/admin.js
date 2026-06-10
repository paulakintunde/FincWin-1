// admin.js — FincWin admin dashboard logic
// Extracted from inline script to comply with CSP script-src 'self' policy.

const SESSION_KEY = 'fw_admin_token';
let _data = null;
let _allLicences = [];

// ── Auth ────────────────────────────────────────────────────────────────────
function getToken() { return sessionStorage.getItem(SESSION_KEY) || ''; }

async function unlock() {
  const input = document.getElementById('token-input');
  const token = input.value.trim();
  if (!token) { showAuthError('Enter your admin token.'); return; }

  const btn = document.getElementById('btn-unlock');
  btn.disabled = true; btn.textContent = 'Verifying…';
  hideAuthError();

  try {
    const res = await fetch('/api/admin', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      showAuthError('Invalid token. Check your ADMIN_TOKEN env var.');
      btn.disabled = false; btn.textContent = 'Unlock dashboard →';
      return;
    }
    if (res.status === 503) {
      showAuthError('Admin not configured. Set the ADMIN_TOKEN environment variable on Vercel.');
      btn.disabled = false; btn.textContent = 'Unlock dashboard →';
      return;
    }
    if (!res.ok) {
      let msg = 'Server error (' + res.status + '). Try again shortly.';
      try { const e = await res.json(); if (e && e.error) msg = e.error; } catch (_) {}
      showAuthError(msg);
      btn.disabled = false; btn.textContent = 'Unlock dashboard →';
      return;
    }
    const json = await res.json();
    sessionStorage.setItem(SESSION_KEY, token);
    input.value = '';
    renderDashboard(json);
  } catch {
    showAuthError('Network error — could not reach the server.');
    btn.disabled = false; btn.textContent = 'Unlock dashboard →';
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  _data = null;
  document.getElementById('auth-screen').style.display = '';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('token-input').value = '';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg; el.style.display = 'block';
}
function hideAuthError() {
  document.getElementById('auth-error').style.display = 'none';
}

// ── Auto-login if session token exists ──────────────────────────────────────
(async function tryAutoLogin() {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      // Only forget the token on a real auth failure — not on a transient 5xx.
      if (res.status === 401 || res.status === 403) sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    renderDashboard(await res.json());
  } catch { sessionStorage.removeItem(SESSION_KEY); }
})();

// ── Render dashboard ────────────────────────────────────────────────────────
function renderDashboard(data) {
  _data = data;
  _allLicences = data.licenses || [];

  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';

  const now = new Date().toLocaleString();
  document.getElementById('nav-meta').textContent =
    _allLicences.length + ' licences · refreshed ' + now;
  document.getElementById('overview-updated').textContent =
    'Last refreshed ' + now;

  renderOverview(data);
  renderLicences(_allLicences);
  renderRevenue(data);

  document.getElementById('overview-loading').style.display  = 'none';
  document.getElementById('overview-content').style.display  = '';
}

// ── Overview ────────────────────────────────────────────────────────────────
function renderOverview(data) {
  const s = data.stats;
  const r = data.revenue;
  const bad = (s.expired || 0) + (s.inactive || 0) + (s.disabled || 0);
  const activeRate = s.total ? Math.round((s.active / s.total) * 100) : 0;

  document.getElementById('st-total').textContent  = s.total;
  document.getElementById('st-total-sub').textContent =
    Object.entries(s.byPlan).map(([k,v]) => v + ' ' + k).join(' · ') || '—';
  document.getElementById('st-active').textContent  = s.active;
  document.getElementById('st-active-sub').textContent = activeRate + '% of all licences';
  document.getElementById('st-bad').textContent     = bad;
  document.getElementById('st-bad-sub').textContent =
    (s.expired || 0) + ' expired · ' + (s.inactive || 0) + ' inactive';
  document.getElementById('st-rev').textContent     = '$' + Number(r.total_usd).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  document.getElementById('st-rev-sub').textContent = r.orders_count + ' paid orders';

  const total = s.total || 1;
  const rows = Object.entries(s.byPlan)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => {
      const pct = Math.round((count / total) * 100);
      return `<div class="plan-row-item">
        <span class="plan-name">${esc(name)}</span>
        <div class="plan-bar-wrap"><div class="plan-bar" style="width:${pct}%"></div></div>
        <span class="plan-count">${count}</span>
      </div>`;
    }).join('');
  document.getElementById('plan-breakdown-rows').innerHTML = rows || '<p style="font-size:13px;color:var(--muted)">No plan data available.</p>';

  const recent = _allLicences.slice(0, 10);
  document.getElementById('recent-tbody').innerHTML = recentRows(recent);
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

// ── Licences ────────────────────────────────────────────────────────────────
function renderLicences(list) {
  document.getElementById('lic-count').textContent = list.length + ' licence' + (list.length === 1 ? '' : 's');
  document.getElementById('licences-tbody').innerHTML = list.length
    ? list.map(l => `
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
        <td><span class="td-key" title="${esc(l.key)}">${maskKey(l.key)}</span></td>
        <td class="td-date">${fmtDate(l.created_at)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" class="td-empty">No licences match your search.</td></tr>`;
}

function filterLicences() {
  const q = (document.getElementById('search-input').value || '').toLowerCase();
  if (!q) { renderLicences(_allLicences); return; }
  const filtered = _allLicences.filter(l =>
    (l.customer_email || '').toLowerCase().includes(q) ||
    (l.customer_name  || '').toLowerCase().includes(q) ||
    (l.key            || '').toLowerCase().includes(q) ||
    (l.plan           || '').toLowerCase().includes(q)
  );
  renderLicences(filtered);
}

// ── Revenue ─────────────────────────────────────────────────────────────────
function renderRevenue(data) {
  const r  = data.revenue;
  const s  = data.stats;
  const totalUsd = Number(r.total_usd);
  const avg = r.orders_count ? (totalUsd / r.orders_count).toFixed(0) : 0;
  const activeRate = s.total ? Math.round((s.active / s.total) * 100) : 0;

  document.getElementById('rev-total').textContent  = '$' + totalUsd.toLocaleString('en', { minimumFractionDigits: 0 });
  document.getElementById('rev-orders').textContent = r.orders_count + ' paid orders';
  document.getElementById('rev-avg').textContent    = '$' + avg;
  document.getElementById('rev-rate').textContent   = activeRate + '%';

  const total = s.total || 1;
  const rows = Object.entries(s.byPlan)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => {
      const pct = Math.round((count / total) * 100);
      return `<div class="plan-row-item">
        <span class="plan-name">${esc(name)}</span>
        <div class="plan-bar-wrap"><div class="plan-bar" style="width:${pct}%"></div></div>
        <span class="plan-count">${count}</span>
      </div>`;
    }).join('');
  document.getElementById('rev-plan-rows').innerHTML = rows || '<p style="font-size:13px;color:var(--muted)">No plan data.</p>';
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function showView(name, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  btn.classList.add('active');
}

function statusBadge(status) {
  const s = (status || 'unknown').toLowerCase();
  const label = s.charAt(0).toUpperCase() + s.slice(1);
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
  try {
    return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
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

// ── Event bindings (replaces all inline onclick/oninput/onkeydown) ────────────
// Script is at end of body — DOM is fully ready, no DOMContentLoaded needed.

// Auth screen
document.getElementById('token-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') unlock();
});
document.getElementById('btn-unlock').addEventListener('click', unlock);

// Dashboard nav
document.getElementById('btn-logout').addEventListener('click', logout);

// Sidebar view buttons
document.querySelectorAll('.sidebar-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view, btn));
});

// LemonSqueezy external link
document.getElementById('btn-ls-link')?.addEventListener('click', () => {
  window.open('https://app.lemonsqueezy.com', '_blank');
});

// Licence search
document.getElementById('search-input').addEventListener('input', filterLicences);
