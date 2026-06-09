/**
 * __verify_admin.mjs — Playwright verification of admin.html CSP compliance
 * Run: node __verify_admin.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4141';
const MOCK_TOKEN = 'test-admin-secret';

const MOCK_DATA = {
  stats: {
    total: 42,
    active: 35,
    expired: 4,
    inactive: 2,
    disabled: 1,
    byPlan: { 'Pro Annual': 20, 'Lifetime': 15, 'Pro Monthly': 7 },
  },
  revenue: {
    total_usd: '4285.00',
    orders_count: 42,
  },
  licenses: Array.from({ length: 12 }, (_, i) => ({
    customer_name: `User ${i + 1}`,
    customer_email: `user${i + 1}@example.com`,
    plan: i % 3 === 0 ? 'Lifetime' : i % 3 === 1 ? 'Pro Annual' : 'Pro Monthly',
    status: i < 10 ? 'active' : 'expired',
    activations_count: i % 3,
    activation_limit: 2,
    key: `AAAA-BBBB-CCCC-${String(i + 1).padStart(4, '0')}`,
    created_at: new Date(Date.now() - i * 86400000 * 7).toISOString(),
  })),
};

let passed = 0;
let failed = 0;

function ok(label, cond, detail = '') {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else       { console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

async function routeAdmin(page) {
  await page.route('**/api/admin', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(MOCK_DATA),
  }));
}

async function openAdmin(browser, { skipSession = false } = {}) {
  const ctx = await browser.newContext();
  if (!skipSession) {
    await ctx.addInitScript((token) => {
      sessionStorage.setItem('fw_admin_token', token);
    }, MOCK_TOKEN);
  }
  const page = await ctx.newPage();
  await routeAdmin(page);
  await page.goto(`${BASE}/admin.html`, { waitUntil: 'domcontentloaded' });
  return { page, ctx };
}

const browser = await chromium.launch({ headless: true });
let cspErrors = [];
let consoleFails = [];

// ── Phase 1: No inline JS violations (CSP compliance) ─────────────────────
console.log('\nPhase 1: CSP compliance — no inline script violations');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => consoleFails.push(e.message));
  // Collect CSP violations via console errors
  page.on('console', msg => {
    if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
      cspErrors.push(msg.text());
    }
  });
  await routeAdmin(page);
  await page.goto(`${BASE}/admin.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  ok('No CSP violations', cspErrors.length === 0, cspErrors[0]);
  ok('No page errors', consoleFails.length === 0, consoleFails[0]);
  await ctx.close();
}

// ── Phase 2: Auth screen visible when no session token ─────────────────────
console.log('\nPhase 2: Auth screen shown when no session token');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await routeAdmin(page);
  await page.goto(`${BASE}/admin.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const authVisible = await page.locator('#auth-screen').isVisible();
  const dashHidden  = !await page.locator('#dashboard').isVisible();
  ok('Auth screen visible', authVisible);
  ok('Dashboard hidden', dashHidden);
  await ctx.close();
}

// ── Phase 3: Wrong token shows error ──────────────────────────────────────
console.log('\nPhase 3: Wrong token shows auth error');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // Route admin with 401 for wrong token
  await page.route('**/api/admin', route => {
    const auth = route.request().headers()['authorization'] || '';
    if (auth === `Bearer ${MOCK_TOKEN}`) {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_DATA) });
    } else {
      route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' });
    }
  });
  await page.goto(`${BASE}/admin.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.fill('#token-input', 'wrong-token');
  await page.click('#btn-unlock');
  await page.waitForTimeout(500);
  const errEl = page.locator('#auth-error');
  const errVisible = await errEl.isVisible();
  const errText = await errEl.textContent();
  ok('Auth error shown', errVisible);
  ok('Auth error mentions token', errText.toLowerCase().includes('invalid') || errText.toLowerCase().includes('token'));
  ok('Auth screen still visible', await page.locator('#auth-screen').isVisible());
  await ctx.close();
}

// ── Phase 4: Enter key triggers unlock ────────────────────────────────────
console.log('\nPhase 4: Enter key on token input triggers unlock');
{
  const { page, ctx } = await openAdmin(browser, { skipSession: true });
  await page.fill('#token-input', MOCK_TOKEN);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  const dashVisible = await page.locator('#dashboard').isVisible();
  ok('Enter key unlocks dashboard', dashVisible);
  await ctx.close();
}

// ── Phase 5: Auto-login from session token ────────────────────────────────
console.log('\nPhase 5: Auto-login with valid session token');
{
  const { page, ctx } = await openAdmin(browser);
  // Wait for dashboard to render
  await page.waitForFunction(
    () => document.getElementById('nav-meta')?.textContent !== 'Loading…',
    { timeout: 5000 }
  ).catch(() => {});
  const dashVisible = await page.locator('#dashboard').isVisible();
  const authHidden  = !await page.locator('#auth-screen').isVisible();
  ok('Dashboard visible after auto-login', dashVisible);
  ok('Auth screen hidden', authHidden);
  const navMeta = await page.locator('#nav-meta').textContent();
  ok('nav-meta shows licence count', navMeta.includes('12'));
  await ctx.close();
}

// ── Phase 6: Overview stats render ────────────────────────────────────────
console.log('\nPhase 6: Overview stats cards render correctly');
{
  const { page, ctx } = await openAdmin(browser);
  await page.waitForFunction(
    () => document.getElementById('st-total')?.textContent.trim() !== '',
    { timeout: 5000 }
  ).catch(() => {});
  const total  = await page.locator('#st-total').textContent();
  const active = await page.locator('#st-active').textContent();
  const rev    = await page.locator('#st-rev').textContent();
  ok('Total licences = 42',  total.trim() === '42');
  ok('Active licences = 35', active.trim() === '35');
  ok('Revenue shows $4,285', rev.includes('4,285') || rev.includes('4285'));
  await ctx.close();
}

// ── Phase 7: Plan breakdown rows render ───────────────────────────────────
console.log('\nPhase 7: Plan breakdown bar chart renders');
{
  const { page, ctx } = await openAdmin(browser);
  await page.waitForFunction(
    () => document.getElementById('plan-breakdown-rows')?.children.length > 0,
    { timeout: 5000 }
  ).catch(() => {});
  const rowCount = await page.locator('#plan-breakdown-rows .plan-row-item').count();
  ok('Plan breakdown has 3 rows', rowCount === 3);
  await ctx.close();
}

// ── Phase 8: Recent licences table renders ────────────────────────────────
console.log('\nPhase 8: Recent licences table renders');
{
  const { page, ctx } = await openAdmin(browser);
  await page.waitForFunction(
    () => document.getElementById('recent-tbody')?.children.length > 0,
    { timeout: 5000 }
  ).catch(() => {});
  const rows = await page.locator('#recent-tbody tr').count();
  ok('Recent table has rows', rows >= 10);
  await ctx.close();
}

// ── Phase 9: Sidebar navigation — switch to Licences ─────────────────────
console.log('\nPhase 9: Sidebar navigation — Overview → Licences → Revenue');
{
  const { page, ctx } = await openAdmin(browser);
  await page.waitForFunction(
    () => document.getElementById('st-total')?.textContent.trim() !== '',
    { timeout: 5000 }
  ).catch(() => {});

  // Overview is active by default
  ok('Overview view active', await page.locator('#view-overview').evaluate(el => el.classList.contains('active')));

  // Click Licences
  await page.click('[data-view="licences"]');
  await page.waitForTimeout(200);
  ok('Licences view active', await page.locator('#view-licences').evaluate(el => el.classList.contains('active')));
  ok('Overview view inactive', !await page.locator('#view-overview').evaluate(el => el.classList.contains('active')));
  ok('Licences sidebar btn active', await page.locator('[data-view="licences"]').evaluate(el => el.classList.contains('active')));

  // Click Revenue
  await page.click('[data-view="revenue"]');
  await page.waitForTimeout(200);
  ok('Revenue view active', await page.locator('#view-revenue').evaluate(el => el.classList.contains('active')));
  ok('Licences view inactive', !await page.locator('#view-licences').evaluate(el => el.classList.contains('active')));

  // Click back to Overview
  await page.click('[data-view="overview"]');
  await page.waitForTimeout(200);
  ok('Overview view re-activated', await page.locator('#view-overview').evaluate(el => el.classList.contains('active')));
  await ctx.close();
}

// ── Phase 10: Licences table renders all 12 licences ─────────────────────
console.log('\nPhase 10: Licences view — table renders all licences');
{
  const { page, ctx } = await openAdmin(browser);
  await page.waitForFunction(
    () => document.getElementById('st-total')?.textContent.trim() !== '',
    { timeout: 5000 }
  ).catch(() => {});
  await page.click('[data-view="licences"]');
  await page.waitForTimeout(200);
  const rows = await page.locator('#licences-tbody tr').count();
  ok('Licences table has 12 rows', rows === 12);
  const countText = await page.locator('#lic-count').textContent();
  ok('lic-count shows 12 licences', countText.includes('12'));
  await ctx.close();
}

// ── Phase 11: Licence search / filter ─────────────────────────────────────
console.log('\nPhase 11: Licence search filters the table');
{
  const { page, ctx } = await openAdmin(browser);
  await page.waitForFunction(
    () => document.getElementById('st-total')?.textContent.trim() !== '',
    { timeout: 5000 }
  ).catch(() => {});
  await page.click('[data-view="licences"]');
  await page.waitForTimeout(200);

  // Search for a specific user
  await page.fill('#search-input', 'user1@');
  await page.waitForTimeout(300);
  const filteredRows = await page.locator('#licences-tbody tr').count();
  ok('Search filters to 1 row', filteredRows === 1);

  // Clear search
  await page.fill('#search-input', '');
  await page.waitForTimeout(300);
  const allRows = await page.locator('#licences-tbody tr').count();
  ok('Clearing search restores all rows', allRows === 12);

  // Search with no matches
  await page.fill('#search-input', 'nobody@nowhere.xyz');
  await page.waitForTimeout(300);
  const zeroRows = await page.locator('#licences-tbody tr').count();
  const emptyText = await page.locator('#licences-tbody').textContent();
  ok('No-match search shows 1 empty row', zeroRows === 1);
  ok('Empty row has "No licences" message', emptyText.includes('No licences'));
  await ctx.close();
}

// ── Phase 12: Revenue stats render ────────────────────────────────────────
console.log('\nPhase 12: Revenue view stats render');
{
  const { page, ctx } = await openAdmin(browser);
  await page.waitForFunction(
    () => document.getElementById('st-total')?.textContent.trim() !== '',
    { timeout: 5000 }
  ).catch(() => {});
  await page.click('[data-view="revenue"]');
  await page.waitForTimeout(200);
  const revTotal  = await page.locator('#rev-total').textContent();
  const revOrders = await page.locator('#rev-orders').textContent();
  const revAvg    = await page.locator('#rev-avg').textContent();
  const revRate   = await page.locator('#rev-rate').textContent();
  ok('rev-total shows $4285', revTotal.includes('4,285') || revTotal.includes('4285'));
  ok('rev-orders shows 42 paid orders', revOrders.includes('42'));
  ok('rev-avg is a dollar amount', revAvg.startsWith('$') && revAvg.length > 1);
  ok('rev-rate is a percentage', revRate.includes('%'));
  const planRows = await page.locator('#rev-plan-rows .plan-row-item').count();
  ok('Revenue plan breakdown has rows', planRows === 3);
  await ctx.close();
}

// ── Phase 13: Logout clears session and shows auth screen ─────────────────
console.log('\nPhase 13: Logout returns to auth screen');
{
  const { page, ctx } = await openAdmin(browser);
  await page.waitForFunction(
    () => document.getElementById('dashboard')?.style.display !== 'none' &&
          document.getElementById('dashboard')?.style.display !== '',
    { timeout: 5000 }
  ).catch(() => {});
  // Give it a moment since display might just be '' (visible)
  await page.waitForTimeout(300);
  const dashBefore = await page.locator('#dashboard').isVisible();
  ok('Dashboard visible before logout', dashBefore);
  await page.click('#btn-logout');
  await page.waitForTimeout(300);
  const authAfter = await page.locator('#auth-screen').isVisible();
  const dashAfter = await page.locator('#dashboard').isVisible();
  ok('Auth screen visible after logout', authAfter);
  ok('Dashboard hidden after logout', !dashAfter);
  // Session token should be cleared
  const token = await page.evaluate(() => sessionStorage.getItem('fw_admin_token'));
  ok('Session token cleared', !token);
  await ctx.close();
}

// ── Phase 14: LemonSqueezy button opens new tab ────────────────────────────
console.log('\nPhase 14: LemonSqueezy link button opens a new page');
{
  const { page, ctx } = await openAdmin(browser);
  await page.waitForTimeout(500);
  const [newPage] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null),
    page.click('#btn-ls-link'),
  ]);
  ok('LemonSqueezy link opens new tab', newPage !== null);
  if (newPage) await newPage.close();
  await ctx.close();
}

// ── Phase 15: maskKey helper works ────────────────────────────────────────
console.log('\nPhase 15: Key masking in licences table');
{
  const { page, ctx } = await openAdmin(browser);
  await page.click('[data-view="licences"]');
  await page.waitForTimeout(300);
  const keyText = await page.locator('#licences-tbody .td-key').first().textContent();
  ok('Key is masked with ••••', keyText.includes('••••'));
  ok('Key still shows first segment', keyText.startsWith('AAAA'));
  await ctx.close();
}

// ── Phase 16: Status badges render ───────────────────────────────────────
console.log('\nPhase 16: Status badges render in licences table');
{
  const { page, ctx } = await openAdmin(browser);
  await page.click('[data-view="licences"]');
  await page.waitForTimeout(300);
  const activeBadges  = await page.locator('#licences-tbody .badge.active').count();
  const expiredBadges = await page.locator('#licences-tbody .badge.expired').count();
  ok('Active badges present', activeBadges > 0);
  ok('Expired badges present', expiredBadges > 0);
  await ctx.close();
}

await browser.close();

// ── Summary ───────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${'─'.repeat(50)}`);
console.log(`admin.html verification: ${passed}/${total} PASS, ${failed} FAIL`);
if (failed > 0) process.exit(1);
