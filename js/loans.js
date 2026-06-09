// === loans.js ===

// Tracks which loan cards have the full history expanded
const _expandedLoans = new Set();

// Max paid chips to keep visible in collapsed view
const LOAN_WINDOW_PAID = 12;
// Auto-archive threshold: once paid chips in the array exceed this, oldest get archived
const LOAN_ARCHIVE_THRESHOLD = 24;

function toggleLoanHistory(li) {
  if (_expandedLoans.has(li)) _expandedLoans.delete(li);
  else _expandedLoans.add(li);
  renderLoans();
}

function _buildChipHTML(p, pi, oi) {
  const isNew = _newChipMonths && _newChipMonths.has(p.month);
  return `<div class="pchip ${p.paid?'paid':'pending'}${isNew?' chip-new':''}" data-action="toggleLP" data-arg="${oi}" data-arg2="${pi}" title="${p.paid?'Click to mark unpaid — restores estimated balance':'Click to mark paid — reduces balance by principal portion'}">${p.paid?icon('check'):icon('circle')} ${esc(p.month)}${isNew?' '+icon('star',{label:'New'}):''}</div>`;
}

function _buildChipsSection(loan, oi) {
  const archived = loan.archivedPaidCount || 0;
  const isExpanded = _expandedLoans.has(oi);
  const paidIdxs   = loan.payments.map((p,pi) => p.paid  ? pi : -1).filter(i => i >= 0);
  const unpaidIdxs = loan.payments.map((p,pi) => !p.paid ? pi : -1).filter(i => i >= 0);

  let chipsHTML;
  if (isExpanded) {
    chipsHTML = loan.payments.map((p,pi) => _buildChipHTML(p,pi,oi)).join('');
  } else {
    const visiblePaidIdxs = paidIdxs.slice(-LOAN_WINDOW_PAID);
    const hiddenInArray   = paidIdxs.length - visiblePaidIdxs.length;
    const totalHidden     = archived + hiddenInArray;
    const summaryChip     = totalHidden > 0
      ? `<div class="pchip paid pchip-archive" title="${totalHidden} older paid payment${totalHidden>1?'s':''} — click History to expand">${icon('check')} ${totalHidden} earlier payment${totalHidden>1?'s':''}</div>`
      : '';
    chipsHTML = summaryChip
      + visiblePaidIdxs.map(pi => _buildChipHTML(loan.payments[pi], pi, oi)).join('')
      + unpaidIdxs.map(pi     => _buildChipHTML(loan.payments[pi], pi, oi)).join('');
  }

  const totalChips = loan.payments.length + archived;
  const hasHistory = totalChips > LOAN_WINDOW_PAID || archived > 0;
  const toggleBtn  = hasHistory
    ? `<button class="tbtn" style="font-size:10px;padding:2px 8px;margin-left:4px;" data-action="toggleLoanHistory" data-arg="${oi}">${isExpanded ? '▲ Less' : `▼ All ${totalChips}`}</button>`
    : '';

  return { chipsHTML, toggleBtn };
}

function renderLoans(){
  const sorted=S.loans.map((loan,oi)=>({loan,oi}));
  if(S.strategy==='avalanche')sorted.sort((a,b)=>b.loan.rate-a.loan.rate);else sorted.sort((a,b)=>a.loan.amount-b.loan.amount);
  // Strategy tip
  document.getElementById('strategyTip').innerHTML=S.strategy==='avalanche'
    ?`<span>${icon('lightning',{label:'Avalanche strategy'})}</span><div><strong>Avalanche strategy active</strong> — Sorted highest interest first. Pay minimums on all, throw every extra dollar at #1. Saves the most interest overall.</div>`
    :`<span>${icon('snowball',{label:'Snowball strategy'})}</span><div><strong>Snowball strategy active</strong> — Sorted smallest balance first. Pay off #1 completely, then roll that freed payment into #2. Builds momentum.</div>`;
  const list=document.getElementById('loanList');list.innerHTML='';
  if(!sorted.length){list.innerHTML='<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;border:2px dashed var(--border);border-radius:var(--radius);">No loans added yet.<br><button class="nm-btn" style="margin-top:10px" data-action="openLoanModal" data-arg="-1">+ Add your first loan</button></div>';document.getElementById('loan-total').textContent='$0';document.getElementById('loan-pmts').textContent='$0';document.getElementById('loan-int').textContent='$0';document.getElementById('loan-free').textContent='—';return;}
  // Debt-free banner when all loans have zero balance
  if(sorted.every(l=>l.loan.amount<=0)){
    const dfBanner=document.createElement('div');
    dfBanner.className='debt-free-card';
    dfBanner.innerHTML='<span class="df-icon">🎉</span><div class="df-title">You\'re Debt-Free!</div><div class="df-sub">All loan balances are at $0. Incredible achievement — keep it up!</div>';
    list.appendChild(dfBanner);
  }
  sorted.forEach(({loan,oi},si)=>{
    const oa=loan.originalAmount||loan.amount;
    const pdPct=Math.min(100,Math.max(4,((oa-loan.amount)/oa)*100));
    const ml=calcMTP(amt(loan.amount),loan.rate,amt(loan.minPayment));
    const isTop=si===0;
    const {chipsHTML,toggleBtn}=_buildChipsSection(loan,oi);
    const totalPaid=(loan.payments.filter(p=>p.paid).length)+(loan.archivedPaidCount||0);
    const totalChipsCount=loan.payments.length+(loan.archivedPaidCount||0);
    const isPaidOff=loan.amount<=0;
    // payoff text — if Never, show minimum payment needed
    let payoffText;
    if(ml>=999){
      const minNeeded=calcMinNeededPayment(amt(loan.amount),loan.rate);
      payoffText=`<span style="color:var(--danger);">${icon('warning',{label:'Warning'})} Needs ${fmt(minNeeded)}/mo to pay off</span>`;
    } else {
      payoffText=`<span style="color:var(--sage);">Payoff: ${getPayoffDate(ml)}</span>`;
    }
    // Per-loan payment status for current month (no goal required)
    const thisMonthPmt=loan.payments.find(p=>p.month===CMK);
    let pmtStatusBadge='';
    if(!isPaidOff){
      if(thisMonthPmt&&thisMonthPmt.paid){
        pmtStatusBadge=`<span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:8px;background:var(--success-light);color:var(--success);">${icon('check')} Paid this month</span>`;
      } else if(thisMonthPmt){
        pmtStatusBadge=`<span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:8px;background:var(--amber-light);color:var(--amber);">${icon('hourglass')} Due this month</span>`;
      }
    }
    // Linked payoff goal
    const linkedGoal=(S.financialGoals||[]).find(g=>g.type==='payoff'&&g.linkedLoan===oi);
    let goalBadge='';
    if(linkedGoal&&linkedGoal.targetDate&&!isPaidOff){
      const [dlYr,dlMo]=linkedGoal.targetDate.split('-').map(Number);
      const dlDate=new Date(dlYr,dlMo-1,1);
      const projDate=ml<999?new Date(...(()=>{const p=CMK.split(' ');let mo=MS.indexOf(p[0]),yr=parseInt(p[1]);mo+=ml;yr+=Math.floor(mo/12);mo=mo%12;return[yr,mo,1];})()) :null;
      const onTrack=projDate&&projDate<=dlDate;
      goalBadge=`<span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:8px;background:${onTrack?'var(--success-light)':'var(--danger-light)'};color:${onTrack?'var(--success)':'var(--danger)'};">Goal: ${onTrack?icon('check')+' On track':icon('warning',{label:'Behind'})+' Behind'} target ${linkedGoal.targetDate}</span>`;
    } else if(linkedGoal&&!isPaidOff){
      goalBadge=`<span style="font-size:10px;color:var(--text-muted);background:var(--slate-mid);padding:1px 6px;border-radius:8px;">🎯 ${esc(linkedGoal.name)}</span>`;
    }
    const div=document.createElement('div');div.className='debt-item'+(isPaidOff?' loan-paid-off':'');
    if(isTop)div.style.borderLeft='3px solid '+(S.strategy==='avalanche'?'var(--danger)':'var(--blue)');
    div.innerHTML=`
      <div class="debt-item-hdr">
        <div><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px;">
          <span class="debt-name" style="${isPaidOff?'text-decoration:line-through;color:var(--success);opacity:.8;':''}">${esc(loan.name)}</span>
          ${isPaidOff?`<span class="loan-paid-badge">${icon('trophy',{label:'Paid Off'})} Paid Off!</span>`:''}
          ${isTop?`<span class="focus-lbl ${S.strategy==='avalanche'?'focus-av':'focus-sn'}">${S.strategy==='avalanche'?icon('lightning')+' Highest rate':icon('snowball')+' Smallest bal'}</span>`:''}
          ${pmtStatusBadge}
          ${goalBadge}
          <span style="font-size:10px;color:var(--text-muted);">#${si+1}</span>
        </div>
        <div class="debt-meta"><span>◆ ${loan.rate}% APR</span><span>◆ Min ${fmt(amt(loan.minPayment))}/mo</span><span>◆ ${totalPaid}/${totalChipsCount} paid</span></div>
        </div>
        <div style="text-align:right;">
          <div class="bal-edit-wrap" style="justify-content:flex-end;margin-bottom:2px;">
            <div class="debt-bal" id="bal-disp-${oi}">${typeof fmtItemAmount==='function'?fmtItemAmount(amt(loan.amount),loan.currency):fmt(amt(loan.amount))}</div>
            <button class="bal-edit-btn" data-action="startEditBal" data-arg="${oi}" title="Edit balance" aria-label="Edit balance">${icon('edit',{label:'Edit balance'})}</button>
          </div>
          <div style="font-size:11px;font-weight:600;">${payoffText}</div>
        </div>
      </div>
      <div style="margin-bottom:4px;">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:2px;"><span>Paid ${fmt(amt(oa)-amt(loan.amount))} of ${fmt(amt(oa))}</span><span>${pdPct.toFixed(0)}%</span></div>
        <div class="pbar" style="height:7px;"><div class="pfill ${loan.rate>15?'pf-danger':loan.rate>10?'pf-amber':'pf-sage'}" style="width:${pdPct}%;"></div></div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin:7px 0 4px;">
        <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">Payment History</span>
        ${toggleBtn}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">${chipsHTML}</div>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;" class="no-print">
        <button class="nm-btn" style="font-size:11px;padding:4px 10px;" data-action="openLoanModal" data-arg="${oi}">${icon('edit')} Edit Loan</button>
        <button class="tbtn" style="font-size:11px;padding:4px 9px;" data-action="addLP" data-arg="${oi}" title="Manually add a payment chip for the current month">+ Log Month</button>
        <button class="tbtn" style="font-size:11px;padding:4px 9px;color:var(--sage);border-color:var(--sage);" data-action="useInCalc" data-arg="${oi}" title="Load this loan into the Paydown Calculator">⊕ Calculator</button>
        <button class="tbtn" style="font-size:11px;padding:4px 9px;color:var(--blue);border-color:var(--blue-mid);" data-action="generatePaySchedule" data-arg="${oi}" title="Pre-fill 12 monthly payment chips from today — mark each paid as you go">${icon('calendar')} Generate Schedule</button>
      </div>`;
    list.appendChild(div);
  });
  document.getElementById('loan-total').textContent=fmt(totalDebt());
  document.getElementById('loan-pmts').textContent=fmt(minPmts());
  const ti=S.loans.reduce((s,l)=>{const m=calcMTP(amt(l.amount),l.rate,amt(l.minPayment));return m>=999?s:s+Math.max(0,amt(l.minPayment)*m-amt(l.amount));},0);
  document.getElementById('loan-int').textContent=fmt(Math.max(0,ti));
  const mm=S.loans.reduce((mx,l)=>Math.max(mx,calcMTP(amt(l.amount),l.rate,amt(l.minPayment))),0);
  document.getElementById('loan-free').textContent=getPayoffDate(mm);
  document.getElementById('loanBadge').textContent=S.loans.length;
  const sel=document.getElementById('calcSel');const cv=sel.value;
  sel.innerHTML='<option value="custom">Custom</option>';
  S.loans.forEach((l,i)=>{sel.innerHTML+=`<option value="${i}">${esc(l.name)}</option>`;});
  // Restore previous selection only if it still exists; otherwise fall back to custom
  if(cv==='custom'||S.loans[parseInt(cv)]){sel.value=cv;}else{sel.value='custom';}
  renderPaydownChart();runCalc();updateBonus(document.getElementById('bonusSlider').value);
}
function calcMTP(bal,ar,mp){const r=ar/100/12;if(r===0)return Math.ceil(bal/mp);if(mp<=bal*r+0.01)return 999;return Math.ceil(-Math.log(1-(bal*r)/mp)/Math.log(1+r));}
function getPayoffDate(months){
  if(months>=999)return'Never — increase pmt';
  const p=CMK.split(' ');let mo=MS.indexOf(p[0]),yr=parseInt(p[1]);
  mo+=months;yr+=Math.floor(mo/12);mo=mo%12;return MS[mo]+' '+yr;
}
function calcMinNeededPayment(bal,ar){
  // Returns the minimum payment needed to make any principal progress
  const r=ar/100/12;
  return Math.ceil((bal*r+0.01)*100)/100;
}
function toggleLP(li,pi){
  const loan=S.loans[li];
  const pmt=loan.payments[pi];
  const wasUnpaid=!pmt.paid;
  const prevAmount=loan.amount;
  // Show breakdown before marking paid
  if(wasUnpaid&&loan.amount>0){
    const r=loan.rate/100/12;
    const intCharge=Math.round(amt(loan.amount)*r*100)/100;
    const principalPaid=Math.max(0,Math.round((amt(loan.minPayment)-intCharge)*100)/100);
    if(principalPaid>0)showToast(`${esc(loan.name)}: ${fmt(principalPaid)} principal + ${fmt(intCharge)} interest`);
  }
  pmt.paid=!pmt.paid;
  // Auto-reduce balance when marking paid
  if(wasUnpaid&&loan.amount>0){
    const r=loan.rate/100/12;
    const intCharge=Math.round(loan.amount*r*100)/100;
    const principalPaid=Math.max(0,Math.round((loan.minPayment-intCharge)*100)/100);
    loan.amount=Math.max(0,Math.round((loan.amount-principalPaid)*100)/100);
    // Auto-archive oldest paid chips once threshold exceeded
    const paidInArray=loan.payments.filter(p=>p.paid);
    if(paidInArray.length>LOAN_ARCHIVE_THRESHOLD){
      const toArchive=paidInArray.length-LOAN_ARCHIVE_THRESHOLD;
      let removed=0;
      loan.payments=loan.payments.filter(p=>{
        if(!p.paid||removed>=toArchive)return true;
        removed++;return false;
      });
      loan.archivedPaidCount=(loan.archivedPaidCount||0)+toArchive;
    }
  }
  // Undo: restore balance estimate when un-marking
  if(!wasUnpaid&&loan.originalAmount){
    const paidCount=loan.payments.filter(p=>p.paid).length+(loan.archivedPaidCount||0);
    let bal=loan.originalAmount;
    const r2=loan.rate/100/12;
    for(let m=0;m<paidCount;m++){
      if(bal<=0)break;
      const ic=bal*r2;
      const pc=Math.max(0,loan.minPayment-ic);
      bal=Math.max(0,Math.round((bal-pc)*100)/100);
    }
    loan.amount=bal;
  }
  persist();renderLoans();updateHealth();

  if(wasUnpaid){
    // Small burst from the chip + flash animation via JS (not CSS class, avoids re-firing on every render)
    const chips=document.querySelectorAll('.pchip.paid');
    if(chips.length){
      const lastChip=chips[chips.length-1];
      lastChip.classList.add('chip-flash');
      setTimeout(()=>lastChip.classList.remove('chip-flash'),300);
      launchConfettiFromEl(lastChip,18);
    }
    // Loan fully paid off (balance hit 0)?
    if(loan.amount<=0&&prevAmount>0){
      celebrateLoanPaidOff(loan.name);
      checkAllLoansDebtFree();
      if(typeof checkAchievements==='function') checkAchievements('debt_slayer','debt_free');
    }
    // All chips for this loan are paid?
    else if(loan.payments.length>0&&loan.payments.every(p=>p.paid)){
      setTimeout(()=>{launchConfetti(70);showToast('🎉 All payments logged for '+esc(loan.name)+'!');},200);
    }
    if(typeof awardXP==='function') awardXP('loan_payment');
  }
}
function startEditBal(li){
  const disp=document.getElementById('bal-disp-'+li);
  if(!disp)return;
  const cur=amt(S.loans[li].amount);
  const inp=document.createElement('input');
  inp.className='bal-edit-input';inp.id='bal-inp-'+li;inp.type='number';inp.value=cur;
  inp.addEventListener('blur',function(){saveEditBal(this,li);});
  inp.addEventListener('keydown',function(e){
    if(e.key==='Enter')this.blur();
    if(e.key==='Escape'){this.value=cur;this.blur();}
  });
  disp.replaceWith(inp);
  setTimeout(()=>{inp.select();inp.focus();},30);
}
function saveEditBal(inp,li){
  if(!inp||!document.getElementById('bal-inp-'+li))return; // already removed from DOM
  const v=parseFloat(inp.value);
  if(!isNaN(v)&&v>=0) dispatch('LOAN_SET_BALANCE',{li,val:storeCents(v)});
  const justPaidOff=(!isNaN(v)&&v===0&&S.loans[li]&&(S.loans[li].originalAmount||0)>0);
  renderLoans();updateHealth();
  if(justPaidOff){celebrateLoanPaidOff(S.loans[li].name);checkAllLoansDebtFree();}
  else showToast('✓ Balance updated');
}
function addLP(li){
  const loan=S.loans[li];
  if(!loan)return;
  // Find the next month starting from CMK that doesn't already have a chip
  const parts=CMK.split(' ');
  let mo=MS.indexOf(parts[0]),yr=parseInt(parts[1]);
  let target=null;
  for(let i=0;i<120;i++){
    const key=mk(mo,yr);
    if(!loan.payments.find(p=>p.month===key)){target=key;break;}
    mo++;if(mo>11){mo=0;yr++;}
  }
  if(!target){showToast('All months already logged','warn-t');return;}
  if(target!==CMK){
    const added=target;
    showToast('Current month already logged — added '+added);
  }
  dispatch('LOAN_ADD_PAYMENT',{li,payment:{month:target,paid:false}});
  renderLoans();
}
function addLoan(){if(typeof requirePlan==='function'&&!requirePlan('pro','Loan Payoff Calculator'))return;openLoanModal(-1);}
function setStrategy(s){
  dispatch('LOAN_STRATEGY',{strategy:s});
  document.getElementById('btn-avalanche').classList.toggle('active',s==='avalanche');
  document.getElementById('btn-snowball').classList.toggle('active',s==='snowball');
  renderLoans();
}
let _newChipMonths=new Set();
function generatePaySchedule(li){
  const loan=S.loans[li];
  const parts=CMK.split(' ');let mo=MS.indexOf(parts[0]),yr=parseInt(parts[1]);
  const monthsToAdd=[];
  _newChipMonths=new Set();
  for(let i=0;i<12;i++){
    const key=mk(mo,yr);
    if(!loan.payments.find(p=>p.month===key)){
      monthsToAdd.push(key);
      _newChipMonths.add(key);
    }
    mo++;if(mo>11){mo=0;yr++;}
  }
  if(monthsToAdd.length>0){
    dispatch('LOAN_GENERATE_SCHEDULE',{loanIdx:li,months:monthsToAdd},false);
    renderLoans();
    showToast('✓ Added '+monthsToAdd.length+' payment chip'+(monthsToAdd.length>1?'s':'')+' for '+esc(loan.name)+' — new ones are highlighted');
    setTimeout(()=>{_newChipMonths=new Set();renderLoans();},4000);
  } else showToast('All 12 months already logged','warn-t');
}
function useInCalc(i){
  document.getElementById('calcSel').value=i;
  calcFromLoan();
  const calcCard=document.getElementById('calcSel').closest('.card');
  if(calcCard)calcCard.scrollIntoView({behavior:'smooth',block:'start'});
}
function calcFromLoan(){
  const v=document.getElementById('calcSel').value;
  if(v==='custom'){
    ['calcP','calcR','calcMin','calcT','calcE'].forEach(id=>{document.getElementById(id).value='';});
    runCalc();return;
  }
  const l=S.loans[parseInt(v)];
  if(!l){document.getElementById('calcSel').value='custom';calcFromLoan();return;}
  document.getElementById('calcP').value=amt(l.amount);
  document.getElementById('calcR').value=l.rate;
  document.getElementById('calcMin').value=amt(l.minPayment);
  document.getElementById('calcT').value='';
  document.getElementById('calcE').value='';
  runCalc();
}
function runCalc(){
  const P=parseFloat(document.getElementById('calcP').value)||0;
  const ar=parseFloat(document.getElementById('calcR').value)||0;
  const mp=parseFloat(document.getElementById('calcMin').value)||0;
  const ex=parseFloat(document.getElementById('calcE').value)||0;
  let tgt=parseInt(document.getElementById('calcT').value)||36;
  if(document.getElementById('calcPT').value==='years')tgt*=12;
  const r=ar/100/12;
  let rp=r===0?P/tgt:P*(r*Math.pow(1+r,tgt))/(Math.pow(1+r,tgt)-1);
  rp=Math.max(rp,mp)+ex;
  let bal=P,tp=0,ti=0;const rows=[];
  for(let m=1;m<=600&&bal>0.005;m++){const ic=bal*r;const ap=Math.min(rp,bal+ic);const pc=ap-ic;bal=Math.max(0,bal-pc);tp+=ap;ti+=ic;rows.push({m,pmt:ap,prin:pc,int:ic,bal});}
  let mB=P,mT=0;for(let m=1;m<=600&&mB>0.005;m++){const ic=mB*r;const p2=Math.max(mp,mB+ic);mB=Math.max(0,mB-(p2-ic));mT+=p2;}
  const sv=Math.max(0,mT-tp);
  document.getElementById('calcMonthly').textContent=fmt(rp);document.getElementById('calcTotal').textContent=fmt(tp);
  document.getElementById('calcInterest').textContent=fmt(ti);document.getElementById('calcSaved').textContent='+'+fmt(sv);
  document.getElementById('calcDate').textContent=getPayoffDate(rows.length);
  const ip=tp>0?ti/tp*100:0;
  document.getElementById('intBar').style.width=ip.toFixed(1)+'%';
  document.getElementById('intLbl').textContent=ip.toFixed(1)+'% interest';
  document.getElementById('prinLbl').textContent=(100-ip).toFixed(1)+'% principal';
  document.getElementById('amortBody').innerHTML=rows.map((row,idx)=>`<tr class="${idx===rows.length-1?'payoff-row':''}"><td style="font-family:'Instrument Serif',serif;">${row.m}</td><td style="font-family:'Instrument Serif',serif;">${fmt(row.pmt)}</td><td style="font-family:'Instrument Serif',serif;color:var(--success)">${fmt(row.prin)}</td><td style="font-family:'Instrument Serif',serif;color:var(--danger)">${fmt(row.int)}</td><td style="font-family:'Instrument Serif',serif;">${fmt(row.bal)}</td></tr>`).join('');
}
function updateBonus(val){
  val=parseFloat(val)||0;document.getElementById('bonusVal').textContent=fmt(val);
  if(!S.loans.length){document.getElementById('bonusResult').textContent='';return;}
  const sorted=[...S.loans];
  if(S.strategy==='avalanche')sorted.sort((a,b)=>b.rate-a.rate);else sorted.sort((a,b)=>a.amount-b.amount);
  const tgt=sorted[0];
  const base=calcMTP(amt(tgt.amount),tgt.rate,amt(tgt.minPayment));
  const nw=calcMTP(amt(tgt.amount),tgt.rate,amt(tgt.minPayment)+parseFloat(val));
  const saved=base-nw;
  document.getElementById('bonusResult').textContent=val>0
    ?`+${fmt(val)}/mo on ${tgt.name}: pays off ${saved>0?saved+' months earlier':'at same time'}. All loans debt-free: ${getPayoffDate(S.loans.reduce((mx,l)=>Math.max(mx,calcMTP(amt(l.amount),l.rate,amt(l.minPayment)+val/S.loans.length)),0))}.`
    :'Adjust the slider to see how extra payments speed up payoff.';
}

// ──────────────────────────────────────────────
// LOAN PAID-OFF CELEBRATION
// ──────────────────────────────────────────────
function celebrateLoanPaidOff(loanName){
  setTimeout(()=>{
    launchConfetti(200);
    showToast('Loan paid off: '+esc(loanName)+'!');
  },150);
}

function checkAllLoansDebtFree(){
  if(S.loans.length>0&&S.loans.every(l=>l.amount<=0)){
    setTimeout(()=>{
      launchConfetti(250);
      showToast('🎉 DEBT FREE! All loans paid off!');
    },400);
    return true;
  }
  return false;
}
