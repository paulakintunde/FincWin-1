import { chromium } from 'playwright';

const BASE = 'http://localhost:4141';
const errs = [];

// ── API mock payloads ────────────────────────────────────────────────────────
const PRO_DATA = {
  valid: true, tier: 'pro', plan: 'Pro',
  activation_limit: 3, activation_usage: 2,
  key_status: 'active', expires_at: null,
  customer_email: 'jane@example.com', customer_name: 'Jane Doe',
  instance_name: 'Test MacBook Pro'
};
const LIFE_DATA = {
  valid: true, tier: 'lifetime', plan: 'Lifetime',
  activation_limit: 5, activation_usage: 1,
  key_status: 'active', expires_at: null,
  customer_email: 'jane@example.com', customer_name: 'Jane Doe',
  instance_name: 'Test MacBook Pro'
};
const EXPIRED_DATA = {
  valid: true, tier: 'pro', plan: 'Pro',
  activation_limit: 3, activation_usage: 2,
  key_status: 'inactive', expires_at: '2024-01-01T00:00:00Z',
  customer_email: 'jane@example.com', customer_name: 'Jane Doe',
  instance_name: 'Test MacBook Pro'
};
const SUB_DATA = {
  ...PRO_DATA,
  expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString()
};

const browser = await chromium.launch({ headless: true });

/**
 * Open account.html with localStorage pre-set and API mocked.
 * Uses addInitScript called BEFORE navigation to guarantee localStorage
 * is available when account.html's own scripts read it.
 */
async function openAccount(lsData, apiResponse) {
  const ctx = await browser.newContext();

  // Set localStorage BEFORE the first navigation — guaranteed to run before page scripts
  await ctx.addInitScript((data) => {
    for (const [k, v] of Object.entries(data)) {
      localStorage.setItem(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  }, lsData);

  const page = await ctx.newPage();
  page.on('pageerror',  e => errs.push('PAGE ERR: ' + e.message));
  page.on('console',    m => { if (m.type() === 'error') errs.push('CONSOLE ERR: ' + m.text()); });

  // Mock API endpoints
  await page.route('**/api/validate',   route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiResponse) }));
  await page.route('**/api/activate',   route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activated: false, error: 'Invalid key', code: 'not_found' }) }));
  await page.route('**/api/deactivate', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

  await page.goto(`${BASE}/account.html`, { waitUntil: 'domcontentloaded' });

  // Wait for JS to finish rendering (greeting leaves its "Loading…" initial state)
  await page.waitForFunction(
    () => document.getElementById('page-greeting')?.textContent !== 'Loading…',
    { timeout: 6000 }
  ).catch(() => {});

  return { page, ctx };
}

// Helpers
const $t = (p, s) => p.$eval(s, el => el.textContent.trim()).catch(() => 'MISSING');
const $v = (p, s) => p.$eval(s, el => el.value).catch(() => 'MISSING');
const $s = (p, s) => p.$eval(s, el => el.style.display || '').catch(() => 'MISSING');
const $c = (p, s) => p.$eval(s, el => getComputedStyle(el).display).catch(() => 'MISSING');
const $h = (p, s) => p.$(s).then(e => !!e);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: No licence key → redirect within 6 s
// ═══════════════════════════════════════════════════════════════════════════
console.log('── Phase 1: No-key redirect ──');
{
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  // Block Firebase auth calls so the SDK fails quickly and triggers redirect
  await page.route('**/identitytoolkit.googleapis.com/**', r => r.abort());
  await page.route('**/securetoken.googleapis.com/**',     r => r.abort());
  await page.goto(`${BASE}/account.html`, { waitUntil: 'domcontentloaded' });
  let redirected = false;
  try {
    // Our 4-second fallback timeout in account.html should fire
    await page.waitForURL(url => url.href.includes('signin'), { timeout: 6000 });
    redirected = true;
  } catch {}
  const finalUrl = page.url();
  console.log('1_no_key_redirect:', redirected ? 'PASS (redirected to: ' + finalUrl + ')' : 'FAIL — stayed at ' + finalUrl);
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2–6: Pro state — page loads + Overview
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Phase 2–6: Pro Overview ──');
const proLs = {
  fw_license_key:   'TEST-PRO-KEY-AAAA',
  fw_instance_id:   'inst-001',
  fw_instance_name: 'Test MacBook Pro',
  fw_plan:          'Pro',
  fw_profile:       { fname: 'Jane', lname: 'Doe', display: 'Jane', email: 'jane@example.com' }
};
const { page: pp, ctx: pc } = await openAccount(proLs, PRO_DATA);

console.log('2_url:', pp.url().includes('account') ? 'PASS' : 'FAIL: ' + pp.url());

const ovActive = await pp.$eval('#section-overview', el => el.classList.contains('active')).catch(() => false);
console.log('3_overview_default_tab:', ovActive ? 'PASS' : 'FAIL');

const greeting = await $t(pp, '#page-greeting');
console.log('4_greeting:', greeting.includes('Jane') ? 'PASS (' + greeting + ')' : 'FAIL: ' + greeting);

const qaBtns = await pp.$$eval('.quick-btn', els => els.map(e => e.textContent.trim()));
console.log('5_quick_actions:', qaBtns.length >= 3 ? 'PASS (' + qaBtns.length + ')' : 'FAIL', JSON.stringify(qaBtns));

const ovPlan    = await $t(pp, '#ov-plan');
const ovDevices = await $t(pp, '#ov-devices');
const ovStatus  = await $t(pp, '#ov-key-status');
const ovExpires = await $t(pp, '#ov-expires');
console.log('3_ov_plan:', ovPlan === 'Pro' ? 'PASS' : 'FAIL: ' + ovPlan);
console.log('3_ov_devices:', ovDevices === '2 / 3' ? 'PASS' : 'FAIL: ' + ovDevices);
console.log('3_ov_status:', ovStatus.toLowerCase().includes('active') ? 'PASS' : 'FAIL: ' + ovStatus);
console.log('3_ov_expires:', ovExpires);

const feats = await pp.$$eval('#ov-features .feature-row', els => els.map(e => ({
  label: e.textContent.trim().replace(/\s+/g, ' '),
  off: e.classList.contains('off')
})));
console.log('6_features_count:', feats.length === 9 ? 'PASS (9)' : 'FAIL: ' + feats.length);
console.log('6_features_on (Pro):',  feats.filter(f => !f.off).map(f => f.label).join(', '));
console.log('6_features_off (Pro):', feats.filter(f => f.off).map(f => f.label).join(', '));

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 7: Plan & Billing
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Phase 7: Plan & Billing ──');
await pp.evaluate(() => showSection('plan', document.querySelector('[data-section="plan"]')));
await pp.waitForTimeout(150);

const planName   = await $t(pp, '#plan-name');
const planNote   = await $t(pp, '#plan-note');
const badgeTxt   = await $t(pp, '#plan-badge-text');
const upgradeS   = await $s(pp, '#upgrade-box');         // '' = visible (correct for Pro)
const expiredS   = await $s(pp, '#expired-box');
const creditS    = await $s(pp, '#upgrade-credit-note');
const subNoteS   = await $s(pp, '#billing-sub-note');
console.log('7_plan_name:', planName === 'FincWin Pro' ? 'PASS' : 'FAIL: ' + planName);
console.log('7_badge:', badgeTxt === 'Pro' ? 'PASS' : 'FAIL: ' + badgeTxt);
console.log('7_upgrade_box (Pro sees Lifetime upgrade):', upgradeS === '' ? 'PASS' : 'FAIL: ' + upgradeS);
console.log('7_expired_box (hidden):', expiredS === 'none' ? 'PASS' : 'FAIL: ' + expiredS);
console.log('7_credit_note (hidden, no sub):', creditS === 'none' ? 'PASS' : 'FAIL: ' + creditS);
console.log('7_billing_sub_note (hidden):', subNoteS === 'none' ? 'PASS' : 'FAIL: ' + subNoteS);
console.log('7_plan_note:', planNote);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 8–9: Licence Key + toggle visibility
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Phase 8–9: Licence Key ──');
await pp.evaluate(() => showSection('licence', document.querySelector('[data-section="licence"]')));
await pp.waitForTimeout(150);

const keyDisp    = await $t(pp, '#key-display');
const keyActs    = await $t(pp, '#key-activations');
const keyStatus  = await $t(pp, '#key-status-el');
const keyExp     = await $t(pp, '#key-expires');
const keyPlan    = await $t(pp, '#key-plan-el');
const newKeyCard = await $h(pp, '#new-key-input');
console.log('8_key_display (masked):', keyDisp.includes('•') ? 'PASS' : 'FAIL: ' + keyDisp);
console.log('8_key_activations:', keyActs);
console.log('8_key_status:', keyStatus.includes('Active') ? 'PASS' : 'FAIL: ' + keyStatus);
console.log('8_key_expires:', keyExp);
console.log('8_key_plan:', keyPlan.includes('Pro') ? 'PASS' : 'FAIL: ' + keyPlan);
console.log('8_new_key_card:', newKeyCard ? 'PASS' : 'FAIL');

await pp.evaluate(() => toggleKeyVisibility());
const revealedKey = await $t(pp, '#key-display');
console.log('9_toggle_reveal:', revealedKey === 'TEST-PRO-KEY-AAAA' ? 'PASS' : 'FAIL: ' + revealedKey);
await pp.evaluate(() => toggleKeyVisibility());
const maskedKey = await $t(pp, '#key-display');
console.log('9_toggle_mask:', maskedKey.includes('•') ? 'PASS' : 'FAIL: ' + maskedKey);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 10: Devices
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Phase 10: Devices ──');
await pp.evaluate(() => showSection('devices', document.querySelector('[data-section="devices"]')));
await pp.waitForTimeout(150);
const devSub   = await $t(pp, '#devices-subtitle');
const devCount = await pp.$eval('#device-list', el => el.children.length).catch(() => 0);
console.log('10_subtitle:', devSub.includes('2 of 3') ? 'PASS' : 'FAIL: ' + devSub);
console.log('10_devices_rendered:', devCount > 0 ? 'PASS (' + devCount + ' slots)' : 'FAIL');

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 11–12: Profile form + save
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Phase 11–12: Profile ──');
await pp.evaluate(() => showSection('profile', document.querySelector('[data-section="profile"]')));
await pp.waitForTimeout(150);
const fname  = await $v(pp, '#p-fname');
const lname  = await $v(pp, '#p-lname');
const email  = await $v(pp, '#p-email');
const dispNm = await $v(pp, '#p-display');
console.log('11_fname:', fname === 'Jane' ? 'PASS' : 'FAIL: ' + fname);
console.log('11_lname:', lname === 'Doe' ? 'PASS' : 'FAIL: ' + lname);
console.log('11_email:', email === 'jane@example.com' ? 'PASS' : 'FAIL: ' + email);
console.log('11_display:', dispNm === 'Jane' ? 'PASS' : 'FAIL: ' + dispNm);

await pp.fill('#p-display', 'Jane Tester');
await pp.evaluate(() => saveProfile(new Event('submit')));
await pp.waitForTimeout(300);
const saveOk = await $s(pp, '#profile-success');
console.log('12_profile_save:', saveOk === 'block' ? 'PASS' : 'FAIL: ' + saveOk);

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 13: Activate new key — failure path stays on page
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Phase 13: Activate new key (failure) ──');
await pp.evaluate(() => showSection('licence', document.querySelector('[data-section="licence"]')));
await pp.waitForTimeout(150);
await pp.fill('#new-key-input', 'FAKE-LIFE-KEY-XXXX');
await pp.evaluate(() => activateNewKey());
await pp.waitForTimeout(1500);
const afterAct = pp.url();
console.log('13_fail_stays_on_page:', afterAct.includes('account') ? 'PASS' : 'FAIL: ' + afterAct);
const toastVisible = await pp.$eval('#toast', el => el.classList.contains('show')).catch(() => false);
console.log('13_error_toast_shown:', toastVisible ? 'PASS' : 'FAIL (no toast)');

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 14: Danger zone
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Phase 14: Danger Zone ──');
await pp.evaluate(() => showSection('danger', document.querySelector('[data-section="danger"]')));
await pp.waitForTimeout(150);
const dangerTitle = await $t(pp, '.danger-zone .card-title');
const deactBtn    = await $h(pp, '#btn-deactivate-all');
const clearBtn    = await pp.$eval('#btn-clear-data', el => el.textContent.trim()).catch(() => 'MISSING');
console.log('14_danger_title:', dangerTitle === 'Danger Zone' ? 'PASS' : 'FAIL: ' + dangerTitle);
console.log('14_deactivate_btn:', deactBtn ? 'PASS' : 'FAIL');
console.log('14_clear_data_btn:', clearBtn.includes('Clear') ? 'PASS' : 'FAIL: ' + clearBtn);

await pc.close();

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 15: Expired Pro state
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Phase 15: Expired Pro ──');
const { page: ep, ctx: ec } = await openAccount(proLs, EXPIRED_DATA);
await ep.evaluate(() => showSection('plan', document.querySelector('[data-section="plan"]')));
await ep.waitForTimeout(150);
const expBadge  = await $t(ep, '#plan-badge-text');
const expUBox   = await $s(ep, '#upgrade-box');
const expEBox   = await $s(ep, '#expired-box');
const expOvPlan = await $t(ep, '#ov-plan');
console.log('15_expired_badge:', expBadge === 'Expired' ? 'PASS' : 'FAIL: ' + expBadge);
console.log('15_upgrade_box_hidden:', expUBox === 'none' ? 'PASS' : 'FAIL: ' + expUBox);
console.log('15_expired_box_shown:', expEBox === '' ? 'PASS' : 'FAIL: ' + expEBox);
console.log('15_ov_plan_shows_expired:', expOvPlan === 'Expired' ? 'PASS' : 'FAIL: ' + expOvPlan);
await ec.close();

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 16: Lifetime state
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Phase 16: Lifetime ──');
const lifeLs = { ...proLs, fw_plan: 'Lifetime' };
const { page: lp, ctx: lc } = await openAccount(lifeLs, LIFE_DATA);
await lp.evaluate(() => showSection('plan', document.querySelector('[data-section="plan"]')));
await lp.waitForTimeout(150);
const lifeBadge  = await $t(lp, '#plan-badge-text');
const lifeUBox   = await $s(lp, '#upgrade-box');
const lifeEBox   = await $s(lp, '#expired-box');
const lifeCCChip = await lp.$eval('#chip-custom-cats', el => el.classList.contains('on')).catch(() => false);
const lifeOvExp  = await $t(lp, '#ov-expires');
const lifeAllOn  = await lp.$$eval('#ov-features .feature-row:not(.off)', els => els.length);
console.log('16_lifetime_badge:', lifeBadge === 'Lifetime' ? 'PASS' : 'FAIL: ' + lifeBadge);
console.log('16_upgrade_box_hidden:', lifeUBox === 'none' ? 'PASS' : 'FAIL: ' + lifeUBox);
console.log('16_expired_box_hidden:', lifeEBox === 'none' ? 'PASS' : 'FAIL: ' + lifeEBox);
console.log('16_custom_cats_chip_on:', lifeCCChip ? 'PASS' : 'FAIL');
console.log('16_ov_expires:', lifeOvExp);
console.log('16_all_9_features_on:', lifeAllOn === 9 ? 'PASS' : 'FAIL: only ' + lifeAllOn + ' on');
await lc.close();

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 17: Pro with subscription (has expires_at) — billing/credit notes
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Phase 17: Pro subscription ──');
const { page: sp, ctx: sc } = await openAccount(proLs, SUB_DATA);
await sp.evaluate(() => showSection('plan', document.querySelector('[data-section="plan"]')));
await sp.waitForTimeout(150);
const subNote2   = await $s(sp, '#billing-sub-note');
const creditN2   = await $s(sp, '#upgrade-credit-note');
const planNote17 = await $t(sp, '#plan-note');
console.log('17_billing_sub_note_visible:', subNote2 === '' ? 'PASS' : 'FAIL: ' + subNote2);
console.log('17_credit_note_visible:', creditN2 === '' ? 'PASS' : 'FAIL: ' + creditN2);
console.log('17_plan_note_shows_renewal:', planNote17.includes('Renew') ? 'PASS' : 'FAIL: ' + planNote17);
await sc.close();

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 18: Page errors
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── Phase 18: Errors ──');
console.log('18_errors:', errs.length === 0 ? 'NONE' : JSON.stringify(errs));

await browser.close();
console.log('\nDONE');
