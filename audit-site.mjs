// Comprehensive FincWin site audit using Playwright
import { chromium } from 'playwright';

const BASE = 'http://localhost:4141';
const PAUSE = ms => new Promise(r => setTimeout(r, ms));

const issues = [];
const notes = [];
function issue(section, msg, severity = 'BUG') {
  issues.push({ section, msg, severity });
  console.log(`[${severity}] [${section}] ${msg}`);
}
function note(section, msg) {
  notes.push({ section, msg });
  console.log(`[NOTE] [${section}] ${msg}`);
}

// Helper: click tab in the desktop tab-bar only
async function clickTab(page, arg) {
  // Target the .tab-bar buttons specifically
  const btn = page.locator(`.tab-bar button[data-arg="${arg}"]`);
  const count = await btn.count();
  if (count === 0) {
    issue('TabNav', `Tab button for "${arg}" not found in .tab-bar`, 'BUG');
    return false;
  }
  await btn.click();
  await PAUSE(500);
  return true;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true
  });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('JS ERROR: ' + err.message));

  // ── 1. Initial load ──────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await PAUSE(800);
  const title = await page.title();
  note('Load', `Page title: "${title}"`);

  // Check onboarding
  const onboardVisible = await page.isVisible('#onboardOverlay');
  if (onboardVisible) {
    note('Onboarding', 'Onboarding overlay visible — clicking demo data button');
    const demoBtn = page.locator('button[data-action="obLoadDemoAndClose"]');
    if (await demoBtn.isVisible()) {
      await demoBtn.click();
      await PAUSE(2000);
    } else {
      issue('Onboarding', 'Demo data button not found/visible', 'BUG');
    }
  } else {
    note('Onboarding', 'No onboarding overlay — demo data or existing state already loaded');
  }

  // ── 2. Demo Banner ───────────────────────────────────────────────────────────
  const demoBannerVisible = await page.isVisible('#demoBanner');
  note('DemoBanner', `Demo banner visible: ${demoBannerVisible}`);

  // ── 3. Dashboard values ───────────────────────────────────────────────────────
  const cashflow = await page.textContent('#d-cashflow');
  const income = await page.textContent('#d-income');
  const expenses = await page.textContent('#d-expenses');
  const healthScore = await page.textContent('#healthScore');
  const monthLabel = await page.textContent('#monthLabel');

  note('Dashboard', `Cashflow: ${cashflow} | Income: ${income} | Expenses: ${expenses}`);
  note('Dashboard', `Health score: ${healthScore} | Month: ${monthLabel}`);

  if (cashflow === '—' || cashflow === '') issue('Dashboard', 'Cashflow not rendering', 'BUG');
  if (healthScore === '—' || healthScore === '') issue('Dashboard', 'Health score not rendering', 'WARN');

  const kpiIds = ['d-income','d-expenses','d-pending','d-debt','d-savings','d-minpmts','d-networth'];
  for (const id of kpiIds) {
    const val = await page.textContent('#' + id);
    if (val === '—' || val === '') issue('Dashboard KPI', `KPI #${id} shows "${val}"`, 'WARN');
  }
  note('Dashboard', 'All KPIs checked');

  // ── 4. Month navigation ───────────────────────────────────────────────────────
  const prevBtn = page.locator('button[data-action="changeMonth"][data-arg="-1"]').first();
  const nextBtn = page.locator('button[data-action="changeMonth"][data-arg="1"]').first();

  await prevBtn.click();
  await PAUSE(300);
  const monthAfterPrev = await page.textContent('#monthLabel');
  if (monthAfterPrev === monthLabel) issue('MonthNav', 'Previous month button did not change month', 'BUG');
  else note('MonthNav', `Prev month → "${monthAfterPrev}" ✓`);

  await nextBtn.click();
  await PAUSE(300);
  const monthAfterNext = await page.textContent('#monthLabel');
  note('MonthNav', `Next month → "${monthAfterNext}" ✓`);

  // ── 5. Health badge → modal ───────────────────────────────────────────────────
  await page.click('.health-badge');
  await PAUSE(600);
  // Check multiple modal selectors
  const healthModalOpen = await page.evaluate(() => {
    const selectors = [
      '#healthModal', '.health-modal', '#healthPanel',
      '.modal-overlay[style*="flex"]', '.modal-overlay[style*="block"]',
      '.pmodal-wrap'
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el && el.offsetParent !== null) return s;
    }
    // Check all dialogs
    const dialogs = document.querySelectorAll('[role="dialog"]');
    for (const d of dialogs) {
      if (d.offsetParent !== null && d.id !== 'onboardOverlay' && d.id !== 'pinSetupModal') return d.id || 'dialog';
    }
    return null;
  });
  note('HealthModal', `Health modal opened: ${healthModalOpen}`);
  if (!healthModalOpen) issue('HealthModal', 'Health badge click did not open a modal/panel', 'BUG');
  await page.keyboard.press('Escape');
  await PAUSE(300);

  // ── 6. DTI Tooltip ────────────────────────────────────────────────────────────
  const dtiBtn = page.locator('#dtiInfoBtn');
  if (await dtiBtn.isVisible()) {
    await dtiBtn.click();
    await PAUSE(200);
    const tooltipVisible = await page.isVisible('#dtiTooltip');
    note('DTI', `DTI tooltip visible: ${tooltipVisible}`);
    if (!tooltipVisible) issue('DTI', 'DTI tooltip not showing after button click', 'BUG');
    // Toggle off
    await dtiBtn.click();
    await PAUSE(200);
    const tooltipHidden = await page.evaluate(() => {
      const el = document.getElementById('dtiTooltip');
      return el && (el.getAttribute('aria-hidden') === 'true' || el.style.display === 'none' || el.style.visibility === 'hidden');
    });
    note('DTI', `DTI tooltip hidden after second click: ${tooltipHidden}`);
  } else {
    issue('DTI', 'DTI info button not found', 'WARN');
  }

  // ── 7. Dark mode toggle ───────────────────────────────────────────────────────
  const darkBefore = await page.evaluate(() => ({
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
    dkAttr: document.documentElement.dataset.theme
  }));
  await page.locator('#dkBtn').click();
  await PAUSE(300);
  const darkAfter = await page.evaluate(() => ({
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
    dkAttr: document.documentElement.dataset.theme,
    localStorage: localStorage.getItem('fw_dark')
  }));
  note('DarkMode', `Before: html="${darkBefore.htmlClass}" body="${darkBefore.bodyClass}" theme="${darkBefore.dkAttr}"`);
  note('DarkMode', `After:  html="${darkAfter.htmlClass}" body="${darkAfter.bodyClass}" theme="${darkAfter.dkAttr}" ls="${darkAfter.localStorage}"`);
  const darkChanged = JSON.stringify(darkBefore) !== JSON.stringify(darkAfter);
  if (!darkChanged) {
    issue('DarkMode', 'Dark mode toggle had no visible effect on class/theme attrs', 'WARN');
  } else {
    note('DarkMode', 'Dark mode toggle changed state ✓');
  }
  // Toggle back
  await page.locator('#dkBtn').click();
  await PAUSE(300);

  // ── 8. Search ─────────────────────────────────────────────────────────────────
  await page.locator('#searchBtn').click();
  await PAUSE(400);
  const searchEl = await page.evaluate(() => {
    const candidates = ['#searchModal', '.search-panel', '#searchPanel', '.search-overlay', '#searchBar'];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return sel;
    }
    // Any element with 'search' in id that's visible
    const all = document.querySelectorAll('[id*="search"], [class*="search"]');
    for (const el of all) {
      if (el.offsetParent !== null && el.tagName !== 'BUTTON' && el.tagName !== 'SVG') return el.id || el.className;
    }
    return null;
  });
  note('Search', `Search panel found: ${searchEl}`);
  if (!searchEl) issue('Search', 'Search panel did not open after searchBtn click', 'BUG');
  // Type a query
  if (searchEl) {
    const searchInput = page.locator('input[placeholder*="earch"], input[type="search"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('rent');
      await PAUSE(300);
      note('Search', 'Typed "rent" in search');
      await searchInput.fill('');
    }
  }
  await page.keyboard.press('Escape');
  await PAUSE(300);

  // ── 9. Tab navigation ─────────────────────────────────────────────────────────
  const tabList = ['expenses','revenue','loans','savings','calendar','analytics','archive','settings'];
  for (const t of tabList) {
    const ok = await clickTab(page, t);
    if (!ok) continue;
    const active = await page.evaluate(id => {
      const el = document.getElementById('section-' + id);
      return el ? el.classList.contains('active') : false;
    }, t);
    if (!active) issue('TabNav', `Tab "${t}" → section-${t} not .active`, 'BUG');
    else note('TabNav', `Tab "${t}" ✓`);

    // Report any new console errors
    if (consoleErrors.length > 0) {
      const recent = consoleErrors.slice(-2).join(' | ');
      issue('TabNav', `JS errors on tab "${t}": ${recent}`, 'BUG');
    }
  }
  await clickTab(page, 'dashboard');

  // ── 10. Expenses tab — add item modal ─────────────────────────────────────────
  await clickTab(page, 'expenses');

  const addExpBtns = await page.locator('button[data-action="openItemModal"]').count();
  note('Expenses', `"Add Item" buttons in DOM: ${addExpBtns}`);

  // Find a visible add button
  const visibleAddBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[data-action="openItemModal"]'));
    const vis = btns.find(b => b.offsetParent !== null);
    return vis ? vis.dataset.arg || 'found' : null;
  });
  note('Expenses', `Visible "Add Item" button: ${visibleAddBtn}`);

  if (visibleAddBtn !== null) {
    const addBtn = page.locator('button[data-action="openItemModal"]').filter({ visible: true }).first();
    await addBtn.click();
    await PAUSE(400);
    const itemModalOpen = await page.evaluate(() => {
      const el = document.getElementById('itemModal');
      return el ? (el.offsetParent !== null) : false;
    });
    note('Expenses', `Item modal opened: ${itemModalOpen}`);
    if (!itemModalOpen) issue('Expenses', 'Add Expense modal did not open', 'BUG');

    if (itemModalOpen) {
      // Check fields
      const nameVisible = await page.isVisible('#iName');
      const amtVisible = await page.isVisible('#iAmount');
      note('Expenses', `Modal fields — name: ${nameVisible}, amount: ${amtVisible}`);
      if (!nameVisible) issue('Expenses', 'iName field missing in item modal', 'BUG');
      if (!amtVisible) issue('Expenses', 'iAmount field missing in item modal', 'BUG');

      // Fill and save
      await page.fill('#iName', 'Audit Test Item');
      await page.fill('#iAmount', '12.34');
      await PAUSE(200);

      const saveBtn = page.locator('button[data-action="saveItem"]').first();
      const saveBtnVisible = await saveBtn.isVisible().catch(() => false);
      note('Expenses', `Save button visible: ${saveBtnVisible}`);
      if (!saveBtnVisible) {
        // Try alternative save button
        const altSave = page.locator('#itemModal button[type="submit"], #itemModal .btn-p').first();
        if (await altSave.isVisible()) {
          await altSave.click();
        } else {
          issue('Expenses', 'No save button found in item modal', 'BUG');
          await page.keyboard.press('Escape');
        }
      } else {
        await saveBtn.click();
      }
      await PAUSE(500);

      const modalClosed = await page.evaluate(() => {
        const el = document.getElementById('itemModal');
        return !el || el.offsetParent === null;
      });
      note('Expenses', `Item modal closed after save: ${modalClosed}`);
      if (!modalClosed) {
        issue('Expenses', 'Item modal did not close after save', 'WARN');
        await page.keyboard.press('Escape');
        await PAUSE(300);
      }
    }
  } else {
    issue('Expenses', 'No visible "Add Item" button found in Expenses tab', 'BUG');
  }

  // Bulk Add button
  const bulkAddVisible = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(btn => btn.offsetParent !== null && (
      btn.dataset.action === 'openBulkAdd' ||
      btn.textContent.toLowerCase().includes('bulk') ||
      btn.textContent.toLowerCase().includes('import')
    ));
    return b ? b.dataset.action + ' | ' + b.textContent.trim().slice(0,30) : null;
  });
  note('Expenses', `Bulk/Import button: ${bulkAddVisible}`);

  // ── 11. Revenue tab — add revenue ─────────────────────────────────────────────
  await clickTab(page, 'revenue');

  const revAddBtnInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[data-action]'));
    const b = btns.find(btn => btn.offsetParent !== null && (
      btn.dataset.action.toLowerCase().includes('rev') ||
      btn.dataset.action.toLowerCase().includes('income') ||
      btn.dataset.action.toLowerCase().includes('add')
    ));
    return b ? { action: b.dataset.action, text: b.textContent.trim().slice(0,30) } : null;
  });
  note('Revenue', `Add/Revenue button: ${JSON.stringify(revAddBtnInfo)}`);

  if (revAddBtnInfo) {
    const revBtn = page.locator(`button[data-action="${revAddBtnInfo.action}"]`).filter({ visible: true }).first();
    await revBtn.click();
    await PAUSE(400);
    const revModalOpen = await page.evaluate(() => {
      const candidates = ['revModal','addRevModal','revenueModal','incomeModal'];
      for (const id of candidates) {
        const el = document.getElementById(id);
        if (el && el.offsetParent !== null) return id;
      }
      const overlays = document.querySelectorAll('.modal-overlay, .pmodal-wrap');
      for (const el of overlays) {
        if (el.offsetParent !== null && el.style.display !== 'none') return 'overlay';
      }
      return null;
    });
    note('Revenue', `Revenue modal: ${revModalOpen}`);
    if (!revModalOpen) issue('Revenue', 'Revenue add modal did not open', 'BUG');
    await page.keyboard.press('Escape');
    await PAUSE(300);
  } else {
    issue('Revenue', 'No visible add-revenue button found', 'WARN');
  }

  // ── 12. Loans tab ─────────────────────────────────────────────────────────────
  await clickTab(page, 'loans');

  const loanBtnInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[data-action]'));
    const b = btns.find(btn => btn.offsetParent !== null && (
      btn.dataset.action.toLowerCase().includes('loan') ||
      btn.dataset.action.toLowerCase().includes('debt')
    ));
    return b ? { action: b.dataset.action, text: b.textContent.trim().slice(0,30) } : null;
  });
  note('Loans', `Loan button: ${JSON.stringify(loanBtnInfo)}`);

  if (loanBtnInfo) {
    const lBtn = page.locator(`button[data-action="${loanBtnInfo.action}"]`).filter({ visible: true }).first();
    await lBtn.click();
    await PAUSE(400);
    const lModalOpen = await page.evaluate(() => {
      const candidates = ['loanModal','addLoanModal'];
      for (const id of candidates) {
        const el = document.getElementById(id);
        if (el && el.offsetParent !== null) return id;
      }
      return null;
    });
    note('Loans', `Loan modal: ${lModalOpen}`);
    if (!lModalOpen) issue('Loans', 'Loan modal did not open', 'BUG');
    await page.keyboard.press('Escape');
    await PAUSE(300);
  }

  // ── 13. Savings tab ───────────────────────────────────────────────────────────
  await clickTab(page, 'savings');

  const savBtnInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[data-action]'));
    const b = btns.find(btn => btn.offsetParent !== null && (
      btn.dataset.action.toLowerCase().includes('sav') ||
      btn.dataset.action.toLowerCase().includes('goal') ||
      btn.dataset.action.toLowerCase().includes('invest')
    ));
    return b ? { action: b.dataset.action, text: b.textContent.trim().slice(0,30) } : null;
  });
  note('Savings', `Savings button: ${JSON.stringify(savBtnInfo)}`);

  if (savBtnInfo) {
    const sBtn = page.locator(`button[data-action="${savBtnInfo.action}"]`).filter({ visible: true }).first();
    await sBtn.click();
    await PAUSE(400);
    const sModalOpen = await page.evaluate(() => {
      const candidates = ['savModal','savingsModal','goalModal','investModal'];
      for (const id of candidates) {
        const el = document.getElementById(id);
        if (el && el.offsetParent !== null) return id;
      }
      // Generic check
      const overlays = document.querySelectorAll('.modal-overlay, .pmodal-wrap, [role="dialog"]');
      for (const el of overlays) {
        if (el.offsetParent !== null && el.id !== 'onboardOverlay') return el.id || 'dialog';
      }
      return null;
    });
    note('Savings', `Savings modal: ${sModalOpen}`);
    if (!sModalOpen) issue('Savings', 'Savings modal did not open', 'BUG');
    await page.keyboard.press('Escape');
    await PAUSE(300);
  }

  // ── 14. Calendar ──────────────────────────────────────────────────────────────
  await clickTab(page, 'calendar');
  await PAUSE(400);
  const calRows = await page.locator('#section-calendar .cal-row, #section-calendar .cal-day, #section-calendar td, #calGrid').count();
  note('Calendar', `Calendar rows/cells found: ${calRows}`);
  if (calRows === 0) issue('Calendar', 'Calendar appears empty — no grid cells found', 'WARN');

  // ── 15. Analytics ─────────────────────────────────────────────────────────────
  await clickTab(page, 'analytics');
  await PAUSE(800);
  const canvasCount = await page.locator('#section-analytics canvas').count();
  note('Analytics', `Charts (canvas) in analytics: ${canvasCount}`);
  if (canvasCount === 0) issue('Analytics', 'No chart canvas elements in analytics', 'WARN');

  // ── 16. Archive ───────────────────────────────────────────────────────────────
  await clickTab(page, 'archive');
  await PAUSE(400);
  const archiveContent = await page.evaluate(() => {
    const s = document.getElementById('section-archive');
    return s ? s.innerText.trim().slice(0, 100) : 'not found';
  });
  note('Archive', `Archive content preview: "${archiveContent}"`);

  // ── 17. Settings tab ──────────────────────────────────────────────────────────
  await clickTab(page, 'settings');
  await PAUSE(500);

  // Find key settings controls
  const settingsButtons = await page.evaluate(() => {
    const section = document.getElementById('section-settings');
    if (!section) return [];
    const btns = Array.from(section.querySelectorAll('button[data-action]'));
    return btns
      .filter(b => b.offsetParent !== null)
      .map(b => ({ action: b.dataset.action, text: b.textContent.trim().slice(0,30) }))
      .slice(0, 30);
  });
  note('Settings', `Visible action buttons: ${settingsButtons.length}`);
  settingsButtons.forEach(b => note('Settings', `  → ${b.action}: "${b.text}"`));

  // Test export button
  const exportBtnAction = settingsButtons.find(b => b.action.toLowerCase().includes('export'));
  if (exportBtnAction) {
    note('Settings', `Export button: ${exportBtnAction.action}`);
  } else {
    issue('Settings', 'No export button found in Settings', 'WARN');
  }

  // Test import button
  const importBtnAction = settingsButtons.find(b => b.action.toLowerCase().includes('import'));
  if (importBtnAction) {
    note('Settings', `Import button: ${importBtnAction.action}`);
  } else {
    issue('Settings', 'No import button found in Settings', 'WARN');
  }

  // ── 18. PIN Setup Modal ───────────────────────────────────────────────────────
  await clickTab(page, 'dashboard');
  await PAUSE(300);

  const pinBtn = page.locator('#pinBtn');
  if (await pinBtn.isVisible()) {
    await pinBtn.click();
    await PAUSE(500);
    const pinModalOpen = await page.evaluate(() => {
      const el = document.getElementById('pinSetupModal');
      if (!el) return 'not found';
      const style = getComputedStyle(el);
      return style.display !== 'none' ? style.display : 'hidden';
    });
    note('PINModal', `PIN modal state: ${pinModalOpen}`);
    if (pinModalOpen === 'hidden' || pinModalOpen === 'not found' || pinModalOpen === 'none') {
      issue('PINModal', 'PIN setup modal did not open', 'BUG');
    } else {
      note('PINModal', `PIN modal opened (display: ${pinModalOpen}) ✓`);
      // Test close button
      const closePinBtn = page.locator('#pinSetupModal button[data-action="closePinSetup"]').first();
      if (await closePinBtn.isVisible()) {
        await closePinBtn.click();
        await PAUSE(300);
        const pinClosed = await page.evaluate(() => {
          const el = document.getElementById('pinSetupModal');
          return el ? getComputedStyle(el).display === 'none' : true;
        });
        note('PINModal', `PIN modal closed: ${pinClosed}`);
        if (!pinClosed) issue('PINModal', 'Close button did not close PIN modal', 'BUG');
      } else {
        issue('PINModal', 'Close button not visible in PIN modal', 'WARN');
        await page.keyboard.press('Escape');
        await PAUSE(300);
      }
    }
  } else {
    issue('PINModal', '#pinBtn not visible', 'WARN');
  }

  // ── 19. Notifications ─────────────────────────────────────────────────────────
  const notifBtnEl = page.locator('#notifBtn');
  if (await notifBtnEl.isVisible()) {
    await notifBtnEl.click();
    await PAUSE(500);
    const notifState = await page.evaluate(() => {
      const ids = ['notifPanel','billReminders','notifSheet','remindersPanel'];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetParent !== null) return id;
      }
      const elems = document.querySelectorAll('.notif-panel, .reminders-panel, [id*="notif"], [id*="remind"]');
      for (const el of elems) {
        if (el.offsetParent !== null) return el.id || el.className;
      }
      return null;
    });
    note('Notifications', `Notif panel: ${notifState}`);
    if (!notifState) issue('Notifications', 'Notification panel did not open', 'WARN');
    await page.keyboard.press('Escape');
    await PAUSE(300);
  }

  // ── 20. Logo → dashboard ──────────────────────────────────────────────────────
  await clickTab(page, 'settings');
  await PAUSE(200);
  const logoBtn = page.locator('button.logo');
  if (await logoBtn.isVisible()) {
    await logoBtn.click();
    await PAUSE(300);
    const dashNowActive = await page.evaluate(() => {
      const el = document.getElementById('section-dashboard');
      return el && el.classList.contains('active');
    });
    note('Logo', `Logo → dashboard: ${dashNowActive}`);
    if (!dashNowActive) issue('Logo', 'Logo button did not navigate to dashboard', 'BUG');
  } else {
    issue('Logo', 'Logo button not visible', 'WARN');
  }

  // ── 21. AI Coach link in mobile menu (known issue check) ──────────────────────
  const aiCoachArg = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const ai = btns.find(b => b.textContent.trim() === 'AI Coach');
    return ai ? ai.dataset.arg : null;
  });
  note('MobileMenu', `AI Coach button data-arg: "${aiCoachArg}"`);
  if (aiCoachArg === 'analytics') {
    issue('MobileMenu', 'AI Coach menu button has data-arg="analytics" — should be "ai" or the correct tab', 'WARN');
  }

  // ── 22. Mobile viewport tests ─────────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  await PAUSE(400);

  // Mobile bottom nav
  const mbnVisible = await page.isVisible('#mobileBottomNav');
  note('MobileNav', `Mobile bottom nav visible at 390px: ${mbnVisible}`);

  const mbnTabs = ['dashboard','expenses','revenue','loans','savings'];
  for (const t of mbnTabs) {
    const mbnBtn = page.locator(`#mbn-${t}`);
    if (await mbnBtn.isVisible()) {
      await mbnBtn.click();
      await PAUSE(300);
      const active = await page.evaluate(id => {
        const el = document.getElementById('section-' + id);
        return el ? el.classList.contains('active') : false;
      }, t);
      if (!active) issue('MobileNav', `MBN tab "${t}" did not activate section`, 'BUG');
      else note('MobileNav', `MBN "${t}" ✓`);
    }
  }

  // Mobile menu open/close
  const mmBtn = page.locator('button[data-action="toggleMobileMenu"]').filter({ visible: true }).first();
  if (await mmBtn.count() > 0) {
    await mmBtn.click();
    await PAUSE(400);
    const mmOpen = await page.evaluate(() => {
      const el = document.getElementById('mobileMenuSheet');
      return el && el.style.display !== 'none' && el.style.display !== '';
    });
    note('MobileMenu', `Mobile menu opened: ${mmOpen}`);
    if (!mmOpen) issue('MobileMenu', 'Mobile menu sheet did not open', 'BUG');

    if (mmOpen) {
      const closeBtn = page.locator('#mobileMenuSheet button').filter({ visible: true }).first();
      await closeBtn.click();
      await PAUSE(300);
      const mmClosed = await page.evaluate(() => {
        const el = document.getElementById('mobileMenuSheet');
        return !el || el.style.display === 'none';
      });
      note('MobileMenu', `Mobile menu closed: ${mmClosed}`);
      if (!mmClosed) issue('MobileMenu', 'Mobile menu did not close after close button', 'BUG');
    }
  }

  // Back to desktop
  await page.setViewportSize({ width: 1280, height: 800 });
  await PAUSE(300);

  // ── 23. Layout / positioning checks ──────────────────────────────────────────
  await clickTab(page, 'dashboard');
  await PAUSE(400);

  const layoutIssues = await page.evaluate(() => {
    const problems = [];
    // Check topbar
    const tb = document.querySelector('.topbar');
    if (tb) {
      const r = tb.getBoundingClientRect();
      if (r.top < 0) problems.push('Topbar clipped above viewport top');
      if (r.bottom > window.innerHeight) problems.push('Topbar extends below viewport');
    }
    // Check any element with data-action that's not in a section
    const sections = Array.from(document.querySelectorAll('.section'));
    sections.forEach(s => {
      const sr = s.getBoundingClientRect();
      if (s.classList.contains('active') && sr.right > window.innerWidth + 10) {
        problems.push(`Section ${s.id} overflows right by ${Math.round(sr.right - window.innerWidth)}px`);
      }
    });
    // Check for z-index stacking issues — any modal-overlay visible without being opened
    const overlays = document.querySelectorAll('.modal-overlay');
    overlays.forEach(o => {
      if (o.offsetParent !== null && o.id !== 'pinSetupModal') {
        problems.push(`Modal overlay "${o.id}" appears visible without being opened`);
      }
    });
    return problems;
  });
  if (layoutIssues.length > 0) {
    layoutIssues.forEach(p => issue('Layout', p, 'WARN'));
  } else {
    note('Layout', 'No layout/overflow issues detected ✓');
  }

  // ── 24. Aria / Accessibility basics ───────────────────────────────────────────
  const a11yIssues = await page.evaluate(() => {
    const problems = [];
    // Buttons without accessible names
    const btns = Array.from(document.querySelectorAll('button'));
    btns.filter(b => b.offsetParent !== null).forEach(b => {
      const text = (b.textContent || '').trim();
      const label = b.getAttribute('aria-label') || b.getAttribute('title');
      if (!text && !label) problems.push(`Button with data-action="${b.dataset.action}" has no accessible name`);
    });
    // Inputs without labels
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"])'));
    inputs.filter(i => i.offsetParent !== null).forEach(inp => {
      const id = inp.id;
      const label = id ? document.querySelector(`label[for="${id}"]`) : null;
      const aria = inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby') || inp.placeholder;
      if (!label && !aria) problems.push(`Input#${id || 'unnamed'} has no label/aria-label/placeholder`);
    });
    return problems.slice(0, 20); // cap at 20
  });
  if (a11yIssues.length > 0) {
    a11yIssues.forEach(p => issue('A11y', p, 'WARN'));
  } else {
    note('A11y', 'No obvious accessibility issues detected ✓');
  }

  // ── 25. Keyboard shortcut — "/" opens search ──────────────────────────────────
  await page.keyboard.press('/');
  await PAUSE(400);
  const searchOpenedByKey = await page.evaluate(() => {
    const candidates = ['#searchModal', '.search-panel', '#searchPanel', '.search-overlay', '#searchBar'];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return true;
    }
    return false;
  });
  note('Keyboard', `"/" shortcut opens search: ${searchOpenedByKey}`);
  if (!searchOpenedByKey) issue('Keyboard', '"/" shortcut did not open search', 'WARN');
  await page.keyboard.press('Escape');
  await PAUSE(300);

  // ── 26. Console errors summary ────────────────────────────────────────────────
  note('Console', `Total JS console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    const unique = [...new Set(consoleErrors)];
    unique.forEach((e, i) => {
      issue('Console', `Error ${i+1}: ${e.slice(0, 200)}`, 'BUG');
    });
  }

  // ── 27. Check for broken images ───────────────────────────────────────────────
  const brokenImages = await page.evaluate(() => {
    return Array.from(document.images)
      .filter(img => !img.complete || img.naturalWidth === 0)
      .map(img => img.src);
  });
  if (brokenImages.length > 0) {
    brokenImages.forEach(src => issue('Images', `Broken image: ${src}`, 'WARN'));
  } else {
    note('Images', 'No broken images ✓');
  }

  await browser.close();

  // ── FINAL REPORT ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('FINCWIN SITE AUDIT — FINAL REPORT');
  console.log('═'.repeat(70));
  const bugs = issues.filter(i => i.severity === 'BUG');
  const warns = issues.filter(i => i.severity === 'WARN');
  console.log(`\nTotal issues: ${issues.length}  |  Bugs: ${bugs.length}  |  Warnings: ${warns.length}\n`);

  if (bugs.length > 0) {
    console.log('── BUGS (' + bugs.length + ') ──');
    bugs.forEach((b, i) => console.log(`  ${i+1}. [${b.section}] ${b.msg}`));
  }
  if (warns.length > 0) {
    console.log('\n── WARNINGS (' + warns.length + ') ──');
    warns.forEach((w, i) => console.log(`  ${i+1}. [${w.section}] ${w.msg}`));
  }
  if (issues.length === 0) {
    console.log('No issues found ✓');
  }
  console.log('\n' + '═'.repeat(70));
})().catch(err => {
  console.error('AUDIT SCRIPT CRASHED:', err.message);
  process.exit(1);
});
