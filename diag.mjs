// Diagnostic: find the real source of JS errors with stack traces
import { chromium } from 'playwright';

const BASE = 'http://localhost:4141';
const PAUSE = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push({ text: msg.text(), location: msg.location() });
  });
  page.on('pageerror', err => errors.push({ text: err.message, stack: err.stack }));

  // Clear all state first for a clean run
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Clear IndexedDB
    return new Promise(res => {
      const req = indexedDB.deleteDatabase('FinFlow');
      req.onsuccess = res; req.onerror = res; req.onblocked = res;
    });
  });
  console.log('Storage cleared');

  // Reload fresh
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await PAUSE(1000);

  const errCount1 = errors.length;
  console.log(`Errors after clean load: ${errCount1}`);
  errors.forEach(e => console.log('  >', e.text?.slice(0,200)));

  // Load demo data
  const demoBtn = page.locator('button[data-action="obLoadDemoAndClose"]');
  if (await demoBtn.isVisible()) {
    errors.length = 0; // reset
    await demoBtn.click();
    await PAUSE(2000);
    console.log(`Errors after demo load: ${errors.length}`);
    errors.forEach(e => console.log('  >', e.text?.slice(0,200)));
  } else {
    console.log('No demo button visible - checking state');
    const state = await page.evaluate(() => ({ CMK: window.CMK, hasMonths: !!(window.S && window.S.months) }));
    console.log('State:', state);
  }

  // Test each tab and capture new errors
  const tabList = ['expenses','revenue','loans','savings','calendar','analytics','archive','settings','dashboard'];
  for (const t of tabList) {
    const prevCount = errors.length;
    await page.locator(`.tab-bar button[data-arg="${t}"]`).click();
    await PAUSE(600);
    const newErrors = errors.slice(prevCount);
    if (newErrors.length > 0) {
      console.log(`\n[TAB: ${t}] ${newErrors.length} new error(s):`);
      newErrors.forEach(e => {
        console.log('  Text:', e.text?.slice(0, 300));
        if (e.stack) console.log('  Stack:', e.stack.split('\n').slice(0,5).join('\n    '));
        if (e.location) console.log('  Location:', e.location);
      });
    } else {
      console.log(`[TAB: ${t}] No errors ✓`);
    }
  }

  // Test health modal specifically
  errors.length = 0;
  await page.locator('.tab-bar button[data-arg="dashboard"]').click();
  await PAUSE(400);

  const healthScore = await page.textContent('#healthScore');
  console.log(`\nHealth score before badge click: "${healthScore}"`);

  await page.click('.health-badge');
  await PAUSE(600);

  const modalOpen = await page.evaluate(() => {
    const el = document.getElementById('healthModal');
    return el ? { display: getComputedStyle(el).display, classes: el.className } : null;
  });
  console.log('Health modal state after click:', modalOpen);

  if (errors.length > 0) {
    console.log('Errors on health badge click:');
    errors.forEach(e => console.log(' >', e.text?.slice(0,300)));
  }

  await page.keyboard.press('Escape');
  await PAUSE(200);

  // Test prev month
  errors.length = 0;
  const monthBefore = await page.textContent('#monthLabel');
  await page.locator('button[data-action="changeMonth"][data-arg="-1"]').first().click();
  await PAUSE(300);
  const monthAfter = await page.textContent('#monthLabel');
  console.log(`\nPrev month: "${monthBefore}" → "${monthAfter}" (changed: ${monthBefore !== monthAfter})`);
  if (errors.length > 0) console.log('Errors on prev month:', errors.map(e => e.text));

  // Test add expense modal
  errors.length = 0;
  await page.locator('.tab-bar button[data-arg="expenses"]').click();
  await PAUSE(400);

  // Find and click the + button (not item name, but the add button)
  const addBtn = await page.evaluate(() => {
    // Look for buttons that have openItemModal with ii=-1 or similar
    const btns = Array.from(document.querySelectorAll('button'));
    const addBtns = btns.filter(b => b.offsetParent !== null &&
      (b.dataset.action === 'openItemModal') &&
      b.textContent.trim() !== '' &&
      (b.dataset.arg2 === undefined || parseInt(b.dataset.arg2) < 0));
    return addBtns.map(b => ({ action: b.dataset.action, arg: b.dataset.arg, arg2: b.dataset.arg2, text: b.textContent.trim().slice(0,20) }));
  });
  console.log('\nAdd expense buttons:', JSON.stringify(addBtn));

  // Open modal via keyboard shortcut N
  await page.keyboard.press('n');
  await PAUSE(400);

  const itemModalState = await page.evaluate(() => {
    const el = document.getElementById('itemModal');
    return el ? { display: getComputedStyle(el).display, classes: el.className } : 'not found';
  });
  console.log('Item modal after "n" shortcut:', itemModalState);

  if (itemModalState && itemModalState.classes && itemModalState.classes.includes('open')) {
    // Fill and save
    await page.fill('#iName', 'Test Expense');
    await page.fill('#iAmount', '25.00');
    await PAUSE(200);

    errors.length = 0;
    await page.locator('button[data-action="saveItemModal"]').click();
    await PAUSE(500);

    const afterSave = await page.evaluate(() => {
      const el = document.getElementById('itemModal');
      return el ? { display: getComputedStyle(el).display, classes: el.className } : 'not found';
    });
    console.log('Item modal after save:', afterSave);

    if (errors.length > 0) {
      console.log('Save errors:', errors.map(e => e.text));
    } else {
      console.log('Save: no errors ✓');
    }
  }

  // Check revenue add modal
  errors.length = 0;
  await page.locator('.tab-bar button[data-arg="revenue"]').click();
  await PAUSE(400);

  const revBtnInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('#section-revenue button[data-action]'));
    return btns.filter(b => b.offsetParent !== null).map(b => ({
      action: b.dataset.action, text: b.textContent.trim().slice(0,20)
    })).slice(0, 10);
  });
  console.log('\nRevenue section buttons:', JSON.stringify(revBtnInfo));

  if (revBtnInfo.length > 0) {
    const addRevAction = revBtnInfo.find(b => b.action.includes('Rev') || b.action.includes('rev'));
    if (addRevAction) {
      await page.locator(`#section-revenue button[data-action="${addRevAction.action}"]`).first().click();
      await PAUSE(400);
      const revModalState = await page.evaluate(() => {
        const el = document.getElementById('revModal');
        return el ? { display: getComputedStyle(el).display, classes: el.className } : 'not found';
      });
      console.log('Rev modal state:', revModalState);
      await page.keyboard.press('Escape');
      await PAUSE(200);
    }
  }

  // Final error summary
  console.log('\n=== TOTAL ERRORS CAPTURED ===');
  console.log(errors.length, 'final errors');
  errors.forEach((e, i) => console.log(`${i+1}. ${e.text?.slice(0,200)}`));

  await browser.close();
})().catch(e => console.error('CRASH:', e.message));
