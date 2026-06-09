// === modals.js ===

// ── FOCUS TRAP FOR MODALS ──
function trapFocus(modal){
  modal._trapTrigger=document.activeElement;
  const focusable=modal.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])');
  const first=focusable[0], last=focusable[focusable.length-1];
  function handler(e){
    if(e.key!=='Tab')return;
    if(e.shiftKey){ if(document.activeElement===first){e.preventDefault();last.focus();} }
    else{ if(document.activeElement===last){e.preventDefault();first.focus();} }
  }
  modal._trapHandler=handler;
  modal.addEventListener('keydown',handler);
}
function releaseTrap(modal){
  if(modal&&modal._trapHandler){
    modal.removeEventListener('keydown',modal._trapHandler);
    modal._trapHandler=null;
    if(modal._trapTrigger&&typeof modal._trapTrigger.focus==='function')modal._trapTrigger.focus();
    modal._trapTrigger=null;
  }
}

// ── Currency select helper (E6) ──────────────────────────────────────────────
function _populateCurrencySelect(selectId, selectedCode) {
  var sel = document.getElementById(selectId);
  if (!sel || typeof CURRENCY_MAP === 'undefined') return;
  var home = getCurrency().code;
  if (sel.options.length === 0) {
    // Build option list once — sorted alpha with home currency first
    var codes = Object.keys(CURRENCY_MAP).sort(function(a, b) {
      if (a === home) return -1;
      if (b === home) return 1;
      return a.localeCompare(b);
    });
    codes.forEach(function(code) {
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code + ' — ' + (CURRENCY_MAP[code].symbol || '') + ' (' + (CURRENCY_MAP[code].locale || '') + ')';
      sel.appendChild(opt);
    });
  }
  sel.value = selectedCode || home;
}

function toggleItemCurrencyRow() {
  var row = document.getElementById('iCurrencyRow');
  var btn = document.getElementById('iCurrencyToggle');
  if (!row) return;
  var shown = row.style.display !== 'none';
  row.style.display = shown ? 'none' : 'block';
  if (btn) btn.textContent = shown ? '+ Different currency' : '− Use home currency';
  if (!shown) _populateCurrencySelect('iCurrency', getCurrency().code);
}

function toggleRevCurrencyRow() {
  var row = document.getElementById('rCurrencyRow');
  var btn = document.getElementById('rCurrencyToggle');
  if (!row) return;
  var shown = row.style.display !== 'none';
  row.style.display = shown ? 'none' : 'block';
  if (btn) btn.textContent = shown ? '+ Different currency' : '− Use home currency';
  if (!shown) _populateCurrencySelect('rCurrency', getCurrency().code);
}

// ══════════════════════════════════════════════════════════════
// EXPENSE ITEM MODAL — Add & Edit
// ══════════════════════════════════════════════════════════════
let _iModalWi=-1, _iModalIi=-1, _iModalReceipt=null, _iModalCat='cat-other', _iModalStatus='pending', _iModalCatManual=false;

function openItemModal(wi, ii){
  _iModalWi=wi; _iModalIi=ii;
  const isEdit = ii >= 0;
  const item = isEdit ? cw()[wi].items[ii] : null;

  // Header
  document.getElementById('itemModalTitle').textContent = isEdit ? 'Edit Expense' : 'Add Expense';
  document.getElementById('itemModalWeekLabel').textContent = 'Week '+(wi+1)+' · '+CMK;
  document.getElementById('iDeleteBtn').style.display = isEdit ? 'block' : 'none';

  // Pre-fill fields
  document.getElementById('iName').value = isEdit ? item.name : '';
  document.getElementById('iAmount').value = isEdit ? amt(item.amount) : '';
  document.getElementById('iNote').value = isEdit ? (item.note||'') : '';
  document.getElementById('iDueDay').value = isEdit && item.dueDay ? item.dueDay : '';

  // Category — use stored category when editing, auto-detect for new items
  _iModalCat = isEdit ? (item.category || getCat(item.name)) : 'cat-other';
  _iModalCatManual = isEdit; // treat loaded category as a manual choice so auto-tag won't overwrite
  renderCatPills(_iModalCat);

  // Status
  _iModalStatus = isEdit ? (item.paid ? 'paid' : 'pending') : 'pending';
  setItemStatus(_iModalStatus);

  // Due day quick-pick grid
  renderDueDayGrid(isEdit && item.dueDay ? item.dueDay : 0);

  // Receipt
  _iModalReceipt = isEdit ? (item.receipt||null) : null;
  renderItemReceiptPreview();

  // Tax deductible (E5)
  const taxCheck = document.getElementById('iTaxCheck');
  if (taxCheck) taxCheck.checked = isEdit ? !!item.taxDeductible : false;

  // Currency (E6) — show row only when item has a non-home currency
  const iCurrRow = document.getElementById('iCurrencyRow');
  const iCurrToggle = document.getElementById('iCurrencyToggle');
  const itemCurrency = isEdit ? (item.currency || getCurrency().code) : getCurrency().code;
  const isForeign = itemCurrency !== getCurrency().code;
  if (iCurrRow) iCurrRow.style.display = isForeign ? 'block' : 'none';
  if (iCurrToggle) iCurrToggle.textContent = isForeign ? '− Use home currency' : '+ Different currency';
  _populateCurrencySelect('iCurrency', itemCurrency);

  // Frequency
  const freqEl=document.getElementById('iFrequency');
  if(freqEl) freqEl.value = isEdit ? (item.frequency||'monthly') : 'monthly';
  const ymEl=document.getElementById('iYearlyMonth');
  if(ymEl) ymEl.value = isEdit ? (item._scheduledYearMonth||0) : 0;
  itemFreqChange();

  // Reset custom categories — add them to pills
  renderCatPills(_iModalCat);

  const _im=document.getElementById('itemModal');
  _im.classList.add('open');
  trapFocus(_im);

  // Focus name if adding, amount if editing (name already known)
  setTimeout(()=>{
    if(!isEdit) document.getElementById('iName').focus();
    else document.getElementById('iAmount').focus();
  },120);
}

function closeItemModal(){
  const _im=document.getElementById('itemModal');
  _im.classList.remove('open');
  releaseTrap(_im);
  _iModalWi=-1; _iModalIi=-1; _iModalReceipt=null; _iModalCatManual=false;
}

function _getUsedCats(){
  const used = new Set();
  try { cw().forEach(w=>(w.items||[]).forEach(it=>{ if(it.category) used.add(it.category); })); } catch(e){}
  return used;
}

function renderCatPills(selectedCls, showAll){
  _iModalCat = selectedCls;
  const allCats = [...CAT_ALL];
  if(S.customCategories&&S.customCategories.length){
    S.customCategories.forEach(cc=>{
      allCats.push({cls:'cat-custom-'+cc.id, lbl:cc.name, icon:'🏷', custom:true, bg:cc.bg, color:cc.color});
    });
  }

  const usedCats = _getUsedCats();
  // Always show: selected category + used categories + "Other"; rest hidden behind toggle
  const alwaysShow = new Set([...usedCats, selectedCls, 'cat-other']);
  const primary = allCats.filter(c => alwaysShow.has(c.cls));
  const secondary = allCats.filter(c => !alwaysShow.has(c.cls));
  const isExpanded = showAll || secondary.some(c => c.cls === selectedCls);

  function pillHTML(cat){
    const isSel = cat.cls===selectedCls;
    const style = cat.custom ? 'background:'+cat.bg+';color:'+cat.color+';' : '';
    return`<button class="cat-pill-opt ${cat.cls}${isSel?' selected':''}" style="${style}" data-action="selectCat" data-arg="${cat.cls}">${cat.iconKey?icon(cat.iconKey):''} ${cat.lbl}</button>`;
  }

  const primaryHTML = primary.map(pillHTML).join('');
  const secondaryHTML = secondary.map(pillHTML).join('');
  const moreBtn = secondary.length
    ? (isExpanded
        ? `<button class="cat-pill-more-btn" data-action="renderCatPillsAll" data-arg="hide">▲ Less</button>`
        : `<button class="cat-pill-more-btn" data-action="renderCatPillsAll" data-arg="show">+ ${secondary.length} more</button>`)
    : '';

  document.getElementById('catPillGrid').innerHTML =
    primaryHTML +
    (isExpanded ? secondaryHTML : '') +
    moreBtn;
}

function selectCat(cls){
  _iModalCatManual = true;
  renderCatPills(cls);
}

function renderCatPillsAll(arg){
  renderCatPills(_iModalCat, arg==='show');
}

function setItemStatus(s){
  _iModalStatus=s;
  document.getElementById('iStatusPending').classList.toggle('sel', s==='pending');
  document.getElementById('iStatusPaid').classList.toggle('sel', s==='paid');
}

function renderDueDayGrid(selectedDay){
  const days=[];
  for(let d=1;d<=31;d++) days.push(d);
  document.getElementById('dueDayGrid').innerHTML = days.map(d=>
    `<button class="due-day-btn${d===selectedDay?' sel':''}" data-action="pickDueDay" data-arg="${d}">${d}</button>`
  ).join('');
}

function pickDueDay(d){
  document.getElementById('iDueDay').value = d;
  renderDueDayGrid(d);
  // Auto-show which week this day falls in (monthly only)
  const freqEl=document.getElementById('iFrequency');
  const freq=freqEl?freqEl.value:'monthly';
  const hint=document.getElementById('iFreqHint');
  if(hint&&freq==='monthly'){
    const wk=getWeekForDay(d,CMK);
    hint.textContent='Day '+d+' falls in Week '+(wk+1)+' of '+CMK;
  }
}

// Show/hide yearly-month row and update frequency hint text
function itemFreqChange(){
  const freqEl=document.getElementById('iFrequency');
  const freq=freqEl?freqEl.value:'monthly';
  const yearlyRow=document.getElementById('iYearlyMonthRow');
  const hint=document.getElementById('iFreqHint');
  if(yearlyRow)yearlyRow.style.display=freq==='yearly'?'block':'none';
  if(hint){
    const msgs={
      monthly:'',
      weekly:'4 line items will be created — one per week.',
      biweekly:'2 line items created for Week 1 and Week 3.',
      quarterly:'Auto-added to January, April, July, and October.',
      yearly:'Auto-added once per year in the selected month.'
    };
    hint.textContent=msgs[freq]||'';
  }
}

function clearItemDueDay(){
  document.getElementById('iDueDay').value='';
  renderDueDayGrid(0);
}

function itemNameAutoTag(name){
  if(_iModalCatManual) return; // user picked a category manually — don't override
  const detected = getCat(name);
  if(detected !== _iModalCat) renderCatPills(detected);
}

function renderItemReceiptPreview(){
  const zone = document.getElementById('iReceiptZone');
  const prev = document.getElementById('iReceiptPreview');
  if(_iModalReceipt){
    const wrap=document.createElement('div');wrap.style.cssText='position:relative;display:inline-block;margin-bottom:6px;';
    const img=document.createElement('img');img.src=_iModalReceipt;img.className='receipt-modal-preview';
    img.addEventListener('click',function(){this.style.maxHeight=this.style.maxHeight==='none'?'150px':'none';});
    const rmBtn=document.createElement('button');rmBtn.innerHTML=icon('close',{label:'Remove receipt'});rmBtn.title='Remove receipt';rmBtn.setAttribute('aria-label','Remove receipt');
    rmBtn.style.cssText='position:absolute;top:4px;right:4px;background:rgba(0,0,0,.5);color:white;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;';
    rmBtn.addEventListener('click',removeItemReceipt);
    wrap.appendChild(img);wrap.appendChild(rmBtn);
    prev.innerHTML='';prev.appendChild(wrap);
    zone.style.display='none';
  } else {
    prev.innerHTML='';
    zone.style.display='block';
  }
}

function handleItemReceipt(file){
  if(!file) return;
  if(file.size>204800){ showToast('Image too large (max 200KB)','warn-t'); return; }
  const reader=new FileReader();
  reader.onload=e=>{ _iModalReceipt=e.target.result; renderItemReceiptPreview(); };
  reader.readAsDataURL(file);
}

function removeItemReceipt(){
  _iModalReceipt=null;
  document.getElementById('iReceiptInput').value='';
  renderItemReceiptPreview();
}

function saveItemModal(){
  const name = document.getElementById('iName').value.trim();
  const amountRaw = parseFloat(document.getElementById('iAmount').value)||0;
  const amount = storeCents(amountRaw);
  const note = document.getElementById('iNote').value.trim();
  const dueDayRaw = parseInt(document.getElementById('iDueDay').value);
  const dueDay = (!isNaN(dueDayRaw)&&dueDayRaw>=1&&dueDayRaw<=31) ? dueDayRaw : null;
  const freq = (document.getElementById('iFrequency')||{}).value || 'monthly';
  const yearlyMonth = parseInt((document.getElementById('iYearlyMonth')||{}).value)||0;

  if(!name){ showToast('Please enter an item name','warn-t'); document.getElementById('iName').focus(); return; }

  // Read currency once — shared by all frequency paths
  const _iCurrRow = document.getElementById('iCurrencyRow');
  const _iCurrSel = document.getElementById('iCurrency');
  const itemCurrency = (_iCurrRow && _iCurrRow.style.display !== 'none' && _iCurrSel && _iCurrSel.value)
    ? _iCurrSel.value : getCurrency().code;

  // ── QUARTERLY / YEARLY → scheduled template ──
  if(freq==='quarterly'||freq==='yearly'){
    if(!S.scheduledExpenses)S.scheduledExpenses=[];
    const isEditingSched = _iModalIi>=0 && cw()[_iModalWi]&&cw()[_iModalWi].items[_iModalIi]&&cw()[_iModalWi].items[_iModalIi]._scheduledId;
    const existingId = isEditingSched ? cw()[_iModalWi].items[_iModalIi]._scheduledId : ('se'+Date.now());
    const se={id:existingId,name,amount,frequency:freq,dueDay,note,week:_iModalWi,yearMonth:yearlyMonth,currency:itemCurrency};
    if(isEditingSched){
      const idx=S.scheduledExpenses.findIndex(s=>s.id===existingId);
      if(idx>=0)S.scheduledExpenses[idx]=se; else S.scheduledExpenses.push(se);
      cw()[_iModalWi].items[_iModalIi]=Object.assign({},cw()[_iModalWi].items[_iModalIi],{name,amount,dueDay,note,frequency:freq,currency:itemCurrency,_scheduledId:existingId,_scheduledYearMonth:yearlyMonth});
    } else {
      S.scheduledExpenses.push(se);
      expandScheduledExpenses(CMK); // inject into current month if it qualifies
    }
    persist();
    closeItemModal(); renderExpenses(); updateHealth();
    const lbl=freq.charAt(0).toUpperCase()+freq.slice(1);
    showToast('✓ '+lbl+' expense saved — auto-appears in qualifying months');
    return;
  }

  // ── WEEKLY → 4 items, one per week ──
  if(freq==='weekly'){
    if(_iModalIi>=0){
      // Edit: update just this occurrence
      cw()[_iModalWi].items[_iModalIi]=Object.assign({},cw()[_iModalWi].items[_iModalIi],{name,amount,dueDay,note,frequency:'weekly',category:_iModalCat,currency:itemCurrency});
    } else {
      cw().forEach(w=>{
        w.items.push({name,amount,paid:false,dueDay,note,receipt:null,frequency:'weekly',category:_iModalCat,currency:itemCurrency,_savingsItem:false});
      });
    }
    persist();
    closeItemModal(); renderExpenses(); updateHealth();
    showToast(_iModalIi>=0?'✓ Item updated':'✓ Weekly expense added to all 4 weeks');
    return;
  }

  // ── BI-WEEKLY → Week 1 (idx 0) and Week 3 (idx 2) ──
  if(freq==='biweekly'){
    if(_iModalIi>=0){
      cw()[_iModalWi].items[_iModalIi]=Object.assign({},cw()[_iModalWi].items[_iModalIi],{name,amount,dueDay,note,frequency:'biweekly',category:_iModalCat,currency:itemCurrency});
    } else {
      [0,2].forEach(wi=>{
        if(cw()[wi])cw()[wi].items.push({name,amount,paid:false,dueDay,note,receipt:null,frequency:'biweekly',category:_iModalCat,currency:itemCurrency,_savingsItem:false});
      });
    }
    persist();
    closeItemModal(); renderExpenses(); updateHealth();
    showToast(_iModalIi>=0?'✓ Item updated':'✓ Bi-weekly expense added to Week 1 & Week 3');
    return;
  }

  // ── MONTHLY (default) — standard single item ──
  const taxCheck = document.getElementById('iTaxCheck');
  const newItem = {
    name, amount,
    paid: _iModalStatus==='paid',
    dueDay, note,
    receipt: _iModalReceipt,
    currency: itemCurrency,
    frequency: 'monthly',
    category: _iModalCat,
    _savingsItem: false,
    taxDeductible: taxCheck ? taxCheck.checked : false
  };

  if(_iModalIi>=0){
    const existing = cw()[_iModalWi].items[_iModalIi];
    newItem._savingsItem = existing._savingsItem||false;
    cw()[_iModalWi].items[_iModalIi] = newItem;
  } else {
    const targetWi = dueDay ? getWeekForDay(dueDay, CMK) : _iModalWi;
    cw()[targetWi].items.push(newItem);
  }

  const wasNew=_iModalIi<0;
  const isPaid=newItem.paid;
  persist();
  closeItemModal();
  renderExpenses();
  updateHealth();
  if(isPaid){launchConfetti(wasNew?30:18);}
  showToast(_iModalIi>=0?'✓ Item updated':'✓ Item added');
  if(wasNew){
    if(typeof awardXP==='function') awardXP('expense_logged');
    if(typeof checkAchievements==='function'){
      var _catCls=typeof getCat==='function'?getCat(name):'';
      var _catId=_catCls?'cat_'+_catCls.replace('cat-',''):'';
      checkAchievements('first_paid','envelope_hero','budget_keeper',_catId);
    }
    _checkRecurringSuggest(name,amount,dueDay);
  }
}

// ── RECURRING SUGGEST (2B) ──
let _recurSuggestName='',_recurSuggestAmt=0,_recurSuggestDue=null;
function _checkRecurringSuggest(name,amount,dueDay){
  const k=name.trim().toLowerCase();
  const prevMonths=Object.keys(S.months).filter(mk=>mk!==CMK);
  let monthCount=0;
  prevMonths.forEach(mk=>{
    if(S.months[mk].weeks.some(w=>w.items.some(i=>i.name.trim().toLowerCase()===k))) monthCount++;
  });
  const alreadySched=(S.scheduledExpenses||[]).some(se=>se.name.trim().toLowerCase()===k);
  if(monthCount>=2&&!alreadySched){
    _recurSuggestName=name; _recurSuggestAmt=amount; _recurSuggestDue=dueDay;
    const banner=document.getElementById('recurSuggestBanner');
    if(!banner)return;
    banner.textContent='';
    const icon=document.createTextNode('↵ ');
    const bold=document.createElement('b');
    bold.textContent=name;
    const msg=document.createTextNode(' recurs — ');
    const btn=document.createElement('button');
    btn.setAttribute('data-action','addSuggestedScheduled');
    btn.style.cssText='background:var(--sage);color:white;border:none;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;';
    btn.textContent='Make Recurring ✓';
    banner.append(icon,bold,msg,btn);
    banner.style.display='flex';
    clearTimeout(window._rstt);
    window._rstt=setTimeout(()=>{banner.style.display='none';banner.textContent='';},7000);
  }
}
function _hideRecurBanner(){
  const banner=document.getElementById('recurSuggestBanner');
  if(banner){banner.style.display='none';banner.textContent='';}
  clearTimeout(window._rstt);
}
function addSuggestedScheduled(){
  if(!_recurSuggestName)return;
  if(!S.scheduledExpenses)S.scheduledExpenses=[];
  S.scheduledExpenses.push({id:'se'+Date.now(),name:_recurSuggestName,amount:_recurSuggestAmt,frequency:'monthly',dueDay:_recurSuggestDue,note:'',week:0});
  persist(false);
  _hideRecurBanner();
  showToast('✓ '+_recurSuggestName+' set as monthly recurring');
  _recurSuggestName='';
}

// Override deleteItemFromModal to show inline confirm
function deleteItemFromModal() {
  const qc = document.getElementById('iDeleteConfirm');
  if (qc) qc.classList.add('show');
}
function hideItemDeleteConfirm() {
  const qc = document.getElementById('iDeleteConfirm');
  if (qc) qc.classList.remove('show');
}
function confirmDeleteItem() {
  if (_iModalWi < 0 || _iModalIi < 0) return;
  dispatch('ITEM_REMOVE', {wi: _iModalWi, ii: _iModalIi});
  closeItemModal(); renderExpenses(); updateHealth();
  showUndoToast('Expense deleted — Undo');
}

// ══════════════════════════════════════════════════════════════
// LOAN MODAL
// ══════════════════════════════════════════════════════════════
let _loanEditIdx = -1;

function openLoanModal(idx) {
  _loanEditIdx = idx;
  const isEdit = idx >= 0;
  const loan = isEdit ? S.loans[idx] : null;

  document.getElementById('loanModalTitle').textContent = isEdit ? 'Edit Loan' : 'Add Loan';
  document.getElementById('lName').value = isEdit ? loan.name : '';
  document.getElementById('lBalance').value = isEdit ? amt(loan.amount) : '';
  document.getElementById('lOriginal').value = isEdit ? amt(loan.originalAmount || loan.amount) : '';
  document.getElementById('lRate').value = isEdit ? loan.rate : '';
  document.getElementById('lMinPmt').value = isEdit ? amt(loan.minPayment) : '';
  _populateCurrencySelect('lCurrency', isEdit ? (loan.currency || getCurrency().code) : getCurrency().code);

  document.getElementById('loanDeleteConfirm').classList.remove('show');
  const ldb=document.getElementById('lDeleteBtn');
  if(ldb) ldb.style.display = isEdit ? 'inline-flex' : 'none';

  const _lm=document.getElementById('loanModal');
  _lm.classList.add('open');
  trapFocus(_lm);
  setTimeout(()=>document.getElementById('lName').focus(),120);
}

function closeLoanModal() {
  const _lm=document.getElementById('loanModal');
  _lm.classList.remove('open');
  releaseTrap(_lm);
}

function showLoanDeleteConfirm() {
  // Warn if any financial goals are linked to this loan
  const linkedGoals = (S.financialGoals||[]).filter(g=>g.linkedLoan===_loanEditIdx);
  const msgEl = document.querySelector('#loanDeleteConfirm .quick-confirm-msg');
  if(msgEl){
    msgEl.textContent = linkedGoals.length
      ? 'Delete this loan? ' + linkedGoals.length + ' linked goal' + (linkedGoals.length>1?'s':'') + ' will be unlinked.'
      : 'Delete this loan permanently?';
  }
  document.getElementById('loanDeleteConfirm').classList.add('show');
  const ldb=document.getElementById('lDeleteBtn'); if(ldb) ldb.style.display='none';
}
function hideLoanDeleteConfirm() {
  document.getElementById('loanDeleteConfirm').classList.remove('show');
  const ldb=document.getElementById('lDeleteBtn'); if(ldb) ldb.style.display='inline-flex';
}

function confirmDeleteLoan() {
  if (_loanEditIdx < 0) return;
  // Unlink goals pointing to this loan; decrement indexes for higher-index loans
  (S.financialGoals||[]).forEach(g=>{
    if(g.linkedLoan===_loanEditIdx){
      delete g.linkedLoan;
    } else if(typeof g.linkedLoan==='number' && g.linkedLoan > _loanEditIdx){
      g.linkedLoan--;
    }
  });
  dispatch('LOAN_REMOVE',{li:_loanEditIdx});
  closeLoanModal(); renderLoans(); updateHealth();
  showUndoToast('Loan deleted — Undo');
}

function saveLoanModal() {
  const name = document.getElementById('lName').value.trim();
  const balanceRaw = parseFloat(document.getElementById('lBalance').value)||0;
  const balance = storeCents(balanceRaw);
  const origRaw = parseFloat(document.getElementById('lOriginal').value)||0;
  const original = storeCents(origRaw);
  const rate = parseFloat(document.getElementById('lRate').value);
  const minPmt = parseFloat(document.getElementById('lMinPmt').value);

  if (!name) { showToast('Enter a loan name', 'warn-t'); document.getElementById('lName').focus(); return; }
  if (isNaN(balance) || balance < 0) { showToast('Enter a valid current balance', 'warn-t'); document.getElementById('lBalance').focus(); return; }
  if (!isFinite(rate) || rate < 0) { showToast('Enter a valid interest rate', 'warn-t'); document.getElementById('lRate').focus(); return; }
  if (rate > 100) { showToast('Interest rate cannot exceed 100%', 'warn-t'); document.getElementById('lRate').focus(); return; }
  if (!isFinite(minPmt) || minPmt < 0) { showToast('Enter a valid minimum payment', 'warn-t'); document.getElementById('lMinPmt').focus(); return; }

  const origAmt = (!isNaN(original) && original > 0) ? original : balance;

  const lCurrSel = document.getElementById('lCurrency');
  const loanCurrency = lCurrSel && lCurrSel.value ? lCurrSel.value : getCurrency().code;
  if (_loanEditIdx >= 0) {
    dispatch('LOAN_UPSERT',{li:_loanEditIdx,patch:{name,amount:Math.round(balance*100)/100,originalAmount:Math.round(origAmt*100)/100,rate,minPayment:minPmt,currency:loanCurrency}});
  } else {
    dispatch('LOAN_UPSERT',{li:-1,loan:{name,amount:Math.round(balance*100)/100,originalAmount:Math.round(origAmt*100)/100,rate,minPayment:minPmt,currency:loanCurrency,payments:[{month:CMK,paid:false}]}});
  }

  const loanJustPaid=(_loanEditIdx>=0&&balance===0&&((S.loans[_loanEditIdx]&&S.loans[_loanEditIdx].originalAmount)||0)>0);
  closeLoanModal(); renderLoans(); updateHealth();
  if(loanJustPaid){celebrateLoanPaidOff(name);checkAllLoansDebtFree();}
  else showToast(_loanEditIdx>=0?'✓ Loan updated':'✓ Loan added');
}

// ══════════════════════════════════════════════════════════════
// REVENUE MODAL
// ══════════════════════════════════════════════════════════════
let _revEditIdx = -1, _revStatus = 'pending';

function openRevModal(idx) {
  _revEditIdx = idx;
  const isEdit = idx >= 0;
  const item = isEdit ? cr()[idx] : null;

  document.getElementById('revModalTitle').textContent = isEdit ? 'Edit Income Source' : 'Add Income Source';
  document.getElementById('rName').value = isEdit ? item.name : '';
  document.getElementById('rAmount').value = isEdit && item.amount ? amt(item.amount) : '';
  document.getElementById('rNote').value = isEdit ? (item.note || '') : '';

  // Recurring checkbox — check if this item exists in S.recurringRevenue
  const recurEl = document.getElementById('rRecurring');
  if(recurEl){
    if(isEdit){
      const isRec = (S.recurringRevenue||[]).some(r=>r.name.trim().toLowerCase()===item.name.trim().toLowerCase());
      recurEl.checked = isRec;
    } else {
      recurEl.checked = false;
    }
  }

  _revStatus = isEdit ? (item.received ? 'received' : 'pending') : 'pending';
  setRevStatus(_revStatus);

  // Currency (E6)
  const rCurrRow = document.getElementById('rCurrencyRow');
  const rCurrToggle = document.getElementById('rCurrencyToggle');
  const revCurrency = isEdit ? (item.currency || getCurrency().code) : getCurrency().code;
  const revForeign = revCurrency !== getCurrency().code;
  if (rCurrRow) rCurrRow.style.display = revForeign ? 'block' : 'none';
  if (rCurrToggle) rCurrToggle.textContent = revForeign ? '− Use home currency' : '+ Different currency';
  _populateCurrencySelect('rCurrency', revCurrency);

  document.getElementById('rDeleteBtn').style.display = isEdit ? 'block' : 'none';
  document.getElementById('revDeleteConfirm').classList.remove('show');

  const _rm=document.getElementById('revModal');
  _rm.classList.add('open');
  trapFocus(_rm);
  setTimeout(()=>document.getElementById('rName').focus(),120);
}

function closeRevModal() {
  const _rm=document.getElementById('revModal');
  _rm.classList.remove('open');
  releaseTrap(_rm);
}

function setRevStatus(s) {
  _revStatus = s;
  document.getElementById('rStatusPending').classList.toggle('sel', s === 'pending');
  document.getElementById('rStatusReceived').classList.toggle('sel', s === 'received');
}

function showRevDeleteConfirm() {
  document.getElementById('revDeleteConfirm').classList.add('show');
}
function hideRevDeleteConfirm() {
  document.getElementById('revDeleteConfirm').classList.remove('show');
}

function confirmDeleteRev() {
  if (_revEditIdx < 0) return;
  dispatch('REVENUE_REMOVE', {i: _revEditIdx});
  closeRevModal(); renderRevenue(); updateHealth();
  showUndoToast('Income deleted — Undo');
}

function saveRevModal() {
  const name = document.getElementById('rName').value.trim();
  const amountRaw2 = parseFloat(document.getElementById('rAmount').value)||0;
  const amount = storeCents(amountRaw2);
  const note = document.getElementById('rNote').value.trim();
  const isRecurring = (document.getElementById('rRecurring')||{}).checked || false;

  if (!name) { showToast('Enter a source name', 'warn-t'); document.getElementById('rName').focus(); return; }

  const rCurrRow = document.getElementById('rCurrencyRow');
  const rCurrSel = document.getElementById('rCurrency');
  const revCurrency = (rCurrRow && rCurrRow.style.display !== 'none' && rCurrSel && rCurrSel.value)
    ? rCurrSel.value : getCurrency().code;
  dispatch('REVENUE_UPSERT',{idx:_revEditIdx,item:{name,amount,received:_revStatus==='received',note,currency:revCurrency}});

  // Manage recurring revenue template
  const recIdx = (S.recurringRevenue||[]).findIndex(r => r.name.trim().toLowerCase() === name.toLowerCase());
  if (isRecurring) {
    dispatch('RECURRING_UPSERT',{idx:recIdx,item:{name,amount,note}});
  } else if (recIdx >= 0) {
    dispatch('RECURRING_REMOVE',{idx:recIdx});
  }
  const wasNewRev = _revEditIdx < 0;
  closeRevModal(); renderRevenue(); updateHealth();
  const recurMsg = isRecurring ? ' · will auto-add to new months' : '';
  showToast((_revEditIdx >= 0 ? '✓ Income updated' : '✓ Income added') + recurMsg);
  if (wasNewRev) {
    if (typeof awardXP === 'function') awardXP('income_logged');
    if (typeof checkAchievements === 'function') checkAchievements('income_logger');
  }
}

// ══════════════════════════════════════════════
// NOTES & RECEIPTS
// ══════════════════════════════════════════════
function openNoteModal(wi,ii){ openItemModal(wi,ii); }

function openReceiptModal(wi,ii){
  _receiptWi=wi;_receiptIi=ii;
  const item=cw()[wi].items[ii];
  document.getElementById('receiptModalItemName').textContent=item.name;
  document.getElementById('receiptFileInput').value='';
  const wrap=document.getElementById('receiptImgWrap');
  wrap.innerHTML='';
  if(item.receipt){
    const thumb=document.createElement('img');thumb.src=item.receipt;thumb.className='receipt-thumb';
    thumb.addEventListener('click',function(){this.style.maxHeight=this.style.maxHeight==='none'?'120px':'none';});
    wrap.appendChild(thumb);
  } else {
    wrap.innerHTML='<p style="color:var(--text-muted);font-size:12px;padding:16px 0;">No receipt attached yet.</p>';
  }
  document.getElementById('receiptModal').classList.add('open');
  trapFocus(document.getElementById('receiptModal'));
  setTimeout(()=>{const _f=document.querySelector('#receiptModal button');if(_f)_f.focus();},120);
}
function closeReceiptModal(){releaseTrap(document.getElementById('receiptModal'));
  document.getElementById('receiptModal').classList.remove('open');}
function handleReceiptFile(file){
  if(!file)return;
  if(file.size>204800){showToast('Image too large (max 200KB)','warn-t');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    dispatch('ITEM_SET_RECEIPT',{wi:_receiptWi,ii:_receiptIi,data:e.target.result});
    closeReceiptModal();renderExpenses();showToast('✓ Receipt attached');
  };
  reader.readAsDataURL(file);
}
function clearReceipt(){
  dispatch('ITEM_SET_RECEIPT',{wi:_receiptWi,ii:_receiptIi,data:null});
  closeReceiptModal();renderExpenses();showToast('✓ Receipt removed');
}

function openImport(){if(typeof requirePlan==='function'&&!requirePlan('pro','CSV Bank Import'))return;const _im2=document.getElementById('importModal');_im2.classList.add('open');trapFocus(_im2);}
function closeImport(){const _im2=document.getElementById('importModal');releaseTrap(_im2);_im2.classList.remove('open');}
function validateImport(p){
  if(!p||typeof p!=='object')return false;
  if(!p.months||typeof p.months!=='object')return false;
  const key=p.currentMonthKey||Object.keys(p.months)[0];
  if(!key||!p.months[key])return false;
  // Validate nested weeks + items structure to prevent runtime crashes on render
  const m=p.months[key];
  if(!Array.isArray(m.weeks))return false;
  for(const w of m.weeks){
    if(!w||!Array.isArray(w.items))return false;
    for(const i of w.items){
      if(typeof i.name!=='string'||typeof i.amount!=='number')return false;
    }
  }
  if(!Array.isArray(m.revenue))return false;
  if(p.loans!==undefined&&!Array.isArray(p.loans))return false;
  if(p.savings!==undefined&&!Array.isArray(p.savings))return false;
  if(p.financialGoals!==undefined&&!Array.isArray(p.financialGoals))return false;
  return true;
}
function doImport(){
  try{
    const p=JSON.parse(document.getElementById('importJson').value);
    if(!validateImport(p))throw new Error();
    S=p;CMK=S.currentMonthKey||Object.keys(S.months)[0];
    if(typeof normaliseState==='function')normaliseState();
    persist();closeImport();applyDark();updateMonthLabel();renderSection(getTab());updateHealth();
    showToast('✓ Import successful');
  }catch(e){showToast('Invalid JSON backup','err-t');}
}

// ══════════════════════════════════════════════
// MONTH COMPARISON
// ══════════════════════════════════════════════
function openCompareModal(){
  const keys=[...Object.keys(S.months),...Object.keys(S.archivedMonths||{})];
  const opts=keys.map(k=>'<option value="'+k+'">'+k+'</option>').join('');
  document.getElementById('compareA').innerHTML=opts;
  document.getElementById('compareB').innerHTML=opts;
  // Default to last two months
  if(keys.length>=2){document.getElementById('compareA').value=keys[keys.length-2];document.getElementById('compareB').value=keys[keys.length-1];}
  renderComparison();
  document.getElementById('compareModal').classList.add('open');
  trapFocus(document.getElementById('compareModal'));
  setTimeout(()=>{const _f=document.querySelector('#compareModal select');if(_f)_f.focus();},120);
}
function closeCompareModal(){releaseTrap(document.getElementById('compareModal'));
  document.getElementById('compareModal').classList.remove('open');}

function getMonthData(key){return S.months[key]||(S.archivedMonths&&S.archivedMonths[key])||null;}

function renderComparison(){
  const kA=document.getElementById('compareA').value;
  const kB=document.getElementById('compareB').value;
  const mA=getMonthData(kA);const mB=getMonthData(kB);
  if(!mA||!mB){document.getElementById('compareResult').innerHTML='<p style="color:var(--text-muted);">Select two months to compare.</p>';return;}
  const revA=mA.revenue.reduce((s,r)=>s+amt(r.amount),0);const revB=mB.revenue.reduce((s,r)=>s+amt(r.amount),0);
  const expA=mA.weeks.reduce((s,w)=>s+w.items.reduce((a,i)=>a+amt(i.amount),0),0);
  const expB=mB.weeks.reduce((s,w)=>s+w.items.reduce((a,i)=>a+amt(i.amount),0),0);
  const netA=revA-expA;const netB=revB-expB;
  // Category breakdown
  const catsA={},catsB={};
  mA.weeks.forEach(w=>w.items.forEach(i=>{const c=getCatLabel(getCat(i.name));catsA[c]=(catsA[c]||0)+amt(i.amount);}));
  mB.weeks.forEach(w=>w.items.forEach(i=>{const c=getCatLabel(getCat(i.name));catsB[c]=(catsB[c]||0)+amt(i.amount);}));
  const allCats=[...new Set([...Object.keys(catsA),...Object.keys(catsB)])].sort();
  function diff(a,b){const d=b-a;return(d>=0?'+':'')+fmt(d);}
  function col(d){return d>=0?'var(--success)':'var(--danger)';}
  const catRows=allCats.map(c=>{
    const a=catsA[c]||0,b=catsB[c]||0;
    return`<tr><td>${c}</td><td class="acol">${fmt(a)}</td><td class="acol">${fmt(b)}</td><td class="acol" style="color:${col(b-a)};">${diff(a,b)}</td></tr>`;
  }).join('');
  document.getElementById('compareResult').innerHTML=`
    <table style="margin-bottom:12px;">
      <thead><tr><th>Metric</th><th class="acol">${kA}</th><th class="acol">${kB}</th><th class="acol">Change</th></tr></thead>
      <tbody>
        <tr><td style="font-weight:600;">Income</td><td class="acol">${fmt(revA)}</td><td class="acol">${fmt(revB)}</td><td class="acol" style="color:${col(revB-revA)};">${diff(revA,revB)}</td></tr>
        <tr><td style="font-weight:600;">Expenses</td><td class="acol">${fmt(expA)}</td><td class="acol">${fmt(expB)}</td><td class="acol" style="color:${col(expA-expB)};">${diff(expA,expB)}</td></tr>
        <tr style="background:var(--sage-light);"><td style="font-weight:700;">Net Flow</td><td class="acol" style="font-weight:700;">${fmt(netA)}</td><td class="acol" style="font-weight:700;">${fmt(netB)}</td><td class="acol" style="font-weight:700;color:${col(netB-netA)};">${diff(netA,netB)}</td></tr>
      </tbody>
    </table>
    <div style="font-weight:600;font-size:12px;margin-bottom:6px;">Category Breakdown</div>
    <table><thead><tr><th>Category</th><th class="acol">${kA}</th><th class="acol">${kB}</th><th class="acol">Change</th></tr></thead><tbody>${catRows}</tbody></table>
  `;
}

// ══════════════════════════════════════════════
// CUSTOM CATEGORY MANAGER
// ══════════════════════════════════════════════
function openCatManager(){
  renderCatManagerList();
  document.getElementById('catManagerModal').classList.add('open');
  trapFocus(document.getElementById('catManagerModal'));
  setTimeout(()=>{const _f=document.querySelector('#catManagerModal input');if(_f)_f.focus();},120);
}
function closeCatManager(){releaseTrap(document.getElementById('catManagerModal'));
  document.getElementById('catManagerModal').classList.remove('open');}

function renderCatManagerList(){
  const cats=S.customCategories||[];
  const el=document.getElementById('customCatList');
  const editSec=document.getElementById('editCatSection');

  if(!cats.length){
    el.innerHTML='<p style="font-size:12px;color:var(--text-muted);">No custom categories yet. Add one below.</p>';
    if(editSec) editSec.style.display='none';
    return;
  }

  el.innerHTML=cats.map((c,i)=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">
      <span class="cat-badge" style="background:${c.bg};color:${c.color};">${esc(c.name)}</span>
      <span style="font-size:11px;color:var(--text-muted);flex:1;">Keywords: ${esc(c.keywords.join(', '))}</span>
      <button class="tbtn" style="font-size:10px;padding:2px 7px;color:var(--danger);" data-action="delCustomCat" data-arg="${i}">Remove</button>
    </div>`).join('');

  // Populate the edit dropdown
  if(editSec){
    editSec.style.display='block';
    const sel=document.getElementById('editCatSelect');
    const prev=sel?sel.value:'';
    if(sel){
      sel.innerHTML='<option value="">— select a category —</option>'+
        cats.map((c,i)=>`<option value="${i}">${esc(c.name)}</option>`).join('');
      if(prev!==''&&sel.querySelector(`option[value="${prev}"]`)) sel.value=prev;
      else sel.value='';
    }
    const fields=document.getElementById('editCatFields');
    if(fields) fields.style.display=sel&&sel.value!==''?'block':'none';
  }
}

function loadCatForEdit(){
  const sel=document.getElementById('editCatSelect');
  const fields=document.getElementById('editCatFields');
  if(!sel||!fields) return;
  const idx=parseInt(sel.value);
  if(isNaN(idx)){fields.style.display='none';return;}
  const cat=(S.customCategories||[])[idx];
  if(!cat){fields.style.display='none';return;}
  document.getElementById('editCatName').value=cat.name;
  document.getElementById('editCatKeywords').value=cat.keywords.join(', ');
  document.getElementById('editCatBg').value=cat.bg||'#EBF4FF';
  document.getElementById('editCatColor').value=cat.color||'#2B6CB0';
  updateEditCatPreview();
  fields.style.display='block';
}

function updateEditCatPreview(){
  const bg=document.getElementById('editCatBg').value;
  const color=document.getElementById('editCatColor').value;
  const name=document.getElementById('editCatName').value.trim()||'Category';
  const p=document.getElementById('editCatPreview');
  if(p){p.style.background=bg;p.style.color=color;p.textContent=name;}
}

function saveEditCustomCat(){
  const sel=document.getElementById('editCatSelect');
  const idx=parseInt(sel?sel.value:'');
  if(isNaN(idx)){showToast('Select a category to edit','warn-t');return;}
  const cats=S.customCategories||[];
  if(!cats[idx]){showToast('Category not found','warn-t');return;}
  const name=document.getElementById('editCatName').value.trim();
  const kwStr=document.getElementById('editCatKeywords').value;
  const bg=document.getElementById('editCatBg').value;
  const color=document.getElementById('editCatColor').value;
  if(!name){showToast('Enter a category name','warn-t');return;}
  const keywords=kwStr.split(',').map(k=>k.trim()).filter(Boolean);
  if(!keywords.length){showToast('Enter at least one keyword','warn-t');return;}
  dispatch('CATEGORY_UPDATE',{idx,category:{...cats[idx],name,keywords,bg,color}});
  renderCatManagerList();
  // Re-select the same index in the dropdown after re-render
  const updSel=document.getElementById('editCatSelect');
  if(updSel){updSel.value=String(idx);loadCatForEdit();}
  showToast('✓ Category updated: '+name);
}

function updateCatPreview(){
  const bg=document.getElementById('newCatBg').value;
  const color=document.getElementById('newCatColor').value;
  const name=document.getElementById('newCatName').value.trim()||'Category';
  const p=document.getElementById('catColorPreview');
  if(p){p.style.background=bg;p.style.color=color;p.textContent=name;}
}
function addCustomCategory(){
  const name=document.getElementById('newCatName').value.trim();
  const kwStr=document.getElementById('newCatKeywords').value;
  const bg=document.getElementById('newCatBg').value;
  const color=document.getElementById('newCatColor').value;
  if(!name){showToast('Enter a category name','warn-t');return;}
  const keywords=kwStr.split(',').map(k=>k.trim()).filter(Boolean);
  if(!keywords.length){showToast('Enter at least one keyword','warn-t');return;}
  const id='cc'+Date.now();
  dispatch('CATEGORY_ADD',{category:{id,name,keywords,bg,color}});
  renderCatManagerList();
  document.getElementById('newCatName').value='';
  document.getElementById('newCatKeywords').value='';
  showToast('✓ Category added: '+name);
}

function delCustomCat(i){
  dispatch('CATEGORY_REMOVE',{idx:i});
  renderCatManagerList();showToast('Category removed');
}

function openEnvModal(cat){
  _envCat=cat;
  document.getElementById('envCatName').textContent='Category: '+cat;
  const inp=document.getElementById('envCapInput');
  inp.value=S.budgets[cat]||BDFT[cat]||500;
  // Escape cancels without saving
  inp._envKeyHandler=function(e){if(e.key==='Escape')closeEnvModal();};
  inp.removeEventListener('keydown',inp._envKeyHandler);
  inp.addEventListener('keydown',inp._envKeyHandler);
  document.getElementById('envModal').classList.add('open');
  trapFocus(document.getElementById('envModal'));
  setTimeout(()=>{inp.focus();inp.select();},120);
}
function closeEnvModal(){releaseTrap(document.getElementById('envModal'));
  document.getElementById('envModal').classList.remove('open');}
function saveEnvCap(){dispatch('BUDGET_SET',{cat:_envCat,val:storeCents(parseFloat(document.getElementById('envCapInput').value)||0)});renderEnvelopes();closeEnvModal();}
