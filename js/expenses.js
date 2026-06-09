// === expenses.js ===

const _collapsedWeeks=new Set();
function toggleWeekCollapse(wi){
  if(_collapsedWeeks.has(wi))_collapsedWeeks.delete(wi);
  else _collapsedWeeks.add(wi);
  renderExpenses();
}

function renderTagFilter(){
  const cats=[...new Set(cw().flatMap(w=>w.items.map(i=>getCatLabel(i.category||getCat(i.name)))))];
  document.getElementById('tagFilterBar').innerHTML=
    `<span class="tag-pill${!tagFilter?' sel':''}" data-action="setTagFilter" data-arg="">All</span>`+
    cats.map(c=>`<span class="tag-pill${tagFilter===c?' sel':''}" data-action="setTagFilter" data-arg="${esc(c)}">${esc(c)}</span>`).join('');
}
function setTagFilter(f){tagFilter=f;renderExpenses();}

function buildRecurringSet(){
  // Returns a Set of lowercased item names that appear in 2+ different months
  const byMonth={};
  Object.values(S.months).forEach(m=>{
    const seen=new Set();
    m.weeks.forEach(w=>w.items.forEach(i=>{
      const k=i.name.trim().toLowerCase();
      if(!seen.has(k)){seen.add(k);byMonth[k]=(byMonth[k]||0)+1;}
    }));
  });
  return new Set(Object.entries(byMonth).filter(([,c])=>c>=2).map(([k])=>k));
}
function detectRecurring(){
  // Count occurrences per MONTH (not per week) to avoid false positives
  const byMonth={};
  Object.entries(S.months).forEach(([mkey,m])=>{
    const seen=new Set();
    m.weeks.forEach(w=>w.items.forEach(i=>{
      const k=i.name.trim().toLowerCase();
      if(!seen.has(k)){
        seen.add(k);
        if(!byMonth[k])byMonth[k]={name:i.name,count:0,amounts:[]};
        byMonth[k].count++;
        // Average amount across months
        const monthAvg=m.weeks.reduce((s,wk)=>s+wk.items.filter(it=>it.name.trim().toLowerCase()===k).reduce((a,it)=>a+it.amount,0),0);
        byMonth[k].amounts.push(monthAvg);
      }
    }));
  });
  return Object.values(byMonth).filter(r=>r.count>=2).sort((a,b)=>b.count-a.count);
}
function isRecurring(name){
  // Count how many DIFFERENT months contain this item name (not weeks within same month)
  const k=name.trim().toLowerCase();
  let monthCount=0;
  Object.values(S.months).forEach(m=>{
    const found=m.weeks.some(w=>w.items.some(i=>i.name.trim().toLowerCase()===k));
    if(found)monthCount++;
  });
  return monthCount>=2;
}

function recurringAutoFill(){
  // Find bills that appear in 2+ previous months but are NOT yet in current month
  const curNames=new Set(cw().flatMap(w=>w.items.map(i=>i.name.trim().toLowerCase())));
  const prevMonths=Object.keys(S.months).filter(k=>k!==CMK);
  const recSet=buildRecurringSet();
  let added=0;
  // For each recurring item not already in current month, add it to the week matching its dueDay
  const seen=new Set();
  prevMonths.forEach(mk=>{
    S.months[mk].weeks.forEach(w=>w.items.forEach(item=>{
      const k=item.name.trim().toLowerCase();
      if(recSet.has(k)&&!curNames.has(k)&&!seen.has(k)){
        seen.add(k);
        const due=item.dueDay||null;
        const wi=due?getWeekForDay(due,CMK):0;
        cw()[wi].items.push({name:item.name,amount:storeCents(item.amount),paid:false,dueDay:due,note:'',receipt:null});
        added++;
      }
    }));
  });
  if(added>0){persist();renderExpenses();showToast(`✓ Added ${added} recurring bill${added>1?'s':''} to the correct week`);}
  else showToast('No new recurring bills to add','warn-t');
}

// ── DRAG REORDER ──
let _dragSrcWi=-1, _dragSrcIi=-1;
let _cachedCatTotals=null; // shared between renderExpenses and renderEnvelopes
function dragStart(e,wi,ii){
  _dragSrcWi=wi;_dragSrcIi=ii;
  const row=e.target.closest('[data-wi]');
  if(!row)return;
  row.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain','');
}
function dragOver(e){
  e.preventDefault();e.dataTransfer.dropEffect='move';
  const row=e.target.closest('[data-wi]');
  if(!row)return;
  row.classList.add('drag-over');
}
function dragLeave(e){
  const row=e.target.closest('[data-wi]');
  if(!row)return;
  row.classList.remove('drag-over');
}
function dragDrop(e,wi,ii){
  e.preventDefault();
  const row=e.target.closest('[data-wi]');
  if(!row)return;
  row.classList.remove('drag-over');
  if(_dragSrcIi===ii&&_dragSrcWi===wi)return; // same slot — no-op
  if(_dragSrcWi===wi){
    // Same-week reorder
    const items=cw()[wi].items;
    const moved=items.splice(_dragSrcIi,1)[0];
    const targetIdx=_dragSrcIi<ii?ii-1:ii;
    items.splice(targetIdx,0,moved);
    persist();renderExpenses();
  } else {
    // Cross-week move
    const srcItems=cw()[_dragSrcWi].items;
    const tgtItems=cw()[wi].items;
    if(!srcItems||!tgtItems)return;
    const moved=srcItems.splice(_dragSrcIi,1)[0];
    tgtItems.splice(Math.min(ii,tgtItems.length),0,moved);
    persist();renderExpenses();
  }
}
function dragEnd(e){
  const row=e.target.closest('[data-wi]');
  if(!row)return;
  row.classList.remove('dragging');
}

// ── RECURRING SET CACHE ──
let _recurSetCache=null;
let _recurSetCacheKey='';

// ── TOUCH DRAG REORDER (Pointer Events — D-14 through D-18) ──
let _touchSrcWi=-1, _touchSrcIi=-1;
let _touchGhost=null;
let _touchOverRow=null;
let _touchStartX=0, _touchStartY=0;
let _touchDragActive=false;

function _onTouchDragStart(e){
  if(e.pointerType!=='touch')return;  // mouse falls through to HTML5 drag handlers
  if(_bulkMode)return;                // no drag in bulk-select mode (D-14)
  const row=e.currentTarget;            // the <tr data-wi> element
  _touchSrcWi=+row.dataset.wi;
  _touchSrcIi=+row.dataset.ii;
  _touchStartX=e.clientX;
  _touchStartY=e.clientY;
  _touchDragActive=false;
  e.currentTarget.setPointerCapture(e.pointerId); // D-18: capture on <tr>
}

function _onTouchDragMove(e){
  if(_touchSrcWi===-1)return;
  if(!_touchDragActive){
    // Movement threshold: only start drag after 8px movement (D-15, pitfall 4)
    if(Math.hypot(e.clientX-_touchStartX,e.clientY-_touchStartY)<8)return;
    _touchDragActive=true;
    const row=e.currentTarget;
    row.style.opacity='0.4';                      // original row semi-transparent
    // Create ghost element (D-15)
    _touchGhost=document.createElement('div');
    _touchGhost.style.cssText='position:fixed;z-index:10000;pointer-events:none;opacity:.85;border:2px solid var(--accent);border-radius:4px;background:var(--bg);padding:6px 10px;font-size:13px;';
    _touchGhost.style.width=row.getBoundingClientRect().width+'px';
    const nameEl=row.querySelector('.item-name');
    _touchGhost.textContent=nameEl?nameEl.textContent:'';  // textContent only — ASVS L1
    document.body.appendChild(_touchGhost);
  }
  if(!_touchGhost)return;
  _touchGhost.style.left=(e.clientX-10)+'px';
  _touchGhost.style.top=(e.clientY-20)+'px';
  // Drop indicator: highlight row under pointer (D-16) — track reference to avoid full-doc scan
  const el=document.elementFromPoint(e.clientX,e.clientY);
  const target=el&&el.closest('tr[data-wi]');
  if(_touchOverRow&&_touchOverRow!==target)_touchOverRow.classList.remove('drag-over');
  if(target&&target!==e.currentTarget){target.classList.add('drag-over');_touchOverRow=target;}
  else _touchOverRow=null;
}

function _onTouchDragEnd(e){
  if(!_touchDragActive){
    _touchSrcWi=-1; _touchSrcIi=-1;
    return;
  }
  // Read drop target BEFORE any DOM mutation so ghost removal doesn't affect hit-test
  const el=document.elementFromPoint(e.clientX,e.clientY);
  const dropRow=el&&el.closest('tr[data-wi]');
  _touchDragActive=false;
  e.currentTarget.style.opacity='';
  if(_touchGhost){_touchGhost.remove();_touchGhost=null;}
  if(_touchOverRow){_touchOverRow.classList.remove('drag-over');_touchOverRow=null;}
  if(dropRow){
    const wi=+dropRow.dataset.wi, ii=+dropRow.dataset.ii;
    if(_touchSrcWi===wi&&_touchSrcIi!==ii){
      const items=cw()[wi].items;
      const moved=items.splice(_touchSrcIi,1)[0];
      const targetIdx=_touchSrcIi<ii?ii-1:ii;
      items.splice(targetIdx,0,moved);
      persist(); renderExpenses();
    }
  }
  _touchSrcWi=-1; _touchSrcIi=-1;
}

function _onTouchDragCancel(e){
  // Browser cancelled pointer (OS gesture, scroll takeover, notification) — clean up without reorder
  _touchDragActive=false;
  e.currentTarget.style.opacity='';
  if(_touchGhost){_touchGhost.remove();_touchGhost=null;}
  if(_touchOverRow){_touchOverRow.classList.remove('drag-over');_touchOverRow=null;}
  _touchSrcWi=-1; _touchSrcIi=-1;
}

// PERF-01: batch multiple same-frame renderExpenses() calls into one DOM pass.
let _renderExpensesRAF = null;
function renderExpenses(){
  if(_renderExpensesRAF) return;
  _renderExpensesRAF = requestAnimationFrame(function(){
    _renderExpensesRAF = null;
    _renderExpensesImpl();
  });
}
function _renderExpensesImpl(){
  document.getElementById('expMonthHdr').textContent=CMK+' Expenses';
  // Guard: if CMK is somehow in archivedMonths, warn and bail
  if(S.archivedMonths && S.archivedMonths[CMK]){
    document.getElementById('weeksGrid').innerHTML=`<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">${icon('lock',{label:'Archived'})} ${CMK} is archived and read-only.<br><button class="btn-p" style="margin-top:12px;" data-action="openRestoreModal" data-arg="${CMK}">${icon('upload')} Restore to edit</button></div>`;
    return;
  }
  // Pre-compute cat totals once — shared with renderEnvelopes
  _cachedCatTotals=catTotalsForMonth();
  // Ensure correct week count for this month (4 or 5)
  const _parts=CMK.split(' ');const _mo=MS.indexOf(_parts[0]);const _yr=parseInt(_parts[1]);
  const _daysInMonth=new Date(_yr,_mo+1,0).getDate();
  const _firstDay=new Date(_yr,_mo,1).getDay();
  const _weekCount=Math.ceil((_daysInMonth+_firstDay)/7)>=5?5:4;
  while(cw().length<_weekCount)cw().push({items:[]});
  // Trim extra empty weeks, keep exactly _weekCount
  while(cw().length>_weekCount&&cw()[cw().length-1].items.length===0)cw().pop();
  document.getElementById('weeksGrid').style.setProperty('--wk-cols',_weekCount);
  // Show auto-fill button if there are recurring items not yet in this month
  // Cache buildRecurringSet() — it iterates all months and is expensive; recompute only when
  // the active month or total item count changes (covers add/delete; rename is a rare edge case)
  const _rkItems=Object.values(S.months).reduce((n,m)=>n+m.weeks.reduce((w,wk)=>w+wk.items.length,0),0);
  const _rkKey=CMK+':'+_rkItems;
  if(_rkKey!==_recurSetCacheKey){_recurSetCache=buildRecurringSet();_recurSetCacheKey=_rkKey;}
  const _recSet=_recurSetCache;
  const _curNames=new Set(cw().flatMap(w=>w.items.map(i=>i.name.trim().toLowerCase())));
  const _hasNew=[..._recSet].some(k=>!_curNames.has(k));
  const _afBtn=document.getElementById('recurAutoFillBtn');
  if(_afBtn)_afBtn.style.display=_hasNew?'inline-flex':'none';
  renderEnvelopes();
  renderTagFilter();
  const isCurMonth=(()=>{const p=CMK.split(' ');const mo=MS.indexOf(p[0]);const yr=parseInt(p[1]);const n=new Date();return mo===n.getMonth()&&yr===n.getFullYear();})();
  const today=isCurMonth?new Date().getDate():0; // only flag overdue in current real month
  const grid=document.getElementById('weeksGrid');grid.innerHTML='';
  cw().forEach((week,wi)=>{
    const wTotal=week.items.reduce((s,i)=>s+_cvt(i.amount,i.currency),0);
    const wPaid=week.items.filter(i=>i.paid).reduce((s,i)=>s+_cvt(i.amount,i.currency),0);
    const wPend=wTotal-wPaid;
    const allItemsPaid=week.items.length>0&&week.items.every(i=>i.paid);
    const hasOverdue=week.items.some(i=>i.dueDay&&!i.paid&&i.dueDay<today);
    const hasPartial=!allItemsPaid&&wPaid>0;
    const isCollapsed=_collapsedWeeks.has(wi);
    let statusCls='';
    if(allItemsPaid)statusCls=' all-paid-card';
    else if(hasOverdue)statusCls=' wk-overdue';
    else if(hasPartial)statusCls=' wk-partial';
    const card=document.createElement('div');card.className='week-card'+statusCls+(isCollapsed?' wk-collapsed':'');
    const rows=week.items
      .map((item,realIi)=>({item,realIi}))
      .filter(({item})=>!tagFilter||CAT_LABELS[item.category||getCat(item.name)]===tagFilter)
      .map(({item,realIi:ii})=>{
        const rec=_recSet.has(item.name.trim().toLowerCase());
        const dd=item.dueDay;
        const isOverdue=dd&&!item.paid&&dd<today;
        const catCls=item.category||getCat(item.name);
        const catStyle=getCatStyle(catCls);
        const catLbl=getCatLabel(catCls);
        // Meta row — only show non-empty items to reduce clutter
        const metaParts=[];
        metaParts.push(`<span class="cat-badge ${catCls}" style="${catStyle}">${catLbl}</span>`);
        if(rec){const _freqLbl=item.frequency==='weekly'?'Weekly':item.frequency==='biweekly'?'Every 2 weeks':item.frequency==='quarterly'?'Quarterly':item.frequency==='yearly'?'Yearly':'Monthly';metaParts.push(`<span class="recur-badge" title="Recurring · ${_freqLbl}">${icon('repeat',{label:'Recurring'})} ${_freqLbl}</span>`);}
        if(dd)metaParts.push(`<span class="due-badge has-due${isOverdue?' overdue':''}" data-action="openDueDateModal" data-arg="${wi}" data-arg2="${ii}" title="Due day ${dd}">Due ${dd}</span>`);
        // 📋 only when has content; 📷 only when has receipt — shown as tiny icons
        if(item.note)metaParts.push(`<button class="note-toggle has-note" data-action="openNoteModal" data-arg="${wi}" data-arg2="${ii}" title="${esc(item.note.substring(0,40))}">${icon('note',{label:'Has note'})}</button>`);
        if(item.receipt)metaParts.push(`<button class="receipt-btn has-receipt" data-action="openReceiptModal" data-arg="${wi}" data-arg2="${ii}" title="View receipt">${icon('camera',{label:'Has receipt'})}</button>`);
        if(item._savingsItem)metaParts.push(`<span class="sav-link-badge" title="Auto-generated savings transfer — edit in Savings tab">${icon('piggyBank',{label:'Linked to savings'})} Savings</span>`);
        if(item.taxDeductible)metaParts.push(`<span class="badge-tax" aria-label="Tax deductible">TAX</span>`);
        const metaRow=metaParts.length?`<div class="item-meta">${metaParts.join('')}</div>`:'';
        const noteHtml=item.note?`<span class="item-note-inline">${esc(item.note.substring(0,60))}${item.note.length>60?'…':''}</span>`:'';
        const bulkKey=`${wi}-${ii}`;
        const isBulkSel=_bulkMode&&_bulkSelected.has(bulkKey);
        return`<tr ${_bulkMode?'':'draggable="true"'} data-wi="${wi}" data-ii="${ii}" style="position:relative;" class="${item.paid?'row-paid':''}${isBulkSel?' bulk-sel':''}${!_bulkMode?' draggable-row':''}">
          ${_bulkMode?`<td class="bulk-cb-col"><input type="checkbox" class="bulk-cb" ${isBulkSel?'checked':''} data-bulk-key="${bulkKey}" data-change="bulkToggleCbFromEl" data-change-self></td>`:''}
          <td class="item-col">
            ${!_bulkMode?'<span class="drag-grab-zone" title="Drag to reorder"></span>':''}
            <span class="item-name" data-action="openItemModal" data-arg="${wi}" data-arg2="${ii}" title="Click to edit">${esc(item.name)}</span>
            ${metaRow}
            ${noteHtml}
          </td>
          <td class="amt-col" style="cursor:pointer;"><span class="ea" data-action="editAmt" data-arg="${wi}" data-arg2="${ii}" data-arg-self title="Click to edit amount inline">${typeof fmtItemAmount==='function'?fmtItemAmount(amt(item.amount),item.currency):fmt(amt(item.amount))}</span></td>
          ${!_bulkMode?`<td class="status-col"><button class="stog ${item.paid?'paid':'pending'}" data-action="toggleExp" data-arg="${wi}" data-arg2="${ii}" aria-label="${item.paid?'Paid — click to mark as pending':'Pending — click to mark as paid'}" title="${item.paid?'Paid — click to mark as pending':'Pending — click to mark as paid'}">${item.paid?icon('check',{label:'Paid'}):icon('circle',{label:'Unpaid'})}<span class="stog-lbl">${item.paid?'Paid':'Due'}</span></button></td>`:''}
          ${!_bulkMode?`<td class="action-col no-print">
            <button class="del-btn" data-action="openItemModal" data-arg="${wi}" data-arg2="${ii}" data-stop-prop title="Edit item">${icon('edit',{label:'Edit'})}</button>
            <button class="del-btn" data-action="delExpItem" data-arg="${wi}" data-arg2="${ii}" data-stop-prop aria-label="Delete item" title="Delete item">${icon('close',{label:'Delete'})}</button>
          </td>`:''}
        </tr>`;
      }).join('');
    card.innerHTML=`
      <div class="week-header" style="cursor:pointer;" data-action="toggleWeekCollapse" data-arg="${wi}">
        <div class="week-title-row">
          <span class="week-title">Week ${wi+1}</span>
          <div style="display:flex;align-items:center;gap:5px;">
            <button class="no-print week-collapse-btn" data-action="toggleWeekCollapse" data-arg="${wi}" data-stop-prop title="${isCollapsed?'Expand':'Collapse'} week" aria-label="${isCollapsed?'Expand':'Collapse'} week ${wi+1}">${isCollapsed?'▸':'▾'}</button>
            ${!_bulkMode?`<button class="no-print" data-action="bulkMarkPaid" data-arg="${wi}" data-stop-prop title="Mark all paid" style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--sage);padding:1px 4px;border-radius:3px;border:1px solid var(--sage-mid);">${icon('check')} All</button>`:`<button class="no-print" data-action="bulkSelectWeek" data-arg="${wi}" data-stop-prop title="Select all in week" style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--accent);padding:1px 4px;border-radius:3px;border:1px solid var(--accent);">☑ All</button>`}
            <span class="week-grand">${fmt(wTotal)}</span>
          </div>
        </div>
        <div class="week-sub-row"><span class="week-sub-stat ws-paid">${icon('check')} ${fmt(wPaid)}</span><span class="week-sub-stat ws-pend">${icon('hourglass')} ${fmt(wPend)}</span></div>
      </div>
      ${allItemsPaid?'<div class="week-all-paid-banner"><span>🎉</span> All paid!</div>':''}
      <table class="week-table"><thead><tr><th>Item</th><th style="text-align:right;padding-right:6px;font-size:9px;color:var(--text-muted);">Amount</th><th style="width:30px;"></th><th style="width:40px;" class="no-print"></th></tr></thead><tbody>${rows||'<tr><td colspan="4" style="text-align:center;color:var(--text-muted);font-size:11px;padding:12px;">No items in this category</td></tr>'}</tbody></table>
      <button class="add-row-btn no-print" data-action="openItemModal" data-arg="${wi}" data-arg2="-1">+ Add Item</button>`;
    card.querySelectorAll('tr[data-wi]').forEach(function(tr){
      tr.addEventListener('pointerdown',_onTouchDragStart);
      tr.addEventListener('pointermove',_onTouchDragMove);
      tr.addEventListener('pointerup',_onTouchDragEnd);
      tr.addEventListener('pointercancel',_onTouchDragCancel);
    });
    grid.appendChild(card);
  });
  const gt=totalExp(),gp=paidExp(),gpd=pendExp();
  document.getElementById('ef-total').textContent=fmt(gt);
  document.getElementById('ef-paid').textContent=fmt(gp);
  document.getElementById('ef-pending').textContent=fmt(gpd);
  document.getElementById('ef-pnote').textContent=gpd>0?((gpd/gt*100).toFixed(0)+'% still due'):'✓ All paid';
  document.getElementById('overBudgetPill').style.display=gt>totalRev()?'inline-flex':'none';
  if(typeof renderSpendingHeatmap==='function')renderSpendingHeatmap();
}


// Arg order matches delegation: data-arg=wi, data-arg2=ii, data-arg-self=el
function editAmt(wi,ii,el){
  const item=cw()[wi].items[ii];
  if(!item)return;
  const old=item.amount;
  const cell=el.closest('.amt-col')||el.parentElement;
  cell.innerHTML=`<input class="ie" type="number" value="${amt(old)}" autofocus style="width:100%;text-align:right;">`;
  const inp=cell.querySelector('input');
  inp.addEventListener('blur',function(){_saveAmt(this,wi,ii,old);});
  inp.addEventListener('keydown',function(e){
    if(e.key==='Enter'){e.preventDefault();this.blur();}
    if(e.key==='Escape'){this.value=amt(old);this.blur();}
  });
  setTimeout(()=>{inp.select();},30);
}
function _saveAmt(inp,wi,ii,old){
  const v=parseFloat(inp.value);
  if(!isNaN(v)&&v>=0) dispatch('ITEM_SET_AMOUNT',{wi,ii,val:storeCents(v)});
  renderExpenses();updateHealth();
}

// ── SURGICAL EXPENSE ROW UPDATE ──
// Updates only the changed row + week totals + footer — skips full DOM rebuild
function updateExpRowSurgical(wi, ii){
  const item = cw()[wi].items[ii];
  if(!item) return false; // fallback to full render if stale

  // 1. Update the row class (paid/unpaid strikethrough)
  const rows = document.querySelectorAll(`#weeksGrid .week-card:nth-child(${wi+1}) .week-table tbody tr`);
  // Find the right row — filter is applied, so we match by data attributes
  const allRows = document.querySelectorAll(`#weeksGrid .week-card:nth-child(${wi+1}) tr[data-ii]`);
  let targetRow = null;
  allRows.forEach(r => { if(parseInt(r.dataset.ii)===ii && parseInt(r.dataset.wi)===wi) targetRow=r; });
  if(!targetRow) return false;

  // Update row paid class
  targetRow.classList.toggle('row-paid', item.paid);

  // Update the stog button
  const stog = targetRow.querySelector('.stog');
  if(stog){
    stog.className = 'stog ' + (item.paid ? 'paid' : 'pending');
    stog.innerHTML = item.paid ? icon('check',{label:'Paid'}) : icon('circle',{label:'Unpaid'});
    stog.setAttribute('aria-label', item.paid ? 'Mark as pending' : 'Mark as paid');
    stog.setAttribute('title',      item.paid ? 'Mark as pending' : 'Mark as paid');
  }

  // 2. Recompute week totals
  const week = cw()[wi];
  const wTotal = week.items.reduce((s,i)=>s+_cvt(i.amount,i.currency),0);
  const wPaid  = week.items.filter(i=>i.paid).reduce((s,i)=>s+_cvt(i.amount,i.currency),0);
  const wPend  = wTotal - wPaid;
  const allItemsPaid = week.items.length>0 && week.items.every(i=>i.paid);

  // 3. Update week card header
  const card = targetRow.closest('.week-card');
  if(card){
    card.classList.toggle('all-paid-card', allItemsPaid);
    const grandEl = card.querySelector('.week-grand');
    if(grandEl) grandEl.textContent = fmt(wTotal);
    const paidEl  = card.querySelector('.ws-paid');
    if(paidEl)  paidEl.innerHTML = icon('check') + ' ' + fmt(wPaid);
    const pendEl  = card.querySelector('.ws-pend');
    if(pendEl)  pendEl.innerHTML = icon('hourglass') + ' ' + fmt(wPend);
    // All-paid banner
    let banner = card.querySelector('.week-all-paid-banner');
    if(allItemsPaid && !banner){
      banner = document.createElement('div');
      banner.className = 'week-all-paid-banner';
      banner.innerHTML = '<span>🎉</span> All paid!';
      const hdr = card.querySelector('.week-header');
      if(hdr) hdr.after(banner);
    } else if(!allItemsPaid && banner){
      banner.remove();
    }
  }

  // 4. Update footer totals (no chart re-render)
  const gt = totalExp(), gp = paidExp(), gpd = pendExp();
  const efTotal = document.getElementById('ef-total');
  const efPaid  = document.getElementById('ef-paid');
  const efPend  = document.getElementById('ef-pending');
  const efNote  = document.getElementById('ef-pnote');
  const overPill= document.getElementById('overBudgetPill');
  if(efTotal) efTotal.textContent = fmt(gt);
  if(efPaid)  efPaid.textContent  = fmt(gp);
  if(efPend)  efPend.textContent  = fmt(gpd);
  if(efNote)  efNote.textContent  = gpd>0 ? (gpd/gt*100).toFixed(0)+'% still due' : '✓ All paid';
  if(overPill) overPill.style.display = gt>totalRev() ? 'inline-flex' : 'none';

  return true; // surgical update succeeded
}

function toggleExp(wi,ii){
  const item=cw()[wi].items[ii];
  const wasPaid=item.paid;
  item.paid=!item.paid;
  persist();
  // Surgical update — only rebuilds the changed row and week totals
  const ok=updateExpRowSurgical(wi,ii);
  if(!ok) renderExpenses(); // fallback: full rebuild if DOM is stale
  updateHealth();
  if(!wasPaid){
    const btn=document.querySelector('.week-table .stog.paid');
    launchConfettiFromEl(btn,22);
    if(typeof awardXP==='function') awardXP('bill_paid');
    const weekDone=cw()[wi].items.length>0&&cw()[wi].items.every(i=>i.paid);
    if(weekDone){
      setTimeout(()=>{launchConfetti(110);showToast('🎉 Week '+(wi+1)+' — all paid!');},300);
      if(typeof awardXP==='function') awardXP('week_complete');
    }
    setTimeout(checkMonthComplete,600);
  }
  if(typeof checkAchievements==='function') checkAchievements('first_paid','week_champ');
}
let _delPendingTimer=null;

function delExpItem(wi,ii){
  _cancelDelPending();
  const tr=document.querySelector(`tr[data-wi="${wi}"][data-ii="${ii}"]`);
  if(!tr)return;
  tr.classList.add('del-pending');
  const cell=tr.querySelector('.action-col');
  if(cell){
    cell.innerHTML=`<button class="del-btn del-ok" data-action="delExpConfirm" data-arg="${wi}" data-arg2="${ii}" data-stop-prop title="Yes, delete" aria-label="Yes, delete">Y</button>`+
      `<button class="del-btn del-no" data-action="delExpCancel" data-stop-prop title="No, keep" aria-label="No, keep">N</button>`;
  }
  _delPendingTimer=setTimeout(_cancelDelPending,4000);
}

function _cancelDelPending(){
  clearTimeout(_delPendingTimer);_delPendingTimer=null;
  if(document.querySelector('tr.del-pending'))renderExpenses();
}

function delExpConfirm(wi,ii){
  clearTimeout(_delPendingTimer);_delPendingTimer=null;
  cw()[wi].items.splice(ii,1);
  persist();renderExpenses();updateHealth();
}

function delExpCancel(){_cancelDelPending();}

// ── BULK OPERATIONS (1C) ──
let _bulkMode=false;
let _bulkSelected=new Set(); // stores "wi-ii" strings

function enterBulkMode(){
  _bulkMode=true; _bulkSelected.clear();
  const btn=document.getElementById('bulkSelectBtn');
  if(btn){btn.innerHTML=icon('close')+' Cancel';btn.dataset.action='exitBulkMode';btn.style.color='var(--danger)';btn.style.borderColor='var(--danger-mid)';}
  renderExpenses(); _updateBulkBar();
}
function exitBulkMode(){
  _bulkMode=false; _bulkSelected.clear();
  const btn=document.getElementById('bulkSelectBtn');
  if(btn){btn.textContent='⊞ Select';btn.dataset.action='enterBulkMode';btn.style.color='';btn.style.borderColor='';}
  renderExpenses(); _updateBulkBar();
}
function _updateBulkBar(){
  const bar=document.getElementById('bulkActionBar');
  const cnt=document.getElementById('bulkCount');
  if(!bar)return;
  bar.style.display=_bulkMode?'flex':'none';
  if(cnt)cnt.textContent=_bulkSelected.size+' selected';
}
function bulkToggleCbFromEl(el){
  const parts=el.dataset.bulkKey.split('-');
  bulkToggleItem(parseInt(parts[0]),parseInt(parts[1]));
}
function bulkToggleItem(wi,ii){
  const k=wi+'-'+ii;
  if(_bulkSelected.has(k))_bulkSelected.delete(k); else _bulkSelected.add(k);
  const cb=document.querySelector(`[data-bulk-key="${k}"]`);
  if(cb)cb.checked=_bulkSelected.has(k);
  const rows=document.querySelectorAll(`tr[data-wi="${wi}"][data-ii="${ii}"]`);
  rows.forEach(r=>r.classList.toggle('bulk-sel',_bulkSelected.has(k)));
  _updateBulkBar();
}
function bulkSelectWeek(wi){
  const items=cw()[wi]&&cw()[wi].items||[];
  const allSel=items.every((_,ii)=>_bulkSelected.has(wi+'-'+ii));
  items.forEach((_,ii)=>{
    const k=wi+'-'+ii;
    if(allSel)_bulkSelected.delete(k); else _bulkSelected.add(k);
    const cb=document.querySelector(`[data-bulk-key="${k}"]`);
    if(cb)cb.checked=!allSel;
    document.querySelectorAll(`tr[data-wi="${wi}"][data-ii="${ii}"]`).forEach(r=>r.classList.toggle('bulk-sel',!allSel));
  });
  _updateBulkBar();
}
function bulkMarkAllPaid(){
  const n=_bulkSelected.size;
  if(!n){showToast('Select items first','warn-t');return;}
  dispatch('BULK_SET_PAID',{keys:_bulkSelected,val:true});
  exitBulkMode(); updateHealth();
  showToast('✓ Marked '+n+' paid');
}
function bulkMarkAllUnpaid(){
  const n=_bulkSelected.size;
  if(!n){showToast('Select items first','warn-t');return;}
  dispatch('BULK_SET_PAID',{keys:_bulkSelected,val:false});
  exitBulkMode(); updateHealth();
  showToast('○ Marked '+n+' unpaid');
}
function bulkDeleteSelected(){
  const n=_bulkSelected.size;
  if(!n){showToast('Select items first','warn-t');return;}
  if(!confirm('Delete '+n+' selected item'+(n!==1?'s':'')+' ?'))return;
  // Collect object references before any deletion — array indices shift after each splice
  const toDelete=[];
  _bulkSelected.forEach(k=>{
    const[wi,ii]=k.split('-').map(Number);
    const item=cw()[wi]&&cw()[wi].items[ii];
    if(item)toDelete.push({wi,ref:item});
  });
  toDelete.forEach(({wi,ref})=>{
    const idx=cw()[wi].items.indexOf(ref);
    if(idx!==-1)cw()[wi].items.splice(idx,1);
  });
  persist(); exitBulkMode(); updateHealth();
  showToast('✓ Deleted '+n+' item'+(n!==1?'s':''));
}

// ── QUICK ADD FAB (1A) ──
let _qaCat='cat-other';

function _buildQaNameList(){
  const seen=new Set(),names=[];
  Object.values(S.months).forEach(m=>m.weeks.forEach(w=>w.items.forEach(i=>{
    const k=i.name.trim().toLowerCase();
    if(!seen.has(k)){seen.add(k);names.push(i.name.trim());}
  })));
  const dl=document.getElementById('qaNameList');
  if(dl)dl.innerHTML=names.slice(0,60).map(n=>`<option value="${esc(n)}">`).join('');
}
function openQuickAdd(){
  const sheet=document.getElementById('quickAddSheet');
  const overlay=document.getElementById('qaOverlay');
  if(!sheet)return;
  _buildQaNameList();
  _qaCat='cat-other';
  renderQaCatRow('cat-other');
  const wkSel=document.getElementById('qaWeek');
  if(wkSel)wkSel.value=Math.min(getWeekForDay(new Date().getDate(),CMK),Math.max(0,cw().length-1));
  const nameIn=document.getElementById('qaName');
  if(nameIn)nameIn.value='';
  const amtIn=document.getElementById('qaAmount');
  if(amtIn)amtIn.value='';
  sheet.style.display='block';
  if(overlay)overlay.style.display='block';
  if(typeof trapFocus==='function')trapFocus(sheet);
  setTimeout(()=>{if(nameIn)nameIn.focus();},150);
}
function closeQuickAdd(){
  const sheet=document.getElementById('quickAddSheet');
  const overlay=document.getElementById('qaOverlay');
  if(sheet){if(typeof releaseTrap==='function')releaseTrap(sheet);sheet.style.display='none';}
  if(overlay)overlay.style.display='none';
}
function renderQaCatRow(selected){
  _qaCat=selected;
  const row=document.getElementById('qaCatRow');
  if(!row)return;
  const cats=[...CAT_ALL];
  if(S.customCategories&&S.customCategories.length)
    S.customCategories.forEach(cc=>cats.push({cls:'cat-custom-'+cc.id,lbl:cc.name,icon:'🏷',bg:cc.bg,color:cc.color}));
  row.innerHTML=cats.map(c=>{
    const style=c.bg?`background:${c.bg};color:${c.color};`:'';
    return`<button class="cat-pill-opt ${c.cls}${c.cls===selected?' selected':''}" style="${style}" data-action="selectQaCat" data-arg="${c.cls}">${c.iconKey?icon(c.iconKey):''} ${c.lbl}</button>`;
  }).join('');
}
function selectQaCat(cls){renderQaCatRow(cls);}
function qaNameAutoTag(name){
  const detected=getCat(name);
  if(detected!==_qaCat)renderQaCatRow(detected);
  // Suggest week from a matching previous expense's due day
  const k=name.trim().toLowerCase();
  outer:for(const m of Object.values(S.months)){
    for(const w of m.weeks){
      const found=w.items.find(i=>i.name.trim().toLowerCase()===k&&i.dueDay);
      if(found){const wkSel=document.getElementById('qaWeek');if(wkSel)wkSel.value=getWeekForDay(found.dueDay,CMK);break outer;}
    }
  }
}
function quickAddSave(){
  const name=(document.getElementById('qaName')||{value:''}).value.trim();
  const amountRaw=parseFloat((document.getElementById('qaAmount')||{value:'0'}).value)||0;
  const wi=parseInt((document.getElementById('qaWeek')||{value:'0'}).value)||0;
  if(!name){showToast('Enter a name','warn-t');document.getElementById('qaName')&&document.getElementById('qaName').focus();return;}
  const amount=storeCents(amountRaw);
  if(!cw()[wi]){showToast('Invalid week','warn-t');return;}
  dispatch('ITEM_ADD',{wi,item:{name,amount,paid:false,dueDay:null,note:'',receipt:null,currency:getCurrency().code,frequency:'monthly',_savingsItem:false}});
  closeQuickAdd();
  if(getTab()==='expenses')renderExpenses();
  updateHealth();
  showToast('✓ '+name+' added to Week '+(wi+1));
  if(typeof _checkRecurringSuggest==='function')_checkRecurringSuggest(name,amount,null);
}

function bulkMarkPaid(wi){
  const allPaid=cw()[wi].items.every(i=>i.paid);
  dispatch('WEEK_SET_ALL_PAID',{wi,val:!allPaid});
  renderExpenses();updateHealth();
  if(!allPaid){
    launchConfetti(110);
    showToast('🎉 Week '+(wi+1)+' — all paid!');
  } else {
    showToast('All items reset to pending');
  }
}
function toggleAllWeekPaid(wi) {
  const week = cw()[wi];
  if (!week) return;
  const allPaid = week.items.every(i => i.paid);
  week.items.forEach(i => { i.paid = !allPaid; });
  persist(); renderExpenses(); updateHealth();
  showToast(allPaid ? 'All items marked unpaid' : '✓ All items marked paid');
}
function addExpItem(wi){openItemModal(wi,-1);} // now opens modal

// Due-date modal was removed; badge clicks now open the item modal directly.
function openDueDateModal(wi,ii){ openItemModal(wi,ii); }
