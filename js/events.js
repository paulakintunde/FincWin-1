// js/events.js — Centralised event delegation
// Replaces all inline onclick/onchange/oninput/onkeydown handlers in index.html.
// Add data-* attributes to elements; this file dispatches to the right function.

// ════════════════════════════════════════════════
// WRAPPER FUNCTIONS — multi-call & special cases
// ════════════════════════════════════════════════
function noop(){} // used with data-stop-prop to absorb clicks without triggering a parent data-action

// Mobile action-sheet wrappers
function notifAndCloseMenu(){toggleNotifications();toggleMobileMenu();}
function currencyAndCloseMenu(){openCurrencyModal();toggleMobileMenu();}
function compareAndCloseMenu(){openCompareModal();toggleMobileMenu();}
function exportAndCloseMenu(){exportData();toggleMobileMenu();}
function importAndCloseMenu(){openImport();toggleMobileMenu();}
function printAndCloseMenu(){window.print();toggleMobileMenu();}
function settingsAndCloseMenu(){var s=document.getElementById('mobileMenuSheet');if(s){s.style.display='none';s.setAttribute('aria-hidden','true');document.body.style.overflow='';}if(typeof releaseTrap==='function')releaseTrap(s);switchTab('settings',document.getElementById('tab-settings'));}

// Settings modal wrappers
function exportFromSettings(){exportData();closeSettings();}
function exportCSVFromSettings(){exportCSV();closeSettings();}
function importFromSettings(){openImport();closeSettings();}
function currencyFromSettings(){openCurrencyModal();closeSettings();}
function compareFromSettings(){openCompareModal();closeSettings();}
function bankImportFromSettings(){if(typeof openBankImport==='function')openBankImport();closeSettings();}
function resetExpensesFromSettings(){closeSettings();openResetModal('expenses');}
function resetRevenueFromSettings(){closeSettings();openResetModal('revenue');}
function resetLoansFromSettings(){closeSettings();openResetModal('loans');}
function resetSavingsFromSettings(){closeSettings();openResetModal('savings');}

// Banner / confirm panel helpers
function dismissDemoBanner(){var b=document.getElementById('demoBanner');if(b)b.style.display='none';}
function hideclaudeRemoveConfirm(){var el=document.getElementById('claudeRemoveConfirm');if(el)el.style.display='none';}

// coachAsk, coachClear, coachRunMode are defined in settings.js — delegation calls them directly

// Bank import wrappers
// handleBankFileFromEl is defined in import-bank.js — delegation calls it directly
function bankImportAndCloseMenu(){if(typeof openBankImport==='function')openBankImport();if(typeof toggleMobileMenu==='function')toggleMobileMenu();}
function _closeMobileSheet(){var s=document.getElementById('mobileMenuSheet');if(s){s.style.display='none';s.setAttribute('aria-hidden','true');document.body.style.overflow='';if(typeof releaseTrap==='function')releaseTrap(s);}}
function switchTabAndCloseMenu(arg){_closeMobileSheet();switchTab(arg,document.getElementById('tab-'+arg));}
function searchAndCloseMenu(){_closeMobileSheet();openSearch();}
function toggleDarkAndCloseMenu(){toggleDark();_closeMobileSheet();}
function pinAndCloseMenu(){_closeMobileSheet();openPinSetup();}
function healthAndCloseMenu(){_closeMobileSheet();openHealthModal();}

// Keyboard shortcuts modal
function openShortcutsModal(){var m=document.getElementById('shortcutsModal');if(!m)return;m.classList.add('open');if(typeof trapFocus==='function')trapFocus(m);}
function closeShortcutsModal(){var m=document.getElementById('shortcutsModal');if(!m)return;if(typeof releaseTrap==='function')releaseTrap(m);m.classList.remove('open');}

// Switch-to-specific-tab wrappers
function switchToExpensesTab(){switchTab('expenses',document.getElementById('tab-expenses'));}


// Design system wrapper — called from theme card Light/Dark buttons
// data-design holds the design id; data-dark holds "true"/"false"
function activateThemeFromBtn(el){
  if(typeof activateTheme==='function'){
    activateTheme(el.dataset.design||'', el.dataset.dark||'false');
  }
}

// File input wrappers (file inputs can't use value delegation)
function handleItemReceiptFromEl(){var f=document.getElementById('iReceiptInput');if(f&&f.files&&f.files[0])handleItemReceipt(f.files[0]);}
function handleReceiptFileFromEl(){var f=document.getElementById('receiptFileInput');if(f&&f.files&&f.files[0])handleReceiptFile(f.files[0]);}
function obHandleReceiptFileFromEl(){var f=document.getElementById('obExpReceipt');if(f)obHandleReceiptFile(f);}

// Savings transaction wrappers (string arg + numeric arg)
function openTxnDeposit(i){if(typeof openTxn==='function')openTxn('deposit',i);}
function openTxnWithdraw(i){if(typeof openTxn==='function')openTxn('withdraw',i);}

// AI provider wrappers (string arg variants)
function aiRemoveKeyClaude(){if(typeof aiRemoveKey==='function')aiRemoveKey('claude');}
function aiRemoveKeyOpenai(){if(typeof aiRemoveKey==='function')aiRemoveKey('openai');}
function openAISetupClaude(){if(typeof openAISetup==='function')openAISetup('claude');}
function openAISetupOpenai(){if(typeof openAISetup==='function')openAISetup('openai');}
function openClaudeManageFromLink(){if(typeof openClaudeManage==='function')openClaudeManage();}

// ════════════════════════════════════════════════
// ACTION ALLOWLIST — audit C-03
// Only functions named here may be called via data-action / data-self-close.
// This prevents an XSS payload from using the delegation layer to invoke
// arbitrary window-level functions (resetAllData, doImport, etc.).
// ════════════════════════════════════════════════
var _ACTION_ALLOWLIST = new Set([
  'noop',
  // Tab & navigation
  'switchTab','switchToMonth','switchToExpensesTab','switchTabAndCloseMenu',
  'searchAndCloseMenu','toggleDarkAndCloseMenu','pinAndCloseMenu','healthAndCloseMenu',
  // Month management
  'changeMonth','confirmArchiveMonth','confirmDeleteMonth','closeDeleteMonthModal',
  'executeDeleteMonth','openNewMonthModal','closeNewMonthModal','createNewMonth',
  'promptArchiveCurrentMonth','openCloneModal','closeCloneModal','executeClone',
  // Expenses / items
  'openItemModal','saveItemModal','closeItemModal',
  'deleteItem','delExpItem','deleteItemFromModal',
  'togglePaid','toggleExp',
  'toggleItemCurrencyRow','clearItemDueDay','hideItemDeleteConfirm','renderCatPillsAll',
  'confirmDeleteItem','recurringAutoFill','openBulkBudgetModal','closeBulkBudgetModal',
  'saveBulkBudgets','catMgrAddRow','toggleEnvExpand','openEnvelopeDetail','closeEnvelopeDetail',
  'drillDownCategory','openEnvModal','closeEnvModal','saveEnvCap',
  'toggleWeekCollapse','setTagFilter','openDueDateModal','toggleExpHeatmap',
  'openNoteModal','openReceiptModal','closeReceiptModal','clearReceipt','editAmt','bulkMarkPaid','toggleAllWeekPaid',
  'delExpConfirm','delExpCancel',
  'enterBulkMode','exitBulkMode',
  'bulkSelectWeek',
  'bulkMarkAllPaid','bulkMarkAllUnpaid','bulkDeleteSelected',
  'openQuickAdd','closeQuickAdd','quickAddSave','selectQaCat',
  'openRestoreModal',
  'selectCat','pickDueDay','delCustomCat',
  'addSuggestedScheduled',
  // Revenue
  'openRevModal','saveRevModal','closeRevModal','deleteRevItem','delRevItem',
  'toggleRevReceived','toggleRev',
  'setRevWin','editRevCell',
  'showRevDeleteConfirm','hideRevDeleteConfirm','confirmDeleteRev',
  'setRevStatus','toggleRevCurrencyRow',
  // Loans
  'openLoanModal','saveLoanModal','closeLoanModal','confirmDeleteLoan','doDeleteLoan',
  'showLoanDeleteConfirm','hideLoanDeleteConfirm',
  'toggleLoanActive','openLoanTxnModal','saveLoanTxn','closeLoanTxnModal',
  'toggleLP','startEditBal','addLP','useInCalc','generatePaySchedule','setStrategy','toggleLoanHistory',
  // Savings
  'openTxnDeposit','openTxnWithdraw','confirmTxn','closeTxnModal',
  'openSavModal','closeSavModal','saveSavGoal','openDelSav','closeDelSav','confirmDelSav','deleteSavTxn',
  'openGoalModal','closeGoalModal','saveGoal','deleteGoal','deleteScheduledRule','toggleScheduledPanel',
  // Investments
  'openInvModal','closeInvModal','saveInvModal','deleteInvestment','invTypeChange',
  // AI Coach panel
  'toggleCoachPanel','switchToCoachTab',
  // Sync & cloud
  'generateSyncQR','consumeSyncToken','enableCloudSync','disableCloudSync',
  'confirmSyncPassphrase','cancelSyncPassphrase','switchBackend','doFullCloudPull',
  'toggleSyncPassphraseVis','switchToFirebase',
  'conflictPickLocal','conflictPickCloud',
  'linkLocalFileFromSettings','unlinkLocalFileFromSettings',
  'openCloudSyncSetupFromSettings','openCloudSyncManageFromSettings',
  'closeCloudSyncSetup','closeCloudSyncManage','confirmCloudSyncSetup',
  'toggleCloudPassphraseVis','generateSyncQRFromSettings','disableCloudSyncFromSettings',
  'connectGoogleDriveFromSettings','disconnectDriveFromSettings','switchToDrive',
  'closeDriveConnectModal','confirmDriveConnect',
  // Import / export
  'openImport','closeImport','doImport','importFromSettings',
  'bankSetFilter',
  'exportData','exportCSV','exportFromSettings','exportCSVFromSettings','exportTaxCSV',
  'openBankImport','closeBankImport','handleBankFileFromEl','bankImportFromSettings',
  'bankImportAndCloseMenu','bankToggleTxn','bankEditName','bankEditCat',
  'bankEditType','bankEditWeek','executeBankImport','bankResetUpload','bankSelectAll','bankDeselectAll',
  'bulkAddRemoveExpense','bulkAddRemoveSaving','bulkAddRemoveLoan',
  // Settings & modals
  'openSettings','closeSettings','saveSettings','openCurrencyModal','closeCurrencyModal',
  'saveCurrency','currencyFromSettings','currencyAndCloseMenu',
  'openCompareModal','closeCompareModal','compareFromSettings','compareAndCloseMenu',
  'openResetModal','closeResetModal','executeReset',
  'openResetConfirm','closeFullResetConfirm','executeFullReset','confirmDemoReset',
  'resetExpensesFromSettings','resetRevenueFromSettings',
  'resetLoansFromSettings','resetSavingsFromSettings',
  // Demo profiles
  'loadSelectedDemoProfile','clearDemoData',
  'showOnboardingFromSettings','showOnboarding',
  'openHealthModal','closeHealthModal',
  'openSearch','closeSearch','doSearch','openShortcutsModal','closeShortcutsModal',
  'setItemStatus','setRevStatus','setPinLen',
  'toggleTaxFilter','replayTour','saveUserNamePage',
  'openCatManager','closeCatManager','addCustomCategory','saveEditCustomCat','loadCatForEdit','updateEditCatPreview',
  // Notifications
  'toggleNotifications','notifAndCloseMenu','markNotifRead','clearAllNotifs',
  // PIN / lock
  'openPinSetup','closePinSetup','savePinSetup','setupKeyPress',
  'lockKeyPress','lockEnter','lockDelete','lockClear','pinAndCloseMenu',
  'showRecoveryPanel','verifyRecovery','removePin',
  'submitPinSetupPassphrase','cancelPinPassphrase',
  // Dark mode & themes
  'toggleDark','activateThemeFromBtn','activateTheme','setTheme',
  // AI coach
  'coachAsk','coachClear','coachRunMode','coachRunAnomaly','runAiInsights',
  'openAISetupClaude','openAISetupOpenai','openClaudeSetup','openAISetup',
  'closeClaudeSetup','connectAI','connectClaude',
  'openClaudeManage','closeClaudeManage','openClaudeManageFromLink',
  'claudeConfirmRemove','claudeRemoveKey',
  'aiRemoveKeyClaude','aiRemoveKeyOpenai',
  'claudeUpdateKey','openaiUpdateKey',
  'switchSetupTab','toggleClaudeKeyVis','toggleOpenAIKeyVis',
  // Gamification
  'openXpModal','closeXpModal','showHmPop',
  // Calendar
  'openCalendar','closeCalendar','calDayClick',
  // Analytics & dashboard
  'openScorecardModal','closeScorecardModal','dismissDashAlerts','toggleDtiTooltip','askAIAboutDTI',
  // Onboarding
  'obGoTo','obFinish','obSkip','obLoadDemoAndClose','obHandleReceiptFileFromEl',
  'obAdvanceStep1','obAdvanceStep2','obSelectStorage','obSaveIncome',
  'obSubmitPassphrase',
  'obAddIncome','obRemoveIncome',
  'obAddExpense','obRemoveExpense',
  'obAddLoan','obRemoveLoan',
  'obAddSaving','obRemoveSaving',
  'obPinKey',
  // Receipts
  'handleItemReceiptFromEl','handleReceiptFileFromEl','removeReceipt',
  // Mobile menu
  'toggleMobileMenu','notifAndCloseMenu','exportAndCloseMenu','importAndCloseMenu',
  'printAndCloseMenu','settingsAndCloseMenu',
  // Misc UI helpers
  'dismissDemoBanner','hideclaudeRemoveConfirm','closeConflictModal',
  'keepLocalData','useCloudData','closePwaPrompt','installPwa',
  // Archive
  'openArchiveModal','closeArchiveModal','openRestoreModal','closeRestoreModal',
  'restoreArchivedMonth','executeRestore','toggleArchiveGroup',
  // Bulk-add
  'openBulkAdd','closeBulkAdd','bulkAddSubmit',
  'bulkAddTab',
  'bulkAddAddExpense','bulkAddAddSaving','bulkAddAddLoan',
  // Search
  'searchNavToExpenseFromEl','searchNavToIncomeFromEl','searchGoToTab',
  // PWA install
  'pwaInstallFromSettings',
]);

// DTI tooltip toggle (E4)
function toggleDtiTooltip(){
  var t=document.getElementById('dtiTooltip');
  var btn=document.getElementById('dtiInfoBtn');
  if(!t)return;
  var hidden=t.getAttribute('aria-hidden')!=='false';
  t.setAttribute('aria-hidden',hidden?'false':'true');
  t.style.display=hidden?'block':'none';
  if(btn)btn.setAttribute('aria-expanded',hidden?'true':'false');
}

function askAIAboutDTI(){
  var t=document.getElementById('dtiTooltip');
  if(t){t.setAttribute('aria-hidden','true');t.style.display='none';}
  var btn=document.getElementById('dtiInfoBtn');
  if(btn)btn.setAttribute('aria-expanded','false');
  switchTab('analytics',document.getElementById('tab-analytics'));
  setTimeout(function(){
    var coachSection=document.getElementById('coachSection');
    if(coachSection)coachSection.scrollIntoView({behavior:'smooth',block:'start'});
    var debtBtn=document.getElementById('coachBtn-debt');
    if(debtBtn)debtBtn.click();
  },300);
}

// ════════════════════════════════════════════════
// CLICK DELEGATION
// ════════════════════════════════════════════════
document.addEventListener('click',function(e){
  // DTI tooltip — close on outside click
  var dtiTip=document.getElementById('dtiTooltip');
  if(dtiTip&&dtiTip.getAttribute('aria-hidden')==='false'){
    if(!e.target.closest('#dtiTooltip')&&!e.target.closest('#dtiInfoBtn')){
      dtiTip.setAttribute('aria-hidden','true');
      dtiTip.style.display='none';
      var dtiBtn=document.getElementById('dtiInfoBtn');
      if(dtiBtn)dtiBtn.setAttribute('aria-expanded','false');
    }
  }

  // 1. Modal overlay backdrop click — data-self-close="fnName"
  var overlay=e.target.closest('[data-self-close]');
  if(overlay&&e.target===overlay){
    var scFn=overlay.dataset.selfClose;
    if(_ACTION_ALLOWLIST.has(scFn)&&typeof window[scFn]==='function')window[scFn]();
    return;
  }

  // 2. Action buttons — data-action="fnName"
  //    [data-arg="..."]          first argument (auto-coerced to number when numeric)
  //    [data-arg2="..."]         second argument (auto-coerced)
  //    [data-arg-self]           passes the element as the LAST positional argument
  //    [data-arg-from="attr"]    read first arg from another data attribute on the element
  //    [data-stop-prop]          call e.stopPropagation() before dispatching
  var el=e.target.closest('[data-action]');
  if(!el)return;

  if(el.dataset.stopProp!==undefined) e.stopPropagation();

  var fn=el.dataset.action;
  var fn2=el.dataset.action2;

  if(_ACTION_ALLOWLIST.has(fn)&&typeof window[fn]==='function'){
    var rawArg=el.dataset.arg;
    var rawArg2=el.dataset.arg2;
    var argFrom=el.dataset.argFrom;
    var argSelf=el.dataset.argSelf;
    var finalArg,finalArg2;

    if(argFrom!==undefined){
      finalArg=el.dataset[argFrom];
    } else if(rawArg!==undefined){
      finalArg=(rawArg.trim()!==''&&!isNaN(rawArg))?Number(rawArg):rawArg;
    }

    if(rawArg2!==undefined){
      finalArg2=(rawArg2.trim()!==''&&!isNaN(rawArg2))?Number(rawArg2):rawArg2;
    }

    if(argSelf!==undefined){
      // element is appended as the last argument after any data-arg / data-arg2
      if(finalArg!==undefined&&finalArg2!==undefined) window[fn](finalArg,finalArg2,el);
      else if(finalArg!==undefined) window[fn](finalArg,el);
      else window[fn](el);
    } else {
      if(finalArg!==undefined&&finalArg2!==undefined) window[fn](finalArg,finalArg2);
      else if(finalArg!==undefined) window[fn](finalArg);
      else window[fn]();
    }
  }

  // Optional second action — data-action2="fnName" (no extra args, used for side-effects)
  if(fn2&&_ACTION_ALLOWLIST.has(fn2)&&typeof window[fn2]==='function') window[fn2]();
});

// ════════════════════════════════════════════════
// CHANGE DELEGATION
// data-change="fnName"
//   [data-change-val]      — pass el.value as first argument
//   [data-change-self]     — pass el (the element itself) as first argument
// ════════════════════════════════════════════════
var _CHANGE_ALLOWLIST = new Set([
  'previewDemoProfile',
  'invTypeChange',
  'obUpdateAmtPrefix','obFreqChange','obHandleReceiptFileFromEl',
  'calcFromLoan','runCalc',
  'updateArchiveThreshold',
  'itemFreqChange',
  'handleItemReceiptFromEl','handleReceiptFileFromEl',
  'renderComparison',
  'updateCatPreview','updateEditCatPreview','loadCatForEdit',
  'handleBankFileFromEl',
  'updateCurrencyPreview',
  'setAIProvider',
  'toggleRolloverFromEl',
  'bulkToggleCbFromEl'
]);

document.addEventListener('change',function(e){
  var el=e.target.closest('[data-change]');
  if(!el)return;
  var fn=el.dataset.change;
  if(!_CHANGE_ALLOWLIST.has(fn)||typeof window[fn]!=='function')return;
  if(el.dataset.changeVal!==undefined) window[fn](el.value);
  else if(el.dataset.changeSelf!==undefined) window[fn](el);
  else window[fn]();
});

// ════════════════════════════════════════════════
// INPUT DELEGATION
// data-input="fnName"
//   [data-input-val]       — pass el.value as first argument
//   [data-input-arg="x"]   — pass fixed string "x" as first argument
// ════════════════════════════════════════════════
var _INPUT_ALLOWLIST = new Set([
  'obDueDayChange',
  'updateBonus',
  'runCalc',
  'itemNameAutoTag',
  'updateCurrencyPreview',
  'checkResetConfirm',
  'checkResetWord',
  'performSearch',
  'qaNameAutoTag'
]);

document.addEventListener('input',function(e){
  var el=e.target.closest('[data-input]');
  if(!el)return;
  var fn=el.dataset.input;
  if(!_INPUT_ALLOWLIST.has(fn)||typeof window[fn]!=='function')return;
  if(el.dataset.inputVal!==undefined) window[fn](el.value);
  else if(el.dataset.inputArg!==undefined) window[fn](el.dataset.inputArg);
  else window[fn]();
});

// ════════════════════════════════════════════════
// DRAG EVENT DELEGATION
// Expense rows carry data-wi and data-ii; handlers
// read those instead of receiving args via inline attrs.
// ════════════════════════════════════════════════
document.addEventListener('dragstart',function(e){
  var el=e.target.closest('[data-wi]');
  if(!el)return;
  if(typeof dragStart==='function')dragStart(e,parseInt(el.dataset.wi),parseInt(el.dataset.ii));
});
document.addEventListener('dragover',function(e){
  var el=e.target.closest('[data-wi]');
  if(!el)return;
  if(typeof dragOver==='function')dragOver(e);
});
document.addEventListener('dragleave',function(e){
  var el=e.target.closest('[data-wi]');
  if(!el)return;
  if(typeof dragLeave==='function')dragLeave(e);
});
document.addEventListener('drop',function(e){
  var el=e.target.closest('[data-wi]');
  if(!el)return;
  if(typeof dragDrop==='function')dragDrop(e,parseInt(el.dataset.wi),parseInt(el.dataset.ii));
});
document.addEventListener('dragend',function(e){
  var el=e.target.closest('[data-wi]');
  if(!el)return;
  if(typeof dragEnd==='function')dragEnd(e);
});

// ════════════════════════════════════════════════
// KEYDOWN — Enter key delegation
// data-enter="fnName"          — call fn() on Enter
// data-enter-focus="elementId" — focus element on Enter
// ════════════════════════════════════════════════
document.addEventListener('keydown',function(e){
  // Space key activates role="button" divs (native <button> handles Space automatically)
  if(e.key===' '||e.key==='Spacebar'){
    var rb=e.target.closest('[role="button"][data-action]');
    if(rb&&rb.tagName!=='BUTTON'){e.preventDefault();rb.click();return;}
  }
  if(e.key!=='Enter')return;
  var el=e.target.closest('[data-enter]');
  if(el){
    e.preventDefault();
    var fn=el.dataset.enter;
    if(typeof window[fn]==='function')window[fn]();
    return;
  }
  var fel=e.target.closest('[data-enter-focus]');
  if(fel){
    e.preventDefault();
    var t=document.getElementById(fel.dataset.enterFocus);
    if(t)t.focus();
  }
});
