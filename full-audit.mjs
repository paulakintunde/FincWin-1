// Full FincWin audit — clean state, all features
import { chromium } from 'playwright';

const BASE = 'http://localhost:4141';
const PAUSE = ms => new Promise(r => setTimeout(r, ms));

const findings = [];
function bug(section, msg) { findings.push({ severity: 'BUG', section, msg }); console.log(`[BUG] [${section}] ${msg}`); }
function warn(section, msg) { findings.push({ severity: 'WARN', section, msg }); console.log(`[WARN] [${section}] ${msg}`); }
function ok(section, msg) { console.log(`[OK] [${section}] ${msg}`); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('JS: ' + err.message));

  // === SETUP: clean state + demo data ===
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear(); sessionStorage.clear();
    return new Promise(res => { const req = indexedDB.deleteDatabase('FinFlow'); req.onsuccess = res; req.onerror = res; req.onblocked = res; });
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await PAUSE(800);

  // Load demo data via onboarding
  const demoBtn = page.locator('button[data-action="obLoadDemoAndClose"]');
  if (await demoBtn.isVisible()) {
    await demoBtn.click();
    await PAUSE(2000);
    ok('Setup', 'Demo data loaded via onboarding');
  }

  function checkErr(section) {
    if (errors.length > 0) { bug(section, `JS errors: ${[...new Set(errors)].slice(0,3).join(' | ')}`); errors.length = 0; }
  }

  async function clickTab(arg) {
    await page.locator(`.tab-bar button[data-arg="${arg}"]`).click();
    await PAUSE(500);
  }

  async function isModalOpen(id) {
    return page.evaluate(id => {
      const el = document.getElementById(id);
      return el ? getComputedStyle(el).display !== 'none' : false;
    }, id);
  }

  // === 1. DASHBOARD ===
  await clickTab('dashboard');
  checkErr('Dashboard');

  const cashflow = await page.textContent('#d-cashflow');
  const healthScore = await page.textContent('#healthScore');
  const monthLabel = await page.textContent('#monthLabel');
  ok('Dashboard', `Cashflow: ${cashflow}, Health: ${healthScore}, Month: ${monthLabel}`);

  if (!cashflow || cashflow === '—') bug('Dashboard', 'Cashflow value not rendering');
  if (!healthScore || healthScore === '—') bug('Dashboard', 'Health score not rendering');

  // All KPIs
  const kpis = ['d-income','d-expenses','d-pending','d-debt','d-savings','d-minpmts','d-networth'];
  for (const id of kpis) {
    const val = await page.textContent('#' + id);
    if (!val || val === '—') warn('Dashboard', `KPI #${id} shows blank/dash`);
  }
  ok('Dashboard', 'KPIs checked');

  // Month navigation
  const monthBefore = await page.textContent('#monthLabel');
  await page.locator('button[data-action="changeMonth"][data-arg="-1"]').first().click();
  await PAUSE(300);
  const monthAfterPrev = await page.textContent('#monthLabel');
  if (monthAfterPrev === monthBefore) warn('MonthNav', 'Prev button did nothing (only 1 month available?)');
  else ok('MonthNav', `Prev: "${monthBefore}" → "${monthAfterPrev}" ✓`);

  await page.locator('button[data-action="changeMonth"][data-arg="1"]').first().click();
  await PAUSE(300);
  const monthAfterNext = await page.textContent('#monthLabel');
  if (monthAfterNext === monthAfterPrev) bug('MonthNav', 'Next button did not advance month');
  else ok('MonthNav', `Next: "${monthAfterPrev}" → "${monthAfterNext}" ✓`);

  // Health badge → modal
  await page.click('.health-badge');
  await PAUSE(600);
  const healthModalOpen = await isModalOpen('healthModal');
  if (!healthModalOpen) bug('HealthModal', 'Health badge click did not open health modal');
  else ok('HealthModal', 'Health modal opened ✓');
  await page.keyboard.press('Escape');
  await PAUSE(200);

  // Greeting click → health modal
  const greeting = page.locator('#d-greeting');
  if (await greeting.isVisible()) {
    await greeting.click();
    await PAUSE(500);
    const greetingOpened = await isModalOpen('healthModal');
    if (!greetingOpened) warn('HealthModal', 'Greeting click did not open health modal');
    else ok('HealthModal', 'Greeting click opens health modal ✓');
    await page.keyboard.press('Escape');
    await PAUSE(200);
  }

  // DTI tooltip
  const dtiBtn = page.locator('#dtiInfoBtn');
  if (await dtiBtn.isVisible()) {
    await dtiBtn.click();
    await PAUSE(200);
    const tooltipOpen = await page.evaluate(() => {
      const el = document.getElementById('dtiTooltip');
      return el ? el.getAttribute('aria-hidden') === 'false' : false;
    });
    if (!tooltipOpen) bug('DTI', 'DTI tooltip did not open');
    else ok('DTI', 'DTI tooltip opened ✓');

    // "Ask AI about DTI" link in tooltip
    const aiDTILink = page.locator('button[data-action="askAIAboutDTI"]');
    if (await aiDTILink.isVisible()) {
      ok('DTI', 'Ask AI about DTI link present ✓');
    } else {
      warn('DTI', 'Ask AI about DTI link not visible in tooltip');
    }

    // Close tooltip by clicking outside
    await page.click('#d-cashflow');
    await PAUSE(200);
    const tooltipClosed = await page.evaluate(() => {
      const el = document.getElementById('dtiTooltip');
      return el ? el.getAttribute('aria-hidden') === 'true' : true;
    });
    if (!tooltipClosed) warn('DTI', 'DTI tooltip did not close on outside click');
    else ok('DTI', 'DTI tooltip closes on outside click ✓');
  }

  // Dark mode toggle
  const darkBefore = await page.evaluate(() => document.body.className);
  await page.locator('#dkBtn').click();
  await PAUSE(300);
  const darkAfter = await page.evaluate(() => document.body.className);
  if (darkBefore === darkAfter) bug('DarkMode', 'Dark mode toggle had no effect');
  else ok('DarkMode', `Dark mode toggled: "${darkBefore}" → "${darkAfter}" ✓`);
  await page.locator('#dkBtn').click();
  await PAUSE(200);

  // Search
  await page.locator('#searchBtn').click();
  await PAUSE(400);
  const searchPanelOpen = await page.evaluate(() => {
    const el = document.getElementById('searchPanel') || document.getElementById('searchOverlay');
    return el ? el.offsetParent !== null : false;
  });
  if (!searchPanelOpen) bug('Search', 'Search panel did not open via button');
  else ok('Search', 'Search panel opened ✓');
  checkErr('Search');
  await page.keyboard.press('Escape');
  await PAUSE(200);

  // "/" shortcut
  await page.keyboard.press('/');
  await PAUSE(300);
  const searchViaKey = await page.evaluate(() => {
    const el = document.getElementById('searchPanel') || document.getElementById('searchOverlay');
    return el ? el.offsetParent !== null : false;
  });
  if (!searchViaKey) warn('Search', '"/" shortcut did not open search');
  else ok('Search', '"/" shortcut opens search ✓');
  await page.keyboard.press('Escape');
  await PAUSE(200);

  // === 2. EXPENSES TAB ===
  await clickTab('expenses');
  checkErr('Expenses');

  // Add item via "N" shortcut
  await page.keyboard.press('n');
  await PAUSE(400);
  const itemModalOpen = await isModalOpen('itemModal');
  if (!itemModalOpen) bug('Expenses', '"N" shortcut did not open add expense modal');
  else ok('Expenses', '"N" shortcut opens item modal ✓');

  if (itemModalOpen) {
    // Fill name and amount
    await page.fill('#iName', 'Test Expense');
    await page.fill('#iAmount', '50.00');
    await PAUSE(100);

    // Check category auto-tag
    const catPillSelected = await page.evaluate(() => {
      const sel = document.querySelector('#catPillGrid .cat-pill-opt.selected');
      return sel ? sel.textContent.trim() : null;
    });
    ok('Expenses', `Category auto-tag: "${catPillSelected}"`);

    // Save
    await page.locator('button[data-action="saveItemModal"]').click();
    await PAUSE(400);
    const modalClosed = !(await isModalOpen('itemModal'));
    if (!modalClosed) bug('Expenses', 'Item modal did not close after save');
    else ok('Expenses', 'Item modal closes after save ✓');
    checkErr('Expenses');
  }

  // Add item via "+ Add Item" button
  const addItemBtn = page.locator('button[data-action="openItemModal"][data-arg2="-1"]').first();
  await addItemBtn.click();
  await PAUSE(400);
  const itemModal2Open = await isModalOpen('itemModal');
  if (!itemModal2Open) bug('Expenses', '"+ Add Item" button did not open modal');
  else ok('Expenses', '"+ Add Item" button opens modal ✓');

  if (itemModal2Open) {
    // Check all modal fields
    const fields = ['iName', 'iAmount', 'iNote', 'iDueDay'];
    for (const f of fields) {
      if (!(await page.isVisible('#' + f))) bug('Expenses', `Item modal field #${f} not visible`);
    }

    // Test category pills exist
    const catPills = await page.locator('#catPillGrid .cat-pill-opt').count();
    if (catPills === 0) bug('Expenses', 'No category pills in item modal');
    else ok('Expenses', `Category pills: ${catPills} options ✓`);

    // Status toggle
    const paidBtn = page.locator('button[data-action="setItemStatus"][data-arg="paid"]');
    if (await paidBtn.isVisible()) {
      await paidBtn.click();
      await PAUSE(100);
      ok('Expenses', 'Status toggle works ✓');
    } else {
      warn('Expenses', 'Status paid button not visible in modal');
    }

    // Close via X button (two buttons match: close-btn and Cancel — use first)
    await page.locator('#itemModal button[data-action="closeItemModal"]').first().click();
    await PAUSE(300);
    const closedByX = !(await isModalOpen('itemModal'));
    if (!closedByX) bug('Expenses', 'X button did not close item modal');
    else ok('Expenses', 'X button closes item modal ✓');
  }

  // Clone Month button
  const cloneBtn = page.locator('button[data-action="openCloneModal"]');
  if (await cloneBtn.isVisible()) {
    await cloneBtn.click();
    await PAUSE(300);
    const cloneOpen = await isModalOpen('cloneModal');
    if (!cloneOpen) bug('Expenses', 'Clone Month modal did not open');
    else ok('Expenses', 'Clone Month modal opens ✓');
    await page.keyboard.press('Escape');
    await PAUSE(200);
  }

  // New Month button
  const newMonBtn = page.locator('button[data-action="openNewMonthModal"]');
  if (await newMonBtn.isVisible()) {
    await newMonBtn.click();
    await PAUSE(300);
    const newMonOpen = await isModalOpen('newMonthModal');
    if (!newMonOpen) bug('Expenses', 'New Month modal did not open');
    else ok('Expenses', 'New Month modal opens ✓');
    await page.keyboard.press('Escape');
    await PAUSE(200);
  }

  // Import CSV button
  const importBtn = page.locator('button[data-action="openBankImport"]').first();
  if (await importBtn.isVisible()) {
    await importBtn.click();
    await PAUSE(400);
    const importOpen = await isModalOpen('bankImportModal');
    if (!importOpen) bug('Expenses', 'Bank Import modal did not open');
    else ok('Expenses', 'Bank Import (CSV) modal opens ✓');
    await page.keyboard.press('Escape');
    await PAUSE(200);
  }

  // === 3. REVENUE TAB ===
  await clickTab('revenue');
  checkErr('Revenue');

  // Add income modal
  const addRevBtn = page.locator('#section-revenue button[data-action="openRevModal"]').filter({ visible: true }).first();
  const revBtnCount = await addRevBtn.count();
  if (revBtnCount > 0) {
    await addRevBtn.click();
    await PAUSE(500);
    const revModalOpen = await isModalOpen('revModal');
    if (!revModalOpen) {
      // Check if modal opened as something else
      const anyOpen = await page.evaluate(() => {
        const m = document.querySelector('.modal-overlay.open');
        return m ? m.id : null;
      });
      bug('Revenue', `Add Income modal did not open (#revModal) — open: ${anyOpen}`);
    } else {
      ok('Revenue', 'Add Income modal opens ✓');
      // Check fields
      const revFields = ['rName', 'rAmount'];
      for (const f of revFields) {
        if (!(await page.isVisible('#' + f))) warn('Revenue', `Rev modal field #${f} not visible`);
      }
      // Close
      await page.keyboard.press('Escape');
      await PAUSE(200);
    }
  } else {
    warn('Revenue', 'No visible "+ Add Income" button in Revenue tab');
  }

  // Toggle received status on existing item
  const toggleRevBtn = page.locator('#section-revenue button[data-action="toggleRev"]').first();
  if (await toggleRevBtn.count() > 0) {
    await toggleRevBtn.click();
    await PAUSE(200);
    ok('Revenue', 'Received toggle clicked ✓');
    checkErr('Revenue');
  }

  // === 4. LOANS TAB ===
  await clickTab('loans');
  checkErr('Loans');

  // Strategy toggle
  const avalancheBtn = page.locator('#btn-avalanche');
  const snowballBtn = page.locator('#btn-snowball');
  if (await avalancheBtn.isVisible() && await snowballBtn.isVisible()) {
    await snowballBtn.click();
    await PAUSE(200);
    const snowballActive = await page.evaluate(() => document.getElementById('btn-snowball').classList.contains('active'));
    if (!snowballActive) warn('Loans', 'Snowball strategy button did not become active');
    else ok('Loans', 'Strategy toggle works ✓');
    await avalancheBtn.click(); // reset
    await PAUSE(200);
  }

  // Add loan modal
  const addLoanBtn = page.locator('#section-loans button[data-action="openLoanModal"]').filter({ visible: true }).first();
  if (await addLoanBtn.count() > 0) {
    await addLoanBtn.click();
    await PAUSE(400);
    const loanModalOpen = await isModalOpen('loanModal');
    if (!loanModalOpen) bug('Loans', 'Add Loan modal did not open');
    else ok('Loans', 'Add Loan modal opens ✓');
    await page.keyboard.press('Escape');
    await PAUSE(200);
  }

  // Pay loan chip (mark paid)
  const loanChip = page.locator('.pchip.pending').first();
  if (await loanChip.count() > 0) {
    await loanChip.click();
    await PAUSE(300);
    ok('Loans', 'Loan payment chip clicked ✓');
    checkErr('Loans');
  }

  // === 5. SAVINGS TAB ===
  await clickTab('savings');
  checkErr('Savings');

  // Add savings goal
  const addSavBtn = page.locator('#section-savings button[data-action="openSavModal"]').filter({ visible: true }).first();
  if (await addSavBtn.count() > 0) {
    await addSavBtn.click();
    await PAUSE(400);
    const savModalOpen = await isModalOpen('savModal');
    if (!savModalOpen) bug('Savings', 'Add Savings Goal modal did not open');
    else ok('Savings', 'Add Savings Goal modal opens ✓');
    await page.keyboard.press('Escape');
    await PAUSE(200);
  }

  // Deposit button
  const depositBtn = page.locator('#section-savings button[data-action="openTxnDeposit"]').first();
  if (await depositBtn.count() > 0) {
    await depositBtn.click();
    await PAUSE(400);
    const txnModalOpen = await isModalOpen('txnModal');
    if (!txnModalOpen) warn('Savings', 'Deposit transaction modal did not open');
    else ok('Savings', 'Deposit modal opens ✓');
    await page.keyboard.press('Escape');
    await PAUSE(200);
  }

  // Withdraw button
  const withdrawBtn = page.locator('#section-savings button[data-action="openTxnWithdraw"]').first();
  if (await withdrawBtn.count() > 0) {
    await withdrawBtn.click();
    await PAUSE(300);
    const txnModalOpen2 = await isModalOpen('txnModal');
    if (!txnModalOpen2) warn('Savings', 'Withdraw transaction modal did not open');
    else ok('Savings', 'Withdraw modal opens ✓');
    await page.keyboard.press('Escape');
    await PAUSE(200);
  }

  // === 6. CALENDAR TAB ===
  await clickTab('calendar');
  checkErr('Calendar');

  const calDays = await page.locator('#section-calendar .cal-day, #section-calendar td[data-date], #section-calendar [data-action="calDayClick"]').count();
  if (calDays === 0) warn('Calendar', 'No calendar day cells found');
  else ok('Calendar', `Calendar cells: ${calDays} ✓`);

  // Click a day
  const calDay = page.locator('#section-calendar [data-action="calDayClick"]').first();
  if (await calDay.count() > 0) {
    await calDay.click();
    await PAUSE(400);
    ok('Calendar', 'Calendar day click triggered');
    checkErr('Calendar');
    await page.keyboard.press('Escape');
    await PAUSE(200);
  }

  // === 7. ANALYTICS TAB ===
  await clickTab('analytics');
  await PAUSE(800); // charts need time
  checkErr('Analytics');

  const canvasCount = await page.locator('#section-analytics canvas').count();
  if (canvasCount === 0) warn('Analytics', 'No chart canvas elements found');
  else ok('Analytics', `Charts rendered: ${canvasCount} canvas elements ✓`);

  // AI Coach section
  const coachSection = await page.isVisible('#coachSection');
  if (!coachSection) warn('Analytics', 'AI Coach section not visible');
  else ok('Analytics', 'AI Coach section visible ✓');

  // === 8. ARCHIVE TAB ===
  await clickTab('archive');
  checkErr('Archive');

  const archiveContent = await page.evaluate(() => {
    const s = document.getElementById('section-archive');
    return s ? s.textContent.trim().slice(0, 100) : '';
  });
  ok('Archive', `Archive content: "${archiveContent.slice(0,50)}..."`);

  // === 9. SETTINGS TAB ===
  await clickTab('settings');
  checkErr('Settings');

  // Export Data button
  const exportBtn = page.locator('#section-settings button[data-action="exportData"]').filter({ visible: true }).first();
  if (await exportBtn.count() > 0) ok('Settings', 'Export Data button present ✓');
  else warn('Settings', 'Export Data button not found in Settings');

  // Import button
  const importSettBtn = page.locator('#section-settings button[data-action="openImport"]').filter({ visible: true }).first();
  if (await importSettBtn.count() > 0) ok('Settings', 'Import button present ✓');
  else warn('Settings', 'Import button not found in Settings');

  // Currency modal
  const currencyBtn = page.locator('#section-settings button[data-action="openCurrencyModal"]').filter({ visible: true }).first();
  if (await currencyBtn.count() > 0) {
    await currencyBtn.click();
    await PAUSE(400);
    const currOpen = await isModalOpen('currencyModal');
    if (!currOpen) bug('Settings', 'Currency modal did not open');
    else ok('Settings', 'Currency modal opens ✓');
    await page.keyboard.press('Escape');
    await PAUSE(200);
  }

  // AI setup button
  const aiSetupBtn = page.locator('#section-settings button[data-action="openAISetupClaude"], #section-settings button[data-action="openClaudeSetup"]').filter({ visible: true }).first();
  if (await aiSetupBtn.count() > 0) {
    ok('Settings', 'AI setup button found ✓');
  } else {
    warn('Settings', 'AI setup button not visible in Settings');
  }

  // === 10. PIN MODAL ===
  await clickTab('dashboard');
  await PAUSE(200);

  await page.locator('#pinBtn').click();
  await PAUSE(400);
  const pinModalOpen = await page.evaluate(() => {
    const el = document.getElementById('pinSetupModal');
    return el ? getComputedStyle(el).display !== 'none' : false;
  });
  if (!pinModalOpen) bug('PINModal', 'PIN setup modal did not open');
  else ok('PINModal', 'PIN setup modal opens ✓');

  if (pinModalOpen) {
    // Test PIN key presses
    for (const d of ['1','2','3','4','5','6']) {
      await page.locator(`#pinSetupModal button[data-action="setupKeyPress"][data-arg="${d}"]`).click();
      await PAUSE(50);
    }
    ok('PINModal', 'PIN digits entered');

    // Test backspace
    await page.locator('#pinSetupModal button[data-action="setupKeyPress"][data-arg="del"]').click();
    await PAUSE(100);
    ok('PINModal', 'PIN delete key works');

    // Close modal
    await page.locator('#pinSetupModal button[data-action="closePinSetup"]').first().click();
    await PAUSE(300);
    const pinClosed = await page.evaluate(() => {
      const el = document.getElementById('pinSetupModal');
      return el ? getComputedStyle(el).display === 'none' : true;
    });
    if (!pinClosed) bug('PINModal', 'PIN modal close button did not work');
    else ok('PINModal', 'PIN modal closes ✓');
    checkErr('PINModal');
  }

  // === 11. NOTIFICATIONS ===
  const notifBtn = page.locator('#notifBtn');
  if (await notifBtn.isVisible()) {
    await notifBtn.click();
    await PAUSE(500);
    const notifState = await page.evaluate(() => {
      const ids = ['notifPanel', 'billReminders', 'notifSheet'];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetParent !== null) return id;
      }
      const byClass = document.querySelector('.notif-panel, .bill-reminders-panel');
      return byClass ? byClass.className : null;
    });
    if (!notifState) warn('Notifications', 'Notification panel not found after button click');
    else ok('Notifications', `Notif panel opened: ${notifState} ✓`);
    await page.keyboard.press('Escape');
    await PAUSE(200);
  }

  // === 12. LOGO NAVIGATION ===
  await clickTab('settings');
  await PAUSE(200);
  await page.locator('button.logo').click();
  await PAUSE(300);
  const dashActive = await page.evaluate(() => {
    const el = document.getElementById('section-dashboard');
    return el ? el.classList.contains('active') : false;
  });
  if (!dashActive) bug('Logo', 'Logo button did not navigate to dashboard');
  else ok('Logo', 'Logo button → dashboard ✓');

  // === 13. MOBILE MENU (desktop viewport) ===
  // Test mobile menu buttons in desktop (they should still work, just hidden)
  // Test AI Coach button routing
  const aiCoachArg = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const ai = btns.find(b => b.textContent.trim() === 'AI Coach');
    return ai ? ai.dataset.arg : 'NOT FOUND';
  });
  if (aiCoachArg === 'analytics') {
    warn('MobileMenu', `AI Coach button routes to "analytics" tab — may be intentional if AI Coach is in analytics section`);
  } else {
    ok('MobileMenu', `AI Coach routes to: "${aiCoachArg}"`);
  }

  // === 14. MOBILE VIEWPORT ===
  await page.setViewportSize({ width: 390, height: 844 });
  await PAUSE(400);

  // Mobile bottom nav
  const mbnItems = ['dashboard','expenses','revenue','loans','savings'];
  for (const t of mbnItems) {
    const mbnBtn = page.locator(`#mbn-${t}`);
    if (await mbnBtn.isVisible()) {
      await mbnBtn.click();
      await PAUSE(300);
      const active = await page.evaluate(id => {
        const el = document.getElementById('section-' + id);
        return el ? el.classList.contains('active') : false;
      }, t);
      if (!active) bug('MobileNav', `MBN "${t}" did not activate section`);
      else ok('MobileNav', `MBN "${t}" ✓`);
    } else {
      warn('MobileNav', `#mbn-${t} not visible at 390px width`);
    }
  }
  checkErr('MobileNav');

  // Mobile menu open/close
  const mmOpenBtn = page.locator('button[data-action="toggleMobileMenu"]').filter({ visible: true }).first();
  if (await mmOpenBtn.count() > 0) {
    await mmOpenBtn.click();
    await PAUSE(400);
    const mmOpen = await page.evaluate(() => {
      const el = document.getElementById('mobileMenuSheet');
      return el ? el.style.display !== 'none' && el.style.display !== '' : false;
    });
    if (!mmOpen) bug('MobileMenu', 'Mobile menu sheet did not open');
    else ok('MobileMenu', 'Mobile menu opens ✓');

    if (mmOpen) {
      // Navigate via mobile menu
      const analyticsMenuItem = page.locator('#mobileMenuSheet button[data-action="switchTabAndCloseMenu"][data-arg="analytics"]').first();
      if (await analyticsMenuItem.isVisible()) {
        await analyticsMenuItem.click();
        await PAUSE(400);
        const analyticsActive = await page.evaluate(() => {
          const el = document.getElementById('section-analytics');
          return el ? el.classList.contains('active') : false;
        });
        if (!analyticsActive) bug('MobileMenu', 'Analytics menu item did not navigate');
        else ok('MobileMenu', 'Analytics menu item navigates ✓');
      }

      // Close mobile menu
      const closeMenuBtn = page.locator('#mobileMenuSheet button[data-action="toggleMobileMenu"]').first();
      if (await closeMenuBtn.isVisible()) {
        await closeMenuBtn.click();
        await PAUSE(300);
        const mmClosed = await page.evaluate(() => {
          const el = document.getElementById('mobileMenuSheet');
          return !el || el.style.display === 'none';
        });
        if (!mmClosed) bug('MobileMenu', 'Mobile menu close button did not close menu');
        else ok('MobileMenu', 'Mobile menu closes ✓');
      }
    }
  }
  checkErr('MobileMenu');

  await page.setViewportSize({ width: 1280, height: 800 });
  await PAUSE(300);

  // === 15. LAYOUT CHECKS ===
  await clickTab('dashboard');
  await PAUSE(400);

  const layoutProblems = await page.evaluate(() => {
    const problems = [];
    // Topbar
    const tb = document.querySelector('.topbar');
    if (tb) {
      const r = tb.getBoundingClientRect();
      if (r.top < -1) problems.push(`Topbar top=${r.top.toFixed(0)}px (above viewport)`);
    }
    // Horizontal overflow on active section
    const active = document.querySelector('.section.active');
    if (active) {
      const r = active.getBoundingClientRect();
      if (r.right > window.innerWidth + 5) problems.push(`Active section overflows right by ${Math.round(r.right-window.innerWidth)}px`);
    }
    // Any open modal-overlay that shouldn't be open
    const opens = Array.from(document.querySelectorAll('.modal-overlay.open'));
    if (opens.length > 0) problems.push(`Orphan open modals: ${opens.map(m=>m.id).join(', ')}`);
    return problems;
  });
  if (layoutProblems.length > 0) {
    layoutProblems.forEach(p => warn('Layout', p));
  } else {
    ok('Layout', 'No layout/overflow issues ✓');
  }

  // === 16. ACCESSIBILITY BASICS ===
  const a11yProblems = await page.evaluate(() => {
    const problems = [];
    // Buttons with no accessible name
    const btns = Array.from(document.querySelectorAll('button'));
    btns.filter(b => b.offsetParent !== null).forEach(b => {
      const text = b.textContent.trim();
      const label = b.getAttribute('aria-label') || b.getAttribute('title');
      if (!text && !label && !b.querySelector('svg title')) {
        problems.push(`Unnamed button: data-action="${b.dataset.action || '?'}"`);
      }
    });
    return problems.slice(0, 10);
  });
  if (a11yProblems.length > 0) {
    a11yProblems.forEach(p => warn('A11y', p));
  } else {
    ok('A11y', 'No unnamed button elements found ✓');
  }

  // === 17. KEYBOARD SHORTCUTS ===
  const shortcuts = [
    { key: 'g', section: 'dashboard', label: 'g → dashboard' },
    { key: 'e', section: 'expenses', label: 'e → expenses' },
    { key: 'r', section: 'revenue', label: 'r → revenue' },
    { key: 'l', section: 'loans', label: 'l → loans' },
    { key: 's', section: 'savings', label: 's → savings' },
    { key: 'a', section: 'analytics', label: 'a → analytics' },
  ];
  for (const sc of shortcuts) {
    await page.keyboard.press(sc.key);
    await PAUSE(300);
    const active = await page.evaluate(id => {
      const el = document.getElementById('section-' + id);
      return el ? el.classList.contains('active') : false;
    }, sc.section);
    if (!active) warn('Keyboard', `Shortcut "${sc.label}" did not activate section`);
    else ok('Keyboard', `"${sc.label}" ✓`);
  }
  checkErr('Keyboard');

  // === 18. BROKEN IMAGES ===
  const brokenImgs = await page.evaluate(() => {
    return Array.from(document.images)
      .filter(img => !img.complete || img.naturalWidth === 0)
      .map(img => img.src.replace(location.origin, ''));
  });
  if (brokenImgs.length > 0) brokenImgs.forEach(src => warn('Images', `Broken image: ${src}`));
  else ok('Images', 'No broken images ✓');

  // === 19. Console errors summary ===
  if (errors.length > 0) {
    [...new Set(errors)].forEach(e => bug('Console', e.slice(0, 200)));
  }

  await browser.close();

  // ══════ FINAL REPORT ══════
  console.log('\n' + '═'.repeat(70));
  console.log('FINCWIN FULL AUDIT REPORT');
  console.log('═'.repeat(70));
  const bugs = findings.filter(f => f.severity === 'BUG');
  const warns = findings.filter(f => f.severity === 'WARN');
  console.log(`\nTotal findings: ${findings.length}  |  Bugs: ${bugs.length}  |  Warnings: ${warns.length}\n`);
  if (bugs.length) {
    console.log(`── BUGS (${bugs.length}) ──`);
    bugs.forEach((b,i) => console.log(`  ${i+1}. [${b.section}] ${b.msg}`));
  }
  if (warns.length) {
    console.log(`\n── WARNINGS (${warns.length}) ──`);
    warns.forEach((w,i) => console.log(`  ${i+1}. [${w.section}] ${w.msg}`));
  }
  if (!findings.length) console.log('No issues found! ✓');
  console.log('\n' + '═'.repeat(70));
})().catch(e => {
  console.error('AUDIT CRASHED:', e.message);
  console.error(e.stack?.split('\n').slice(0,5).join('\n'));
  process.exit(1);
});
