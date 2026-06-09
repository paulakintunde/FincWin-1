// === analytics.js ===

// Update a canvas aria-label after chart data is known, so screen readers get
// a meaningful description rather than a static placeholder.
function _setChartAria(id, label) {
  var el = document.getElementById(id);
  if (el) el.setAttribute('aria-label', label);
}

function renderAnalytics(){
  if(typeof requirePlan==='function'&&!requirePlan('pro','Analytics & Forecasting'))return;
  const keys=Object.keys(S.months);
  const revs=keys.map(k=>totalRev(k));
  const exps=keys.map(k=>totalExp(k));
  const nets=keys.map((k,i)=>revs[i]-exps[i]);
  const avgInc=revs.reduce((s,v)=>s+v,0)/(revs.length||1);
  const avgExp=exps.reduce((s,v)=>s+v,0)/(exps.length||1);
  document.getElementById('an-avginc').textContent=fmt(avgInc);
  document.getElementById('an-avgexp').textContent=fmt(avgExp);
  const bi=nets.indexOf(Math.max(...nets));
  document.getElementById('an-best').textContent=keys[bi]||'—';
  const catTotals={};keys.forEach(k=>S.months[k].weeks.forEach(w=>w.items.forEach(i=>{const c=CAT_LABELS[getCat(i.name)];catTotals[c]=(catTotals[c]||0)+i.amount;})));
  const topCat=Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('an-topcat').textContent=topCat?topCat[0]:'—';
  // YoY
  const years=[...new Set(keys.map(k=>k.split(' ')[1]))];
  document.getElementById('yoyTable').innerHTML=years.length>1
    ?`<table><thead><tr><th>Year</th><th class="acol">Income</th><th class="acol">Expenses</th><th class="acol">Net</th></tr></thead><tbody>${years.map(yr=>{const yk=keys.filter(k=>k.endsWith(yr));const yi=yk.reduce((s,k)=>s+totalRev(k),0),ye=yk.reduce((s,k)=>s+totalExp(k),0),yn=yi-ye;return`<tr><td>${yr}</td><td class="acol" style="color:var(--success);">${fmt(yi)}</td><td class="acol" style="color:var(--danger);">${fmt(ye)}</td><td class="acol" style="color:${yn>=0?'var(--success)':'var(--danger)'};">${yn<0?'-':''}${fmt(Math.abs(yn))}</td></tr>`;}).join('')}</tbody></table>`
    :'<p style="color:var(--text-muted);font-size:12px;">Add months across multiple years to see year-over-year data.</p>';
  // Insights
  const ins=genInsights(keys,revs,exps,nets,catTotals);
  document.getElementById('insightsList').innerHTML=ins.map(i=>`<div class="insight-item"><span class="insight-icon">${i.icon}</span><div><div style="font-weight:600;font-size:13px;margin-bottom:2px;">${esc(i.title)}</div><div style="font-size:12px;color:var(--text-secondary);">${esc(i.body)}</div></div></div>`).join('');
  renderCatTrend(keys);renderNetChart(keys,nets);
  renderVarianceTable(keys);
  renderShortfallBanner();
  updateAIActionGrid();
  renderTaxSummary();
  // Update chart aria-labels with real data values so screen readers are informative
  if(keys.length){
    const lastKey=keys[keys.length-1];
    _setChartAria('netChart','Monthly net cash flow. Most recent month '+lastKey+': '+fmtSigned(nets[nets.length-1]));
    _setChartAria('catTrendChart','Category spending trend over '+keys.length+' months. Top category: '+(document.getElementById('an-topcat').textContent||'—'));
  }
  // Scorecard history — all closed months (i.e. not the current month)
  var scRow=document.getElementById('an-scorecard-row');
  if(scRow){
    var past=keys.filter(function(k){return k!==CMK;});
    if(!past.length){
      scRow.innerHTML='<span style="font-size:11px;color:var(--text-muted);">No closed months yet — scorecards appear here after you close your first month.</span>';
    } else {
      scRow.innerHTML=past.map(function(k){
        return '<button class="tbtn" style="font-size:11px;" data-action="openScorecardModal" data-arg="'+k+'">'+k+'</button>';
      }).join('');
    }
  }
}

function renderVarianceTable(keys){
  const wrap=document.getElementById('varianceTableWrap');
  const last3=keys.slice(-3);
  if(!last3.length){
    wrap.innerHTML='<p style="font-size:12px;color:var(--text-muted);padding:8px 0;">No month data yet — add expenses to see budget vs actual variance.</p>';
    return;
  }
  // Build actuals per category, but only for categories that have real spending
  const cats=Object.keys(S.budgets||BDFT);
  const catData=cats.map(cat=>{
    const actuals=last3.map(k=>{
      const md=S.months[k];
      if(!md) return 0;
      return md.weeks.reduce((s,w)=>s+w.items.filter(i=>CAT_LABELS[getCat(i.name)]===cat).reduce((a,i)=>a+i.amount,0),0);
    });
    const hasData=actuals.some(a=>a>0);
    return{cat,actuals,hasData};
  }).filter(d=>d.hasData);

  if(!catData.length){
    wrap.innerHTML='<p style="font-size:12px;color:var(--text-muted);padding:8px 0;">No categorised expenses in the last '+(last3.length===1?'month':'3 months')+'  — add expenses to see variance.</p>';
    return;
  }

  const rows=catData.map(({cat,actuals})=>{
    const cap=S.budgets[cat]||BDFT[cat]||0;
    const variances=actuals.map(a=>cap-a);
    const trend=actuals.length>=2?actuals[actuals.length-1]-actuals[actuals.length-2]:0;
    return`<tr>
      <td style="font-weight:500;font-size:12px;">${esc(cat)}</td>
      <td class="acol" style="font-size:12px;">${cap?fmt(cap):'—'}</td>
      ${actuals.map(a=>`<td class="acol" style="font-size:12px;background:${cap&&a>cap?'var(--danger-light)':cap&&a>cap*.8?'var(--amber-light)':'transparent'}">${fmt(a)}</td>`).join('')}
      ${variances.map(v=>`<td class="acol"><span class="${v>=0?'var-pos':'var-neg'}">${cap?(v>=0?'+':'')+fmt(v):'—'}</span></td>`).join('')}
      <td class="acol"><span class="var-arrow">${actuals.length>=2?(trend>0?'▲':'▼'):'—'}</span></td>
    </tr>`;
  }).join('');

  const thead=`<tr><th>Category</th><th class="acol">Budget</th>${last3.map(k=>`<th class="acol">${k}</th>`).join('')}${last3.map(k=>`<th class="acol">Var ${k.split(' ')[0]}</th>`).join('')}<th class="acol">Trend</th></tr>`;
  wrap.innerHTML=`<table class="variance-table"><thead>${thead}</thead><tbody>${rows}</tbody></table>`;
}

function genInsights(keys,revs,exps,nets,catTotals){
  const ins=[];
  const dti=totalRev()>0?minPmts()/totalRev()*100:0;
  if(dti>43)ins.push({icon:icon('warning',{label:'Alert'}),title:'High DTI ratio',body:`Loan payments consume ${dti.toFixed(0)}% of income. Lenders consider above 43% high risk.`});
  else if(dti>=36)ins.push({icon:icon('warning',{label:'Alert'}),title:'DTI in caution zone',body:`Your DTI of ${dti.toFixed(0)}% — lenders typically prefer under 36%.`});
  else if(dti>0)ins.push({icon:icon('check',{label:'Good'}),title:'Healthy DTI ratio',body:`Your DTI of ${dti.toFixed(0)}% is within the healthy range (under 36%).`});
  if(keys.length>=2){const t=revs[revs.length-1]-revs[revs.length-2];if(t>0)ins.push({icon:icon('trendUp',{label:'Up'}),title:'Income trending up',body:`Income up ${fmt(t)} vs last month.`});else if(t<0)ins.push({icon:icon('chart',{label:'Down'}),title:'Income dip',body:`Income down ${fmt(Math.abs(t))} vs last month.`});}
  const top=Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  if(top)ins.push({icon:icon('lightbulb',{label:'Insight'}),title:`Top spend: ${top[0]}`,body:`${fmt(top[1])} total across all months.`});
  const sv=totalSav(),dt=totalDebt();
  if(sv>0&&dt>0)ins.push({icon:icon('chart',{label:'Insight'}),title:'Savings vs Debt',body:`${fmt(sv)} in savings vs ${fmt(dt)} in debt. High-interest debt may cost more than savings earn.`});
  const hi=S.loans.filter(l=>l.rate>20);
  if(hi.length)ins.push({icon:icon('lightning',{label:'Alert'}),title:`${hi.length} high-interest loan${hi.length>1?'s':''}`,body:`${hi.map(l=>esc(l.name)).join(', ')} above 20%. Prioritise these.`});
  const pp=totalRev()>0?pendExp()/totalRev()*100:0;
  if(pp>50)ins.push({icon:icon('hourglass',{label:'Pending'}),title:'High pending ratio',body:`${pp.toFixed(0)}% of income tied in unpaid bills.`});
  return ins.length?ins:[{icon:icon('compass',{label:'Goal'}),title:'Add more data',body:'More months = more personalised insights here.'}];
}

// _buildFinancialContext and _getModeLabel are defined in settings.js (single source)

// ══════════════════════════════════════════════
// CHARTS
// ══════════════════════════════════════════════
const CH={};
function dc(id){if(CH[id]){try{CH[id].destroy();}catch(e){}delete CH[id];}}

// Smart chart update — animates data changes instead of destroy+recreate
function uc(id, newData, newOptions){
  if(CH[id]){
    // Update existing chart smoothly
    const c = CH[id];
    c.data.labels = newData.labels;
    newData.datasets.forEach((ds,i)=>{
      if(c.data.datasets[i]){
        c.data.datasets[i].data = ds.data;
        // Update colours if changed (e.g. dark mode toggle)
        if(ds.backgroundColor !== undefined) c.data.datasets[i].backgroundColor = ds.backgroundColor;
        if(ds.borderColor !== undefined) c.data.datasets[i].borderColor = ds.borderColor;
      } else {
        c.data.datasets.push(ds);
      }
    });
    // Trim extra datasets if count reduced
    if(c.data.datasets.length > newData.datasets.length)
      c.data.datasets.splice(newData.datasets.length);
    c.update('active'); // smooth animated transition
    return;
  }
  // Chart doesn't exist yet — create fresh
  const canvas = document.getElementById(id);
  if(!canvas) return;
  CH[id] = new Chart(canvas, { data: newData, ...newOptions });
}


function renderPaydownChart(){
  const COLS=['#C53030','#B8860B','#276749','#5C7A6B','#2B6CB0','#6B46C1'];
  _setChartAria('paydownChart','Loan balance paydown trajectory for '+S.loans.length+' loan'+(S.loans.length!==1?'s':'')+'. Total debt: '+fmt(totalDebt()));
  const vm=S.loans.map(l=>calcMTP(amt(l.amount),l.rate,amt(l.minPayment))).filter(m=>m<999);
  if(!vm.length){dc('pd');return;}
  const maxMo=Math.min(120,Math.max(...vm));
  const labels=Array.from({length:maxMo+1},(_,i)=>i===0?'Now':i%12===0?'Yr '+(i/12):i%6===0?'Mo '+i:'');
  const loanNames=S.loans.map(l=>l.name);
  const datasets=S.loans.map((l,li)=>{
    const r=l.rate/100/12;let bal=amt(l.amount);const d=[Math.round(bal*100)/100];
    for(let m=1;m<=maxMo;m++){if(bal<=0.005){d.push(0);continue;}const interest=Math.round(bal*r*100)/100;if(amt(l.minPayment)<=interest){d.push(Math.round(bal*100)/100);continue;}bal=Math.max(0,bal-(amt(l.minPayment)-interest));d.push(Math.round(bal*100)/100);}
    return{label:l.name,data:d,borderColor:COLS[li%COLS.length],backgroundColor:'transparent',borderWidth:2,pointRadius:0,pointHoverRadius:4,tension:.3};
  });
  // Smart update: recreate only when loan count, names, or timeline length changes
  if(CH['pd']&&CH['pd'].data.datasets.length===datasets.length&&JSON.stringify(CH['pd'].data.datasets.map(ds=>ds.label))===JSON.stringify(loanNames)&&CH['pd'].data.labels.length===labels.length){
    datasets.forEach((ds,i)=>{CH['pd'].data.datasets[i].data=ds.data;});
    CH['pd'].update('active');return;
  }
  dc('pd');
  CH['pd']=new Chart(document.getElementById('paydownChart'),{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:10},padding:8,boxWidth:12,generateLabels:c=>c.data.datasets.map((ds,i)=>({text:ds.label,fillStyle:'transparent',strokeStyle:ds.borderColor,lineWidth:2,hidden:false,index:i,datasetIndex:i}))}}},scales:{x:{grid:{display:false},ticks:{font:{size:9},maxRotation:0}},y:{ticks:{callback:v=>fmtK(v),font:{size:9}},grid:{color:'rgba(0,0,0,0.03)'}}}}});
}

function renderSavingsChart(goals){
  if(!goals||!goals.length){dc('savChart');return;}
  _setChartAria('savChart','12-month savings projection for '+(goals.length)+' goal'+(goals.length!==1?'s':'')+'. Total saved: '+fmt(totalSav()));
  const p=CMK.split(' ');let baseMo=MS.indexOf(p[0]);const baseYr=parseInt(p[1]);
  const months=12;
  const labels=Array.from({length:months+1},(_,i)=>{let mo=(baseMo+i)%12,yr=baseYr+Math.floor((baseMo+i)/12);return MS[mo]+' '+yr;});
  const COLS=['#2B6CB0','#276749','#B8860B','#6B46C1','#C53030'];
  const datasets=goals.map((g,gi)=>{
    let bal=amt(g.balance);const data=[Math.round(bal*100)/100];
    for(let m=1;m<=months;m++){bal=bal*(1+g.rate/100/12)+amt(g.contribution);data.push(Math.round(bal*100)/100);}
    return{label:g.name,data,borderColor:COLS[gi%COLS.length],backgroundColor:'transparent',borderWidth:2,pointRadius:2,tension:.3};
  });
  let totalD=totalDebt();const debtData=[totalD];
  for(let m=1;m<=months;m++){totalD=Math.max(0,totalD-minPmts());debtData.push(parseFloat(totalD.toFixed(2)));}
  datasets.push({label:'Debt Remaining',data:debtData,borderColor:'#C53030',backgroundColor:'rgba(197,48,48,.06)',borderWidth:2,borderDash:[5,3],pointRadius:0,fill:true,tension:.3});
  const goalNames=goals.map(g=>g.name);
  // Smart update: recreate only when goal count or names change
  if(CH['savChart']&&CH['savChart'].data.datasets.length===datasets.length&&JSON.stringify(CH['savChart'].data.datasets.slice(0,-1).map(ds=>ds.label))===JSON.stringify(goalNames)&&JSON.stringify(CH['savChart'].data.labels)===JSON.stringify(labels)){
    datasets.forEach((ds,i)=>{CH['savChart'].data.datasets[i].data=ds.data;});
    CH['savChart'].update('active');return;
  }
  dc('savChart');
  CH['savChart']=new Chart(document.getElementById('savChart'),{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:10},padding:8,boxWidth:12}}},scales:{x:{grid:{display:false},ticks:{font:{size:9}}},y:{ticks:{callback:v=>fmtK(v),font:{size:9}},grid:{color:'rgba(0,0,0,0.03)'}}}}});
}

function _dashGreeting(){
  const score=calcHealth().total;
  const mood=score>=100?'🌟':score>=75?'😄':score>=51?'😊':score>=26?'😐':'😰';
  const h=new Date().getHours();
  const name=S.userName?', '+S.userName:'';
  const time=h>=5&&h<12?'Good morning':h>=12&&h<17?'Good afternoon':h>=17&&h<21?'Good evening':'Good night';
  return mood+' '+time+name;
}
var _dashDirty=true;
var _dashCache={};
function renderDash(){
  _dashDirty=false;
  const exp=totalExp(), paid=paidExp(), pend=pendExp(), rev=totalRev(), debt=totalDebt(), net=Math.round((rev-exp)*100)/100;
  const sv=totalSav(), mp=minPmts(), dti=rev>0?mp/rev*100:0;
  const {total:healthScore}=calcHealth();

  // ── GREETING ──
  const greetEl=document.getElementById('d-greeting');
  if(greetEl) greetEl.textContent=_dashGreeting();

  // ── HERO ──
  document.getElementById('d-hero-month').textContent=CMK;
  const cfEl=document.getElementById('d-cashflow');
  cfEl.textContent=(net<0?'-':'')+fmt(Math.abs(net));
  cfEl.className='hero-net '+(net>=0?'pos':'neg');
  document.getElementById('d-hero-sub').innerHTML='Income '+fmt(rev)+'&nbsp;·&nbsp; Expenses '+fmt(exp)+'&nbsp;·&nbsp; Pending '+fmt(pend);

  // Hero badges
  const keys=Object.keys(S.months), idx=keys.indexOf(CMK);
  const momEl=document.getElementById('d-hero-mom');
  momEl.textContent='';momEl.className='hero-badge hb-neutral';
  if(idx>0){
    const prevNet=totalRev(keys[idx-1])-totalExp(keys[idx-1]);
    const diff=net-prevNet;
    if(diff!==0){
      momEl.textContent=(diff>0?'▲ ':'▼ ')+fmtK(Math.abs(diff))+' vs '+keys[idx-1].split(' ')[0];
      momEl.className='hero-badge '+(diff>0?'hb-pos':'hb-neg');
      momEl.style.display='';
    }
  }
  const pendPct=exp>0?Math.round(pend/exp*100):0;
  const pendBadge=document.getElementById('d-hero-pending');
  if(exp>0&&pend>0){pendBadge.textContent=pendPct+'% bills pending';pendBadge.className='hero-badge hb-warn';pendBadge.style.display='';}
  else if(exp>0&&pend===0){pendBadge.textContent='All paid ✓';pendBadge.className='hero-badge hb-pos';pendBadge.style.display='';}
  else{pendBadge.style.display='none';}
  const hEl=document.getElementById('d-hero-health');
  hEl.textContent='Health '+healthScore+'/100';
  hEl.className='hero-badge '+(healthScore>=75?'hb-pos':healthScore>=50?'hb-warn':'hb-neg');

  // ── KPI ROW ──
  document.getElementById('d-income').textContent=fmt(rev);
  document.getElementById('d-expenses').textContent=fmt(exp);
  document.getElementById('d-pending').textContent=fmt(pend);
  document.getElementById('d-debt').textContent=fmt(debt);
  document.getElementById('d-savings').textContent=fmt(sv);
  document.getElementById('d-minpmts').textContent=fmt(mp);

  // KPI deltas
  const incD=document.getElementById('d-inc-d'), expD=document.getElementById('d-exp-d');
  incD.textContent='';incD.className='dkd';incD.style.display='none';expD.textContent='';expD.className='dkd';expD.style.display='none';
  if(idx>0){
    const pR=totalRev(keys[idx-1]),pE=totalExp(keys[idx-1]);
    const dR=rev-pR,dE=exp-pE;
    if(dR!==0){incD.textContent=(dR>0?'▲ ':'▼ ')+fmtK(Math.abs(dR));incD.className='dkd '+(dR>0?'dp':'dn');incD.style.display='';}
    if(dE!==0){expD.textContent=(dE>0?'▲ ':'▼ ')+fmtK(Math.abs(dE));expD.className='dkd '+(dE<0?'dp':'dn');expD.style.display='';}
  }
  const pendSubEl=document.getElementById('d-pend-sub');
  pendSubEl.textContent=pendPct+'% still due';
  const savSubEl=document.getElementById('d-sav-sub');
  const savGoals=S.savings||[];
  const savDone=savGoals.filter(g=>amt(g.balance)>=amt(g.target)).length;
  savSubEl.textContent=savDone+' / '+savGoals.length+' goals met';
  const dtiLbl=document.getElementById('d-dti-lbl');
  dtiLbl.textContent='DTI '+dti.toFixed(1)+'%';
  dtiLbl.style.background=dti>43?'var(--danger-light)':dti>=36?'var(--amber-light)':'var(--success-light)';
  dtiLbl.style.color=dti>43?'var(--danger)':dti>=36?'var(--amber)':'var(--success)';
  document.getElementById('d-dti').textContent=fmt(mp);
  // FX note — show when any item in the current month has a foreign currency (E6)
  var fxNote=document.getElementById('kpi-fx-note');
  if(fxNote){
    var hasFX=cw().some(function(w){return w.items.some(function(i){return i.currency&&i.currency!==getCurrency().code;});})
      ||(cm().revenue||[]).some(function(r){return r.currency&&r.currency!==getCurrency().code;});
    fxNote.style.display=hasFX?'':'none';
  }
  // Update tooltip detail text (E4)
  var dtiDetail=document.getElementById('dtiTooltipDetail');
  if(dtiDetail){
    if(dti>43) dtiDetail.textContent='Your DTI is '+dti.toFixed(1)+'% — above 43%, which lenders consider high risk.';
    else if(dti>=36) dtiDetail.textContent='Your DTI is '+dti.toFixed(1)+'% — lenders typically prefer under 36%.';
    else if(dti>0) dtiDetail.textContent='Your DTI is '+dti.toFixed(1)+'% — within the healthy range (under 36%).';
    else dtiDetail.textContent='No loan payments recorded yet.';
  }

  // ── UPCOMING BILLS ──
  document.getElementById('d-cat-month').textContent=CMK;
  const today=new Date().getDate();
  const isCurMonth=(()=>{const p=CMK.split(' ');return MS.indexOf(p[0])===new Date().getMonth()&&parseInt(p[1])===new Date().getFullYear();})();
  const billsByDay={};
  cw().forEach(w=>w.items.forEach(item=>{
    if(item.dueDay){
      if(!billsByDay[item.dueDay])billsByDay[item.dueDay]=[];
      billsByDay[item.dueDay].push(item);
    }
  }));
  const billEntries=Object.entries(billsByDay)
    .sort((a,b)=>parseInt(a[0])-parseInt(b[0]))
    .filter(([d])=>!isCurMonth||parseInt(d)>=today);
  const billsEl=document.getElementById('d-bills-list');
  const billCountEl=document.getElementById('d-bills-count');
  const _billSig=today+':'+isCurMonth+':'+JSON.stringify(billEntries.map(([d,items])=>[d,items.map(i=>i.name+i.paid+i.amount)]));
  if(_billSig!==_dashCache.billSig){
    _dashCache.billSig=_billSig;
    if(!billEntries.length){
      billsEl.innerHTML='<div style="padding:12px 0;font-size:12px;color:var(--text-muted);text-align:center;">No upcoming bills with due dates set.<br><span style="font-size:11px;">Set due dates in Expenses tab.</span></div>';
      billCountEl.textContent='';
    } else {
      const pendingBillCount=billEntries.reduce((s,[,items])=>s+items.filter(i=>!i.paid).length,0);
      billCountEl.textContent=pendingBillCount+' pending';
      billsEl.innerHTML=billEntries.slice(0,6).map(([day,items])=>{
        const daysUntil=isCurMonth?parseInt(day)-today:-1;
        const dotCls=daysUntil>=0&&daysUntil<=3?'bdd-urgent':daysUntil>=0&&daysUntil<=7?'bdd-soon':'bdd-ok';
        const total=items.reduce((s,i)=>s+i.amount,0);
        const allPaid=items.every(i=>i.paid);
        return`<div class="bill-row">
          <div class="bill-day-dot ${dotCls}">${day}</div>
          <div class="bn">${items.length===1?items[0].name:items.length+' bills'}</div>
          <div class="ba">${fmt(total)}</div>
          <span class="bs ${allPaid?'bs-paid':'bs-pend'}">${allPaid?'Paid':'Due'}</span>
        </div>`;
      }).join('');
    }
  }

  // ── CHARTS ──
  // Trend chart — 6 month income vs expenses
  const tk=keys.slice(-6);
  if(!CH['tr']){
    dc('tr');
    CH['tr']=new Chart(document.getElementById('trendChart'),{type:'line',data:{labels:tk,datasets:[{label:'Income',data:tk.map(k=>totalRev(k)),borderColor:'#276749',backgroundColor:'rgba(39,103,73,.07)',borderWidth:2,pointRadius:3,pointHoverRadius:5,fill:true,tension:.4},{label:'Expenses',data:tk.map(k=>totalExp(k)),borderColor:'#C53030',backgroundColor:'rgba(197,48,48,.05)',borderWidth:2,pointRadius:3,pointHoverRadius:5,fill:true,tension:.4}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+fmt(ctx.raw)}}},scales:{x:{grid:{display:false},ticks:{font:{size:9},maxRotation:0}},y:{ticks:{callback:v=>fmtK(v),font:{size:9}},grid:{color:'rgba(0,0,0,.03)'}}}}});
  } else {
    CH['tr'].data.labels=tk;
    CH['tr'].data.datasets[0].data=tk.map(k=>totalRev(k));
    CH['tr'].data.datasets[1].data=tk.map(k=>totalExp(k));
    CH['tr'].update('active');
  }

  // Update trend chart aria-label with real values
  _setChartAria('trendChart','Income vs expenses over last '+tk.length+' months. '+CMK+': income '+fmt(totalRev(CMK))+', expenses '+fmt(totalExp(CMK)));

  // Category donut
  const catT={};cw().forEach(w=>w.items.forEach(i=>{const c=getCatLabel(getCat(i.name));catT[c]=(catT[c]||0)+i.amount;}));

  const topCatEntry=Object.entries(catT).sort((a,b)=>b[1]-a[1])[0];
  _setChartAria('categoryChart','Spending by category this month. Top: '+(topCatEntry?topCatEntry[0]+' '+fmt(topCatEntry[1]):'none'));
  const dark=document.body.classList.contains('dark');
  const catKeys=Object.keys(catT).filter(k=>catT[k]>0);
  const catVals=catKeys.map(k=>catT[k]);
  const catBgs=catKeys.map(c=>CAT_COLORS[c]||'#A0AEC0');
  const _catTotal=catVals.reduce((a,b)=>a+b,0)||1;
  if(!CH['cat']||JSON.stringify(CH['cat'].data.labels)!==JSON.stringify(catKeys)){
    dc('cat');
    CH['cat']=new Chart(document.getElementById('categoryChart'),{type:'doughnut',data:{labels:catKeys,datasets:[{data:catVals,backgroundColor:catBgs,borderWidth:2,borderColor:dark?'#222536':'#fff',hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{position:'right',labels:{font:{size:9},padding:6,boxWidth:9}},tooltip:{callbacks:{label:ctx=>ctx.label+': '+fmt(ctx.raw)+' ('+Math.round(ctx.raw/_catTotal*100)+'%)'}}}}});
  } else {
    CH['cat'].data.datasets[0].data=catVals;
    CH['cat'].data.datasets[0].borderColor=dark?'#222536':'#fff';
    CH['cat'].update('active');
  }

  // Weekly stacked bar
  const wkLabels=cw().map((_,i)=>'Wk '+(i+1));
  const _wkPaid=cw().map(w=>w.items.filter(i=>i.paid).reduce((s,i)=>s+i.amount,0));
  const _wkPend=cw().map(w=>w.items.filter(i=>!i.paid).reduce((s,i)=>s+i.amount,0));
  if(!CH['wk']){
    dc('wk');
    CH['wk']=new Chart(document.getElementById('weeklyChart'),{type:'bar',data:{labels:wkLabels,datasets:[{label:'Paid',data:_wkPaid,backgroundColor:'#276749',borderRadius:3,stack:'w'},{label:'Pending',data:_wkPend,backgroundColor:'#B7791F',borderRadius:3,stack:'w'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+fmt(ctx.raw)}}},scales:{x:{stacked:true,grid:{display:false},ticks:{font:{size:10}}},y:{stacked:true,ticks:{callback:v=>fmtK(v),font:{size:9}},grid:{color:'rgba(0,0,0,.03)'}}}}});
  } else {
    CH['wk'].data.labels=wkLabels;
    CH['wk'].data.datasets[0].data=_wkPaid;
    CH['wk'].data.datasets[1].data=_wkPend;
    CH['wk'].update('active');
  }

  _setChartAria('weeklyChart','Weekly expenses for '+CMK+'. Total paid: '+fmt(paidExp())+', pending: '+fmt(pendExp()));
  // Cash flow bar
  const _cfData=[rev,exp,mp,Math.abs(net)];
  const _cfColors=['#276749','#C53030','#B7791F',net>=0?'#5C7A6B':'#C53030'];
  if(!CH['cf']){
    dc('cf');
    CH['cf']=new Chart(document.getElementById('cashflowChart'),{type:'bar',data:{labels:['Income','Expenses','Loan Pmts','Net'],datasets:[{data:_cfData,backgroundColor:_cfColors,borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>fmt(ctx.raw)}}},scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{ticks:{callback:v=>fmtK(v),font:{size:9}},grid:{color:'rgba(0,0,0,.03)'}}}}});
  } else {
    CH['cf'].data.datasets[0].data=_cfData;
    CH['cf'].data.datasets[0].backgroundColor=_cfColors;
    CH['cf'].update('active');
  }

  _setChartAria('cashflowChart','Cash flow for '+CMK+': income '+fmt(rev)+', expenses '+fmt(exp)+', loan payments '+fmt(mp)+', net '+(net>=0?'+':'')+fmt(Math.abs(net)));
  // ── EXPENSE PROGRESS BARS ──
  const expTotal=exp||1;
  const _epbPaidPct=Math.min(100,paid/expTotal*100);
  const _epbPendPct=Math.min(100,pend/expTotal*100);
  document.getElementById('d-epb-paid').style.width=_epbPaidPct.toFixed(1)+'%';
  document.getElementById('d-epb-paid').closest('[role="progressbar"]').setAttribute('aria-valuenow',Math.round(_epbPaidPct));
  document.getElementById('d-epb-paid-val').textContent=fmt(paid);
  document.getElementById('d-epb-pend').style.width=_epbPendPct.toFixed(1)+'%';
  document.getElementById('d-epb-pend').closest('[role="progressbar"]').setAttribute('aria-valuenow',Math.round(_epbPendPct));
  document.getElementById('d-epb-pend-val').textContent=fmt(pend);
  document.getElementById('d-exp-prog-pct').textContent=Math.round(paid/expTotal*100)+'% paid';
  // Per-week mini bars — fingerprint reuses _wkPaid/_wkPend already computed for the chart
  const _weekSig=JSON.stringify(_wkPaid)+':'+JSON.stringify(_wkPend);
  if(_weekSig!==_dashCache.weekSig){
    _dashCache.weekSig=_weekSig;
    document.getElementById('d-week-prog-list').innerHTML=cw().map((w,wi)=>{
      const wt=w.items.reduce((s,i)=>s+i.amount,0);
      const wp=w.items.filter(i=>i.paid).reduce((s,i)=>s+i.amount,0);
      const wpct=wt>0?Math.min(100,wp/wt*100):0;
      const allPaid=wt>0&&wp===wt;
      return`<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
        <span style="font-size:10px;color:var(--text-muted);min-width:28px;">Wk ${wi+1}</span>
        <div role="progressbar" aria-valuenow="${Math.round(wpct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Week ${wi+1} paid" style="flex:1;height:5px;background:var(--slate-mid);border-radius:3px;overflow:hidden;">
          <div style="height:100%;border-radius:3px;background:${allPaid?'var(--success)':'var(--sage)'};width:${wpct.toFixed(1)}%;transition:width .5s;"></div>
        </div>
        <span style="font-size:10px;color:${allPaid?'var(--success)':'var(--text-muted)'};min-width:32px;text-align:right;">${wpct.toFixed(0)}%</span>
      </div>`;
    }).join('');
  }

  // ── LOAN PAYOFF PROGRESS ──
  const loanTotal=debt||1;
  document.getElementById('d-loan-summary').textContent=S.loans.length+' loans · '+fmt(debt)+' remaining';
  const _loanSig=JSON.stringify(S.loans.map(l=>l.name+''+l.amount+''+l.originalAmount+''+l.rate));
  if(_loanSig!==_dashCache.loanSig){
    _dashCache.loanSig=_loanSig;
    document.getElementById('loanProgressList').innerHTML=S.loans.length?S.loans.map(l=>{
      const oa=l.originalAmount||l.amount;
      const pct=Math.min(100,Math.max(2,oa>0?(oa-l.amount)/oa*100:0));
      const col=l.rate>15?'var(--danger)':l.rate>10?'var(--amber)':'var(--sage)';
      const isPaidOff=l.amount<=0;
      return`<div class="prog-item-dash">
        <div class="prog-header">
          <span class="pn" style="${isPaidOff?'text-decoration:line-through;color:var(--success);':''}">${esc(l.name)}</span>
          <span class="pa">${isPaidOff?'Paid off!':fmt(amt(l.amount))}</span>
        </div>
        <div class="prog-track"><div class="prog-fill-dash" style="width:${pct.toFixed(1)}%;background:${col};"></div></div>
        <div class="prog-foot">${l.rate}% APR &nbsp;·&nbsp; ${pct.toFixed(0)}% paid off ${isPaidOff?icon('trophy',{label:'Paid off'}):''}</div>
      </div>`;
    }).join(''):'<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">No loans added yet.</div>';
  }

  // ── SAVINGS GOALS ──
  const savGoalsList=S.savings||[];
  document.getElementById('d-sav-summary').textContent=savGoalsList.length+' goals · '+fmt(sv)+' saved';
  renderDashSavings(savGoalsList);

  // ── NET WORTH (savings + investments − debt) ──
  const invValue=typeof totalInvValue==='function'?Math.round(totalInvValue()*100)/100:0;
  const totalAssets=Math.round((sv+invValue)*100)/100;
  const nw=Math.round((totalAssets-debt)*100)/100;
  const nwEl=document.getElementById('d-networth');
  if(nwEl){
    nwEl.textContent=(nw<0?'-':'')+fmt(Math.abs(nw));
    nwEl.className='dkv '+(nw>=0?'nw-pos':'nw-neg');
    const nwSub=document.getElementById('d-nw-sub');
    if(nwSub){
      // Concise: show assets total and debt; tooltip title shows the split
      nwSub.textContent=fmt(totalAssets)+' assets − '+fmt(debt)+' debt';
      nwSub.title='Savings: '+fmt(sv)+(invValue>0?' · Investments: '+fmt(invValue):'')+' · Debt: '+fmt(debt);
    }
  }
  // ── INVESTMENTS SUMMARY ──
  if(typeof renderDashInvestments==='function')renderDashInvestments();

  // ── NET WORTH BREAKDOWN CARD ──
  (function(){
    const _svEl=document.getElementById('d-nw-savings');
    const _invEl=document.getElementById('d-nw-investments');
    const _assEl=document.getElementById('d-nw-assets');
    const _dbtEl=document.getElementById('d-nw-debt');
    const _totEl=document.getElementById('d-nw-total');
    const _barEl=document.getElementById('d-nw-bar');
    if(!_totEl)return;
    if(_svEl)_svEl.textContent=fmt(sv);
    if(_invEl)_invEl.textContent=fmt(invValue);
    if(_assEl)_assEl.textContent=fmt(totalAssets);
    if(_dbtEl)_dbtEl.textContent=fmt(debt);
    if(_totEl){_totEl.textContent=(nw<0?'-':'')+fmt(Math.abs(nw));_totEl.style.color=nw>=0?'var(--success)':'var(--danger)';}
    if(_barEl){
      const total=totalAssets+debt||1;
      const assetPct=(totalAssets/total*100).toFixed(1);
      const debtPct=(debt/total*100).toFixed(1);
      // Sub-bar: savings vs investments within the asset portion
      const savPct=(sv/total*100).toFixed(1);
      const invPct=(invValue/total*100).toFixed(1);
      _barEl.innerHTML=
        `<div style="width:${savPct}%;background:var(--blue);height:100%;" title="Savings: ${fmt(sv)}"></div>`+
        `<div style="width:${invPct}%;background:var(--success);height:100%;" title="Investments: ${fmt(invValue)}"></div>`+
        `<div style="width:${debtPct}%;background:var(--danger);height:100%;" title="Debt: ${fmt(debt)}"></div>`;
    }
  })();

  // Award XP for positive historical months (once per month per session)
  if(net>0){
    const xpKey='fintone_xp_pos_'+CMK;
    if(!sessionStorage.getItem(xpKey)){
      if(typeof awardXP==='function') awardXP('positive_month');
      sessionStorage.setItem(xpKey,'1');
    }
  }

  // Proactive alerts panel
  renderDashAlerts();

  // Gamification — streak, challenge, achievements, XP bar, heatmap
  if(typeof renderGamification==='function') renderGamification();
}

// ── DASHBOARD ALERTS (2C) ──
function generateDashAlerts(){
  const alerts=[];
  const parts=CMK.split(' ');
  const todayObj=new Date();
  const isCurMo=MS.indexOf(parts[0])===todayObj.getMonth()&&parseInt(parts[1])===todayObj.getFullYear();
  const today=isCurMo?todayObj.getDate():0;

  // 1. Bills due in next 3 days
  if(isCurMo){
    cw().forEach(w=>w.items.forEach(item=>{
      if(item.dueDay&&!item.paid){
        const d=item.dueDay-today;
        if(d>=0&&d<=3){
          const lbl=d===0?'TODAY':d===1?'tomorrow':'in '+d+' days';
          alerts.push({icon:d===0?'🔴':d===1?'🟡':'🔵',text:'<b>'+esc(item.name)+'</b> ('+fmt(item.amount)+') due '+lbl,action:'switchToExpensesTab',actionLabel:'View'});
        }
      }
    }));
  }

  // 2. Budget velocity warnings (category will hit cap before month end)
  if(isCurMo&&today>0){
    const daysInMonth=new Date(todayObj.getFullYear(),todayObj.getMonth()+1,0).getDate();
    const catT=_cachedCatTotals||catTotalsForMonth();
    Object.keys(S.budgets||BDFT).forEach(cat=>{
      const spent=catT[cat]||0;
      const cap=(S.budgets&&S.budgets[cat])||BDFT[cat]||500;
      if(spent>0&&cap>0){
        const projected=spent/today*daysInMonth;
        if(projected>=cap*1.1&&spent<cap){
          const hitDay=Math.min(daysInMonth,Math.round(cap/(spent/today)));
          alerts.push({icon:'📊',text:'<b>'+esc(cat)+'</b> on pace to hit budget cap around day '+hitDay,action:'switchToExpensesTab',actionLabel:'Review'});
        }
      }
    });
  }

  // 3. Spending anomaly — category 1.5× its 3-month average
  const allKeys=Object.keys(S.months);
  const prevKeys=allKeys.filter(k=>k!==CMK).slice(-3);
  if(prevKeys.length>=1){
    const catT=_cachedCatTotals||catTotalsForMonth();
    Object.entries(CAT_LABELS).forEach(([catCls,catLbl])=>{
      const currSpent=catT[catLbl]||0;
      const prevAvg=prevKeys.reduce((s,k)=>{
        return s+(S.months[k].weeks||[]).reduce((ws,w)=>ws+w.items.filter(i=>getCat(i.name)===catCls).reduce((a,i)=>a+i.amount,0),0);
      },0)/prevKeys.length;
      if(prevAvg>50&&currSpent>prevAvg*1.5){
        const _anomalyMsg=catLbl+' spending is '+(currSpent/prevAvg).toFixed(1)+'x my recent average of '+fmt(prevAvg)+'/mo. This month I\'ve spent '+fmt(currSpent)+'. Why might this be high and what should I do?';
        alerts.push({icon:icon('warning',{label:'Alert'}),text:'<b>'+esc(catLbl)+'</b> is '+(currSpent/prevAvg).toFixed(1)+'× your recent average ('+fmt(prevAvg)+'/mo)',action:'coachRunAnomaly',actionArg:_anomalyMsg,actionLabel:'Ask Coach'});
      }
    });
  }

  return alerts.slice(0,3);
}

function coachRunAnomaly(question){
  // Switch to analytics tab and reveal the coach panel
  switchTab('analytics',document.getElementById('tab-analytics'));
  setTimeout(function(){
    // Expand coach panel if collapsed
    var body=document.getElementById('coachPanelBody');
    var btn=document.getElementById('coachCollapseBtn');
    if(body&&body.style.display==='none'){
      body.style.display='';
      if(btn)btn.textContent='▲ Collapse';
      try{localStorage.setItem('fincwin_coach_collapsed','0');}catch(e){}
    }
    // Scroll to coach section
    var sec=document.getElementById('coachSection');
    if(sec)sec.scrollIntoView({behavior:'smooth',block:'start'});
    // Pre-fill question and submit
    setTimeout(function(){
      var input=document.getElementById('coachQuestion');
      if(input&&question){
        input.value=question;
        input.dispatchEvent(new Event('input'));
      }
      if(typeof coachAsk==='function') coachAsk();
    },300);
  },260);
}

function renderDashAlerts(){
  const panel=document.getElementById('dash-alerts-panel');
  if(!panel)return;
  const alerts=generateDashAlerts();
  if(!alerts.length){panel.style.display='none';return;}
  panel.style.display='';
  panel.innerHTML=alerts.map(a=>
    `<div class="da-row">
      <span class="da-icon">${a.icon}</span>
      <div class="da-text">${a.text}</div>
      ${a.action?`<button class="da-btn" data-action="${a.action}"${a.actionArg?' data-arg="'+a.actionArg.replace(/"/g,'&quot;')+'"':''}>${a.actionLabel}</button>`:''}
    </div>`
  ).join('')+'<button class="da-dismiss" data-action="dismissDashAlerts" title="Dismiss alerts" aria-label="Dismiss">'+icon('close',{label:'Dismiss'})+'</button>';
}

function dismissDashAlerts(){
  const panel=document.getElementById('dash-alerts-panel');
  if(panel)panel.style.display='none';
}

function renderExpSumChart(){
  const _esData={labels:['Wk 1','Wk 2','Wk 3','Wk 4','Revenue'],datasets:[{data:[...cw().map(w=>w.items.reduce((s,i)=>s+i.amount,0)),totalRev()],backgroundColor:['#5C7A6B','#5C7A6B','#5C7A6B','#5C7A6B','#B8860B'],borderRadius:3}]};
  uc('es',_esData,{type:'bar',options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{ticks:{callback:v=>fmtK(v),font:{size:9}}}}}});
}
function renderIncomeChart(){
  const keys=Object.keys(S.months).slice(-8);
  const _latestInc=keys.length?totalRev(keys[keys.length-1]):0;
  const _latestExp=keys.length?totalExp(keys[keys.length-1]):0;
  _setChartAria('incomeChart','Income and expenses over last '+keys.length+' months. Latest: income '+fmt(_latestInc)+', expenses '+fmt(_latestExp));
  if(!CH['ic']||JSON.stringify(CH['ic'].data.labels)!==JSON.stringify(keys)){
    dc('ic');
    CH['ic']=new Chart(document.getElementById('incomeChart'),{type:'line',data:{labels:keys,datasets:[{label:'Income',data:keys.map(k=>totalRev(k)),borderColor:'#276749',backgroundColor:'rgba(39,103,73,.08)',borderWidth:2,pointRadius:3,fill:true,tension:.3},{label:'Expenses',data:keys.map(k=>totalExp(k)),borderColor:'#C53030',backgroundColor:'rgba(197,48,48,.05)',borderWidth:2,pointRadius:3,fill:true,tension:.3}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:10},padding:8,boxWidth:10}}},scales:{x:{grid:{display:false},ticks:{font:{size:9}}},y:{ticks:{callback:v=>fmtK(v),font:{size:9}}}}}});
  } else {
    CH['ic'].data.datasets[0].data=keys.map(k=>totalRev(k));
    CH['ic'].data.datasets[1].data=keys.map(k=>totalExp(k));
    CH['ic'].update('active');
  }
}
function renderCatTrend(keys){
  const cats=Object.keys(CAT_LABELS);
  const dsets=cats.map(cat=>{const lbl=CAT_LABELS[cat];const data=keys.map(k=>S.months[k].weeks.reduce((s,w)=>s+w.items.filter(i=>getCat(i.name)===cat).reduce((a,i)=>a+i.amount,0),0));if(data.every(v=>v===0))return null;return{label:lbl,data,borderColor:CAT_COLORS[lbl]||'#A0AEC0',backgroundColor:'transparent',borderWidth:2,pointRadius:2,tension:.3};}).filter(Boolean);
  if(!CH['ct']||JSON.stringify(CH['ct'].data.labels)!==JSON.stringify(keys)||CH['ct'].data.datasets.length!==dsets.length){
    dc('ct');
    CH['ct']=new Chart(document.getElementById('catTrendChart'),{type:'line',data:{labels:keys,datasets:dsets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{size:9},padding:6,boxWidth:9}}},scales:{x:{grid:{display:false},ticks:{font:{size:9}}},y:{ticks:{callback:v=>fmtK(v),font:{size:9}}}}}});
  } else {
    dsets.forEach((ds,i)=>{CH['ct'].data.datasets[i].data=ds.data;});
    CH['ct'].update('active');
  }
}
// ── TAX SUMMARY CARD (E5) ──────────────────────────────────────────────────────
function renderTaxSummary() {
  var card = document.getElementById('taxSummaryCard');
  var body = document.getElementById('taxSummaryBody');
  if (!card || !body) return;

  var monthNums = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
  var qMap = {1:'Q1',2:'Q1',3:'Q1',4:'Q2',5:'Q2',6:'Q2',7:'Q3',8:'Q3',9:'Q3',10:'Q4',11:'Q4',12:'Q4'};
  var qtotals = {Q1:{},Q2:{},Q3:{},Q4:{}};

  Object.keys(S.months).forEach(function(key) {
    var mn = monthNums[key.split(' ')[0]] || 0;
    var q = qMap[mn];
    if (!q) return;
    S.months[key].weeks.forEach(function(w) {
      w.items.filter(function(i) { return i.taxDeductible; }).forEach(function(item) {
        var cat = getCatLabel(getCat(item.name));
        qtotals[q][cat] = (qtotals[q][cat] || 0) + (item.amount || 0);
      });
    });
  });

  var hasAny = Object.values(qtotals).some(function(q) { return Object.keys(q).length > 0; });
  card.style.display = hasAny ? '' : 'none';
  if (!hasAny) return;

  var allCats = [];
  var seen = {};
  Object.values(qtotals).forEach(function(q) {
    Object.keys(q).forEach(function(c) { if (!seen[c]) { seen[c] = true; allCats.push(c); } });
  });

  var html = '<table class="tax-summary-table"><thead><tr><th>Quarter</th>' +
    allCats.map(function(c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
  ['Q1','Q2','Q3','Q4'].forEach(function(q) {
    var total = allCats.reduce(function(s, c) { return s + (qtotals[q][c] || 0); }, 0);
    if (total === 0) return;
    html += '<tr><td>' + q + '</td>' +
      allCats.map(function(c) { return '<td>' + (qtotals[q][c] ? fmt(qtotals[q][c]) : '—') + '</td>'; }).join('') +
      '</tr>';
  });
  html += '</tbody></table>';
  body.innerHTML = html;
}

function renderNetChart(keys,nets){
  if(!CH['nc']||JSON.stringify(CH['nc'].data.labels)!==JSON.stringify(keys)){
    dc('nc');
    CH['nc']=new Chart(document.getElementById('netChart'),{type:'line',data:{labels:keys,datasets:[{label:'Net Flow',data:nets,borderColor:'#276749',backgroundColor:'rgba(39,103,73,.1)',borderWidth:2,pointRadius:3,fill:true,tension:.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:9}}},y:{ticks:{callback:v=>fmtK(v),font:{size:9}},grid:{color:'rgba(0,0,0,0.03)'}}}}});
  } else {
    CH['nc'].data.datasets[0].data=nets;
    CH['nc'].update('active');
  }
}
