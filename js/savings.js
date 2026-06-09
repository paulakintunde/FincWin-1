// === savings.js ===

function renderSavings(){
  renderGoals();
  const goals=S.savings||[];
  const svTot=Math.round(goals.reduce((s,g)=>s+amt(g.balance),0)*100)/100;
  const estInt=Math.round(goals.reduce((s,g)=>s+amt(g.balance)*(g.rate/100/12),0)*100)/100;
  const mContrib=Math.round(goals.reduce((s,g)=>s+amt(g.contribution),0)*100)/100;
  const done=goals.filter(g=>amt(g.balance)>=amt(g.target)).length;
  document.getElementById('sv-total').textContent=fmt(svTot);
  document.getElementById('sv-done').textContent=done+' / '+goals.length;
  document.getElementById('sv-int').textContent=fmt(estInt);
  document.getElementById('sv-contrib').textContent=fmt(mContrib);

  const grid=document.getElementById('savingsGrid');
  if(!goals.length){
    grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-muted);font-size:13px;border:2px dashed var(--border);border-radius:var(--radius);">No savings goals yet.<br><button class="nm-btn" style="margin-top:10px;" data-action="openSavModal" data-arg="-1">+ Add your first goal</button></div>`;
    if(typeof dc==='function')dc('savChart');return;
  }
  grid.innerHTML=goals.map((g,i)=>{
    const pct=Math.min(100,amt(g.target)>0?amt(g.balance)/amt(g.target)*100:0);
    const moLeft=g.contribution>0&&amt(g.balance)<amt(g.target)?Math.ceil((amt(g.target)-amt(g.balance))/amt(g.contribution)):0;
    const projDate=moLeft>0?getPayoffDate(moLeft):'';
    const isComplete=pct>=100;
    const barColor=isComplete?'var(--success)':'var(--blue)';
    // Deadline badge: if user set a deadline, show if on-track or behind
    let deadlineBadge='';
    if(g.deadline&&!isComplete){
      const dlParts=g.deadline.split('-');const dlDate=new Date(parseInt(dlParts[0]),parseInt(dlParts[1])-1,1);
      const projParts=(projDate||'').split(' ');
      const projMo=projParts[0]?MS.indexOf(projParts[0]):-1;const projYr=projParts[1]?parseInt(projParts[1]):-1;
      const projD=projMo>=0&&projYr>0?new Date(projYr,projMo,1):null;
      const onTrack=!projD||(projD<=dlDate);
      deadlineBadge=`<span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:8px;margin-left:4px;background:${onTrack?'var(--success-light)':'var(--danger-light)'};color:${onTrack?'var(--success)':'var(--danger)'};">${onTrack?icon('check')+' On track':icon('warning',{label:'Behind schedule'})+' Behind'} · Deadline ${g.deadline}</span>`;
    }
    const transferBadge=g.transferDay?`<span style="font-size:10px;color:var(--blue);background:var(--blue-light);padding:1px 6px;border-radius:8px;">${icon('calendar')} Auto-transfers day ${g.transferDay}</span>`:'';
    return`<div class="sav-card${isComplete?' sav-complete':''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <div>
          <div style="font-weight:700;font-size:13px;">${esc(g.name)}</div>
          <div class="sav-interest">${icon('star',{label:'Interest rate'})} ${g.rate}% p.a. interest</div>
          ${deadlineBadge||transferBadge?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">${deadlineBadge}${transferBadge}</div>`:''}
        </div>
        <button class="del-btn" style="opacity:1;" data-action="openDelSav" data-arg="${i}" title="Delete savings goal" aria-label="Delete savings goal">${icon('close',{label:'Delete'})}</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin:6px 0 2px;">
        <span style="font-family:'Instrument Serif',serif;font-size:20px;font-weight:400;color:${barColor};">${typeof fmtItemAmount==='function'?fmtItemAmount(amt(g.balance),g.currency):fmt(amt(g.balance))}</span>
        <span style="font-size:12px;font-weight:600;color:${barColor};">${pct.toFixed(0)}%</span>
      </div>
      <div class="sav-goal-bar"><div class="sav-goal-fill" style="width:${pct.toFixed(1)}%;background:${barColor};"></div></div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">of ${fmt(amt(g.target))} goal${isComplete?'':moLeft>0?' · '+projDate+' est.':''}</div>
      ${isComplete?`<div style="text-align:center;margin-bottom:8px;"><span class="sav-complete-badge">${icon('trophy',{label:'Goal achieved'})} Goal Reached!</span></div>`:''}
      <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;text-align:center;">
        ${fmt(amt(g.contribution))}/mo · Interest: ${fmt(amt(g.balance)*(g.rate/100/12))}/mo
      </div>
      <div class="sav-actions">
        <button class="tbtn" style="font-size:11px;padding:4px 9px;color:var(--success);border-color:var(--success-mid);" data-action="openTxnDeposit" data-arg="${i}">+ Deposit</button>
        <button class="tbtn" style="font-size:11px;padding:4px 9px;color:var(--amber);border-color:var(--amber-mid);" data-action="openTxnWithdraw" data-arg="${i}">− Withdraw</button>
        <button class="tbtn" style="font-size:11px;padding:4px 9px;" data-action="openSavModal" data-arg="${i}">Edit</button>
      </div>
      ${(g.transactions&&g.transactions.length)?`<details style="margin-top:8px;font-size:11px;"><summary style="cursor:pointer;color:var(--text-muted);font-size:10px;user-select:none;">History (${g.transactions.length})</summary><div style="margin-top:6px;max-height:140px;overflow-y:auto;">${g.transactions.slice(0,20).map((t,ti)=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-top:1px solid var(--border);gap:4px;"><span style="color:var(--text-muted);flex:0 0 auto;">${esc(t.date)}</span><span style="color:${t.type==='deposit'?'var(--success)':'var(--amber)'};flex:1;">${t.type==='deposit'?'+':'-'}${fmt(t.amount)}${t.note?` <span style="font-size:10px;color:var(--text-muted);">${esc(t.note)}</span>`:''}</span><button class="del-btn" data-action="deleteSavTxn" data-arg="${i}" data-arg2="${ti}" title="Delete this transaction" aria-label="Delete this transaction" style="opacity:.5;font-size:10px;flex:0 0 auto;">${icon('close',{label:'Delete'})}</button></div>`).join('')}</div></details>`:''}
    </div>`;
  }).join('');

  // All savings goals complete banner
  const allSavComplete=goals.length>0&&goals.every(g=>amt(g.balance)>=amt(g.target));
  let sacBanner=document.getElementById('savAllCompleteBanner');
  if(allSavComplete){
    if(!sacBanner){
      sacBanner=document.createElement('div');
      sacBanner.id='savAllCompleteBanner';
      sacBanner.className='savings-all-complete';
      sacBanner.innerHTML='<span class="sac-icon">'+icon('trophy',{label:'All goals reached'})+'</span><div class="sac-text"><strong>All Savings Goals Reached!</strong><span>Every goal is funded. Consider setting a new challenge or investing the surplus.</span></div>';
      const grid=document.getElementById('savingsGrid');
      if(grid&&grid.parentNode)grid.parentNode.insertBefore(sacBanner,grid);
    }
  } else if(sacBanner){sacBanner.remove();}
  renderSavingsChart(goals);
  renderDashSavings(goals);
  if(typeof renderInvestments==='function')renderInvestments();
  if(typeof renderDashInvestments==='function')renderDashInvestments();
}
function renderDashSavings(goals){
  const el=document.getElementById('dashSavingsList');
  if(!el)return;
  if(!goals||!goals.length){el.innerHTML='<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">No savings goals yet.</div>';return;}
  el.innerHTML=goals.map(g=>{
    const noTarget=amt(g.target)<=0;
    const pct=noTarget?0:Math.min(100,amt(g.balance)/amt(g.target)*100);
    const isComplete=!noTarget&&pct>=100;
    const moLeft=!noTarget&&g.contribution>0&&amt(g.balance)<amt(g.target)?Math.ceil((amt(g.target)-amt(g.balance))/amt(g.contribution)):0;
    return`<div class="prog-item-dash">
      <div class="prog-header">
        <span class="pn" style="${isComplete?'color:var(--success);':''}">${esc(g.name)}${isComplete?' '+icon('trophy',{label:'Goal achieved'}):''}</span>
        <span class="pa">${noTarget?fmt(amt(g.balance)):fmt(amt(g.balance))+' / '+fmt(amt(g.target))}</span>
      </div>
      <div class="prog-track"><div class="prog-fill-dash" style="width:${pct.toFixed(1)}%;background:${isComplete?'var(--success)':'var(--blue)'};"></div></div>
      <div class="prog-foot">${noTarget?'No target set':isComplete?'Goal reached!':moLeft>0?moLeft+' months to go':'contributing '+fmt(amt(g.contribution))+'/mo'}</div>
    </div>`;
  }).join('');
}

// Savings goal modal (add/edit)
function openSavModal(idx){
  // Free tier: cap at 1 savings goal
  if(idx<0&&typeof getPlan==='function'&&getPlan()==='free'){
    if((typeof S!=='undefined'&&S&&(S.savings||[]).length>=1)){
      if(typeof requirePlan==='function')requirePlan('pro','Unlimited Savings Goals');
      return;
    }
  }
  _pendingSavIdx=idx;
  document.getElementById('savModalTitle').textContent=idx<0?'Add Savings Goal':'Edit Savings Goal';
  const g=idx>=0?S.savings[idx]:{name:'',target:0,balance:0,contribution:0,rate:0,deadline:'',transferDay:''};
  document.getElementById('savName').value=g.name;
  document.getElementById('savTarget').value=g.target?amt(g.target):'';
  document.getElementById('savBal').value=g.balance?amt(g.balance):'';
  document.getElementById('savContrib').value=g.contribution?amt(g.contribution):'';
  document.getElementById('savRate').value=g.rate||'';
  const dlEl=document.getElementById('savDeadline');if(dlEl)dlEl.value=g.deadline||'';
  const tdEl=document.getElementById('savTransferDay');if(tdEl)tdEl.value=g.transferDay||'';
  if(typeof _populateCurrencySelect==='function')_populateCurrencySelect('savCurrency',g.currency||getCurrency().code);
  const _sm=document.getElementById('savModal');
  _sm.classList.add('open');
  trapFocus(_sm);
  setTimeout(()=>{const f=document.getElementById('savName');if(f)f.focus();},120);
}
function closeSavModal(){releaseTrap(document.getElementById('savModal'));
  document.getElementById('savModal').classList.remove('open');}
function saveSavGoal(){
  const rawName=document.getElementById('savName').value.trim();
  if(!rawName){showToast('Enter a goal name','warn-t');document.getElementById('savName').focus();return;}
  const dlEl=document.getElementById('savDeadline');
  const tdEl=document.getElementById('savTransferDay');
  // Preserve the existing goal's stable _id on edit; generate a new one on create (audit M-11).
  const existingId = (_pendingSavIdx >= 0 && S.savings[_pendingSavIdx]) ? S.savings[_pendingSavIdx]._id : null;
  const savCurrSel=document.getElementById('savCurrency');
  const g={
    _id: existingId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
    name:rawName,
    target:storeCents(document.getElementById('savTarget').value),
    balance:storeCents(document.getElementById('savBal').value),
    contribution:storeCents(document.getElementById('savContrib').value),
    rate:Math.min(100,Math.max(0,parseFloat(document.getElementById('savRate').value)||0)),
    deadline:dlEl?dlEl.value:'',
    transferDay:tdEl?parseInt(tdEl.value)||null:null,
    currency:savCurrSel&&savCurrSel.value?savCurrSel.value:getCurrency().code
  };
  const alreadyMet=amt(g.target)>0&&amt(g.balance)>=amt(g.target);
  const wasEdit=_pendingSavIdx>=0;
  dispatch('SAVINGS_UPSERT',{idx:wasEdit?_pendingSavIdx:-1,goal:g});
  syncSavingsExpenses();
  closeSavModal();renderSavings();updateHealth();
  if(alreadyMet&&!wasEdit){
    setTimeout(()=>{launchConfetti(140);showToast('Goal already reached: '+g.name);},200);
  }
}

// Auto-create savings transfer expense when transferDay arrives
function checkSavingsAutopilot(){
  if(!S.savings||!S.savings.length)return;
  const today=new Date();
  const isCurMo=(()=>{const p=CMK.split(' ');return MS.indexOf(p[0])===today.getMonth()&&parseInt(p[1])===today.getFullYear();})();
  if(!isCurMo)return;
  const todayDate=today.getDate();
  S.savings.forEach((g,i)=>{
    if(!g.transferDay||g.transferDay!==todayDate||amt(g.contribution)<=0)return;
    const tag='_autopilot_'+i+'_'+CMK;
    const alreadyAdded=cw().some(w=>w.items.some(it=>it._savingsTag===tag));
    if(alreadyAdded)return;
    cw()[getWeekForDay(g.transferDay,CMK)].items.push({
      name:g.name+' deposit',
      amount:storeCents(amt(g.contribution)),
      paid:false,dueDay:g.transferDay,
      note:'Auto: monthly savings transfer',
      receipt:null,_savingsTag:tag
    });
    persist();
    showToast('📅 Autopilot: '+g.name+' deposit added for today');
  });
}
function deleteSavTxn(goalIdx, txnIdx){
  const g = S.savings[goalIdx];
  if(!g||!g.transactions||!g.transactions[txnIdx]) return;
  dispatch('SAVINGS_TXN_REMOVE',{goalIdx,txnIdx},false);
  renderSavings();updateHealth();
  showUndoToast('Transaction removed — Undo');
}

function openDelSav(i){_pendingDelSavIdx=i;document.getElementById('delSavName').textContent='Delete "'+S.savings[i].name+'"? This cannot be undone.';document.getElementById('delSavModal').classList.add('open');
  trapFocus(document.getElementById('delSavModal'));
  setTimeout(()=>{const _f=document.querySelector('#delSavModal button');if(_f)_f.focus();},120);}
function closeDelSav(){releaseTrap(document.getElementById('delSavModal'));
  document.getElementById('delSavModal').classList.remove('open');}
function confirmDelSav(){
  dispatch('SAVINGS_REMOVE',{idx:_pendingDelSavIdx});
  syncSavingsExpenses();
  closeDelSav();renderSavings();updateHealth();
  showUndoToast('Savings goal deleted — Undo');
}

// Deposit / Withdraw modal
function openTxn(mode,idx){
  _txnMode=mode;_txnIdx=idx;
  const g=S.savings[idx];
  document.getElementById('txnTitle').textContent=mode==='deposit'?'Deposit to '+g.name:'Withdraw from '+g.name;
  document.getElementById('txnGoalName').textContent='Current balance: '+fmt(amt(g.balance));
  document.getElementById('txnAmount').value='';
  document.getElementById('txnNote').value='';
  document.getElementById('txnWarnRow').style.display='none';
  document.getElementById('txnConfirmBtn').textContent=mode==='deposit'?'Confirm Deposit':'Confirm Withdrawal';
  document.getElementById('txnConfirmBtn').style.background=mode==='deposit'?'var(--sage)':'var(--amber)';
  document.getElementById('txnModal').classList.add('open');
  trapFocus(document.getElementById('txnModal'));
  setTimeout(()=>{const _f=document.querySelector('#txnModal input');if(_f)_f.focus();},120);
}
function closeTxnModal(){releaseTrap(document.getElementById('txnModal'));
  document.getElementById('txnModal').classList.remove('open');}
function confirmTxn(){
  const a=parseFloat(document.getElementById('txnAmount').value)||0;
  if(a<=0){showToast('Enter an amount','warn-t');return;}
  const g=S.savings[_txnIdx];
  if(!g){closeTxnModal();return;}
  const prevPct=amt(g.target)>0?amt(g.balance)/amt(g.target):0;
  const aAmt=Math.round(a*100)/100;
  let newBalance;
  if(_txnMode==='deposit'){newBalance=Math.round((amt(g.balance)+aAmt)*100)/100;}
  else{
    if(aAmt>amt(g.balance)){newBalance=0;showToast('Balance set to $0');}
    else newBalance=Math.round((amt(g.balance)-aAmt)*100)/100;
  }
  const date=new Date().toISOString().slice(0,10);
  const type=_txnMode;
  const amount=aAmt;
  const note=document.getElementById('txnNote').value.trim();
  dispatch('SAVINGS_UPDATE_BALANCE', {
    idx: _txnIdx,
    balance: newBalance,
    txn: { date, type, amount, note, balance: newBalance }
  });
  const newPct=amt(g.target)>0?newBalance/amt(g.target):0;
  persist();closeTxnModal();renderSavings();updateHealth();
  if(_txnMode==='deposit'){
    if(typeof awardXP==='function') awardXP('sav_deposit');
    if(typeof checkAchievements==='function') checkAchievements('sav_starter','goal_crusher');
  }
  if(_txnMode==='deposit'&&prevPct<1&&newPct>=1){
    setTimeout(()=>{launchConfetti(160);showToast('Savings goal reached: '+g.name);},200);
  } else {
    showToast('✓ '+ (_txnMode==='deposit'?'Deposited':'Withdrew')+' '+fmt(a));
  }
}
// Warn on withdraw
document.addEventListener('DOMContentLoaded',function(){const el=document.getElementById('txnAmount');if(el)el.addEventListener('input',function(){
  if(_txnMode==='withdraw'&&_txnIdx>=0&&S.savings[_txnIdx]){const a=parseFloat(this.value)||0;document.getElementById('txnWarnRow').style.display=(a>0&&a>amt(S.savings[_txnIdx].balance))?'block':'none';}
});});

// ══════════════════════════════════════════════
// FINANCIAL GOALS
// ══════════════════════════════════════════════
let _goalEditIdx=-1;

function openGoalModal(idx){
  _goalEditIdx=idx;
  document.getElementById('goalModalTitle').textContent=idx<0?'Add Debt Payoff Goal':'Edit Debt Payoff Goal';
  const g=idx>=0?S.financialGoals[idx]:{type:'payoff',name:'',target:0,targetDate:'',linkedLoan:undefined};
  document.getElementById('goalName').value=g.name||'';
  document.getElementById('gTarget').value=g.target||0;
  document.getElementById('gDate').value=g.targetDate||'';
  const llEl=document.getElementById('gLinkedLoan');
  if(llEl){
    llEl.innerHTML='<option value="">None</option>'+S.loans.map((l,i)=>'<option value="'+i+'" '+(g.linkedLoan===i?'selected':'')+'>'+esc(l.name)+'</option>').join('');
    llEl.value=g.linkedLoan!==undefined?g.linkedLoan:'';
  }
  document.getElementById('goalModal').classList.add('open');
  trapFocus(document.getElementById('goalModal'));
  setTimeout(()=>{const _f=document.getElementById('goalName');if(_f)_f.focus();},120);
}
function closeGoalModal(){releaseTrap(document.getElementById('goalModal'));
  document.getElementById('goalModal').classList.remove('open');}

function saveGoal(){
  const name=document.getElementById('goalName').value.trim()||'Debt Payoff Goal';
  const llEl=document.getElementById('gLinkedLoan');
  const ll=llEl?llEl.value:'';
  const g={
    type:'payoff',name,createdMonth:CMK,progress:0,
    target:parseFloat(document.getElementById('gTarget').value)||0,
    targetDate:document.getElementById('gDate').value||''
  };
  if(ll!=='')g.linkedLoan=parseInt(ll);
  dispatch('GOAL_UPSERT',{idx:_goalEditIdx,goal:g});
  closeGoalModal();renderGoals();
  const linkedLoan=g.linkedLoan!==undefined?S.loans[g.linkedLoan]:null;
  const cur=linkedLoan?linkedLoan.amount:g.target;
  if(cur<=0)setTimeout(()=>{launchConfetti(130);showToast('Debt paid off!');},300);
}

function renderGoals(){
  // Only renders payoff-type goals. Spend/save/custom types removed per UX consolidation.
  const goals=(S.financialGoals||[]).filter(g=>g.type==='payoff');
  const grid=document.getElementById('goalsGrid');
  if(!grid)return;
  if(!goals.length){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);font-size:12px;border:2px dashed var(--border);border-radius:var(--radius);">No debt payoff goals yet. Add a goal to track a loan payoff target.</div>';
    return;
  }
  grid.innerHTML=goals.map((g,gi)=>{
    const realIdx=(S.financialGoals||[]).indexOf(g);
    const loan=g.linkedLoan!==undefined?S.loans[g.linkedLoan]:null;
    const noLoan=!loan;
    const cur=loan?amt(loan.amount):amt(g.target||0);
    const orig=loan?amt(loan.originalAmount||loan.amount):amt(g.target||0);
    const progress=orig>0?Math.min(100,((orig-cur)/orig)*100):0;
    const met=cur<=0;
    const detail=loan?'Balance: '+fmt(cur):'Target: '+fmt(amt(g.target));
    // On-track check against targetDate
    let trackBadge='';
    if(g.targetDate&&!met){
      const [dlYr,dlMo]=g.targetDate.split('-').map(Number);
      const dlDate=new Date(dlYr,dlMo-1,1);
      const projMTP=loan?calcMTP(cur,loan.rate,amt(loan.minPayment)):999;
      const projDate=projMTP<999?new Date(...(()=>{const p=CMK.split(' ');let mo=MS.indexOf(p[0]),yr=parseInt(p[1]);mo+=projMTP;yr+=Math.floor(mo/12);mo=mo%12;return[yr,mo,1];})())  :null;
      if(projDate)trackBadge=`<span style="font-size:10px;font-weight:600;padding:1px 5px;border-radius:8px;background:${projDate<=dlDate?'var(--success-light)':'var(--danger-light)'};color:${projDate<=dlDate?'var(--success)':'var(--danger)'};">${projDate<=dlDate?icon('check')+' On track':icon('warning',{label:'Behind schedule'})+' Behind'} · by ${g.targetDate}</span>`;
    }
    return`<div class="goal-card type-payoff${met?' type-met goal-celebrating':''}">
      <div class="g-type">Debt Payoff Goal</div>
      <div class="g-name">${esc(g.name)}</div>
      ${trackBadge?`<div style="margin-bottom:4px;">${trackBadge}</div>`:''}
      <div class="g-progress">${noLoan?'—':progress.toFixed(0)+'%'}</div>
      <div class="g-bar"><div class="g-fill" style="width:${noLoan?0:progress}%;background:var(--danger);"></div></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
        <span style="font-size:11px;color:var(--text-secondary);">${detail}</span>
        <span class="${met?'sav-complete-badge':'goal-status-badge goal-unmet'}">${met?icon('trophy',{label:'Goal achieved'})+' Paid Off!':noLoan?icon('warning',{label:'No loan linked'})+' No loan linked':icon('hourglass',{label:'In progress'})+' In progress'}</span>
      </div>
      <div style="margin-top:8px;display:flex;gap:5px;" class="no-print goal-actions">
        <button class="tbtn" style="font-size:10px;padding:3px 7px;" data-action="openGoalModal" data-arg="${realIdx}">Edit</button>
        <button class="tbtn" style="font-size:10px;padding:3px 7px;color:var(--danger);" data-action="deleteGoal" data-arg="${realIdx}">Delete</button>
      </div>
    </div>`;
  }).join('');
}
function deleteGoal(i){
  const g=(S.financialGoals||[])[i];
  if(!g)return;
  if(!window.confirm('Delete goal "'+g.name+'"? This cannot be undone.'))return;
  dispatch('GOAL_REMOVE',{idx:i});renderGoals();showToast('Goal deleted');
}

// ══════════════════════════════════════════════
// SCHEDULED EXPENSES MANAGEMENT PANEL
// ══════════════════════════════════════════════
function renderScheduledPanel(){
  const el=document.getElementById('scheduledPanel');
  if(!el)return;
  const rules=S.scheduledExpenses||[];
  if(!rules.length){
    el.innerHTML='<p style="font-size:12px;color:var(--text-muted);padding:6px 0;">No recurring rules yet. Set an expense to Quarterly or Yearly frequency to create one.</p>';
    return;
  }
  el.innerHTML=rules.map((r,i)=>{
    const freqLabel=r.frequency==='quarterly'?'Quarterly':'Yearly';
    const yearlyMo=r.frequency==='yearly'&&r.yearMonth>=0?(' · '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][r.yearMonth]):'';
    return`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.name)}</div>
        <div style="font-size:10px;color:var(--text-muted);">${freqLabel}${yearlyMo} · ${fmt(amt(r.amount))}${r.dueDay?' · Due day '+r.dueDay:''}</div>
      </div>
      <button class="tbtn" style="font-size:10px;padding:2px 8px;color:var(--danger);border-color:var(--danger-mid);flex-shrink:0;" data-action="deleteScheduledRule" data-arg="${i}">Remove</button>
    </div>`;
  }).join('');
}

function deleteScheduledRule(i){
  if(!(S.scheduledExpenses||[]).length)return;
  dispatch('SCHEDULED_REMOVE',{idx:i},false);
  renderScheduledPanel();showToast('Recurring rule removed');
}

function toggleScheduledPanel(){
  const wrap=document.getElementById('scheduledPanelWrap');
  const tog=document.getElementById('scheduledPanelToggle');
  if(!wrap)return;
  const open=wrap.style.display==='none';
  wrap.style.display=open?'block':'none';
  if(tog)tog.textContent=open?'▾ Hide':'▸ Show';
  if(open)renderScheduledPanel();
}
