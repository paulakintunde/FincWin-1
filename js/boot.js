// === boot.js ===

// ══════════════════════════════════════════════════════════════
// CONFETTI ENGINE
// ══════════════════════════════════════════════════════════════
(function(){
  const COLORS=['#5C7A6B','#B8860B','#276749','#2B6CB0','#6B46C1','#C53030','#B7791F','#C6F6D5','#BEE3F8','#FBF5E6'];
  let _particles=[], _rafId=null, _canvas=null, _ctx=null;

  function getCanvas(){
    if(!_canvas){
      _canvas=document.getElementById('confettiCanvas');
      _ctx=_canvas.getContext('2d');
    }
    return _canvas;
  }

  function resize(){
    const c=getCanvas();
    c.width=window.innerWidth;c.height=window.innerHeight;
  }

  function launch(count=80,originX=null,originY=null){
    resize();
    const c=getCanvas();
    c.style.display='block';
    const ox=originX!=null?originX:window.innerWidth/2;
    const oy=originY!=null?originY:window.innerHeight*0.4;
    for(let i=0;i<count;i++){
      const angle=(Math.random()-0.5)*Math.PI*1.6; // spread upward
      const speed=4+Math.random()*10;
      _particles.push({
        x:ox,y:oy,
        vx:Math.cos(angle)*speed,
        vy:Math.sin(angle)*speed-6,
        rot:Math.random()*360,
        rotV:(Math.random()-0.5)*8,
        w:7+Math.random()*6,h:4+Math.random()*4,
        color:COLORS[Math.floor(Math.random()*COLORS.length)],
        life:1,decay:0.012+Math.random()*0.01,
        shape:Math.random()<0.5?'rect':'circle'
      });
    }
    if(!_rafId)_rafId=requestAnimationFrame(tick);
  }

  function tick(){
    const c=getCanvas();const ctx=_ctx;
    ctx.clearRect(0,0,c.width,c.height);
    _particles=_particles.filter(p=>p.life>0);
    _particles.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.35; // gravity
      p.vx*=0.99; p.rot+=p.rotV; p.life-=p.decay;
      ctx.save();
      ctx.globalAlpha=Math.max(0,p.life);
      ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle=p.color;
      if(p.shape==='circle'){ctx.beginPath();ctx.arc(0,0,p.w/2,0,Math.PI*2);ctx.fill();}
      else{ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);}
      ctx.restore();
    });
    if(_particles.length>0){_rafId=requestAnimationFrame(tick);}
    else{_rafId=null;ctx.clearRect(0,0,c.width,c.height);c.style.display='none';}
  }

  window.launchConfetti=function(count,x,y){launch(count||80,x,y);};
  window.launchConfettiFromEl=function(el,count){
    const r=el?el.getBoundingClientRect():null;
    const x=r?(r.left+r.right)/2:null;
    const y=r?(r.top+r.bottom)/2:null;
    launch(count||90,x,y);
  };
})();

// ══════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════
function switchTab(name,btn){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active','slide-fwd','slide-back'));
  document.querySelectorAll('.tab').forEach(t=>{t.classList.remove('active');t.removeAttribute('aria-current');});
  const sec=document.getElementById('section-'+name);
  sec.classList.add('active','slide-fwd');
  setTimeout(()=>sec.classList.remove('slide-fwd'),250);
  if(btn)btn.classList.add('active');
  // aria-current: set on whichever tab button matches (btn arg or id lookup)
  const tabBtn=btn||document.getElementById('tab-'+name);
  if(tabBtn)tabBtn.setAttribute('aria-current','page');
  // Sync mobile bottom nav
  document.querySelectorAll('.mbn-item').forEach(b=>{b.classList.remove('mbn-active');b.removeAttribute('aria-current');});
  const mbnTarget=document.getElementById('mbn-'+name);
  if(mbnTarget){mbnTarget.classList.add('mbn-active');mbnTarget.setAttribute('aria-current','page');}
  // Sync mobile quick-nav strip
  document.querySelectorAll('.qnav-btn[data-arg]').forEach(b=>{
    const active=b.dataset.arg===name;
    b.classList.toggle('active',active);
    if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  renderSection(name);
  // Reset scroll to top so the new section's masthead clears the sticky
  // topbar + tab-bar instead of sitting jammed underneath them. Without this,
  // switching from a scrolled-down tab leaves the prior scroll offset and the
  // new heading renders behind the (translucent, in glass theme) nav.
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderSection(name){
  if(name==='dashboard'){if(typeof _dashDirty!=='undefined'&&!_dashDirty)return;renderDash();}
  else if(name==='expenses')renderExpenses();
  else if(name==='revenue')renderRevenue();
  else if(name==='loans')renderLoans();
  else if(name==='savings')renderSavings();
  else if(name==='calendar')renderCalendar();
  else if(name==='analytics'){renderAnalytics();if(typeof renderCoach==='function')renderCoach();}
  else if(name==='archive')renderArchive();
  else if(name==='settings'&&typeof renderSettings==='function')renderSettings();
}

// ── MONTH NAV HELPERS ──
const MS_IDX={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
function keyToYM(k){const p=k.split(' ');return parseInt(p[1])*12+MS_IDX[p[0]];}
function currentRealYM(){const n=new Date();return n.getFullYear()*12+n.getMonth();}
function changeMonth(dir){
  const _cmb=document.getElementById('monthCompleteBanner');if(_cmb)_cmb.remove();_lastMonthComplete='';
  const keys=Object.keys(S.months);
  const idx=keys.indexOf(CMK)+dir;
  if(idx<0)return; // already at oldest
  // Allow navigating up to 6 months ahead of today for pre-planning
  const maxYM=currentRealYM()+6;
  if(idx>=keys.length){
    // At newest existing month — try to go further forward
    const nextYM=keyToYM(CMK)+1;
    if(nextYM>maxYM){showToast('Cannot plan more than 6 months ahead','warn-t');return;}
    // Create the next month automatically
    const nextMo=nextYM%12;const nextYr=Math.floor(nextYM/12);
    const nextKey=MS[nextMo]+' '+nextYr;
    if(!S.months[nextKey])S.months[nextKey]={weeks:[{items:[]},{items:[]},{items:[]},{items:[]}],revenue:[]};
    expandScheduledExpenses(nextKey);
    CMK=nextKey;S.currentMonthKey=CMK;
    persist(false);updateMonthLabel();tagFilter='';
    renderSection(getTab());updateHealth();renderMonthTags();
    return;
  }
  // Guard: never navigate to a stored month more than 6 ahead of today
  const targetYM=keyToYM(keys[idx]);
  if(targetYM>maxYM){showToast('Cannot plan more than 6 months ahead','warn-t');return;}
  CMK=keys[idx];S.currentMonthKey=CMK;
  persist(false);updateMonthLabel();tagFilter='';
  renderSection(getTab());updateHealth();
}
function updateMonthLabel(){document.getElementById('monthLabel').textContent=CMK;}

// ══════════════════════════════════════════════
// MONTH MANAGEMENT
// ══════════════════════════════════════════════
function switchToMonth(k){
  const maxYM=currentRealYM()+6;
  if(keyToYM(k)>maxYM){showToast('Cannot plan more than 6 months ahead','warn-t');return;}
  CMK=k;S.currentMonthKey=k;_lastMonthComplete='';
  const b=document.getElementById('monthCompleteBanner');if(b)b.remove();
  persist(false);updateMonthLabel();tagFilter='';renderMonthTags();renderExpenses();updateHealth();
}
function renderMonthTags(){
  const keys=Object.keys(S.months);
  const canDelete=keys.length>1;
  document.getElementById('monthTags').innerHTML=keys.map(k=>{const ek=esc(k);return`<span class="month-tag${k===CMK?' active-month':''}" data-action="switchToMonth" data-arg="${ek}">${ek}<span class="no-print month-tag-actions"><span class="mta-btn" title="Archive ${ek}" data-action="confirmArchiveMonth" data-arg="${ek}" data-stop-prop>${icon('archive',{label:'Archive '+ek})}</span>${canDelete?`<span class="mta-btn" title="Delete ${ek}" data-action="confirmDeleteMonth" data-arg="${ek}" data-stop-prop style="color:var(--danger);">${icon('trash',{label:'Delete '+ek})}</span>`:''}</span></span>`;}).join('');
}
let _deleteMonthTarget='';
function confirmDeleteMonth(k){
  if(Object.keys(S.months).length<=1){showToast('Cannot delete — keep at least one active month','warn-t');return;}
  _deleteMonthTarget=k;
  const isArchived=S.archivedMonths&&S.archivedMonths[k];
  document.getElementById('deleteMonthKey').textContent=k;
  document.getElementById('deleteMonthArchiveRow').style.display=isArchived?'flex':'none';
  document.getElementById('deleteMonthAlsoArchive').checked=false;
  document.getElementById('deleteMonthModal').classList.add('open');
  trapFocus(document.getElementById('deleteMonthModal'));
  setTimeout(()=>{const f=document.querySelector('#deleteMonthModal button');if(f)f.focus();},120);
}
function closeDeleteMonthModal(){
  releaseTrap(document.getElementById('deleteMonthModal'));
  document.getElementById('deleteMonthModal').classList.remove('open');
  _deleteMonthTarget='';
}
function executeDeleteMonth(){
  const k=_deleteMonthTarget;
  if(!k||!S.months[k]){closeDeleteMonthModal();return;}
  const alsoArchive=document.getElementById('deleteMonthAlsoArchive').checked;
  delete S.months[k];
  if(alsoArchive&&S.archivedMonths)delete S.archivedMonths[k];
  if(CMK===k){
    const remaining=Object.keys(S.months);
    CMK=remaining.length?remaining[remaining.length-1]:'';
    S.currentMonthKey=CMK;
  }
  persist();updateMonthLabel();renderMonthTags();renderExpenses();updateHealth();updateArchiveBadge();
  closeDeleteMonthModal();
  showToast(`✓ ${k} deleted`);
}
function openCloneModal(){document.getElementById('cloneModal').classList.add('open');
  trapFocus(document.getElementById('cloneModal'));
  setTimeout(()=>{const _f=document.querySelector('#cloneModal input,#cloneModal select,#cloneModal textarea');if(_f)_f.focus();},120);}
function closeCloneModal(){releaseTrap(document.getElementById('cloneModal'));
  document.getElementById('cloneModal').classList.remove('open');}
function executeClone(){
  const doExp=document.getElementById('cloneExpenses').checked;
  const doRev=document.getElementById('cloneRevenue').checked;
  const keepPaid=document.getElementById('cloneKeepPaid').checked;
  closeCloneModal();
  cloneCurrentMonth(doExp,doRev,keepPaid);
}
function cloneCurrentMonth(doExp=true,doRev=true,keepPaid=false){
  const parts=CMK.split(' ');let mo=MS.indexOf(parts[0]),yr=parseInt(parts[1]);
  mo++;if(mo>11){mo=0;yr++;}
  const nk=mk(mo,yr);
  if(S.months[nk]){showToast(nk+' already exists','warn-t');return;}
  const newWeeks=doExp?deepClone(cw()).map(w=>({items:w.items.map(i=>({...i,paid:keepPaid?i.paid:false}))})):[{items:[]},{items:[]},{items:[]},{items:[]}];
  const newRev=doRev?deepClone(cr()).map(r=>({...r,received:keepPaid?r.received:false})):[];
  S.months[nk]={weeks:newWeeks,revenue:newRev};
  applyBudgetRollovers(CMK,nk);
  expandScheduledExpenses(nk);
  if(typeof expandRecurringRevenue==='function')expandRecurringRevenue(nk);
  const _clonePrevKey=CMK;
  if(typeof calcHealth==='function') dispatch('MONTH_SET_SCORE',{mk:_clonePrevKey,score:calcHealth().total},false);
  CMK=nk;S.currentMonthKey=nk;persist();updateMonthLabel();renderMonthTags();renderExpenses();updateHealth();showToast('✓ Cloned to '+nk);
  if(typeof openScorecardModal==='function') setTimeout(()=>openScorecardModal(_clonePrevKey),400);
}
function openNewMonthModal(){
  const monSel=document.getElementById('newMonSelMonth');
  const yrSel=document.getElementById('newMonSelYear');
  const cs=document.getElementById('cloneFromSel');

  // Populate month select
  monSel.innerHTML=MS.map((m,i)=>`<option value="${i}">${m}</option>`).join('');

  // Populate year select — current year to current + 50
  const curYr=new Date().getFullYear();
  const _yrOpts=[];
  for(let y=curYr;y<=curYr+50;y++) _yrOpts.push(`<option value="${y}">${y}</option>`);
  yrSel.innerHTML=_yrOpts.join('');

  // Default to the month after the latest existing month
  const existingKeys=Object.keys(S.months||{});
  let defMo=new Date().getMonth(), defYr=new Date().getFullYear();
  if(existingKeys.length){
    const latest=existingKeys.map(k=>{const p=k.split(' ');return{mo:MS.indexOf(p[0]),yr:parseInt(p[1])};})
      .sort((a,b)=>a.yr!==b.yr?a.yr-b.yr:a.mo-b.mo).pop();
    defMo=(latest.mo+1)%12;
    defYr=latest.mo===11?latest.yr+1:latest.yr;
  }
  monSel.value=defMo;
  yrSel.value=Math.min(defYr,curYr+50);

  cs.innerHTML='<option value="blank">Blank (empty)</option>'+Object.keys(S.months).map(k=>`<option value="${esc(k)}">Clone from ${esc(k)}</option>`).join('');

  document.getElementById('newMonthModal').classList.add('open');
  trapFocus(document.getElementById('newMonthModal'));
  setTimeout(()=>monSel.focus(),120);
}
function closeNewMonthModal(){releaseTrap(document.getElementById('newMonthModal'));
  document.getElementById('newMonthModal').classList.remove('open');}
function createNewMonth(){
  const mo=parseInt(document.getElementById('newMonSelMonth').value);
  const yr=parseInt(document.getElementById('newMonSelYear').value);
  const from=document.getElementById('cloneFromSel').value;
  if(isNaN(mo)||isNaN(yr)){showToast('Select a month and year','warn-t');return;}
  const key=mk(mo,yr);
  if(keyToYM(key)>currentRealYM()+6){showToast('Cannot plan more than 6 months ahead','warn-t');return;}
  if(S.months[key]){showToast(key+' already exists','warn-t');closeNewMonthModal();return;}
  if(from==='blank'){
    S.months[key]={weeks:[{items:[]},{items:[]},{items:[]},{items:[]}],revenue:[]};
  } else {
    const src=S.months[from];
    S.months[key]={weeks:deepClone(src.weeks).map(w=>({items:w.items.map(i=>({...i,paid:false}))})),revenue:deepClone(src.revenue).map(r=>({...r,received:false}))};
  }
  expandScheduledExpenses(key);
  if(typeof expandRecurringRevenue==='function')expandRecurringRevenue(key);
  const _newMonPrevKey=CMK;
  if(typeof calcHealth==='function') dispatch('MONTH_SET_SCORE',{mk:_newMonPrevKey,score:calcHealth().total},false);
  CMK=key;S.currentMonthKey=key;persist();updateMonthLabel();closeNewMonthModal();renderMonthTags();renderExpenses();updateHealth();showToast('✓ Created '+key);
  if(typeof openScorecardModal==='function') setTimeout(()=>openScorecardModal(_newMonPrevKey),400);
}

// ══════════════════════════════════════════════
// BUDGET ENVELOPES
// ══════════════════════════════════════════════
function catTotalsForMonth(){
  const t={};cw().forEach(w=>w.items.forEach(i=>{const c=CAT_LABELS[getCat(i.name)];t[c]=(t[c]||0)+amt(i.amount);}));
  return t;
}
function _calcBudgetVelocity(spent, cap) {
  if(cap<=0||spent<=0) return null;
  const parts=CMK.split(' ');
  const today=new Date();
  if(MS.indexOf(parts[0])!==today.getMonth()||parseInt(parts[1])!==today.getFullYear()) return null;
  const d=today.getDate(); if(d<=0) return null;
  const daysInMonth=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
  const daily=spent/d;
  const projected=daily*daysInMonth;
  if(projected>=cap){
    const hitDay=Math.min(daysInMonth,Math.round(cap/daily));
    return{ok:false,hitDay};
  }
  return{ok:true,remaining:cap-spent};
}

function renderEnvelopes(){
  const t=_cachedCatTotals||catTotalsForMonth();
  const grid=document.getElementById('envelopesGrid');
  if(!grid)return;
  if(!Object.keys(t).length){grid.innerHTML='<div style="padding:12px;color:var(--text-muted);font-size:12px;">No expenses this month — budget tracking will appear once you add items.</div>';return;}
  const allBudgetKeys=Object.keys(S.budgets||BDFT);
  document.getElementById('envelopesGrid').innerHTML=allBudgetKeys.map(cat=>{
    const spent=t[cat]||0;
    const baseCap=S.budgets[cat]||BDFT[cat]||500;
    const _rollEntry=S.budgetRolloverAmounts&&S.budgetRolloverAmounts[CMK]&&S.budgetRolloverAmounts[CMK][cat];
    const cap=baseCap+(_rollEntry?_rollEntry.amount:0);
    const pct=Math.min(100,spent/cap*100);
    const over=pct>=100,warn=pct>=80&&pct<100;
    const col=over?'var(--danger)':warn?'var(--amber)':'var(--sage)';
    const vel=_calcBudgetVelocity(spent,cap);
    const velHtml=vel===null?'':vel.ok
      ?`<div class="be-velocity vel-ok">${icon('check')} On pace · ${fmt(vel.remaining)} left</div>`
      :`<div class="be-velocity vel-warn">${icon('lightning')} Hits cap around day ${vel.hitDay}</div>`;
    const rollover=S.budgetRolloverAmounts&&S.budgetRolloverAmounts[CMK]&&S.budgetRolloverAmounts[CMK][cat];
    const rolloverHtml=rollover?`<div style="font-size:9px;color:var(--blue);margin-top:2px;">↩ +${fmt(rollover.amount)} rolled from ${rollover.from}</div>`:'';
    return`<div class="be${over?' over':warn?' warn':''}" data-action="drillDownCategory" data-arg="${esc(cat)}" title="View ${esc(cat)} expenses" role="button" tabindex="0">
      <div class="be-lbl">${esc(cat)}<button class="be-edit" data-action="openEnvModal" data-arg="${esc(cat)}" data-stop-prop title="Edit ${esc(cat)} budget" aria-label="Edit budget">edit</button></div>
      <div class="be-amt"><span class="be-spent" style="color:${col}">${fmt(spent)}</span><span class="be-cap">/ ${fmt(cap)}</span></div>
      <div class="pbar" style="height:6px;"><div class="pfill" style="width:${pct}%;background:${col};border-radius:3px;height:100%;transition:width .4s;"></div></div>
      ${velHtml}
      ${rolloverHtml}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
        <span style="font-size:10px;font-weight:600;padding:1px 5px;border-radius:8px;background:${over?'var(--danger-light)':warn?'var(--amber-light)':'var(--success-light)'};color:${col};">${pct.toFixed(0)}%</span>
        <label data-action="noop" data-stop-prop title="Roll unused budget to next month" style="display:flex;align-items:center;gap:3px;cursor:pointer;font-size:9px;color:var(--text-muted);">
          <input type="checkbox" data-change="toggleRolloverFromEl" data-change-self data-cat="${esc(cat)}" ${(S.budgetRollover&&S.budgetRollover[cat])?'checked':''} style="accent-color:var(--sage);width:11px;height:11px;">
          Roll unused to next month
        </label>
      </div>
    </div>`;
  }).join('');
  checkBudgetThresholds();
  initEnvCollapse();
}

// ── Envelope grid collapse / hover-expand ───────────────────────────────────
var _envExpanded = false;
var _envCollapseTimer = null;
var _envTouchOpen = false; // mobile: stay open until tapped again

function initEnvCollapse() {
  var wrap = document.getElementById('envCollapseWrap');
  var grid = document.getElementById('envelopesGrid');
  var pill = document.getElementById('envMorePill');
  var label = document.getElementById('envMoreLabel');
  var bar = document.getElementById('envMoreBar');
  if (!wrap || !grid || !pill) return;

  // Measure after layout — rAF ensures grid has painted
  requestAnimationFrame(function() {
    var allCards = grid.querySelectorAll('.be');
    if (!allCards.length) { pill.style.display = 'none'; wrap.style.maxHeight = ''; return; }

    // Compute how many columns fit — measure the first card width against grid width
    var gridW = grid.getBoundingClientRect().width;
    var cardW = allCards[0].getBoundingClientRect().width;
    var cols = cardW > 0 ? Math.max(1, Math.round(gridW / cardW)) : 4;
    var firstRowH = allCards[0].getBoundingClientRect().height;
    var totalH = grid.scrollHeight;
    var hiddenCount = Math.max(0, allCards.length - cols);

    if (hiddenCount === 0) {
      // Everything fits in one row — no collapse needed
      wrap.style.maxHeight = '';
      pill.style.display = 'none';
      _removeEnvListeners(wrap);
      return;
    }

    // Collapsed: clip to first row
    wrap.style.maxHeight = firstRowH + 'px';
    _envExpanded = false;
    _envTouchOpen = false;
    label.textContent = '▾ ' + hiddenCount + ' more ' + (hiddenCount === 1 ? 'category' : 'categories');
    pill.style.display = 'flex';
    bar.classList.remove('draining');

    // Store full height for expand
    wrap._fullH = totalH;
    wrap._rowH = firstRowH;

    _removeEnvListeners(wrap);
    _attachEnvListeners(wrap, pill, bar, label, hiddenCount);
  });
}

function _attachEnvListeners(wrap, pill, bar, label, hiddenCount) {
  function expand() {
    _clearEnvTimer();
    bar.classList.remove('draining');
    wrap.style.maxHeight = wrap._fullH + 'px';
    _envExpanded = true;
    label.textContent = '▴ hide';
  }
  function collapse() {
    wrap.style.maxHeight = wrap._rowH + 'px';
    _envExpanded = false;
    _envTouchOpen = false;
    label.textContent = '▾ ' + hiddenCount + ' more ' + (hiddenCount === 1 ? 'category' : 'categories');
    bar.classList.remove('draining');
  }
  function startCollapseTimer() {
    _clearEnvTimer();
    bar.classList.remove('draining');
    // Force reflow so animation restarts cleanly
    void bar.offsetWidth;
    bar.classList.add('draining');
    _envCollapseTimer = setTimeout(collapse, 3000);
  }

  // Desktop: hover on the wrap
  wrap._envEnter = function() {
    if (_envTouchOpen) return;
    expand();
  };
  wrap._envLeave = function() {
    if (_envTouchOpen) return;
    if (_envExpanded) startCollapseTimer();
  };
  wrap.addEventListener('mouseenter', wrap._envEnter);
  wrap.addEventListener('mouseleave', wrap._envLeave);

  // Cancel timer if mouse re-enters while draining
  wrap._envReEnter = function() {
    if (_envTouchOpen) return;
    _clearEnvTimer();
    bar.classList.remove('draining');
  };
  wrap.addEventListener('mouseenter', wrap._envReEnter);

  // Pill click/tap — works on both desktop and mobile
  pill._envClick = function(e) {
    e.stopPropagation();
    if (_envExpanded && _envTouchOpen) {
      // Mobile: second tap collapses
      _clearEnvTimer();
      collapse();
    } else if (_envExpanded) {
      // Desktop: pill click while open collapses immediately
      _clearEnvTimer();
      collapse();
    } else {
      // Open — on touch mark as touch-open so hover timers don't interfere
      var isTouch = e.pointerType === 'touch' || window.matchMedia('(hover:none)').matches;
      _envTouchOpen = isTouch;
      expand();
    }
  };
  pill.addEventListener('click', pill._envClick);
}

function _removeEnvListeners(wrap) {
  var pill = document.getElementById('envMorePill');
  if (wrap._envEnter) wrap.removeEventListener('mouseenter', wrap._envEnter);
  if (wrap._envLeave) wrap.removeEventListener('mouseleave', wrap._envLeave);
  if (wrap._envReEnter) wrap.removeEventListener('mouseenter', wrap._envReEnter);
  if (pill && pill._envClick) pill.removeEventListener('click', pill._envClick);
}

function _clearEnvTimer() {
  if (_envCollapseTimer) { clearTimeout(_envCollapseTimer); _envCollapseTimer = null; }
}

function toggleEnvExpand() {
  // Fallback for data-action routing — pill click handles this directly
  var pill = document.getElementById('envMorePill');
  if (pill && pill._envClick) pill._envClick({ stopPropagation: function(){}, pointerType: '' });
}

function drillDownCategory(cat){
  tagFilter=cat;
  switchTab('expenses',document.getElementById('tab-expenses'));
}
function checkBudgetThresholds(){
  if(!_notifEnabled||Notification.permission!=='granted')return;
  const totals=catTotalsForMonth();
  Object.keys(S.budgets||BDFT).forEach(cat=>{
    const spent=totals[cat]||0;
    const baseCap=(S.budgets&&S.budgets[cat])||BDFT[cat]||500;
    const _roll=S.budgetRolloverAmounts&&S.budgetRolloverAmounts[CMK]&&S.budgetRolloverAmounts[CMK][cat];
    const cap=baseCap+(_roll?_roll.amount:0);
    const pct=spent/cap*100;
    const base=`fintone_bnotif_${CMK}_${cat}`;
    if(pct>=100&&!sessionStorage.getItem(base+'_100')){
      try{new Notification('FincWin — Budget Exceeded',{body:`${cat}: ${fmt(spent)} spent (${pct.toFixed(0)}% of ${fmt(cap)} cap)`,tag:base+'_100'});}catch(e){}
      sessionStorage.setItem(base+'_100','1');
    }else if(pct>=80&&!sessionStorage.getItem(base+'_80')){
      try{new Notification('FincWin — Budget Warning',{body:`${cat}: ${pct.toFixed(0)}% of ${fmt(cap)} cap used`,tag:base+'_80'});}catch(e){}
      sessionStorage.setItem(base+'_80','1');
    }
  });
}
function toggleRollover(cat,enabled){
  if(!S.budgetRollover)S.budgetRollover={};
  S.budgetRollover[cat]=enabled;
  persist(false);
  showToast(enabled?'Rollover enabled for '+cat:'Rollover disabled for '+cat);
}
function toggleRolloverFromEl(el){toggleRollover(el.dataset.cat,el.checked);}

// Called when cloning a month — applies unused budget surplus to new month caps
function applyBudgetRollovers(fromKey,toKey){
  if(!S.budgetRollover||!S.months[fromKey]||!S.months[toKey])return;
  if(!S.budgetRolloverAmounts)S.budgetRolloverAmounts={};
  const cats=Object.keys(S.budgetRollover).filter(c=>S.budgetRollover[c]);
  cats.forEach(cat=>{
    const cap=S.budgets[cat]||0;
    const spent=S.months[fromKey].weeks.reduce((sum,w)=>sum+w.items.filter(i=>CAT_LABELS[getCat(i.name)]===cat).reduce((s,i)=>s+amt(i.amount),0),0);
    const surplus=Math.max(0,Math.round((cap-spent)*100)/100);
    if(surplus>0){
      if(!S.budgetRolloverAmounts[toKey])S.budgetRolloverAmounts[toKey]={};
      S.budgetRolloverAmounts[toKey][cat]={amount:surplus,from:fromKey};
    }
  });
}

// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// CATEGORY MANAGER
// ══════════════════════════════════════════════

// Default keywords per built-in category (subset of CAT_MAP for display)
const _CAT_DEFAULT_KW={
  'Banking':['bank charges','bank fee','service charge','overdraft','annual fee'],
  'Telecom':['phone plan','mobile plan','broadband','internet bill','verizon','at&t','t-mobile'],
  'Subscriptions':['netflix','spotify','disney+','hulu','amazon prime','youtube premium','subscription','adobe'],
  'Auto':['car insurance','auto insurance','car payment','fuel','gas station','parking','toll'],
  'Utilities':['electricity','water bill','gas bill','council tax','natural gas'],
  'Housing':['rent','mortgage','property tax','home insurance','hoa','maintenance'],
  'Food/Meals':['grocery','groceries','restaurant','dining','takeout','doordash','ubereats','coffee'],
  'Entertainment':['movie','cinema','concert','gaming','steam','playstation','xbox','bar'],
  'Fees':['late fee','penalty','processing fee','atm fee','foreign transaction'],
  'Health':['health insurance','dental','pharmacy','doctor','gym','fitness'],
  'Loan Pmt':['student loan','personal loan','credit card payment','loan payment','minimum payment'],
  'Tuition':['tuition','school fee','college','university','course','education'],
  'Savings':['savings','emergency fund','vacation fund','retirement'],
  'Other':[]
};

// Internal working state for the modal
let _catMgrRows=[];

function openBulkBudgetModal(){
  _catMgrBuild();
  document.getElementById('bulkBudgetModal').classList.add('open');
  trapFocus(document.getElementById('bulkBudgetModal'));
  setTimeout(()=>{const f=document.querySelector('#bulkBudgetModal input');if(f)f.focus();},120);
}

function _catMgrBuild(){
  const budgets=S.budgets||{};
  const savedKw=S.categoryKeywords||{};
  // Built-in categories — use saved keyword overrides when present, else defaults
  const builtIn=Object.keys(BDFT).map(name=>({
    type:'builtin', name, cap:budgets[name]!=null?budgets[name]:BDFT[name],
    keywords:savedKw[name]?[...savedKw[name]]:[...(_CAT_DEFAULT_KW[name]||[])]
  }));
  // Custom categories
  const custom=(S.customCategories||[]).map(cc=>({
    type:'custom', id:cc.id, name:cc.name,
    cap:budgets[cc.name]!=null?budgets[cc.name]:0,
    keywords:[...(cc.keywords||[])]
  }));
  _catMgrRows=[...builtIn,...custom];
  _catMgrRender();
}

function _catMgrRender(){
  const wrap=document.getElementById('catMgrRows');
  if(!wrap)return;
  wrap.innerHTML='';
  // Section: built-in
  const builtIn=_catMgrRows.filter(r=>r.type==='builtin');
  const custom=_catMgrRows.filter(r=>r.type==='custom');

  function renderSection(rows,label){
    if(!rows.length)return;
    const hdr=document.createElement('div');
    hdr.style.cssText='font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);padding:8px 0 4px;border-bottom:1px solid var(--border);margin-bottom:4px;';
    hdr.textContent=label;
    wrap.appendChild(hdr);
    rows.forEach(row=>{
      const idx=_catMgrRows.indexOf(row);
      wrap.appendChild(_catMgrRowEl(row,idx));
    });
  }
  renderSection(builtIn,'Built-in categories');
  renderSection(custom,'Custom categories');
}

function _catMgrRowEl(row,idx){
  const div=document.createElement('div');
  div.className='catmgr-row';
  div.dataset.idx=idx;

  // Name
  const nameInp=document.createElement('input');
  nameInp.className='catmgr-name-inp fi';
  nameInp.type='text';
  nameInp.value=row.name;
  nameInp.placeholder='Category name';
  nameInp.maxLength=40;
  nameInp.setAttribute('aria-label','Category name');
  if(row.type==='builtin'){nameInp.readOnly=true;nameInp.title='Built-in category name (read-only)';}
  nameInp.addEventListener('change',function(){_catMgrRows[idx].name=this.value.trim();});

  // Cap
  const capWrap=document.createElement('div');
  capWrap.className='catmgr-cap-wrap';
  const sym=document.createElement('span');
  sym.textContent=getCurrency().symbol;
  sym.style.cssText='font-size:11px;color:var(--text-muted);';
  const capInp=document.createElement('input');
  capInp.className='catmgr-cap-inp fi';
  capInp.type='number';capInp.min='0';capInp.step='1';
  capInp.value=amt(row.cap);
  capInp.setAttribute('aria-label','Monthly cap');
  capInp.addEventListener('change',function(){_catMgrRows[idx].cap=storeCents(parseFloat(this.value)||0);});
  capWrap.appendChild(sym);capWrap.appendChild(capInp);

  // Keywords chip area
  const kwWrap=document.createElement('div');
  kwWrap.className='catmgr-kw-wrap';

  function renderChips(){
    kwWrap.innerHTML='';
    row.keywords.forEach((kw,ki)=>{
      const chip=document.createElement('span');
      chip.className='catmgr-chip';
      chip.textContent=kw;
      const del=document.createElement('button');
      del.type='button';del.className='catmgr-chip-del';del.textContent='×';
      del.setAttribute('aria-label','Remove keyword '+kw);
      del.onclick=function(){row.keywords.splice(ki,1);renderChips();};
      chip.appendChild(del);
      kwWrap.appendChild(chip);
    });
    // Add input
    const addInp=document.createElement('input');
    addInp.type='text';addInp.placeholder='+ keyword';addInp.className='catmgr-kw-inp';
    addInp.setAttribute('aria-label','Add keyword');
    function commitKw(){
      const v=addInp.value.trim().toLowerCase();
      if(v&&!row.keywords.includes(v)){row.keywords.push(v);renderChips();}
      else addInp.value='';
    }
    addInp.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===','){e.preventDefault();commitKw();}
      if(e.key==='Backspace'&&!this.value&&row.keywords.length){row.keywords.pop();renderChips();}
    });
    addInp.addEventListener('blur',function(){if(this.value.trim())commitKw();});
    kwWrap.appendChild(addInp);
  }
  renderChips();

  // Delete (custom only)
  let delBtn = null;
  if(row.type==='custom'){
    delBtn=document.createElement('button');
    delBtn.type='button';delBtn.className='catmgr-del-btn';delBtn.title='Delete category';
    delBtn.setAttribute('aria-label','Delete category '+row.name);
    delBtn.innerHTML=icon('close',{label:'Delete category'});
    delBtn.onclick=function(){
      if(!confirm('Delete category "'+(_catMgrRows[idx].name||'this category')+'"? Existing expenses using it will move to Other.'))return;
      _catMgrRows.splice(idx,1);_catMgrRender();
    };
  }

  // Append in grid column order: name | cap | keywords | delete
  div.appendChild(nameInp);
  div.appendChild(capWrap);
  div.appendChild(kwWrap);
  if(delBtn) div.appendChild(delBtn);
  return div;
}

function catMgrAddRow(){
  _catMgrRows.push({type:'custom',id:'cc'+Date.now(),name:'',cap:0,keywords:[]});
  _catMgrRender();
  // focus the new name input
  setTimeout(()=>{
    const inputs=document.querySelectorAll('.catmgr-name-inp');
    if(inputs.length){inputs[inputs.length-1].focus();}
    const scroll=document.getElementById('catMgrScroll');
    if(scroll)scroll.scrollTop=scroll.scrollHeight;
  },60);
}

function closeBulkBudgetModal(){
  releaseTrap(document.getElementById('bulkBudgetModal'));
  document.getElementById('bulkBudgetModal').classList.remove('open');
}

function saveBulkBudgets(){
  if(!S.budgets)S.budgets={};

  // Collect current name inputs (may have changed for custom)
  const rows=_catMgrRows;

  // Validate: no blank names
  for(const r of rows){
    if(!r.name.trim()){showToast('⚠ Every category needs a name','warn-t');return;}
  }

  // Built-in: update caps and persist any keyword edits
  if(!S.categoryKeywords)S.categoryKeywords={};
  const builtIn=rows.filter(r=>r.type==='builtin');
  builtIn.forEach(r=>{
    S.budgets[r.name]=r.cap;
    S.categoryKeywords[r.name]=r.keywords;
  });

  // Custom: rebuild S.customCategories, handle renames, update budgets
  const oldCustom=S.customCategories||[];
  const newCustom=rows.filter(r=>r.type==='custom');

  // Rename detection: match by id
  newCustom.forEach(r=>{
    const old=oldCustom.find(c=>c.id===r.id);
    if(old&&old.name!==r.name){
      // Rename: migrate budget key and expense category references
      if(S.budgets[old.name]!=null){S.budgets[r.name]=S.budgets[old.name];delete S.budgets[old.name];}
      Object.values(S.months).forEach(m=>{
        m.weeks.forEach(w=>{
          w.items.forEach(item=>{if(item.category==='cat-custom-'+r.id){}/* id-based, no action needed */});
        });
      });
    }
    S.budgets[r.name]=r.cap;
  });

  // Remove budget keys for deleted custom categories
  const newCustomIds=new Set(newCustom.map(r=>r.id));
  oldCustom.forEach(c=>{if(!newCustomIds.has(c.id))delete S.budgets[c.name];});

  // Save custom categories with updated keywords
  S.customCategories=newCustom.map(r=>({
    id:r.id,
    name:r.name.trim(),
    keywords:r.keywords,
    bg: (oldCustom.find(c=>c.id===r.id)||{}).bg||'var(--sage-light)',
    color:(oldCustom.find(c=>c.id===r.id)||{}).color||'var(--sage)'
  }));

  persist();
  closeBulkBudgetModal();
  if(typeof renderEnvelopes==='function')renderEnvelopes();
  showToast('✓ Categories saved');
}

// ══════════════════════════════════════════════
// HEATMAP TOGGLE (Expenses tab)
// ══════════════════════════════════════════════
function toggleExpHeatmap(){
  const wrap=document.getElementById('expHeatmapWrap');
  const hdr=wrap&&wrap.closest('.card')&&wrap.closest('.card').querySelector('[data-action="toggleExpHeatmap"]');
  if(!wrap)return;
  const isHidden=wrap.style.display==='none';
  wrap.style.display=isHidden?'':'none';
  const toggle=document.getElementById('expHeatmapToggle');
  const chevronLeft='<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="10 13 5 8 10 3"/></svg>';
  const chevronRight='<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="6 3 11 8 6 13"/></svg>';
  if(toggle){toggle.innerHTML=isHidden?chevronLeft+' Hide':chevronRight+' Show';}
  if(hdr)hdr.setAttribute('aria-expanded',isHidden?'true':'false');
  if(isHidden&&typeof renderSpendingHeatmap==='function')renderSpendingHeatmap();
}

// ──────────────────────────────────────────────
// MONTH COMPLETE CHECK
// ──────────────────────────────────────────────
let _lastMonthComplete='';
function checkMonthComplete(){
  const allExpPaid=cw().every(w=>w.items.length===0||w.items.every(i=>i.paid));
  const allRevReceived=cr().length>0&&cr().every(r=>r.received);
  const totalItems=cw().reduce((s,w)=>s+w.items.length,0);
  if(allExpPaid&&allRevReceived&&totalItems>0&&_lastMonthComplete!==CMK){
    _lastMonthComplete=CMK;
    const rev=totalRev(),exp=totalExp(),net=rev-exp;
    const score=typeof calcHealth==='function'?calcHealth().total:null;
    const grade=score!==null?(score>=95?'A+':score>=85?'A':score>=75?'B':score>=60?'C':score>=40?'D':'F'):'—';
    const gradeColor=grade==='A+'||grade==='A'?'var(--success)':grade==='B'?'var(--blue)':grade==='C'?'var(--amber)':'var(--danger)';
    if(score!==null)dispatch('MONTH_SET_SCORE',{mk:CMK,score},false);
    const _capturedCMK = CMK;
    setTimeout(()=>{
      if (CMK !== _capturedCMK) return; // user navigated away
      launchConfetti(180);
      showToast('🎊 '+CMK+' is complete — all paid & all income received!');
      let banner=document.getElementById('monthCompleteBanner');
      if(!banner){
        banner=document.createElement('div');
        banner.id='monthCompleteBanner';
        banner.className='month-complete-banner no-print';
        banner.innerHTML=`<span style="font-size:24px;">🎊</span>
          <div style="flex:1;">
            <strong style="font-size:13px;color:var(--success);">${CMK} Complete!</strong>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">All expenses paid · All income received</div>
            <div style="margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:11px;">Net: <strong style="color:${net>=0?'var(--success)':'var(--danger)'};">${net>=0?'+':''}${fmt(Math.abs(net))}</strong></span>
              ${score!==null?`<span style="font-size:11px;font-weight:700;padding:1px 7px;border-radius:8px;background:var(--surface);color:${gradeColor};">Grade ${grade} · ${score}/100</span>`:''}
              <button class="tbtn" style="font-size:10px;padding:2px 8px;color:var(--sage);border-color:var(--sage-mid);" data-action="promptArchiveCurrentMonth">Archive Month →</button>
            </div>
          </div>`;
        const expSection=document.getElementById('section-expenses');
        if(expSection)expSection.insertAdjacentElement('afterbegin',banner);
      }
    },500);
  }
}

function promptArchiveCurrentMonth(){
  if(typeof confirmArchiveMonth==='function'){confirmArchiveMonth(CMK);return;}
  // fallback — confirmArchiveMonth not loaded yet
  if(Object.keys(S.months).length<=1){showToast('Cannot archive — keep at least one active month','warn-t');return;}
  archiveMonth(CMK);
  const b=document.getElementById('monthCompleteBanner');if(b)b.remove();
  _lastMonthComplete='';
}

// ── KEYBOARD: Escape closes any open modal ──
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    document.querySelectorAll('.modal-overlay.open').forEach(function(m){
      var closeFn=m.dataset.selfClose;
      if(closeFn&&typeof window[closeFn]==='function'){window[closeFn]();}
      else{m.classList.remove('open');if(typeof releaseTrap==='function')releaseTrap(m);}
    });
  }
});

// ══════════════════════════════════════════════
// PWA SETUP — register static manifest + service worker
(function initPWA(){
  if('serviceWorker' in navigator && location.protocol !== 'file:'){
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
    // Handle SW_UPDATED message from activated service worker (audit P-01).
    navigator.serviceWorker.addEventListener('message', function(ev){
      if(ev.data && ev.data.type==='SW_UPDATED'){
        if(typeof showToast==='function') showToast('App updated — reload for the latest version','info-t');
      }
    });
  }
})();

// ── SWIPE MONTH NAVIGATION ──
// Left swipe → next month, right swipe → previous month.
// Ignores swipes that start on modals, cards, or are more vertical than horizontal.
(function initSwipeNav(){
  let _sx=null,_sy=null;
  const main=document.getElementById('main-content');
  if(!main)return;
  main.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    _sx=e.touches[0].clientX;_sy=e.touches[0].clientY;
  },{passive:true});
  main.addEventListener('touchend',e=>{
    if(_sx===null||e.changedTouches.length!==1)return;
    const dx=e.changedTouches[0].clientX-_sx;
    const dy=e.changedTouches[0].clientY-_sy;
    _sx=null;_sy=null;
    if(Math.abs(dx)<60||Math.abs(dx)<Math.abs(dy)*1.5)return;
    if(e.target.closest('.modal-overlay,.ob-card,.week-card,.goal-card,.ai-stream-area'))return;
    changeMonth(dx<0?1:-1);
  },{passive:true});
})();

// ── PWA INSTALL PROMPT ──
(function initInstallPrompt(){
  var _standalone = window.matchMedia('(display-mode: standalone)').matches
                  || !!window.navigator.standalone;

  // Increment session counter on each page load for the 3rd-session banner
  var _sessionCount = parseInt(localStorage.getItem('finflow_session_count') || '0', 10) + 1;
  localStorage.setItem('finflow_session_count', String(_sessionCount));

  var _deferred = null;

  function _hidePwaUI(){
    var btn = document.getElementById('installPwaBtn');
    if(btn) btn.style.display = 'none';
    var mob = document.getElementById('installPwaBtnMobile');
    if(mob) mob.style.display = 'none';
    var banner = document.getElementById('pwaInstallBanner');
    if(banner) banner.remove();
  }

  function _triggerInstall(){
    if(!_deferred) return;
    _deferred.prompt();
    _deferred.userChoice.then(function(result){
      if(result.outcome === 'accepted'){ _deferred = null; _hidePwaUI(); }
    });
  }

  function _showBanner(){
    if(localStorage.getItem('finflow_install_banner_dismissed')) return;
    if(document.getElementById('pwaInstallBanner')) return;
    var banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.className = 'pwa-install-banner no-print';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Install FincWin');
    banner.innerHTML = '<span class="pwa-banner-icon">'+icon('download',{label:'Install'})+' </span>'
      + '<span class="pwa-banner-text"><strong>Install FincWin</strong> — works offline, opens like an app</span>'
      + '<button class="pwa-banner-install" aria-label="Install FincWin">Install</button>'
      + '<button class="pwa-banner-dismiss" aria-label="Dismiss install prompt">'+icon('close',{label:'Dismiss'})+'</button>';
    banner.querySelector('.pwa-banner-install').addEventListener('click', function(){
      _triggerInstall(); banner.remove();
      document.documentElement.style.removeProperty('--banner-h');
    });
    banner.querySelector('.pwa-banner-dismiss').addEventListener('click', function(){
      localStorage.setItem('finflow_install_banner_dismissed', '1');
      banner.remove();
      document.documentElement.style.removeProperty('--banner-h');
    });
    var topbar = document.querySelector('.topbar');
    if(topbar) {
      topbar.insertAdjacentElement('beforebegin', banner);
      var bh = banner.getBoundingClientRect().height || 38;
      document.documentElement.style.setProperty('--banner-h', bh + 'px');
    } else {
      document.body.insertAdjacentElement('afterbegin', banner);
      document.documentElement.style.setProperty('--banner-h', '38px');
    }
  }

  // D2 — already installed: suppress all install UI
  if(_standalone){
    _hidePwaUI();
    window._updateInstallSettingsRow = function(){
      var sub = document.getElementById('installAppSub');
      if(sub) sub.textContent = 'FincWin is installed on this device ✓';
      var btn = document.getElementById('installAppBtn');
      if(btn){ btn.textContent = '✓ Installed'; btn.disabled = true; btn.style.opacity = '0.6'; }
    };
    window.pwaInstallFromSettings = function(){
      if(typeof showToast === 'function') showToast('FincWin is already installed on this device');
    };
    return;
  }

  // D1 — show topbar icon and wire mobile button when browser signals eligibility
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    _deferred = e;
    var btn = document.getElementById('installPwaBtn');
    if(btn){ btn.style.display = ''; btn.onclick = _triggerInstall; }
    var mob = document.getElementById('installPwaBtnMobile');
    if(mob){ mob.style.display = ''; mob.onclick = _triggerInstall; }
    // D1 — one-time dismissible banner after the user's 3rd session
    if(_sessionCount >= 3) _showBanner();
  });

  // D2 — post-install: hide UI, fire gamification milestone
  window.addEventListener('appinstalled', function(){
    _hidePwaUI();
    if(typeof unlockAchievement === 'function') unlockAchievement('app_installed');
  });

  // Settings row helpers
  window._updateInstallSettingsRow = function(){};
  window.pwaInstallFromSettings = function(){
    if(_deferred){ _triggerInstall(); return; }
    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if(typeof showToast === 'function'){
      showToast(isIOS
        ? 'Tap the Share button ↑ then “Add to Home Screen”'
        : 'Look for the install icon in your browser address bar');
    }
  };
})();

// Handle physical keyboard on lock screen
document.addEventListener('keydown', function(e){
  if(document.getElementById('lockScreen').style.display!=='none'){
    if(e.key>='0'&&e.key<='9'){lockKeyPress(e.key);e.preventDefault();}
    else if(e.key==='Backspace'){lockKeyPress('del');e.preventDefault();}
  }
});

// ── KEYBOARD SHORTCUTS (desktop) ──
(function initKeyboardShortcuts(){
  document.addEventListener('keydown',function(e){
    const tag=e.target.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') return;
    if(document.querySelector('.modal-overlay.open')) return;
    if(document.getElementById('lockScreen').style.display!=='none') return;
    if(document.getElementById('onboardOverlay').style.display!=='none') return;
    if(e.metaKey||e.ctrlKey||e.altKey) return;
    switch(e.key){
      case 'g':case 'G':e.preventDefault();switchTab('dashboard',document.getElementById('tab-dashboard'));break;
      case 'e':case 'E':e.preventDefault();switchTab('expenses',document.getElementById('tab-expenses'));break;
      case 'r':case 'R':e.preventDefault();switchTab('revenue',document.getElementById('tab-revenue'));break;
      case 'l':case 'L':e.preventDefault();switchTab('loans',document.getElementById('tab-loans'));break;
      case 's':case 'S':e.preventDefault();switchTab('savings',document.getElementById('tab-savings'));break;
      case 'a':case 'A':e.preventDefault();switchTab('analytics',document.getElementById('tab-analytics'));break;
      case 'c':case 'C':e.preventDefault();switchTab('analytics',document.getElementById('tab-analytics'));setTimeout(function(){var el=document.getElementById('coachSection');if(el)el.scrollIntoView({behavior:'smooth'});},260);break;
      case 'n':case 'N':
        e.preventDefault();
        switchTab('expenses',document.getElementById('tab-expenses'));
        setTimeout(()=>openItemModal(0,-1),200);
        break;
      case '/':
        e.preventDefault();
        if(typeof openSearch==='function') openSearch();
        break;
      case '?':
        e.preventDefault();
        if(typeof openShortcutsModal==='function') openShortcutsModal();
        break;
      case 'ArrowLeft':
        if(document.getElementById('searchOverlay')&&document.getElementById('searchOverlay').style.display!=='none') break;
        e.preventDefault();changeMonth(-1);break;
      case 'ArrowRight':
        if(document.getElementById('searchOverlay')&&document.getElementById('searchOverlay').style.display!=='none') break;
        e.preventDefault();changeMonth(1);break;
    }
  });
})();

// ── ONLINE/OFFLINE INDICATOR ──
(function(){
  var _offlineDismissTimer=null;
  function showConnStatus(state){
    let bar=document.getElementById('connBar');
    if(!bar){
      bar=document.createElement('div');
      bar.id='connBar';
      bar.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9999;font-size:12px;font-weight:600;text-align:center;padding:6px;transition:transform .3s;transform:translateY(100%)';
      document.body.appendChild(bar);
    }
    // D-13: float bar above mobile bottom nav on small viewports
    bar.style.bottom=window.innerWidth<=600?'60px':'0';
    // Cancel any pending offline dismiss before switching state
    if(_offlineDismissTimer!==null){clearTimeout(_offlineDismissTimer);_offlineDismissTimer=null;}
    if(state==='offline'){
      bar.style.background='var(--danger)';
      bar.style.color='var(--bg)';
      bar.textContent='⚠ You\'re offline — data saved locally';
      bar.style.transform='translateY(0)';
      document.body.classList.add('offline-mode'); // persistent CSS hook for future indicators
      _offlineDismissTimer=setTimeout(()=>bar.style.transform='translateY(100%)',8000);
    } else if(state==='syncing'){
      bar.style.background='var(--amber)';
      bar.style.color='var(--bg)';
      bar.textContent='↑ Syncing...';
      bar.style.transform='translateY(0)';
    } else { // 'synced'
      document.body.classList.remove('offline-mode');
      bar.style.background='var(--success)';
      bar.style.color='var(--bg)';
      bar.textContent='✓ Back online';
      bar.style.transform='translateY(0)';
      setTimeout(()=>bar.style.transform='translateY(100%)',2500);
    }
  }
  var _syncFallbackTimer=null;
  var _syncDoneHandler=null;
  function _cancelSyncWait(){
    if(_syncFallbackTimer!==null){clearTimeout(_syncFallbackTimer);_syncFallbackTimer=null;}
    if(_syncDoneHandler!==null){window.removeEventListener('fincwin:sync-complete',_syncDoneHandler);_syncDoneHandler=null;}
  }
  window.addEventListener('online',function(){
    _cancelSyncWait(); // discard any stale timer/listener from a previous online event
    var cloudActive=typeof S!=='undefined'&&S&&S.syncConfig&&S.syncConfig.cloudEnabled&&S.activeBackend!==null;
    if(cloudActive){
      showConnStatus('syncing');
      _syncDoneHandler=function(){
        _cancelSyncWait();
        showConnStatus('synced');
      };
      window.addEventListener('fincwin:sync-complete',_syncDoneHandler,{once:true});
      _syncFallbackTimer=setTimeout(function(){
        _cancelSyncWait();
        showConnStatus('synced');
      },8000);
    } else {
      showConnStatus('synced');
    }
  });
  window.addEventListener('offline',function(){
    _cancelSyncWait(); // prevent stale timer from overwriting offline bar
    showConnStatus('offline');
  });
  if(!navigator.onLine) showConnStatus('offline');
})();

// ══════════════════════════════════════════════
// RESET ALL DATA
// ══════════════════════════════════════════════
async function resetAllData(){
  // Clear in-memory AI key cache
  if(typeof clearAIKeyCache==='function') clearAIKeyCache();
  // Wipe IndexedDB (state + PIN + AI keys)
  try{
    if(!_idb) _idb=await openIDB().catch(()=>null);
    if(_idb){
      await new Promise(res=>{
        const tx=_idb.transaction([IDB_STORE,IDB_PIN_STORE],'readwrite');
        tx.objectStore(IDB_STORE).clear();
        tx.objectStore(IDB_PIN_STORE).clear();
        tx.oncomplete=res; tx.onerror=res;
      });
    }
  }catch(e){}
  // Wipe localStorage
  [SK,SK+'_migrated','finflow_onboarded',PIN_IDB_KEY,
   _CLAUDE_KEY,_OPENAI_KEY,_AI_PREF].forEach(k=>{
    try{localStorage.removeItem(k);}catch(e){}
  });
  // Blank state — no demo data
  const blankWeeks=[{items:[]},{items:[]},{items:[]},{items:[]}];
  S={
    loans:[],strategy:'avalanche',savings:[],
    budgets:{...BDFT},budgetRollover:{},financialGoals:[],customCategories:[],scheduledExpenses:[],
    darkMode:S?S.darkMode:false,archiveThreshold:6,archivedMonths:{},
    currency:{symbol:'$',code:'CAD',locale:'en-CA'},
    fxRates:{rates:{},fetchedAt:0,base:'CAD'},
    months:{[CMK]:{weeks:blankWeeks,revenue:[]}},
    currentMonthKey:CMK,
    xp:0,xpLevel:1,achievements:[],monthChallenge:{}
  };
  await persist(false);
  // Reset UI
  document.getElementById('loanBadge').textContent='0';
  document.getElementById('demoBanner').style.display='none';
  document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
  updateClaudeBtn();
  renderDash();
  updateHealth();
  if(typeof updateArchiveBadge==='function')updateArchiveBadge();
  showToast('All data cleared. Starting fresh.');
  showOnboarding();
}

// ══════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════
(async function boot(){
  // Returning users (completed onboarding) must have an active licence key.
  // First-time visitors are allowed through so onboarding/demo can run.
  if (!localStorage.getItem('fw_license_key') && localStorage.getItem('finflow_onboarded')) {
    window.location.replace('./signin.html');
    return;
  }
  if(!window.crypto || !window.crypto.subtle){
    var _cryptoErr=document.createElement('div');
    _cryptoErr.style.cssText='position:fixed;top:0;left:0;right:0;padding:14px 16px;background:#c53030;color:#fff;font-size:15px;text-align:center;z-index:9999;';
    _cryptoErr.textContent='FincWin requires the Web Cryptography API, which is unavailable in your browser. Please use Chrome, Firefox, Edge, or Safari 15+ over HTTPS.';
    document.body?document.body.prepend(_cryptoErr):document.addEventListener('DOMContentLoaded',function(){document.body.prepend(_cryptoErr);});
    return;
  }
  // checkLock() MUST run before initState() so that _sessionKey is derived
  // from the correct PIN before initState() attempts to decrypt IDB data.
  // checkLock() returns a Promise that resolves when the PIN is entered (or
  // immediately if no PIN is set). See state.js for the full design.
  await checkLock();
  await initState();
  if (typeof _initBC === 'function') _initBC();
  if (typeof window.handleOAuthReturn === 'function') await window.handleOAuthReturn();
  if (typeof checkSyncTokenOnLoad === 'function') await checkSyncTokenOnLoad();
  // Migrate localStorage to IDB if not yet done
  if(!localStorage.getItem(SK+'_migrated'))await migrateToIDB();
  // Load AI keys from IDB (_settingsIdbGet will decrypt with session key if set)
  if(typeof loadAIKeys==='function') await loadAIKeys();
  migrateAmountsToCents();
  runAutoArchive();
  // Expand any quarterly/yearly scheduled expenses into current month
  expandScheduledExpenses(CMK);
  // Auto-populate recurring income sources for current month
  if(typeof expandRecurringRevenue==='function')expandRecurringRevenue(CMK);
  // Check savings autopilot (create transfer expense if today is transfer day)
  if(typeof checkSavingsAutopilot==='function')checkSavingsAutopilot();
  loadTheme();
  if(typeof loadDesign==='function')loadDesign();
  applyDark();
  updateMonthLabel();
  renderMonthTags();
// Set strategy buttons correctly
document.getElementById('btn-avalanche').classList.toggle('active',S.strategy==='avalanche');
document.getElementById('btn-snowball').classList.toggle('active',S.strategy==='snowball');
  renderDash();
  updateHealth();
  updateClaudeBtn();
  // Update loan badge on boot from saved data
  document.getElementById('loanBadge').textContent=S.loans.length;
  // Show demo banner or onboarding for first-time users
  checkDemoBanner();
  if(!localStorage.getItem('finflow_onboarded')) showOnboarding();
  // Wire ob-label divs to adjacent inputs with aria-labelledby (accessibility fix).
  // This runs once on boot for all static HTML labels without needing to change 30+
  // div→label tags in index.html.
  (function wireObLabels(){
    document.querySelectorAll('.ob-label').forEach(function(lbl,idx){
      var id='ob-lbl-'+idx;
      lbl.setAttribute('id',id);
      var parent=lbl.parentElement;
      var ctrl=parent&&parent.querySelector('input:not([type=hidden]),select,textarea');
      if(ctrl&&!ctrl.getAttribute('aria-labelledby'))ctrl.setAttribute('aria-labelledby',id);
    });
  })();

  // Fetch live FX rates after boot so multi-currency totals are accurate (E6)
  if(typeof fetchFXRates==='function'){
    fetchFXRates(getCurrency().code).then(function(){
      // Refresh the dashboard KPI row after rates load (if already rendered)
      if(typeof _dashDirty!=='undefined'){_dashDirty=true;}
      if(typeof renderDash==='function')renderDash();
    }).catch(function(){});
  }
})();
