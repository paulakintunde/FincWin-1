// === health.js ===

// ══════════════════════════════════════════════
// HEALTH SCORE
// ══════════════════════════════════════════════

// FC-01: 3-month rolling average income — used when the current month has no
// income yet (e.g. on the 1st) so DTI and savings buffer don't collapse to 0.
function _rollingAvgRev(months){
  var allM=Object.assign({},S.archivedMonths||{},S.months||{});
  var keys=Object.keys(allM).sort().slice(-months);
  if(!keys.length)return 0;
  var total=keys.reduce(function(s,k){
    var m=allM[k];
    return s+(m.revenue||[]).reduce(function(rs,i){return rs+amt(i.amount);},0);
  },0);
  return total/keys.length;
}

function calcHealth(){
  const rev=totalRev(),exp=totalExp(),debt=totalDebt(),mp=minPmts();
  // Use rolling 3-month average when current month has no income entered yet.
  const revEff=rev>0?rev:_rollingAvgRev(3);
  const allI=cw().reduce((s,w)=>s+w.items.length,0);
  const pI=cw().reduce((s,w)=>s+w.items.filter(i=>i.paid).length,0);
  const sv=Math.max(0,totalSav());
  const invV=typeof totalInvValue==='function'?Math.max(0,totalInvValue()):0;
  const cf=rev>0?Math.min(25,Math.max(0,((rev-exp)/rev)*40)):0;
  const dti=revEff>0?Math.min(25,Math.max(0,(1-mp/revEff)*30)):0;
  const pmt=allI>0?(pI/allI)*20:0;
  const dl=revEff>0?Math.min(15,Math.max(0,(1-debt/(revEff*12))*15)):0;
  // Savings buffer includes investment portfolio — liquid savings for 3-month cushion,
  // investments weighted at 50% (less liquid, but real wealth)
  const ss=revEff>0?Math.min(10,Math.max(0,((sv+invV*0.5)/(revEff*3))*10)):0;
  const div=cr().length>1?5:0;
  const total=Math.min(100,Math.round(cf+dti+pmt+dl+ss+div));
  return{total,details:[{label:'Cash Flow',score:Math.round(cf),max:25},{label:'Debt-to-Income',score:Math.round(dti),max:25},{label:'Payment Rate',score:Math.round(pmt),max:20},{label:'Debt Load',score:Math.round(dl),max:15},{label:'Savings & Investments',score:Math.round(ss),max:10},{label:'Income Diversity',score:Math.round(div),max:5}]};
}
let _lastHealthScore=0;
function _animateScore(el,from,to){
  if(from===to){el.textContent=to;return;}
  const dur=600,start=performance.now();
  function step(now){
    const p=Math.min((now-start)/dur,1);
    const e=1-Math.pow(1-p,3);
    el.textContent=Math.round(from+(to-from)*e);
    if(p<1)requestAnimationFrame(step);else el.textContent=to;
  }
  requestAnimationFrame(step);
}
function updateHealth(){
  const{total}=calcHealth();
  const prev=_lastHealthScore;
  _lastHealthScore=total;
  const scoreEl=document.getElementById('healthScore');
  _animateScore(scoreEl,prev,total);
  const badge=document.querySelector('.health-badge');
  if(!badge)return;
  const badgeScore=badge.querySelector('.score'),lblEl=badge.querySelector('.hlabel');

  // Score 100 — perfect score
  if(total===100){
    badge.classList.add('score-perfect');
    badge.classList.remove('milestone');
    if(prev!==100){setTimeout(()=>{launchConfetti(220);showToast('🌟 Perfect score — 100/100!');},200);}
  } else {
    badge.classList.remove('score-perfect');
    // Crossed 75 milestone
    if(prev<75&&total>=75){
      badge.classList.add('milestone');
      setTimeout(()=>badge.classList.remove('milestone'),500);
      launchConfetti(60);showToast('🎉 Great financial health — score hit 75!');
      if(typeof awardXP==='function') awardXP('health_milestone');
    }
    if(prev<100&&total===100){if(typeof awardXP==='function') awardXP('health_milestone');}
    const[bg,bc,col]=total>=75?['var(--success-light)','var(--success-mid)','var(--success)']:total>=50?['var(--amber-light)','var(--amber-mid)','var(--amber)']:['var(--danger-light)','var(--danger-mid)','var(--danger)'];
    badge.style.background=bg;badge.style.borderColor=bc;badgeScore.style.color=col;lblEl.style.color=col;
  }

  // Gamification hooks
  if(typeof renderHealthTierPill==='function') renderHealthTierPill(total);
  if(typeof checkAchievements==='function') checkAchievements('perfect_score');
}
const _healthTips={
  'Cash Flow':{desc:'Net income minus expenses as % of income.',tip:'Aim for 20%+ positive flow. Reduce discretionary spending or grow income.'},
  'Debt-to-Income':{desc:'Monthly loan minimums vs. monthly income.',tip:'Below 36% is healthy. Pay down high-interest debt to lower this score.'},
  'Payment Rate':{desc:'Bills and expenses marked paid vs. total this month.',tip:'Mark bills paid as you go. All paid = full score.'},
  'Debt Load':{desc:'Total debt vs. one year\'s income.',tip:'Lower total debt relative to your income. Extra payments reduce this fast.'},
  'Savings Buffer':{desc:'Savings balance vs. a 3-month income emergency fund.',tip:'Build 3 months of income in savings for a full score.'},
  'Income Diversity':{desc:'Number of active income sources.',tip:'Add a second income source (side work, investments) to earn +5 points.'}
};

function openHealthModal(){
  const{total,details}=calcHealth();
  document.getElementById('modalScore').textContent=total;
  const offset=251-(251*total/100);
  const ring=document.getElementById('healthRing');
  ring.setAttribute('stroke-dashoffset',offset.toFixed(1));
  const colVar=total>=75?'var(--success)':total>=50?'var(--amber)':'var(--danger)';
  ring.style.stroke=colVar;
  document.getElementById('scoreBreakdown').innerHTML=details.map(d=>{
    const tip=_healthTips[d.label];
    const pct=d.max>0?d.score/d.max*100:0;
    return`<div class="score-row" style="flex-direction:column;align-items:stretch;gap:3px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-weight:600;font-size:12px;">${d.label}</span>
        <span style="font-family:'Instrument Serif',serif;font-size:13px;">${d.score}/${d.max}</span>
      </div>
      <div class="bw"><div class="bar-fill" style="width:${pct}%;background:${colVar};"></div></div>
      ${tip?`<div style="font-size:10px;color:var(--text-muted);">${tip.desc}</div>
      <div style="font-size:10px;color:var(--text-secondary);font-style:italic;">${d.score<d.max?'💡 '+tip.tip:''}</div>`:''}
    </div>`;
  }).join('');
  document.getElementById('healthModal').classList.add('open');
  trapFocus(document.getElementById('healthModal'));
}
function closeHealthModal(){releaseTrap(document.getElementById('healthModal'));
  document.getElementById('healthModal').classList.remove('open');}
