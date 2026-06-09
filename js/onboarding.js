// === onboarding.js ===

// ══════════════════════════════════════════════
// ONBOARDING WIZARD
// ══════════════════════════════════════════════
let _obPin='', _obPinFirst='', _obPinPhase='enter'; // 'enter'|'confirm'|'passphrase'
let _obPinFinal=''; // holds confirmed PIN until passphrase is also saved
let _obIncome=[], _obExpenses=[], _obLoans=[], _obSavings=[];
let _obReceiptData=null;
let _obStoragePref = 'local';
const OB_TOTAL=9;

// ── PIN pad keyboard support ──────────────────────────────────────────────────
let _obPinKeyHandler=null;
function _attachObPinKeyboard(){
  if(_obPinKeyHandler) return;
  _obPinKeyHandler=function(e){
    const step6=document.getElementById('obStep6');
    if(!step6||step6.style.display==='none') return;
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if(/^[0-9]$/.test(e.key)){ e.preventDefault(); obPinKey(e.key); }
    else if(e.key==='Backspace'){ e.preventDefault(); obPinKey('del'); }
  };
  document.addEventListener('keydown',_obPinKeyHandler);
}
function _detachObPinKeyboard(){
  if(_obPinKeyHandler){ document.removeEventListener('keydown',_obPinKeyHandler); _obPinKeyHandler=null; }
}

function showOnboarding(){
  const sel=document.getElementById('obCurrency');
  sel.innerHTML=Object.keys(CURRENCY_MAP).map(code=>`<option value="${code}"${code==='USD'?' selected':''}>${code} — ${CURRENCY_MAP[code].symbol}</option>`).join('');
  _obIncome=[]; _obExpenses=[]; _obLoans=[]; _obSavings=[]; _obReceiptData=null;
  obRenderIncome(); obRenderExpenses(); obRenderLoans(); obRenderSavings();
  document.getElementById('obExpReceiptLabel').innerHTML=icon('camera')+' Tap to attach image';
  document.getElementById('obExpReceipt').value='';
  document.getElementById('obExpNote').value='';
  document.getElementById('obExpDue').value='';
  document.getElementById('obExpWeek').value='0';
  const freqEl=document.getElementById('obExpFreq');
  if(freqEl){freqEl.value='monthly';obFreqChange();}
  obGoTo(0);
  var _ov=document.getElementById('onboardOverlay');
  _ov.style.display='flex';
  document.body.style.overflow='hidden';
  if(typeof trapFocus==='function')trapFocus(_ov);
  setTimeout(()=>{const f=document.getElementById('obStep0').querySelector('button');if(f)f.focus();},120);
}

function obGoTo(step){
  for(let i=0;i<OB_TOTAL;i++){
    document.getElementById('obStep'+i).style.display='none';
    const dot=document.getElementById('obDot'+i);
    dot.classList.remove('active','done');
    if(i<step) dot.classList.add('done');
    else if(i===step) dot.classList.add('active');
  }
  document.getElementById('obStep'+step).style.display='block';
  // Keep aria-labelledby pointing at the visible step heading (audit A-02).
  var ov=document.getElementById('onboardOverlay');
  if(ov) ov.setAttribute('aria-labelledby','obStepHeading'+step);
  if(step===7) obRenderSyncStep();
  if(step===2||step===3||step===4||step===5) obSyncPrefixes();
  if(step===3){
    _obReceiptData=null;
    document.getElementById('obExpReceiptLabel').innerHTML=icon('camera')+' Tap to attach image';
    document.getElementById('obExpReceipt').value='';
  }
  if(step!==6) _detachObPinKeyboard();
  if(step===6){
    _attachObPinKeyboard();
    _obPin=''; _obPinFirst=''; _obPinPhase='enter'; _obPinFinal='';
    document.getElementById('obPinPhaseLabel').textContent='Enter a new PIN';
    document.getElementById('obPinErr').textContent='';
    // Show pin pad, hide passphrase section; restore back nav
    var obPinPad=document.getElementById('obPinPadSection');
    var obPassSec=document.getElementById('obPassphraseSection');
    var obNavBack=document.getElementById('obPinNavBack');
    if(obPinPad) obPinPad.style.display='';
    if(obPassSec) obPassSec.style.display='none';
    if(obNavBack) obNavBack.style.display='';
    var osp=document.getElementById('obPassphrase');
    var osp2=document.getElementById('obPassphrase2');
    if(osp) osp.value='';
    if(osp2) osp2.value='';
    obUpdatePinDots();
    // Sync the length toggle active state
    document.querySelectorAll('[data-action="setPinLen"]').forEach(function(btn){
      btn.classList.toggle('active',parseInt(btn.dataset.arg)===_pinLen);
    });
  }
  setTimeout(()=>{const f=document.querySelector('#obStep'+step+' input, #obStep'+step+' select, #obStep'+step+' button');if(f)f.focus();},80);
}

function obGetSym(){
  const code=document.getElementById('obCurrency').value;
  return (CURRENCY_MAP[code]&&CURRENCY_MAP[code].symbol)||'$';
}

function obSyncPrefixes(){
  const sym=obGetSym();
  ['obAmtPrefix','obExpPrefix','obLoanPrefix','obLoanMinPrefix','obSavPrefix','obSavBalPrefix','obSavContribPrefix'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.textContent=sym;
  });
}

function obUpdateAmtPrefix(){
  obSyncPrefixes();
}

// Auto-detect which week a due day falls in and pre-select it
function obDueDayChange(){
  const day=parseInt(document.getElementById('obExpDue').value);
  const freqEl=document.getElementById('obExpFreq');
  const freq=freqEl?freqEl.value:'monthly';
  if(freq==='monthly'&&day>=1&&day<=31){
    const wk=getWeekForDay(day,CMK);
    document.getElementById('obExpWeek').value=wk;
    const hint=document.getElementById('obWeekHint');
    if(hint)hint.textContent='→ auto Week '+(wk+1);
  }
}

// Show/hide week row and yearly-month row based on chosen frequency
function obFreqChange(){
  const freq=(document.getElementById('obExpFreq')||{}).value||'monthly';
  const weekRow=document.getElementById('obExpWeekRow');
  const yearlyRow=document.getElementById('obExpYearlyMonthRow');
  const hint=document.getElementById('obWeekHint');
  if(freq==='quarterly'||freq==='yearly'){
    if(weekRow)weekRow.style.display='none';
    if(yearlyRow)yearlyRow.style.display=freq==='yearly'?'':'none';
  } else {
    if(weekRow)weekRow.style.display='';
    if(yearlyRow)yearlyRow.style.display='none';
  }
  if(hint)hint.textContent='';
}

function obSaveIncome(){
  document.getElementById('obIncomeErr').textContent='';
  obGoTo(3);
}

// ── Income ──
function obAddIncome(){
  const nameEl=document.getElementById('obIncName');
  const amtEl=document.getElementById('obIncAmt');
  const errEl=document.getElementById('obIncomeErr');
  const name=nameEl.value.trim();
  const val=parseFloat(amtEl.value);
  errEl.textContent='';
  if(!name){errEl.textContent='Enter an income source name.';nameEl.focus();return;}
  if(isNaN(val)||val<=0){errEl.textContent='Enter a valid amount greater than 0.';amtEl.focus();return;}
  _obIncome.push({name,amount:Math.round(val*100)/100});
  nameEl.value=''; amtEl.value='';
  obRenderIncome();
  nameEl.focus();
}

function obRemoveIncome(i){
  _obIncome.splice(i,1);
  obRenderIncome();
}

function obRenderIncome(){
  const sym=obGetSym();
  const list=document.getElementById('obIncList');
  if(!list) return;
  if(!_obIncome.length){
    list.innerHTML='<div class="ob-empty-hint">No income sources added yet — use the form above</div>';
    list.classList.add('ob-list-empty');
    return;
  }
  list.classList.remove('ob-list-empty');
  list.innerHTML=_obIncome.map((e,i)=>`
    <div class="ob-item-row">
      <span class="ob-item-name">${e.name.replace(/</g,'&lt;')}</span>
      <span class="ob-item-amt">${sym}${e.amount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      <button class="ob-item-del" data-action="obRemoveIncome" data-arg="${i}" title="Remove" aria-label="Remove ${e.name.replace(/"/g,'')}">&times;</button>
    </div>`).join('');
}

// ── Expenses ──
function obHandleReceiptFile(input){
  const file=input.files[0];
  if(!file) return;
  if(file.size>204800){showToast('Image too large (max 200KB)','warn-t');input.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    _obReceiptData=e.target.result;
    document.getElementById('obExpReceiptLabel').textContent='✓ '+file.name;
  };
  reader.readAsDataURL(file);
}

function obAddExpense(){
  const nameEl=document.getElementById('obExpName');
  const amtEl=document.getElementById('obExpAmt');
  const errEl=document.getElementById('obExpErr');
  const name=nameEl.value.trim();
  const val=parseFloat(amtEl.value);
  errEl.textContent='';
  if(!name){errEl.textContent='Enter an expense name.';nameEl.focus();return;}
  if(isNaN(val)||val<=0){errEl.textContent='Enter a valid amount greater than 0.';amtEl.focus();return;}
  const freq=(document.getElementById('obExpFreq')||{}).value||'monthly';
  const week=parseInt(document.getElementById('obExpWeek').value)||0;
  const dueRaw=parseInt(document.getElementById('obExpDue').value);
  const dueDay=(dueRaw>=1&&dueRaw<=31)?dueRaw:null;
  const note=document.getElementById('obExpNote').value.trim();
  const yearlyMonth=parseInt((document.getElementById('obExpYearlyMonth')||{}).value)||0;
  _obExpenses.push({name,amount:Math.round(val*100)/100,week,dueDay,note,receipt:_obReceiptData,frequency:freq,yearlyMonth});
  nameEl.value=''; amtEl.value=''; document.getElementById('obExpNote').value='';
  document.getElementById('obExpDue').value=''; document.getElementById('obExpWeek').value='0';
  const freqEl=document.getElementById('obExpFreq');
  if(freqEl){freqEl.value='monthly';obFreqChange();}
  const hint=document.getElementById('obWeekHint');
  if(hint)hint.textContent='';
  document.getElementById('obExpReceiptLabel').innerHTML=icon('camera')+' Tap to attach image';
  document.getElementById('obExpReceipt').value=''; _obReceiptData=null;
  obRenderExpenses();
  nameEl.focus();
}

function obRemoveExpense(i){
  _obExpenses.splice(i,1);
  obRenderExpenses();
}

function obRenderExpenses(){
  const sym=obGetSym();
  const list=document.getElementById('obExpList');
  if(!list) return;
  if(!_obExpenses.length){
    list.innerHTML='<div class="ob-empty-hint">No expenses added yet — use the form above</div>';
    list.classList.add('ob-list-empty');
    return;
  }
  list.classList.remove('ob-list-empty');
  const freqBadge={monthly:'',weekly:icon('repeat')+' Weekly',biweekly:icon('repeat')+' Bi-wk',quarterly:icon('calendar')+' Qtly',yearly:icon('calendar')+' Yearly'};
  list.innerHTML=_obExpenses.map((e,i)=>{
    const freq=e.frequency||'monthly';
    const fb=freqBadge[freq]?` <span style="font-size:9px;background:var(--sage-light);color:var(--sage);padding:1px 4px;border-radius:3px;">${freqBadge[freq]}</span>`:'';
    const wkLabel=(freq==='monthly')?` <span style="font-size:10px;color:var(--text-muted);margin-right:4px;">Wk${e.week+1}</span>`:'';
    return`<div class="ob-item-row">
      <span class="ob-item-name">${e.name.replace(/</g,'&lt;')}${fb}${e.dueDay?` <span style="font-size:9px;color:var(--text-muted);">due ${e.dueDay}</span>`:''}${e.note?` <span style="font-size:9px;color:var(--text-muted);">${icon('note',{label:'Has note'})}</span>`:''}</span>
      ${wkLabel}
      <span class="ob-item-amt">${sym}${e.amount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}${e.receipt?` <span style="font-size:9px;">${icon('camera',{label:'Has receipt'})}</span>`:''}</span>
      <button class="ob-item-del" data-action="obRemoveExpense" data-arg="${i}" title="Remove" aria-label="Remove ${e.name.replace(/"/g,'')}">&times;</button>
    </div>`;
  }).join('');
}

// ── Savings ──
function obAddSaving(){
  const nameEl=document.getElementById('obSavName');
  const targetEl=document.getElementById('obSavTarget');
  const balEl=document.getElementById('obSavBal');
  const contribEl=document.getElementById('obSavContrib');
  const rateEl=document.getElementById('obSavRate');
  const errEl=document.getElementById('obSavErr');
  const name=nameEl.value.trim();
  const target=parseFloat(targetEl.value);
  errEl.textContent='';
  if(!name){errEl.textContent='Enter a goal name.';nameEl.focus();return;}
  if(isNaN(target)||target<=0){errEl.textContent='Enter a target amount greater than 0.';targetEl.focus();return;}
  const bal=parseFloat(balEl.value)||0;
  const contrib=parseFloat(contribEl.value)||0;
  const rate=parseFloat(rateEl.value)||0;
  _obSavings.push({name,target:Math.round(target*100)/100,balance:Math.round(bal*100)/100,contribution:Math.round(contrib*100)/100,rate:Math.round(rate*100)/100});
  nameEl.value=''; targetEl.value=''; balEl.value=''; contribEl.value=''; rateEl.value='';
  obRenderSavings();
  nameEl.focus();
}

function obRemoveSaving(i){
  _obSavings.splice(i,1);
  obRenderSavings();
}

function obRenderSavings(){
  const sym=obGetSym();
  const list=document.getElementById('obSavList');
  if(!list) return;
  if(!_obSavings.length){
    list.innerHTML='<div class="ob-empty-hint">No goals added yet — use the form above</div>';
    list.classList.add('ob-list-empty');
    return;
  }
  list.classList.remove('ob-list-empty');
  list.innerHTML=_obSavings.map((g,i)=>`
    <div class="ob-item-row">
      <span class="ob-item-name">${g.name.replace(/</g,'&lt;')}</span>
      <span class="ob-item-amt" style="font-size:10px;color:var(--text-muted);">${sym}${g.balance.toFixed(2)} / ${sym}${g.target.toFixed(2)}</span>
      <button class="ob-item-del" data-action="obRemoveSaving" data-arg="${i}" title="Remove" aria-label="Remove ${g.name.replace(/"/g,'')}">&times;</button>
    </div>`).join('');
}

// ── Loans ──
function obAddLoan(){
  const nameEl=document.getElementById('obLoanName');
  const balEl=document.getElementById('obLoanBal');
  const rateEl=document.getElementById('obLoanRate');
  const minEl=document.getElementById('obLoanMin');
  const errEl=document.getElementById('obLoanErr');
  const name=nameEl.value.trim();
  const bal=parseFloat(balEl.value);
  const rate=parseFloat(rateEl.value);
  const min=parseFloat(minEl.value);
  errEl.textContent='';
  if(!name){errEl.textContent='Enter a loan name.';nameEl.focus();return;}
  if(isNaN(bal)||bal<=0){errEl.textContent='Enter a valid balance.';balEl.focus();return;}
  if(isNaN(rate)||rate<0){errEl.textContent='Enter a valid interest rate (0 or higher).';rateEl.focus();return;}
  if(isNaN(min)||min<=0){errEl.textContent='Enter a valid minimum payment.';minEl.focus();return;}
  _obLoans.push({
    name,
    amount:Math.round(bal*100)/100,
    originalAmount:Math.round(bal*100)/100,
    rate:Math.round(rate*100)/100,
    minPayment:Math.round(min*100)/100,
    payments:[]
  });
  nameEl.value=''; balEl.value=''; rateEl.value=''; minEl.value='';
  obRenderLoans();
  nameEl.focus();
}

function obRemoveLoan(i){
  _obLoans.splice(i,1);
  obRenderLoans();
}

function obRenderLoans(){
  const sym=obGetSym();
  const list=document.getElementById('obLoanList');
  if(!list) return;
  if(!_obLoans.length){
    list.innerHTML='<div class="ob-empty-hint">No loans added yet — use the form above</div>';
    list.classList.add('ob-list-empty');
    return;
  }
  list.classList.remove('ob-list-empty');
  list.innerHTML=_obLoans.map((l,i)=>`
    <div class="ob-item-row">
      <span class="ob-item-name">${l.name.replace(/</g,'&lt;')}</span>
      <span class="ob-item-amt">${sym}${l.amount.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})} &bull; ${l.rate}% &bull; min ${sym}${l.minPayment}</span>
      <button class="ob-item-del" data-action="obRemoveLoan" data-arg="${i}" title="Remove" aria-label="Remove ${l.name.replace(/"/g,'')}">&times;</button>
    </div>`).join('');
}

// ── PIN ──
function obPinKey(key){
  if(_obPinPhase==='passphrase') return; // numpad inactive in passphrase phase
  const err=document.getElementById('obPinErr');
  err.textContent='';
  if(key==='del'){_obPin=_obPin.slice(0,-1);obUpdatePinDots();return;}
  if(_obPin.length>=_pinLen) return;
  _obPin+=key;
  obUpdatePinDots();
  if(_obPin.length===_pinLen){
    if(_obPinPhase==='enter'){
      _obPinFirst=_obPin; _obPin=''; _obPinPhase='confirm';
      document.getElementById('obPinPhaseLabel').textContent='Confirm your PIN';
      obUpdatePinDots();
    } else {
      if(_obPin===_obPinFirst){
        // PIN confirmed — switch to recovery passphrase phase
        _obPinFinal=_obPin;
        _obPin=''; _obPinPhase='passphrase';
        var obPinPad=document.getElementById('obPinPadSection');
        var obPassSec=document.getElementById('obPassphraseSection');
        var obNavBack=document.getElementById('obPinNavBack');
        if(obPinPad) obPinPad.style.display='none';
        if(obNavBack) obNavBack.style.display='none';
        if(obPassSec){
          obPassSec.style.display='';
          var inp=obPassSec.querySelector('#obPassphrase');
          if(inp) setTimeout(function(){inp.focus();},80);
        }
        err.textContent='';
      } else {
        err.textContent="PINs don't match — try again";
        _obPin=''; _obPinFirst=''; _obPinPhase='enter';
        document.getElementById('obPinPhaseLabel').textContent='Enter a new PIN';
        obUpdatePinDots();
      }
    }
  }
}

function obUpdatePinDots(){
  for(var i=0;i<6;i++){
    var d=document.getElementById('opd'+i);
    if(!d) continue;
    d.style.display=i<_pinLen?'':'none';
    d.classList.toggle('filled',i<_obPin.length);
  }
  var s=document.getElementById('obPinStatus');
  if(s) s.textContent=_obPin.length===_pinLen?'PIN complete':_obPin.length+' of '+_pinLen+' digits entered';
}

async function obSubmitPassphrase(){
  var pass=(document.getElementById('obPassphrase').value||'').trim();
  var pass2=(document.getElementById('obPassphrase2').value||'').trim();
  var err=document.getElementById('obPinErr');
  err.textContent='';
  if(pass.length<8){err.textContent='Passphrase must be at least 8 characters';return;}
  if(pass!==pass2){err.textContent='Passphrases do not match';document.getElementById('obPassphrase2').value='';document.getElementById('obPassphrase2').focus();return;}
  // Save PIN + passphrase using the shared _doFinalPinSetup from state.js
  await _doFinalPinSetup(_obPinFinal, pass);
  obGoTo(7);
}

// ── Finish ──
function obFinish(){
  // Name
  const name=(document.getElementById('obName').value||'').trim();
  if(name) S.userName=name;

  // Currency
  const code=document.getElementById('obCurrency').value;
  if(CURRENCY_MAP[code]) S.currency={symbol:CURRENCY_MAP[code].symbol,code,locale:CURRENCY_MAP[code].locale};

  // Always replace income — use user entries or empty list (clears demo)
  const md=S.months[CMK];
  if(md){
    md.revenue=_obIncome.map(e=>({name:e.name,amount:e.amount,received:true}));
  }

  // Always replace expenses — use user entries or empty (clears demo)
  if(md){
    md.weeks.forEach(w=>{w.items=[];});
    if(!S.scheduledExpenses)S.scheduledExpenses=[];
    _obExpenses.forEach(e=>{
      const freq=e.frequency||'monthly';
      if(freq==='quarterly'||freq==='yearly'){
        // Store as a scheduled template — auto-expands into qualifying months
        const se={
          id:'se'+Date.now()+Math.random().toString(36).slice(2),
          name:e.name,amount:e.amount,frequency:freq,
          dueDay:e.dueDay||null,note:e.note||'',
          week:e.week||0,yearMonth:e.yearlyMonth||0
        };
        S.scheduledExpenses.push(se);
        // Also inject into current month right away if it qualifies
        expandScheduledExpenses(CMK);
      } else if(freq==='weekly'){
        // Add one item per week (all 4)
        md.weeks.forEach(w=>{
          w.items.push({name:e.name,amount:e.amount,paid:false,dueDay:e.dueDay||null,note:e.note||'',receipt:e.receipt||null,frequency:'weekly'});
        });
      } else if(freq==='biweekly'){
        // Add to Week 1 and Week 3 (indices 0 and 2)
        [0,2].forEach(wi=>{
          if(md.weeks[wi])md.weeks[wi].items.push({name:e.name,amount:e.amount,paid:false,dueDay:e.dueDay||null,note:e.note||'',receipt:e.receipt||null,frequency:'biweekly'});
        });
      } else {
        // Monthly — place in the chosen week
        const wk=Math.min(3,Math.max(0,e.week||0));
        md.weeks[wk].items.push({name:e.name,amount:e.amount,paid:false,dueDay:e.dueDay||null,note:e.note||'',receipt:e.receipt||null,frequency:'monthly'});
      }
    });
  }

  // Always replace loans — use user entries or empty (clears demo)
  S.loans=_obLoans.map(l=>Object.assign({},l));

  // Always replace savings — use user entries or empty (clears demo)
  S.savings=_obSavings.map(g=>Object.assign({},g));

  S.activeBackend = _obStoragePref === 'local' ? null : _obStoragePref;
  if(typeof normaliseState==='function')normaliseState();
  persist();
  localStorage.setItem('finflow_onboarded','1');
  document.getElementById('demoBanner').style.display='none';

  // Update loan badge
  document.getElementById('loanBadge').textContent=S.loans.length;

  // Update PIN lock button
  getPinHash().then(h=>{const btn=document.getElementById('pinBtn');if(btn) btn.innerHTML=h?icon('unlock',{label:'Lock app'}):icon('lock',{label:'Unlock app'});});

  var _obOv=document.getElementById('onboardOverlay');
  if(typeof releaseTrap==='function')releaseTrap(_obOv);
  _obOv.style.display='none';
  document.body.style.overflow='';

  if (_obStoragePref === 'local') {
    if (typeof window.linkLocalFile === 'function') window.linkLocalFile();
  } else {
    const _obLabel = _obStoragePref === 'gdrive' ? 'Google Drive' : 'Firebase';
    if (typeof showToast === 'function') showToast('Go to Settings to connect your ' + _obLabel + ' sync.');
  }

  renderDash();
  updateHealth();
  const greeting=name?'Welcome, '+name+'!':'Welcome to Financial Win!';
  const extras=[];
  if(_obIncome.length) extras.push(_obIncome.length+' income source'+(_obIncome.length>1?'s':''));
  if(_obExpenses.length) extras.push(_obExpenses.length+' expense'+(_obExpenses.length>1?'s':''));
  if(_obLoans.length) extras.push(_obLoans.length+' loan'+(_obLoans.length>1?'s':''));
  if(_obSavings.length) extras.push(_obSavings.length+' savings goal'+(_obSavings.length>1?'s':''));
  const detail=extras.length?' ('+extras.join(', ')+' added)':'';
  showToast(greeting+' Dashboard ready'+detail+'.');

  // Fire the onboarding tour after a short delay so the dashboard is visible
  setTimeout(function(){if(typeof startTour==='function')startTour();},800);
}

// ── Step 1 currency gate ──────────────────────────────────────────────────────

function obAdvanceStep1() {
  const sel = document.getElementById('obCurrency');
  const err = document.getElementById('obCurrencyErr');
  if (err) err.textContent = '';
  const val = sel ? (sel.value || '').trim() : '';
  if (!val) {
    if (err) err.textContent = 'Please select a currency to continue.';
    else if (sel) sel.focus();
    return;
  }
  obGoTo(2);
}

// ── Sync step (Step 7) helpers ──────────────────────────────────────────────

var _OB_CARD_MAP = { local: 'obLocalCard', gdrive: 'obDriveCard', firebase: 'obFirebaseCard' };

function obSelectStorage(pref) {
  _obStoragePref = pref;
  ['obLocalCard', 'obDriveCard', 'obFirebaseCard'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('ob-sync-active');
    const badge = el && el.querySelector('.ob-sync-badge');
    if (badge) badge.style.display = 'none';
  });
  const activeId = _OB_CARD_MAP[pref];
  const active = activeId ? document.getElementById(activeId) : null;
  if (active) {
    active.classList.add('ob-sync-active');
    const badge = active.querySelector('.ob-sync-badge');
    if (badge) badge.style.display = 'inline';
  }
}

function obAdvanceStep2(){
  var err=document.getElementById('obSyncErr');
  if(err) err.textContent='';
  if(_obStoragePref!=='local'){
    if(err) err.textContent='Please select Local File to continue. Cloud sync can be configured in Settings after setup.';
    return;
  }
  obGoTo(8);
}

function obRenderSyncStep() {
  const err = document.getElementById('obSyncErr');
  if (err) err.textContent = '';
  obSelectStorage('local'); // always default to local — required during onboarding
  // Cloud sync cards are disabled during onboarding; configure in Settings later
  ['obDriveCard','obFirebaseCard'].forEach(function(id){
    var el=document.getElementById(id);
    if(!el) return;
    el.style.opacity='0.45';
    el.style.pointerEvents='none';
    el.title='Available in Settings after setup';
  });
}

function obToggleTip(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ── Demo-profiles lazy loader ─────────────────────────────────────────────────
// demo-profiles.js is ~50 KB of sample data never needed by non-demo users.
// We load it dynamically on first request so it doesn't bloat the initial parse.
let _demoScriptLoaded = false;
let _demoScriptPending = null;

function _ensureDemoProfiles() {
  if (_demoScriptLoaded) return Promise.resolve();
  if (_demoScriptPending) return _demoScriptPending;
  _demoScriptPending = new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = 'js/demo-profiles.js';
    s.onload = function() { _demoScriptLoaded = true; resolve(); };
    s.onerror = function() { reject(new Error('Failed to load demo profiles')); };
    document.head.appendChild(s);
  });
  return _demoScriptPending;
}

// Stub wrappers — replaced by the real function declarations after the script loads.
// Named function expressions allow self-reference comparison to detect replacement.
window.obLoadDemoAndClose = async function _stubObLoadDemoAndClose() {
  try { await _ensureDemoProfiles(); } catch(e) {
    if (typeof showToast === 'function') showToast('Failed to load demo data', 'err-t');
    return;
  }
  if (window.obLoadDemoAndClose !== _stubObLoadDemoAndClose) window.obLoadDemoAndClose();
};
window.loadSelectedDemoProfile = async function _stubLoadSelectedDemoProfile() {
  try { await _ensureDemoProfiles(); } catch(e) {
    if (typeof showToast === 'function') showToast('Failed to load demo data', 'err-t');
    return;
  }
  if (window.loadSelectedDemoProfile !== _stubLoadSelectedDemoProfile) window.loadSelectedDemoProfile();
};
window.clearDemoData = async function _stubClearDemoData() {
  try { await _ensureDemoProfiles(); } catch(e) {
    if (typeof showToast === 'function') showToast('Failed to load demo data', 'err-t');
    return;
  }
  if (window.clearDemoData !== _stubClearDemoData) window.clearDemoData();
};
