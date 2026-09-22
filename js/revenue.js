// === revenue.js ===

function renderRevenue(){
  document.getElementById('revMonHdr').textContent=CMK;
  const tbody=document.getElementById('revTbody');tbody.innerHTML='';
  const revItems=cr();
  let tot=0,rcvd=0,pend=0;
  if(!revItems.length){
    tbody.innerHTML='<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">No income sources yet. Click <strong>+ Add Income</strong> to get started.</td></tr>';
  }
  revItems.forEach((item,i)=>{
    const converted=_cvt(item.amount,item.currency);
    tot+=converted;if(item.received)rcvd+=converted;else pend+=converted;
    const tr=document.createElement('tr');
    tr.dataset.action='openRevModal';tr.dataset.arg=i;
    tr.title='Click to edit';
    tr.innerHTML=`<td style="font-weight:500;">${esc(item.name)}${item.note?'<div style="font-size:10px;color:var(--text-muted);margin-top:1px;">'+esc(item.note)+'</div>':''}</td>
      <td class="acol" style="font-family:'Instrument Serif',serif;font-weight:400;">${typeof fmtItemAmount==='function'?fmtItemAmount(amt(item.amount),item.currency,{monthKey:CMK}):fmt(amt(item.amount))}</td>
      <td class="scol"><button class="stog ${item.received?'paid':'pending'}" data-action="toggleRev" data-arg="${i}" data-stop-prop aria-label="Toggle ${esc(item.name)} received status">${item.received?icon('check',{label:'Received'}):icon('circle',{label:'Pending'})}</button></td>
      <td class="no-print"><button class="del-btn" data-action="openRevModal" data-arg="${i}" data-stop-prop title="Edit income source" aria-label="Edit income source">${icon('edit',{label:'Edit'})}</button></td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('revTableTotal').textContent=fmt(tot);
  document.getElementById('rev-total').textContent=fmt(tot);
  document.getElementById('rev-received').textContent=fmt(rcvd);
  document.getElementById('rev-pending').textContent=fmt(pend);
  const ytd=Object.values(S.months).reduce((s,m)=>s+m.revenue.reduce((a,r)=>a+_cvt(r.amount,r.currency),0),0);
  document.getElementById('rev-ytd').textContent=fmt(ytd);
  // MoM delta
  const keys=Object.keys(S.months),idx=keys.indexOf(CMK);
  const del=document.getElementById('rev-delta');del.textContent='';del.className='md';
  if(idx>0){const prev=totalRev(keys[idx-1]),diff=tot-prev;if(diff!==0){del.textContent=(diff>0?'▲ ':'▼ ')+fmtK(Math.abs(diff));del.className='md '+(diff>0?'dp':'dn');}}
  const exp=totalExp(),paidEx=paidExp(),pendEx=pendExp(),net=tot-paidEx;
  const netEl=document.getElementById('netCash');netEl.textContent=(net<0?'-':'')+fmt(Math.abs(net));netEl.className='net-amount '+(net>=0?'pos':'neg');
  // Show pending deductions below the net figure
  const netPendEl=document.getElementById('netCashPending');
  if(netPendEl){
    if(pendEx>0){netPendEl.textContent='−'+fmt(pendEx)+' pending';netPendEl.style.display='';}
    else{netPendEl.style.display='none';}
  }
  const ratio=tot>0?Math.min(exp/tot*100,120):0;
  document.getElementById('expRatioPct').textContent=(tot>0?(exp/tot*100).toFixed(1):0)+'%';
  const bar=document.getElementById('expRatioBar');bar.style.width=Math.min(ratio,100)+'%';
  bar.className='pfill '+(ratio>100?'pf-danger':ratio>80?'pf-amber':'pf-sage');
  renderRevTable();renderIncomeChart();
}
function setRevWin(n,btn){revWin=n;document.querySelectorAll('.rev-toggle-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderRevTable();}
function renderRevTable(){
  let keys=Object.keys(S.months);
  if(revWin<999&&keys.length>revWin)keys=keys.slice(-revWin);
  const srcs=new Set();keys.forEach(k=>S.months[k].revenue.forEach(r=>srcs.add(r.name)));
  const srcArr=[...srcs];
  document.getElementById('revTHead').innerHTML='<tr><th>Source</th>'+keys.map(k=>`<th class="acol" style="${k===CMK?'color:var(--sage);font-weight:700;':''}">${esc(k)}</th>`).join('')+'<th class="acol">Total</th></tr>';
  const revTots=keys.map(k=>totalRev(k));
  const expTots=keys.map(k=>totalExp(k));
  let rows=srcArr.map(src=>{
    const rTot=keys.reduce((s,k)=>{const r=S.months[k].revenue.find(r=>r.name===src);return s+(r?_cvt(r.amount,r.currency):0);},0);
    return`<tr><td style="font-weight:500;font-size:12px;white-space:nowrap;">${esc(src)}</td>
      ${keys.map(k=>{const r=S.months[k].revenue.find(r=>r.name===src);const rawAmt=r?r.amount:0;const dispAmt=r?_cvt(r.amount,r.currency):0;const ri=r?S.months[k].revenue.indexOf(r):-1;
        return`<td class="acol" style="${k===CMK?'background:var(--sage-light);':''}">${rawAmt>0?`<span class="ea" data-action="editRevCell" data-arg="${k}" data-arg2="${ri}">${fmt(dispAmt)}</span>`:'<span style="color:var(--text-muted);">—</span>'}</td>`;
      }).join('')}
      <td class="acol" style="font-weight:600;color:var(--sage);">${fmt(rTot)}</td></tr>`;
  }).join('');
  const grand=revTots.reduce((s,v)=>s+v,0),expGrand=expTots.reduce((s,v)=>s+v,0);
  rows+=`<tr style="background:var(--sage-light);"><td style="font-weight:700;font-size:12px;color:var(--sage);">▲ Revenue</td>${keys.map((k,i)=>`<td class="acol" style="font-weight:600;color:var(--sage);">${fmt(revTots[i])}</td>`).join('')}<td class="acol" style="font-weight:700;color:var(--sage);">${fmt(grand)}</td></tr>`;
  rows+=`<tr style="background:var(--danger-light);"><td style="font-weight:700;font-size:12px;color:var(--danger);">▼ Expenses</td>${keys.map((k,i)=>`<td class="acol" style="color:var(--danger);">${fmt(expTots[i])}</td>`).join('')}<td class="acol" style="font-weight:700;color:var(--danger);">${fmt(expGrand)}</td></tr>`;
  const netTots=revTots.map((v,i)=>v-expTots[i]);const netGrand=grand-expGrand;
  rows+=`<tr style="background:var(--success-light);"><td style="font-weight:700;font-size:12px;color:var(--success);">Net</td>${keys.map((k,i)=>{const n=netTots[i];return`<td class="acol" style="font-weight:600;color:${n>=0?'var(--success)':'var(--danger)'};">${n<0?'-':''}${fmt(Math.abs(n))}</td>`;}).join('')}<td class="acol" style="font-weight:700;color:${netGrand>=0?'var(--success)':'var(--danger)'};">${netGrand<0?'-':''}${fmt(Math.abs(netGrand))}</td></tr>`;
  document.getElementById('revTBody').innerHTML=rows;
}
function editRevCell(k,ri,el){
  if(ri<0||!el)return;
  const old=S.months[k].revenue[ri].amount;
  const inp=document.createElement('input');
  inp.className='ie';inp.type='number';inp.value=old;inp.setAttribute('autofocus','');
  inp.addEventListener('blur',function(){saveRevCell(this,k,ri);});
  inp.addEventListener('keydown',function(e){if(e.key==='Enter')this.blur();if(e.key==='Escape'){this.value=old;this.blur();}});
  el.textContent='';el.appendChild(inp);
  inp.select();inp.focus();
}
function saveRevCell(inp,k,ri){dispatch('REVENUE_SET_AMOUNT',{mk:k,ri,val:storeCents(inp.value)});renderRevenue();}
function toggleRev(i){
  const wasUnreceived=!cr()[i].received;
  dispatch('REVENUE_TOGGLE',{i});
  renderRevenue();updateHealth();
  if(wasUnreceived){
    // Flash the row green
    const rows=document.querySelectorAll('#revTbody tr');
    if(rows[i]){rows[i].classList.add('rev-received-row');setTimeout(()=>rows[i].classList.remove('rev-received-row'),600);}
    launchConfettiFromEl(rows[i],15);
    // All income received for the month?
    if(cr().length>0&&cr().every(r=>r.received)){
      setTimeout(()=>{launchConfetti(80);showToast('🎉 All income received for '+CMK+'!');},250);
    }
    // Check full month complete
    setTimeout(checkMonthComplete,700);
  }
}
function delRevItem(i){dispatch('REVENUE_REMOVE',{i});renderRevenue();updateHealth();showUndoToast('Income deleted — Undo');}
function addRevItem(){openRevModal(-1);} // now opens modal

// ──────────────────────────────────────────────
// RECURRING INCOME — auto-populate new months
// ──────────────────────────────────────────────
function expandRecurringRevenue(monthKey){
  if(!S.recurringRevenue||!S.recurringRevenue.length)return;
  if(!S.months[monthKey])return;
  const existing=new Set(S.months[monthKey].revenue.map(r=>r.name.trim().toLowerCase()));
  let added=0;
  S.recurringRevenue.forEach(src=>{
    const k=src.name.trim().toLowerCase();
    if(!existing.has(k)){
      S.months[monthKey].revenue.push({name:src.name,amount:src.amount,received:false,note:src.note||''});
      existing.add(k);
      added++;
    }
  });
  return added;
}
