// === state.js ===

// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
let S=null, CMK='', revWin=12, tagFilter='', _blurLk=false;
let _pendingSavIdx=-1, _pendingDelSavIdx=-1;
let _txnMode='deposit', _txnIdx=-1, _envCat='';
let _noteWi=-1, _noteIi=-1, _receiptWi=-1, _receiptIi=-1;

// ── Undo state ────────────────────────────────────────────────────────────────
let _undoSnapshot = null; // { json, timer }
let _persisting = false;  // guard against concurrent _doPersist calls

// ── Session encryption state ──────────────────────────────────────────────────
// _sessionKey : AES-GCM CryptoKey derived from PIN via PBKDF2 — null when locked.
// _lockResolve: resolves the Promise returned by checkLock() when PIN is entered.
// _lastActivity: updated by pointer/keyboard events for auto-lock.
// _pinActive   : true once checkLock confirms a PIN is set, regardless of encryption.
//               Used by auto-lock guards so non-encrypted PIN users are still locked.
let _sessionKey   = null;
let _lockResolve  = null;
let _lastActivity = Date.now();
let _pinActive    = false;
// ── Purpose-specific session-key wrappers (S-02) ─────────────────────────────
// External modules (settings.js, gdrive.js) must never receive the raw CryptoKey.
// These wrappers perform encrypt/decrypt operations inside this closure scope and
// return only the result — the key itself never leaves state.js.
async function sessionKeyEncrypt(plaintext) {
  if (!_sessionKey || typeof CRYPTO === 'undefined') return plaintext;
  try { return JSON.stringify(await CRYPTO.encrypt(plaintext, _sessionKey)); } catch(e) { return plaintext; }
}
async function sessionKeyDecrypt(val) {
  if (!_sessionKey || typeof CRYPTO === 'undefined') return val;
  try {
    var _p = typeof val === 'string' ? JSON.parse(val) : val;
    if (CRYPTO.isEncryptedPayload(_p)) return await CRYPTO.decrypt(_p, _sessionKey);
  } catch(e) {}
  return val;
}
function isSessionKeyActive() { return _sessionKey !== null; }

// ── Cross-tab state sync (DI-02) ──────────────────────────────────────────
// BroadcastChannel notifies sibling tabs when state is written so they can
// warn the user rather than silently overwriting data on next save.
let _bc = null;
let _bcLastSend = 0;
function _initBC() {
  if (typeof BroadcastChannel === 'undefined' || _bc) return;
  _bc = new BroadcastChannel('fw_state_sync');
  _bc.onmessage = function(e) {
    if (!e.data || e.data.type !== 'STATE_WRITTEN') return;
    if (typeof showToast === 'function') {
      showToast('⚠ Data changed in another tab — refresh to sync', 'warn-t');
    }
  };
}

// ── Session-unlock token ──────────────────────────────────────────────────────
// A lightweight token written to sessionStorage when the PIN is entered.
// sessionStorage survives page refreshes but is wiped when the tab closes.
// This means: one PIN per tab session (not per page load).
// The token encodes the unlock time so the inactivity timeout can still apply.
const _SESSION_TOKEN_KEY = 'fw_pin_session';

function _writeSessionToken() {
  try {
    sessionStorage.setItem(_SESSION_TOKEN_KEY, JSON.stringify({ at: Date.now() }));
  } catch(e) {}
}

function _readSessionToken() {
  try {
    var raw = sessionStorage.getItem(_SESSION_TOKEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) { return null; }
}

function _clearSessionToken() {
  try { sessionStorage.removeItem(_SESSION_TOKEN_KEY); } catch(e) {}
}

// Returns true if a valid, non-expired session token exists.
// Expiry = S.autoLockMins (default 240). 0 = never auto-expire token.
function _sessionTokenValid() {
  var token = _readSessionToken();
  if (!token || !token.at) return false;
  var mins = (typeof S !== 'undefined' && S && typeof S.autoLockMins === 'number')
    ? S.autoLockMins : 240;
  if (mins === 0) return true; // "never lock" — token lives until tab close
  return (Date.now() - token.at) < mins * 60000;
}

function mk(mo,yr){return MS[mo]+' '+yr;}

// ══════════════════════════════════════════════
// INDEXEDDB STORAGE ENGINE
// Wraps persist/initState — no other functions change
// Falls back to localStorage if IDB unavailable
// ══════════════════════════════════════════════
const IDB_NAME='FinFlow';const IDB_VERSION=2;const IDB_STORE='state';const IDB_PIN_STORE='meta';
let _idb=null;
function getSharedIdb(){ return _idb; }

function openIDB(){
  return new Promise((res,rej)=>{
    if(!window.indexedDB){rej(new Error('no IDB'));return;}
    const req=indexedDB.open(IDB_NAME,IDB_VERSION);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      const oldV=e.oldVersion;
      // v0 → v1/v2: create primary state store
      if(!db.objectStoreNames.contains(IDB_STORE)){
        db.createObjectStore(IDB_STORE);
      }
      // v1 → v2: add meta store for PIN hash and app metadata
      if(oldV<2&&!db.objectStoreNames.contains(IDB_PIN_STORE)){
        db.createObjectStore(IDB_PIN_STORE);
      }
      // Future migrations: add if(oldV<3){...} blocks here
    };
    req.onsuccess=e=>{res(e.target.result);};
    req.onerror=e=>{rej(e.target.error);};
  });
}

async function idbGet(key){
  // IDB hangs silently on file:// in Edge — use localStorage directly
  if(location.protocol==='file:')return localStorage.getItem(key);
  if(!_idb)_idb=await openIDB().catch(()=>null);
  if(!_idb)return localStorage.getItem(key);
  return new Promise((res,rej)=>{
    const tx=_idb.transaction(IDB_STORE,'readonly');
    const req=tx.objectStore(IDB_STORE).get(key);
    req.onsuccess=e=>{var _r=e.target.result;res(_r!==undefined?_r:null);};
    req.onerror=e=>rej(e.target.error);
  });
}

async function idbSet(key,val){
  // IDB hangs silently on file:// in Edge — use localStorage directly
  if(location.protocol==='file:'){try{localStorage.setItem(key,val);}catch(e){}return;}
  if(!_idb)_idb=await openIDB().catch(()=>null);
  if(!_idb){localStorage.setItem(key,val);return;}
  return new Promise((res,rej)=>{
    const tx=_idb.transaction(IDB_STORE,'readwrite');
    const req=tx.objectStore(IDB_STORE).put(val,key);
    req.onsuccess=()=>res();
    req.onerror=e=>rej(e.target.error);
  });
}

// ── Generic meta-store helpers (used by PIN and encryption key management) ──────
// These read/write the IDB_PIN_STORE ('meta') without any encryption applied —
// they store crypto metadata (salts, hashes) that must survive PIN changes.
async function _metaGet(key) {
  if (location.protocol === 'file:') return localStorage.getItem(key);
  if (!_idb) _idb = await openIDB().catch(function () { return null; });
  if (!_idb) return localStorage.getItem(key);
  return new Promise(function (res) {
    try {
      var tx  = _idb.transaction(IDB_PIN_STORE, 'readonly');
      var req = tx.objectStore(IDB_PIN_STORE).get(key);
      req.onsuccess = function (e) { res(e.target.result !== undefined ? e.target.result : null); };
      req.onerror   = function ()  { res(null); };
    } catch (e) { res(null); }
  });
}

async function _metaSet(key, val) {
  if (location.protocol === 'file:') { try { localStorage.setItem(key, val); } catch (e) {} return; }
  if (!_idb) _idb = await openIDB().catch(function () { return null; });
  if (!_idb) { try { localStorage.setItem(key, val); } catch (e) {} return; }
  return new Promise(function (res) {
    try {
      var tx  = _idb.transaction(IDB_PIN_STORE, 'readwrite');
      var req = tx.objectStore(IDB_PIN_STORE).put(val, key);
      req.onsuccess = function () { res(); };
      req.onerror   = function () { res(); };
    } catch (e) { res(); }
  });
}

async function _metaDel(key) {
  if (location.protocol === 'file:') { localStorage.removeItem(key); return; }
  if (!_idb) _idb = await openIDB().catch(function () { return null; });
  if (!_idb) { localStorage.removeItem(key); return; }
  return new Promise(function (res) {
    try {
      var tx  = _idb.transaction(IDB_PIN_STORE, 'readwrite');
      var req = tx.objectStore(IDB_PIN_STORE).delete(key);
      req.onsuccess = function () { res(); };
      req.onerror   = function () { res(); };
    } catch (e) { res(); }
  });
}

// Migrate from localStorage to IDB on first run
async function migrateToIDB(){
  const lsData=localStorage.getItem(SK);
  if(lsData){
    try{
      await idbSet(SK,lsData);
      localStorage.removeItem(SK);
      localStorage.setItem(SK+'_migrated','1');
    }catch(e){}
  }
}

let _persistTimer=null;
function persist(toast=true){
  clearTimeout(_persistTimer);
  _persistTimer=setTimeout(()=>_doPersist(toast),400);
}
// Flush any pending debounced save immediately on tab close / background.
// When encryption is active we cannot do async crypto here — the last encrypted
// save already written by _doPersist is the authoritative IDB copy.
window.addEventListener('beforeunload',function(){
  if(_persistTimer){
    clearTimeout(_persistTimer);
    _persistTimer=null;
    // If encryption is active, skip the synchronous fallback save:
    // _doPersist() fired on every prior change and the encrypted copy is in IDB.
    // Writing plaintext here would be a security regression.
    if(_sessionKey) return;
    S.currentMonthKey=CMK;
    S.lastModified=Date.now();
    var json=JSON.stringify(S);
    try{
      localStorage.setItem(SK,json);
    }catch(e){
      // QuotaExceededError — receipts (base64 images) are the likely culprit.
      try{
        var slim=JSON.parse(json);
        Object.values(slim.months||{}).forEach(function(m){
          m.weeks.forEach(function(w){w.items.forEach(function(i){i.receipt=null;});});
        });
        Object.values(slim.archivedMonths||{}).forEach(function(m){
          m.weeks.forEach(function(w){w.items.forEach(function(i){i.receipt=null;});});
        });
        localStorage.setItem(SK,JSON.stringify(slim));
      }catch(e2){}
    }
    if(typeof idbSet==='function')idbSet(SK,json).catch(function(){});
  }
});
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden'&&_persistTimer){clearTimeout(_persistTimer);_doPersist(false);}
});
async function _doPersist(toast=true){
  if(_persisting) return;
  _persisting=true;
  // Mark dashboard stale so next tab-switch to dashboard re-renders
  if(typeof _dashDirty!=='undefined') _dashDirty=true;
  S.currentMonthKey=CMK;
  S.lastModified = Date.now();
  const json=JSON.stringify(S);
  // Estimate byte size (UTF-8, 1 byte per char is conservative enough for JSON).
  const bytes=json.length;
  const alertEl=document.getElementById('storAlert');
  const msgEl=document.getElementById('storMsg');
  if(alertEl){
    const pct=bytes/(50*1024*1024)*100;
    if(pct>80){alertEl.classList.add('show');if(msgEl)msgEl.textContent='Data is large ('+Math.round(bytes/1024)+'KB) — consider exporting a backup.';}
    else alertEl.classList.remove('show');
  }
  // ── Encrypt at-rest if session key is active ──────────────────────────────
  let toStore = json;
  if (_sessionKey && typeof CRYPTO !== 'undefined') {
    try {
      const encPayload = await CRYPTO.encrypt(json, _sessionKey);
      toStore = JSON.stringify(encPayload);
    } catch (encErr) {
      // Encryption failure is fatal — show error and do NOT write cleartext to IDB.
      if (toast) showToast('⚠ Encryption error — data not saved', 'err-t');
      return;
    }
  }
  idbSet(SK, toStore).then(function () {
    _persisting=false;
    if(toast)showToast('✓ Saved');
    // Sync hooks always receive plaintext — they apply their own encryption.
    if(typeof window.fileWrite==='function')window.fileWrite(json);
    if(typeof window.cloudSyncPush==='function')window.cloudSyncPush(json);
    // Notify sibling tabs (throttled to once per 2 s to avoid flooding on rapid edits).
    if (_bc) {
      var _now = Date.now();
      if (_now - _bcLastSend > 2000) {
        _bcLastSend = _now;
        try { _bc.postMessage({ type: 'STATE_WRITTEN', at: _now }); } catch(e) {}
      }
    }
  }).catch(function () {
    _persisting=false;
    try{localStorage.setItem(SK,toStore);if(toast)showToast('✓ Saved (local)');}
    catch(e){showToast('⚠ Save failed — tap Export to backup','err-t');}
  });
}

// ══════════════════════════════════════════════
// CENTRAL MUTATION API
// All S.* writes from UI code should go through dispatch().
// Guarantees a single persist() per user action and a single
// place to add cross-cutting concerns (logging, undo, validation).
// Usage: dispatch('ACTION_TYPE', payload)
//        dispatch('ACTION_TYPE', payload, false)  ← silent persist (no toast)
// Remaining legacy direct-mutation sites: sync.js, gamification.js,
// state.js init, onboarding.js, bulk-add.js, import-bank.js, search.js.
// ══════════════════════════════════════════════
var _DESTRUCTIVE_ACTIONS=['ITEM_REMOVE','LOAN_REMOVE','SAVINGS_REMOVE','REVENUE_REMOVE',
  'RECURRING_REMOVE','MONTH_RESET_EXPENSES','MONTH_RESET_REVENUE',
  'MONTH_RESET_LOANS_PMT','SAVINGS_RESET_ALL','INVESTMENTS_RESET_ALL','SAVINGS_TXN_REMOVE'];

function dispatch(type, payload, toast) {
  var p = payload || {};
  var mk = p.mk || CMK;
  var weeks = S.months[mk] ? S.months[mk].weeks : null;
  if(_DESTRUCTIVE_ACTIONS.indexOf(type)!==-1)_snapForUndo();
  switch (type) {
    // ── ITEM ──────────────────────────────────
    case 'ITEM_SET_AMOUNT':
      if (weeks && weeks[p.wi] && weeks[p.wi].items[p.ii] !== undefined)
        weeks[p.wi].items[p.ii].amount = p.val;
      break;
    case 'ITEM_SET_PAID':
      if (weeks && weeks[p.wi] && weeks[p.wi].items[p.ii] !== undefined)
        weeks[p.wi].items[p.ii].paid = p.val;
      break;
    case 'ITEM_SET_FIELD':
      if (weeks && weeks[p.wi] && weeks[p.wi].items[p.ii] !== undefined)
        weeks[p.wi].items[p.ii][p.field] = p.val;
      break;
    case 'ITEM_SET_RECEIPT':
      if (weeks && weeks[p.wi] && weeks[p.wi].items[p.ii] !== undefined)
        weeks[p.wi].items[p.ii].receipt = p.data;
      break;
    case 'ITEM_ADD':
      if (!S.months[mk]) S.months[mk] = {weeks:[{items:[]},{items:[]},{items:[]},{items:[]}],revenue:[]};
      S.months[mk].weeks[p.wi].items.push(p.item);
      break;
    case 'ITEM_REMOVE':
      if (weeks && weeks[p.wi]) weeks[p.wi].items.splice(p.ii, 1);
      break;
    case 'ITEM_UPSERT':
      if (!S.months[mk]) S.months[mk] = {weeks:[{items:[]},{items:[]},{items:[]},{items:[]}],revenue:[]};
      if (p.ii >= 0) S.months[mk].weeks[p.wi].items[p.ii] = Object.assign({}, S.months[mk].weeks[p.wi].items[p.ii], p.patch);
      else S.months[mk].weeks[p.wi].items.push(p.item);
      break;
    case 'WEEK_SET_ALL_PAID':
      if (weeks && weeks[p.wi]) weeks[p.wi].items.forEach(function(i){ i.paid = p.val; });
      break;
    case 'BULK_SET_PAID':
      p.keys.forEach(function(k) {
        var parts = k.split('-').map(Number), wi = parts[0], ii = parts[1];
        if (weeks && weeks[wi] && weeks[wi].items[ii] !== undefined)
          weeks[wi].items[ii].paid = p.val;
      });
      break;
    // ── REVENUE ───────────────────────────────
    case 'REVENUE_SET_AMOUNT':
      if (S.months[mk] && S.months[mk].revenue[p.ri] !== undefined)
        S.months[mk].revenue[p.ri].amount = p.val;
      break;
    case 'REVENUE_TOGGLE':
      if (S.months[mk] && S.months[mk].revenue[p.i] !== undefined)
        S.months[mk].revenue[p.i].received = !S.months[mk].revenue[p.i].received;
      break;
    case 'REVENUE_UPSERT':
      if (!S.months[mk]) S.months[mk] = {weeks:[{items:[]},{items:[]},{items:[]},{items:[]}],revenue:[]};
      if (p.idx >= 0) S.months[mk].revenue[p.idx] = p.item;
      else S.months[mk].revenue.push(p.item);
      break;
    case 'REVENUE_REMOVE':
      if (S.months[mk]) S.months[mk].revenue.splice(p.i, 1);
      break;
    // ── RECURRING REVENUE ─────────────────────
    case 'RECURRING_UPSERT':
      if (!S.recurringRevenue) S.recurringRevenue = [];
      if (p.idx >= 0) S.recurringRevenue[p.idx] = p.item;
      else S.recurringRevenue.push(p.item);
      break;
    case 'RECURRING_REMOVE':
      if (S.recurringRevenue) S.recurringRevenue.splice(p.idx, 1);
      break;
    // ── LOAN ──────────────────────────────────
    case 'LOAN_SET_BALANCE':
      if (S.loans[p.li] !== undefined) {
        S.loans[p.li].amount = p.val;
        if (S.loans[p.li].amount > (S.loans[p.li].originalAmount || 0))
          S.loans[p.li].originalAmount = S.loans[p.li].amount;
      }
      break;
    case 'LOAN_UPSERT':
      if (!S.loans) S.loans = [];
      if (p.li >= 0) Object.assign(S.loans[p.li], p.patch);
      else S.loans.push(p.loan);
      break;
    case 'LOAN_REMOVE':
      if (S.loans) S.loans.splice(p.li, 1);
      break;
    case 'LOAN_ADD_PAYMENT':
      if (S.loans && S.loans[p.li]) S.loans[p.li].payments.push(p.payment);
      break;
    case 'LOAN_STRATEGY':
      S.strategy = p.strategy;
      break;
    // ── SAVINGS ───────────────────────────────
    case 'SAVINGS_UPSERT':
      if (!S.savings) S.savings = [];
      if (p.idx >= 0) S.savings[p.idx] = p.goal;
      else S.savings.push(p.goal);
      break;
    case 'SAVINGS_REMOVE':
      if (S.savings) S.savings.splice(p.idx, 1);
      break;
    case 'SAVINGS_UPDATE_BALANCE':
      if(S.savings[p.idx]){
        S.savings[p.idx].balance = p.balance;
        if(!S.savings[p.idx].transactions) S.savings[p.idx].transactions = [];
        S.savings[p.idx].transactions.unshift(p.txn);
      }
      break;
    // ── FINANCIAL GOALS ───────────────────────
    case 'GOAL_UPSERT':
      if (!S.financialGoals) S.financialGoals = [];
      if (p.idx >= 0) S.financialGoals[p.idx] = p.goal;
      else S.financialGoals.push(p.goal);
      break;
    case 'GOAL_REMOVE':
      if (S.financialGoals) S.financialGoals.splice(p.idx, 1);
      break;
    // ── CATEGORIES / BUDGETS ──────────────────
    case 'CATEGORY_ADD':
      if (!S.customCategories) S.customCategories = [];
      S.customCategories.push(p.category);
      if (!S.budgets) S.budgets = {};
      if (!S.budgets[p.category.name]) S.budgets[p.category.name] = 500;
      break;
    case 'CATEGORY_REMOVE':
      if (S.customCategories) S.customCategories.splice(p.idx, 1);
      break;
    case 'CATEGORY_UPDATE':
      if (S.customCategories && S.customCategories[p.idx]) {
        const old = S.customCategories[p.idx];
        S.customCategories[p.idx] = p.category;
        // Rename budget key if the category name changed
        if (S.budgets && old.name !== p.category.name) {
          S.budgets[p.category.name] = S.budgets[old.name] || 0;
          delete S.budgets[old.name];
        }
      }
      break;
    case 'BUDGET_SET':
      if (!S.budgets) S.budgets = {};
      S.budgets[p.cat] = Math.max(0, Math.min(9999999, p.val || 0));
      break;
    // ── SCHEDULED EXPENSES ────────────────────
    case 'SCHEDULED_UPSERT':
      if (!S.scheduledExpenses) S.scheduledExpenses = [];
      var si = S.scheduledExpenses.findIndex(function(e){ return e.id === p.item.id; });
      if (si >= 0) S.scheduledExpenses[si] = p.item;
      else S.scheduledExpenses.push(p.item);
      break;
    case 'SCHEDULED_REMOVE':
      if (S.scheduledExpenses) S.scheduledExpenses.splice(p.idx, 1);
      break;
    // ── MONTH METADATA ────────────────────────
    case 'MONTH_SET_SCORE':
      if (S.months[mk]) S.months[mk].closedScore = p.score;
      break;
    case 'MONTH_RESET_EXPENSES':
      if (S.months[mk]) S.months[mk].weeks = [{items:[]},{items:[]},{items:[]},{items:[]}];
      break;
    case 'MONTH_RESET_REVENUE':
      if (S.months[mk]) S.months[mk].revenue = [];
      break;
    case 'MONTH_RESET_LOANS_PMT':
      if (S.loans) S.loans.forEach(function(l){ l.payments = []; });
      break;
    case 'SAVINGS_RESET_ALL':
      S.savings = [];
      break;
    // ── INVESTMENTS ───────────────────────────
    case 'INVESTMENTS_UPSERT':
      if (!S.investments) S.investments = [];
      if (p.idx >= 0) S.investments[p.idx] = p.account;
      else S.investments.push(p.account);
      break;
    case 'INVESTMENTS_REMOVE':
      if (S.investments) S.investments.splice(p.idx, 1);
      break;
    case 'INVESTMENTS_RESET_ALL':
      S.investments = [];
      break;
    // ── LOAN SCHEDULE ─────────────────────────────
    case 'LOAN_GENERATE_SCHEDULE':
      if (S.loans && S.loans[p.loanIdx]) {
        var _sched = S.loans[p.loanIdx];
        if (!_sched.payments) _sched.payments = [];
        (p.months || []).forEach(function(mo) {
          if (!_sched.payments.find(function(pmt){ return pmt.month === mo; }))
            _sched.payments.push({month: mo, paid: false});
        });
      }
      break;
    // ── SAVINGS TRANSACTION ───────────────────────
    case 'SAVINGS_TXN_REMOVE':
      if (S.savings && S.savings[p.goalIdx]) {
        var _stg = S.savings[p.goalIdx];
        if (_stg.transactions && _stg.transactions[p.txnIdx] !== undefined) {
          var _stxn = _stg.transactions[p.txnIdx];
          if (_stxn.type === 'deposit')
            _stg.balance = Math.max(0, Math.round((amt(_stg.balance) - _stxn.amount) * 100) / 100);
          else
            _stg.balance = Math.round((amt(_stg.balance) + _stxn.amount) * 100) / 100;
          _stg.transactions.splice(p.txnIdx, 1);
        }
      }
      break;
    case 'SYNC_SAVINGS_EXPENSES': {
      // Sync savings contributions to current month week 0.
      // Routed through dispatch so persist() is guaranteed and mutation is tracked.
      var _goals = S.savings || [];
      var _monthData = S.months[mk];
      if (!_monthData || !_monthData.weeks || !_monthData.weeks[0]) break;
      var _w0 = _monthData.weeks[0];
      var _validIds = new Set(_goals.filter(function(g){return g.contribution>0&&g._id;}).map(function(g){return g._id;}));
      var _prevLen = _w0.items.length;
      _w0.items = _w0.items.filter(function(i){
        if(!i._savingsItem) return true;
        if(i._savingsGoalId) return _validIds.has(i._savingsGoalId);
        return _goals.some(function(g){return g.contribution>0&&g.name+' (Savings)'===i.name;});
      });
      _goals.forEach(function(g){
        if(g.contribution<=0) return;
        var expName=g.name+' (Savings)';
        var existing=g._id
          ?_w0.items.find(function(i){return i._savingsItem&&i._savingsGoalId===g._id;})
          :_w0.items.find(function(i){return i._savingsItem&&i.name===expName;});
        if(!existing){
          _w0.items.push({name:expName,amount:g.contribution,paid:false,dueDay:null,note:'',receipt:null,_savingsItem:true,_savingsGoalId:g._id||null});
        } else {
          if(existing.name!==expName) existing.name=expName;
          if(existing.amount!==g.contribution) existing.amount=g.contribution;
          if(!existing._savingsGoalId&&g._id) existing._savingsGoalId=g._id;
        }
      });
      break;
    }
    case 'MONTH_ARCHIVE':
      if (S.months[p.k]) {
        if (!S.archivedMonths) S.archivedMonths = {};
        S.archivedMonths[p.k] = S.months[p.k];
        delete S.months[p.k];
      }
      break;
    case 'MONTH_RESTORE':
      if (S.archivedMonths && S.archivedMonths[p.k]) {
        S.months[p.k] = S.archivedMonths[p.k];
        delete S.archivedMonths[p.k];
        var _sortedM = {};
        Object.keys(S.months).sort(function(a,b){
          var _ms={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
          var _pa=a.split(' '),_pb=b.split(' ');
          return (parseInt(_pa[1])*12+_ms[_pa[0]])-(parseInt(_pb[1])*12+_ms[_pb[0]]);
        }).forEach(function(k){ _sortedM[k]=S.months[k]; });
        S.months = _sortedM;
      }
      break;
    case 'SET_ARCHIVE_THRESHOLD':
      S.archiveThreshold = p.val;
      break;
    case 'SET_USERNAME':
      S.userName = p.name || undefined;
      break;
    case 'SET_CURRENCY':
      S.currency = p.currency;
      break;
    default:
      console.warn('[dispatch] unknown action:', type);
      return;
  }
  persist(toast !== false);
}

// ══════════════════════════════════════════════
// SAVINGS ↔ EXPENSE SYNC
// Ensures each goal's contribution appears as a Savings expense item
// in the current month's week 1 if not already present
// ══════════════════════════════════════════════
function syncSavingsExpenses(){
  // Route through dispatch() so persist() is guaranteed via the single mutation gateway (audit M-03).
  dispatch('SYNC_SAVINGS_EXPENSES', {}, false);
}

// ══════════════════════════════════════════════
// DARK MODE
// ══════════════════════════════════════════════
function toggleDark(){S.darkMode=!S.darkMode;applyDark();persist();}
function toggleMobileMenu(){
  var s=document.getElementById('mobileMenuSheet');
  var open=s.style.display==='none'||s.style.display==='';
  s.style.display=open?'flex':'none';
  s.setAttribute('aria-hidden',open?'false':'true');
  document.body.style.overflow=open?'hidden':'';
  if(open){if(typeof trapFocus==='function')trapFocus(s);}
  else{if(typeof releaseTrap==='function')releaseTrap(s);}
}
function applyDark(){
  document.body.classList.toggle('dark',!!S.darkMode);
  document.getElementById('dkBtn').textContent=S.darkMode?'☀':'☾';
  if(getTab()==='analytics'&&typeof renderAnalytics==='function')renderAnalytics();
}

// ══════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════
function showToast(msg,cls=''){
  const t=document.getElementById('toast');
  // If an undo toast is pending, commit it before showing a plain toast
  if(_undoSnapshot&&_undoSnapshot.timer){clearTimeout(_undoSnapshot.timer);_undoSnapshot=null;}
  t.textContent=msg;t.className='toast show '+(cls||'');
  const dur=cls==='err-t'?5000:cls==='warn-t'?3500:2500;
  clearTimeout(window._tt);window._tt=setTimeout(()=>t.classList.remove('show'),dur);
}

// Snapshot current state before a destructive mutation
function _snapForUndo() {
  if(_undoSnapshot&&_undoSnapshot.timer){clearTimeout(_undoSnapshot.timer);}
  _undoSnapshot={json:JSON.stringify(S),timer:null};
}

// Show an undo-able deletion toast (5 s to cancel, else commit)
function showUndoToast(msg) {
  const t=document.getElementById('toast');
  if(!t)return;
  clearTimeout(window._tt);
  t.innerHTML='<span>'+msg+'</span><button class="toast-undo-btn" onclick="undoLast()">Undo</button>';
  t.className='toast show';
  if(_undoSnapshot){
    _undoSnapshot.timer=setTimeout(function(){
      t.classList.remove('show');
      t.innerHTML='';
      _undoSnapshot=null;
    },5000);
  }
}

// Restore state from the last destructive undo snapshot
function undoLast() {
  if(!_undoSnapshot)return;
  clearTimeout(_undoSnapshot.timer);
  // GAM-02: preserve XP earned after the snapshot — it accumulates and should not revert.
  var _xpNow = S.xp || 0;
  try{S=JSON.parse(_undoSnapshot.json);}catch(e){_undoSnapshot=null;return;}
  if(_xpNow > (S.xp || 0)) S.xp = _xpNow;
  _undoSnapshot=null;
  persist(false);
  // Re-render all visible sections so the restored data shows immediately
  if(typeof renderExpenses==='function')renderExpenses();
  if(typeof renderRevenue==='function')renderRevenue();
  if(typeof renderLoans==='function')renderLoans();
  if(typeof renderSavings==='function')renderSavings();
  if(typeof renderInvestments==='function')renderInvestments();
  if(typeof updateHealth==='function')updateHealth();
  showToast('↩ Undone');
}
window.undoLast=undoLast;
function fmt(n){
  const cur=getCurrency();
  if(n==null||isNaN(n)||!isFinite(n))return cur.symbol+'0.00';
  return cur.symbol+Math.abs(n).toLocaleString(cur.locale,{minimumFractionDigits:2,maximumFractionDigits:2});
}
function getCurrency(){return(S&&S.currency&&S.currency.code)?S.currency:{symbol:'$',code:'USD',locale:'en-US'};}
function fmtSigned(n){return(n<0?'-':'')+fmt(Math.abs(n));}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

function getCatLabel(catClass){
  if(catClass.startsWith('cat-custom-')){
    const id=catClass.replace('cat-custom-','');
    const cc=(S&&S.customCategories||[]).find(c=>c.id===id);
    return cc?cc.name:'Custom';
  }
  return CAT_LABELS[catClass]||'Other';
}
function getCatStyle(catClass){
  if(catClass.startsWith('cat-custom-')){
    const id=catClass.replace('cat-custom-','');
    const cc=(S&&S.customCategories||[]).find(c=>c.id===id);
    return cc?'background:'+cc.bg+';color:'+cc.color+';':'background:var(--slate-mid);color:var(--ink);';
  }
  return '';
}
function fmtK(n){if(n==null)return fmt(0);return n>=1000?getCurrency().symbol+(Math.abs(n)/1000).toFixed(1)+'k':fmt(n);}
function deepClone(o){return JSON.parse(JSON.stringify(o));}
function getTab(){var _gs=document.querySelector('.section.active');return _gs?_gs.id.replace('section-',''):'dashboard';}

// ══════════════════════════════════════════════
// PLAN GATING
// Three tiers: free → pro → lifetime
// Free = no valid license key in localStorage
// Pro  = key present, plan name does not include 'lifetime'
// Lifetime = key present, plan name includes 'lifetime'
// ══════════════════════════════════════════════
function getPlan(){
  if(!localStorage.getItem('fw_license_key')) return 'free';
  var p=(localStorage.getItem('fw_plan')||'').toLowerCase();
  if(p.includes('lifetime')) return 'lifetime';
  return 'pro'; // any valid key without 'lifetime' = pro
}

var _PLAN_RANK={free:0,pro:1,lifetime:2};

// Returns true if the user's plan meets minTier. Otherwise shows upgrade wall and returns false.
function requirePlan(minTier,featureName){
  if((_PLAN_RANK[getPlan()]||0)>=(_PLAN_RANK[minTier]||0)) return true;
  _showUpgradeWall(featureName,minTier);
  return false;
}

function _showUpgradeWall(featureName,minTier){
  var el=document.getElementById('_fw_upgrade_wall');
  if(!el){
    el=document.createElement('div');
    el.id='_fw_upgrade_wall';
    el.setAttribute('role','dialog');
    el.setAttribute('aria-modal','true');
    el.setAttribute('aria-labelledby','_fw_uw_title');
    el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';
    el.innerHTML=`
      <div style="background:#fff;border-radius:20px;padding:36px 40px;max-width:420px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.18);">
        <div style="width:52px;height:52px;border-radius:50%;background:#f5f4f0;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5a6e3f" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
        </div>
        <h2 id="_fw_uw_title" style="font-family:'DM Serif Display',serif;font-size:22px;font-weight:400;color:#111;margin-bottom:8px;"></h2>
        <p id="_fw_uw_desc" style="font-size:14px;color:#6b7280;line-height:1.65;margin-bottom:6px;"></p>
        <p style="font-size:12px;color:#9ca3af;margin-bottom:24px;">Available on FincWin Pro &amp; Lifetime</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <a id="_fw_uw_upgrade" href="pricing.html" style="display:block;padding:13px;background:#111;color:#fff;border-radius:50px;font-family:inherit;font-size:14px;font-weight:500;text-decoration:none;transition:background .2s;">Upgrade to Pro — $39/yr →</a>
          <button id="_fw_uw_close" type="button" style="padding:11px;background:none;border:1px solid rgba(0,0,0,.1);border-radius:50px;font-family:inherit;font-size:13px;color:#6b7280;cursor:pointer;">Maybe later</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    // Inline on* handlers are blocked by the CSP (script-src-attr 'none'), so
    // every interaction must be wired with addEventListener.
    function _dismiss(){
      el.style.display='none';
      // Route back to the dashboard — the gated feature was never entered, so
      // returning the user to a safe, always-available tab is the expected exit.
      if(typeof switchTab==='function'){
        var dashTab=document.getElementById('tab-dashboard');
        switchTab('dashboard',dashTab);
      }
    }
    el.querySelector('#_fw_uw_close').addEventListener('click',_dismiss);
    el.addEventListener('click',function(e){if(e.target===el)_dismiss();});
    var _up=el.querySelector('#_fw_uw_upgrade');
    _up.addEventListener('mouseover',function(){this.style.background='#5a6e3f';});
    _up.addEventListener('mouseout',function(){this.style.background='#111';});
  }
  var isPro=minTier==='pro';
  document.getElementById('_fw_uw_title').textContent=(featureName||'Pro feature')+' requires Pro';
  document.getElementById('_fw_uw_desc').textContent=
    isPro
      ? (featureName||'This feature')+' is included in FincWin Pro. Upgrade once and it\'s yours for the year.'
      : (featureName||'This feature')+' is exclusive to FincWin Lifetime. One payment, all features, forever.';
  el.style.display='flex';
  var closeBtn=el.querySelector('button');
  if(closeBtn)setTimeout(function(){closeBtn.focus();},60);
}

window.getPlan=getPlan;
window.requirePlan=requirePlan;
function cw(){return cm().weeks;}
function cr(){return cm().revenue;}
function cwSafe(wi){const w=cw();return(wi>=0&&wi<w.length)?w[wi]:null;}
function cm(){return S.months[CMK]||{weeks:[{items:[]},{items:[]},{items:[]},{items:[]}],revenue:[]};}

function _cvt(amount,currency){
  // Convert amount to home currency for totals (E6). Gracefully no-ops if fx not loaded.
  if(!currency||currency===getCurrency().code)return amt(amount);
  if(typeof convertToHome==='function'){var r=convertToHome(amt(amount),currency);return r.value;}
  return amt(amount);
}
function totalExp(k){const w=(k?S.months[k]:cm()).weeks;return Math.round(w.reduce((s,wk)=>s+wk.items.reduce((a,i)=>a+_cvt(i.amount,i.currency),0),0)*100)/100;}
function paidExp(){return Math.round(cw().reduce((s,w)=>s+w.items.filter(i=>i.paid).reduce((a,i)=>a+_cvt(i.amount,i.currency),0),0)*100)/100;}
function pendExp(){return Math.round((totalExp()-paidExp())*100)/100;}
function totalRev(k){return Math.round((k?S.months[k]:cm()).revenue.reduce((s,i)=>s+_cvt(i.amount,i.currency),0)*100)/100;}
function totalDebt(){return Math.round(S.loans.reduce((s,l)=>s+_cvt(l.amount,l.currency),0)*100)/100;}
function minPmts(){return Math.round(S.loans.reduce((s,l)=>{
  const mp=_cvt(l.minPayment,l.currency);
  if(mp===0&&amt(l.amount)>0&&l.rate>0)return s+Math.round(_cvt(l.amount,l.currency)*(l.rate/100/12)*100)/100;
  return s+mp;
},0)*100)/100;}
function totalSav(){return Math.round((S.savings||[]).reduce((s,g)=>s+_cvt(g.balance,g.currency),0)*100)/100;}


function storeCents(dollars){
  if(dollars==null||String(dollars).trim()==='')return 0;
  const v=parseFloat(dollars);
  if(isNaN(v)||!isFinite(v))return 0;
  return Math.round(Math.min(9999999,Math.max(0,v))*100)/100;
}
function amt(x){
  // Dollar-float storage — amt() is now just a null-safe pass-through
  if(x==null||isNaN(x)||!isFinite(x))return 0;
  return x;
}
function migrateAmountsToCents(){
  // REVERTED: cent storage caused cascading display/calculation bugs.
  // All amounts stored as dollar floats. Round to 2dp at save time.
  // If a previous migration ran (S._centsFormat===true), convert back to dollars.
  if(S._centsFormat){
    const toDollar=val=>(val==null?0:Math.round(val)/100);
    Object.values(S.months).forEach(m=>{
      m.weeks.forEach(w=>w.items.forEach(i=>{ if(i.amount!==undefined) i.amount=toDollar(i.amount); }));
      m.revenue.forEach(r=>{ if(r.amount!==undefined) r.amount=toDollar(r.amount); });
    });
    Object.values(S.archivedMonths||{}).forEach(m=>{
      m.weeks.forEach(w=>w.items.forEach(i=>{ if(i.amount!==undefined) i.amount=toDollar(i.amount); }));
      m.revenue.forEach(r=>{ if(r.amount!==undefined) r.amount=toDollar(r.amount); });
    });
    S.loans.forEach(l=>{
      if(l.amount!==undefined) l.amount=toDollar(l.amount);
      if(l.originalAmount!==undefined) l.originalAmount=toDollar(l.originalAmount);
      if(l.minPayment!==undefined) l.minPayment=toDollar(l.minPayment);
    });
    (S.savings||[]).forEach(g=>{
      if(g.balance!==undefined) g.balance=toDollar(g.balance);
      if(g.target!==undefined) g.target=toDollar(g.target);
      if(g.contribution!==undefined) g.contribution=toDollar(g.contribution);
    });
    S._centsFormat=false;
    persist(false);
  }
}

function _conflictDiffMetrics(stateA, stateB) {
  // Extract comparable metrics from two state snapshots.
  // Returns array of {label, a, b} where a=browser value, b=file value.
  function totalExp(st) {
    var t=0;
    Object.values(st.months||{}).forEach(function(m){
      (m.weeks||[]).forEach(function(w){(w.items||[]).forEach(function(i){t+=i.amount||0;});});
    });
    return t;
  }
  function totalRev(st) {
    var t=0;
    Object.values(st.months||{}).forEach(function(m){
      (m.revenue||[]).forEach(function(r){t+=r.amount||0;});
    });
    return t;
  }
  function totalLoanBal(st) {
    return (st.loans||[]).reduce(function(s,l){return s+(l.amount||0);},0);
  }
  function totalSavBal(st) {
    return (st.savings||[]).reduce(function(s,g){return s+(g.balance||0);},0);
  }
  function expenseCount(st) {
    var c=0;
    Object.values(st.months||{}).forEach(function(m){
      (m.weeks||[]).forEach(function(w){c+=(w.items||[]).length;});
    });
    return c;
  }
  var sym=(stateA.currency&&stateA.currency.symbol)||'$';
  function money(v){return sym+Math.round(v).toLocaleString();}
  function count(v){return String(v);}
  return [
    {label:'Total expenses',   a:money(totalExp(stateA)),   b:money(totalExp(stateB)),   aRaw:totalExp(stateA),   bRaw:totalExp(stateB),   lowerIsBetter:true},
    {label:'Total income',     a:money(totalRev(stateA)),   b:money(totalRev(stateB)),   aRaw:totalRev(stateA),   bRaw:totalRev(stateB),   lowerIsBetter:false},
    {label:'Loan balances',    a:money(totalLoanBal(stateA)),b:money(totalLoanBal(stateB)),aRaw:totalLoanBal(stateA),bRaw:totalLoanBal(stateB),lowerIsBetter:true},
    {label:'Savings balance',  a:money(totalSavBal(stateA)), b:money(totalSavBal(stateB)), aRaw:totalSavBal(stateA), bRaw:totalSavBal(stateB), lowerIsBetter:false},
    {label:'Expense items',    a:count(expenseCount(stateA)),b:count(expenseCount(stateB)),aRaw:expenseCount(stateA),bRaw:expenseCount(stateB),lowerIsBetter:false}
  ];
}

function _renderConflictDiff(browserState, fileState) {
  var wrap = document.getElementById('conflictDiff');
  var table = document.getElementById('conflictDiffTable');
  if (!wrap || !table) return;
  var metrics = _conflictDiffMetrics(browserState, fileState);
  // Only show rows where the values differ
  var diffRows = metrics.filter(function(m){return m.aRaw !== m.bRaw;});
  if (!diffRows.length) { wrap.style.display = 'none'; return; }
  var rows = diffRows.map(function(m) {
    var diff = m.bRaw - m.aRaw; // positive = file has more
    // For "lowerIsBetter" metrics (expenses, loans): more in file = red; less = green
    // For "higherIsBetter" metrics (income, savings, count): more in file = green; less = red
    var fileIsGood = m.lowerIsBetter ? diff < 0 : diff > 0;
    var arrow = diff > 0 ? '▲' : '▼';
    var diffColor = fileIsGood ? 'var(--success, #276749)' : 'var(--danger, #c0392b)';
    // Format delta
    var absDiff = Math.abs(diff);
    var diffStr = (typeof m.b === 'string' && m.b.startsWith(m.a[0]))
      ? ((m.lowerIsBetter ? (diff>0?'+':'-') : (diff>0?'+':'-')) + (m.a[0]||'') + (absDiff/100).toFixed(0))
      : (diff > 0 ? '+' : '') + absDiff;
    // Use currency symbol if money metric
    var isMoney = m.label !== 'Expense items';
    var sym = (browserState.currency && browserState.currency.symbol) || '$';
    diffStr = isMoney
      ? (diff > 0 ? '+' : '−') + sym + (absDiff / 100).toFixed(0)
      : (diff > 0 ? '+' : '−') + absDiff;

    return '<tr style="border-bottom:1px solid var(--border-soft);">'
      + '<td style="padding:4px 6px 4px 0;color:var(--text-muted);font-size:10px;white-space:nowrap;">' + m.label + '</td>'
      + '<td style="padding:4px 6px;text-align:right;font-size:11px;">' + m.a + '</td>'
      + '<td style="padding:4px 6px;text-align:right;font-size:11px;">' + m.b + '</td>'
      + '<td style="padding:4px 0 4px 6px;text-align:right;font-size:10px;font-weight:700;white-space:nowrap;color:' + diffColor + ';">'
      + arrow + ' ' + diffStr + '</td>'
      + '</tr>';
  });
  table.innerHTML = '<thead><tr>'
    + '<th style="font-size:9px;font-weight:600;color:var(--text-muted);text-align:left;padding-bottom:4px;border-bottom:1px solid var(--border);">Metric</th>'
    + '<th style="font-size:9px;font-weight:600;color:var(--text-muted);text-align:right;padding-bottom:4px;border-bottom:1px solid var(--border);">Browser</th>'
    + '<th style="font-size:9px;font-weight:600;color:var(--text-muted);text-align:right;padding-bottom:4px;border-bottom:1px solid var(--border);">File</th>'
    + '<th style="font-size:9px;font-weight:600;color:var(--text-muted);text-align:right;padding-bottom:4px;border-bottom:1px solid var(--border);">Δ</th>'
    + '</tr></thead><tbody>' + rows.join('') + '</tbody>';
  wrap.style.display = 'block';
}

function showFileNewerPrompt(fileLastModified, fileContent) {
  return new Promise(function(resolve) {
    var conflictModal = document.getElementById('syncConflictModal');
    if (!conflictModal) {
      resolve(confirm('Your local file is newer. Load from file?'));
      return;
    }
    var titleEl = document.getElementById('syncConflictTitle');
    var descEl = conflictModal.querySelector('.pmodal > p');
    var localTimeEl = document.getElementById('conflictLocalTime');
    var cloudTimeEl = document.getElementById('conflictCloudTime');
    var localSummaryEl = document.getElementById('conflictLocalSummary');
    var cloudSummaryEl = document.getElementById('conflictCloudSummary');
    var keepLocalBtn = conflictModal.querySelector('[data-action="conflictPickLocal"]');
    var useCloudBtn = conflictModal.querySelector('[data-action="conflictPickCloud"]');

    if (titleEl) titleEl.textContent = 'Local File is Newer';
    if (descEl) descEl.textContent = 'Your linked file has changes not saved to the browser. Which version should be used?';
    if (localTimeEl) localTimeEl.textContent = (S && S.lastModified) ? new Date(S.lastModified).toLocaleString() : 'unknown';
    if (cloudTimeEl) cloudTimeEl.textContent = new Date(fileLastModified).toLocaleString();
    if (localSummaryEl) localSummaryEl.textContent = 'Browser (IndexedDB) data';
    if (cloudSummaryEl) cloudSummaryEl.textContent = 'File on disk';
    var gridCols = conflictModal.querySelectorAll('[style*="grid-template-columns"] > div');
    if (gridCols[0]) gridCols[0].querySelector('div') && (gridCols[0].querySelector('div').textContent = 'Browser data');
    if (gridCols[1]) gridCols[1].querySelector('div') && (gridCols[1].querySelector('div').textContent = 'Local file');
    if (keepLocalBtn) keepLocalBtn.textContent = 'Keep browser data';
    if (useCloudBtn) useCloudBtn.textContent = 'Load from file';

    // Render key-differences table if we have the file content to compare
    var diffWrap = document.getElementById('conflictDiff');
    if (diffWrap) diffWrap.style.display = 'none';
    if (fileContent && S) {
      try {
        var fileParsed = JSON.parse(fileContent);
        if (fileParsed && typeof fileParsed === 'object') _renderConflictDiff(S, fileParsed);
      } catch(e) { /* unparseable file — skip diff */ }
    }

    conflictModal.dataset.resolveWith = '';
    conflictModal.classList.add('open');

    var _fno = new MutationObserver(function() {
      if (!conflictModal.classList.contains('open')) {
        _fno.disconnect();
        if (keepLocalBtn) keepLocalBtn.textContent = 'Keep Local';
        if (useCloudBtn) useCloudBtn.textContent = 'Use Cloud';
        resolve(false);
        return;
      }
      var choice = conflictModal.dataset.resolveWith;
      if (choice === 'local' || choice === 'cloud') {
        _fno.disconnect();
        conflictModal.classList.remove('open');
        if (keepLocalBtn) keepLocalBtn.textContent = 'Keep Local';
        if (useCloudBtn) useCloudBtn.textContent = 'Use Cloud';
        resolve(choice === 'cloud');
      }
    });
    _fno.observe(conflictModal, { attributes: true, attributeFilter: ['class', 'data-resolve-with'] });
  });
}

// Structural schema guard for any externally-sourced JSON before it touches S.
// Returns true if the shape is safe; false if it must be rejected.
// Blocks prototype-pollution keys and enforces minimum required structure.
function _validateStateShape(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  // Prototype-pollution guard — scan raw JSON string for dangerous keys
  try {
    var raw = JSON.stringify(data);
    if (raw.indexOf('"__proto__"') !== -1 || raw.indexOf('"constructor"') !== -1 || raw.indexOf('"prototype"') !== -1) return false;
  } catch(e) { return false; }
  // Required top-level shape
  if (typeof data.months !== 'object' || data.months === null || Array.isArray(data.months)) return false;
  if (!Array.isArray(data.loans)) return false;
  // Validate each month entry
  var monthKeys = Object.keys(data.months);
  for (var i = 0; i < monthKeys.length; i++) {
    var mk = monthKeys[i];
    // Reject any month key that looks like a prototype attack
    if (mk === '__proto__' || mk === 'constructor' || mk === 'prototype') return false;
    var m = data.months[mk];
    if (typeof m !== 'object' || m === null) return false;
    if (!Array.isArray(m.weeks)) return false;
    // Allow 4-week layout (current schema); reject obviously wrong week counts
    if (m.weeks.length > 8) return false;
    for (var j = 0; j < m.weeks.length; j++) {
      if (!Array.isArray(m.weeks[j].items)) return false;
    }
    if (!Array.isArray(m.revenue)) return false;
  }
  // Validate loans array entries (light check)
  for (var li = 0; li < data.loans.length; li++) {
    var loan = data.loans[li];
    if (typeof loan !== 'object' || loan === null) return false;
  }
  return true;
}

function normaliseState(){
  const fixItems=m=>m.weeks.forEach(w=>w.items.forEach(i=>{
    if(i.dueDay===undefined)i.dueDay=null;
    if(i.note===undefined)i.note='';
    if(i.receipt===undefined)i.receipt=null;
  }));
  Object.values(S.months).forEach(fixItems);
  if(!S.savings)S.savings=[];
  if(!S.budgets)S.budgets={...BDFT};
  if(!S.archivedMonths)S.archivedMonths={};
  Object.values(S.archivedMonths).forEach(fixItems);
  if(S.archiveThreshold===undefined)S.archiveThreshold=6;
  if(!S.currency||!S.currency.code)S.currency={symbol:'$',code:'USD',locale:'en-US'};
  if(!S.fxRates)S.fxRates={rates:{},fetchedAt:0,base:'USD'};
  if(S.autoLockMins===undefined)S.autoLockMins=240;
  if(!S.budgetRollover)S.budgetRollover={};
  if(!S.financialGoals)S.financialGoals=[];
  if(!S.customCategories)S.customCategories=[];
  if(!S.categoryKeywords)S.categoryKeywords={};
  if(!S.scheduledExpenses)S.scheduledExpenses=[];
  if(!S.achievements)S.achievements=[];
  if(S.xp===undefined)S.xp=0;
  if(S.xpLevel===undefined)S.xpLevel=0;
  if(!S.monthChallenge)S.monthChallenge={};
  if(S.lastModified===undefined)S.lastModified=Date.now();
  if(S.lastSyncedAt===undefined)S.lastSyncedAt=0;
  if(!S.syncConfig)S.syncConfig={cloudEnabled:false,fileEnabled:false};
  // v2 field defaults — set here so all downstream phases can read without guards
  if(S.activeBackend===undefined)S.activeBackend=null; // null = not set; use === undefined (not !S.activeBackend) because null is the valid "not configured" value
  if(!S.tier)S.tier='free';         // falsy check OK — no valid empty/zero tier string
  if(!S.budgetLimits)S.budgetLimits={};
  if(!S.goalTargets)S.goalTargets=[];
  if(!S.investments)S.investments=[];
}

// Expose validator so sync.js can guard cloud-pulled JSON before applying it to S.
window._validateStateShape = _validateStateShape;

async function initState(){
  // Try IDB first, fall back to localStorage
  let raw=null;
  try{raw=await idbGet(SK);}catch(e){}
  if(!raw)raw=localStorage.getItem(SK); // fallback
  if(raw){
    try{
      var _parsed=JSON.parse(raw);

      // ── Decrypt if the stored value is an encrypted envelope ─────────────
      if(typeof CRYPTO !== 'undefined' && CRYPTO.isEncryptedPayload(_parsed)){
        // _sessionKey must be set by verifyPin() before initState() is called.
        // boot() now calls checkLock() first so this invariant holds.
        if(!_sessionKey){
          throw new Error('[FincWin] Encrypted data in IDB but no session key. PIN required.');
        }
        try{
          const _plaintext = await CRYPTO.decrypt(_parsed, _sessionKey);
          _parsed = JSON.parse(_plaintext);
        } catch(decErr){
          // Wrong key or corrupted data — do not wipe, surface to user.
          showToast('⚠ Could not decrypt data. Please re-enter your PIN.', 'err-t');
          throw decErr;
        }
      } else if(_sessionKey && typeof CRYPTO !== 'undefined' && typeof _parsed === 'object') {
        // ── Migration: plaintext data with PIN already set (first boot after upgrade) ─
        // Load as-is. The next _doPersist() will write it back encrypted.
        // No extra action needed here — fall through to normal load path.
      }
      // ─────────────────────────────────────────────────────────────────────

      if(!_validateStateShape(_parsed)){throw new Error('Invalid state shape');}
      S=_parsed;
      normaliseState();
      CMK=S.currentMonthKey||Object.keys(S.months||{})[0];
      if(!CMK){
        const _now=new Date();
        CMK=mk(_now.getMonth(),_now.getFullYear());
        S.months[CMK]={weeks:[{items:[]},{items:[]},{items:[]},{items:[]}],revenue:[]};
      }
      // Phase 1: check if linked local file is newer than IDB (D-11)
      if(typeof window.checkFileNewerThanIDB==='function'){
        try{
          const fileCheck=await window.checkFileNewerThanIDB();
          if(fileCheck&&fileCheck.newer&&fileCheck.fileContent){
            const useFile=await showFileNewerPrompt(fileCheck.fileLastModified,fileCheck.fileContent);
            if(useFile){
              var _fileParsed=JSON.parse(fileCheck.fileContent);
              if(!_validateStateShape(_fileParsed)){throw new Error('Invalid file state shape');}
              S=_fileParsed;
              normaliseState();
              CMK=S.currentMonthKey||Object.keys(S.months||{})[0];
              if(!CMK){
                const _now=new Date();
                CMK=mk(_now.getMonth(),_now.getFullYear());
                S.months[CMK]={weeks:[{items:[]},{items:[]},{items:[]},{items:[]}],revenue:[]};
              }
            }
          }
        }catch(e){/* non-fatal — continue with IDB state */}
      }
      // Phase 1: cloud pull on load if enabled (D-02, full implementation in sync.js PLAN-04)
      if(typeof window.cloudPullOnLoad==='function'){
        try{ await window.cloudPullOnLoad(); }catch(e){}
      }
      return;
    }catch(e){}
  }
  // Seed month = actual current month, not a hardcoded date
  const _seedNow=new Date();
  const _seedKey=mk(_seedNow.getMonth(),_seedNow.getFullYear());
  S={loans:DL.map(l=>JSON.parse(JSON.stringify(l))),strategy:'avalanche',savings:JSON.parse(JSON.stringify(DSV)),budgets:{...BDFT},budgetRollover:{},financialGoals:[],customCategories:[],scheduledExpenses:[],darkMode:false,archiveThreshold:6,archivedMonths:{},currency:{symbol:'$',code:'USD',locale:'en-US'},fxRates:{rates:{},fetchedAt:0,base:'USD'},months:{[_seedKey]:{weeks:DW.map(w=>JSON.parse(JSON.stringify(w))),revenue:JSON.parse(JSON.stringify(DR))}},currentMonthKey:_seedKey,lastModified:Date.now(),lastSyncedAt:0,syncConfig:{cloudEnabled:false,fileEnabled:false}};
  CMK=_seedKey;
  // Sync savings contributions as expense items in seed month
  syncSavingsExpenses();
  persist(false);
}

// ══════════════════════════════════════════════════════════════
// SCHEDULED EXPENSES  (quarterly / yearly auto-expansion)
// Stored in S.scheduledExpenses[].  Each entry:
//   { id, name, amount, frequency:'quarterly'|'yearly',
//     dueDay, week, note, yearMonth (0-11, yearly only) }
// Called whenever a new month is created or on boot.
// ══════════════════════════════════════════════════════════════
function expandScheduledExpenses(monthKey){
  if(!S||!S.scheduledExpenses||!S.scheduledExpenses.length)return 0;
  const parts=monthKey.split(' ');
  const mo=MS.indexOf(parts[0]);
  const yr=parseInt(parts[1]);
  const md=S.months[monthKey];
  if(!md||mo<0||isNaN(yr))return 0;
  let added=0;
  S.scheduledExpenses.forEach(se=>{
    // Does this month qualify?
    let applies=false;
    if(se.frequency==='quarterly') applies=(mo%3===0); // Jan/Apr/Jul/Oct
    else if(se.frequency==='yearly') applies=(mo===(se.yearMonth||0));
    else if(se.frequency==='monthly') applies=true;
    if(!applies)return;
    // Already expanded into this month?
    const already=md.weeks.some(w=>w.items.some(i=>i._scheduledId===se.id));
    if(already)return;
    // Place in the right week: stored week preference, or auto-detect from due day
    const wk=se.week!==undefined?Math.min(3,Math.max(0,se.week)):getWeekForDay(se.dueDay,monthKey);
    const freqTag=se.frequency==='quarterly'?'[quarterly]':se.frequency==='yearly'?'[yearly]':'';
    md.weeks[wk].items.push({
      name:se.name,amount:se.amount,paid:false,
      dueDay:se.dueDay||null,
      note:(se.note?se.note+(freqTag?' ':'')+freqTag:freqTag).trim()||undefined,
      receipt:null,
      frequency:se.frequency,
      _scheduledId:se.id
    });
    added++;
  });
  if(added>0)persist(false);
  return added;
}

// ══════════════════════════════════════════════════════════════
// PIN / LOCK SCREEN
// PIN is hashed with SHA-256 via crypto.subtle before storage.
// The raw PIN is never stored — only the hex digest.
// ENC_SALT_IDB_KEY holds the per-device salt used to derive the AES-GCM session key.
// ══════════════════════════════════════════════════════════════
const PIN_IDB_KEY      = 'finflow_pin_hash';
const PIN_LOCK_IDB_KEY = 'finflow_pin_lockout';
const ENC_SALT_IDB_KEY = 'fincwin_enc_salt';    // v1 legacy — direct PBKDF2(pin, salt)
const ENC_VERSION_KEY  = 'fincwin_enc_v';        // '2' = v2 DEK key-wrapping in use
const PIN_KEK_SALT_KEY = 'fincwin_pin_kek_salt'; // v2: salt for PIN-KEK derivation
const DEK_PIN_KEY      = 'fincwin_dek_pin';      // v2: DEK wrapped under PIN-KEK
const REC_KEK_SALT_KEY = 'fincwin_rec_kek_salt'; // v2: salt for recovery-KEK derivation
const DEK_REC_KEY      = 'fincwin_dek_rec';      // v2: DEK wrapped under recovery-KEK
const PIN_LEN_IDB_KEY  = 'finflow_pin_len';      // stored PIN digit length (4 or 6)

let _pinLen = 6;          // default 6 for new users; loaded from IDB on checkLock
let _lockBuffer = '';
let _setupBuffer = '';
let _setupStage = 'enter'; // 'enter' | 'confirm' | 'passphrase'
let _setupFirst = '';
let _setupPinConfirmed = ''; // holds confirmed PIN until passphrase is also saved
let _pinFailCount = 0;
let _pinLockUntil = 0;

// Persist lockout state so page refresh cannot bypass the lockout (audit M-01).
async function _savePinLockout() {
  if (!_idb) return;
  try {
    const tx = _idb.transaction(IDB_PIN_STORE, 'readwrite');
    tx.objectStore(IDB_PIN_STORE).put({ failCount: _pinFailCount, lockUntil: _pinLockUntil }, PIN_LOCK_IDB_KEY);
  } catch(e) {}
}
async function _loadPinLockout() {
  if (!_idb) return;
  try {
    const tx = _idb.transaction(IDB_PIN_STORE, 'readonly');
    const req = tx.objectStore(IDB_PIN_STORE).get(PIN_LOCK_IDB_KEY);
    req.onsuccess = function(e) {
      const d = e.target.result;
      if (d && typeof d.failCount === 'number') {
        _pinFailCount = d.failCount;
        _pinLockUntil = d.lockUntil || 0;
        // Expire stale lockouts that passed while the page was closed
        if (_pinLockUntil < Date.now()) { _pinFailCount = 0; _pinLockUntil = 0; _savePinLockout(); }
      }
    };
  } catch(e) {}
}

// PBKDF2 hash with a caller-supplied salt (random per PIN set)
async function _hashPin(pin, saltBytes){
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:saltBytes,iterations:100000,hash:'SHA-256'}, km, 256);
  return Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
// Legacy SHA-256 with static salt — only used to verify PINs set before the PBKDF2 upgrade
async function _hashPinLegacy(pin){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin+'finflow_salt_v1'));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function getPinHash(){
  try{
    if(location.protocol==='file:')return localStorage.getItem(PIN_IDB_KEY)||null;
    if(!_idb)_idb=await openIDB().catch(()=>null);
    if(!_idb)return localStorage.getItem(PIN_IDB_KEY)||null;
    return new Promise((res)=>{
      const tx=_idb.transaction(IDB_PIN_STORE,'readonly');
      const req=tx.objectStore(IDB_PIN_STORE).get(PIN_IDB_KEY);
      req.onsuccess=e=>res(e.target.result||null);
      req.onerror=()=>res(null);
    });
  }catch(e){return null;}
}

// Returns a Promise that resolves when the lock screen is dismissed.
// If no PIN is set it resolves immediately.
// If a valid session token exists (same tab, within inactivity window) it also
// resolves immediately — no PIN prompt on refresh.
// boot() awaits this before calling initState() so _sessionKey is ready for decryption.
async function checkLock(){
  await _loadPinLockout();
  // Load stored PIN length so the correct number of dots show
  var storedLen = await _metaGet(PIN_LEN_IDB_KEY);
  if(storedLen) _pinLen = parseInt(storedLen) || 6;
  const hash = await getPinHash();
  if(!hash) return; // no PIN set — resolve immediately

  // A PIN is confirmed set — enable auto-lock guards.
  _pinActive = true;

  // If we already unlocked in this tab and the inactivity window hasn't expired,
  // skip the lock screen entirely.
  if(_sessionTokenValid()){
    var restoredKey = await _restoreSessionKey();
    if(restoredKey){
      // Encrypted session: key restored from sessionStorage JWK.
      _sessionKey = restoredKey;
      _lastActivity = Date.now();
      _writeSessionToken();
      return; // skip PIN screen
    }
    // No JWK found. Check if encryption is actually in use.
    // If data is stored unencrypted (no ENC_VERSION_KEY), the session token alone
    // is sufficient — we don't need to re-derive a crypto key.
    var encV = await _metaGet(ENC_VERSION_KEY);
    if(!encV){
      // No encryption active — session token proves the PIN was entered this session.
      _lastActivity = Date.now();
      _writeSessionToken();
      return; // skip PIN screen
    }
    // Encrypted data but JWK is missing (tab re-opened? sessionStorage cleared?).
    // Must re-enter PIN to decrypt.
    _clearSessionToken();
  }

  return new Promise(function(resolve){
    _lockResolve = resolve;
    updateLockDots(); // apply correct dot count before showing screen
    document.getElementById('lockScreen').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    var btn = document.getElementById('pinBtn');
    if(btn) btn.textContent = '🔒';
  });
}

// ── Session key persistence across refreshes ─────────────────────────────────
// We wrap the CryptoKey as a JWK and store it in sessionStorage (tab-only, not
// persisted to disk). This lets us skip the PIN on refresh without weakening
// security: sessionStorage is cleared when the tab closes, and the stored JWK
// is only useful within the same origin tab.
const _SS_KEY = 'fw_sk';

async function _storeSessionKey(key){
  if(!key) return;
  // S-03: when the user has opted into high-security mode, do not persist the DEK
  // as a JWK in sessionStorage — this forces a PIN re-entry on every page load.
  if(typeof S !== 'undefined' && S && S.pinRefreshSkip === false) return;
  try{
    var jwk = await crypto.subtle.exportKey('jwk', key);
    sessionStorage.setItem(_SS_KEY, JSON.stringify(jwk));
  }catch(e){}
}

async function _restoreSessionKey(){
  try{
    var raw = sessionStorage.getItem(_SS_KEY);
    if(!raw) return null;
    var jwk = JSON.parse(raw);
    var key = await crypto.subtle.importKey(
      'jwk', jwk,
      {name:'AES-GCM',length:256},
      false, ['encrypt','decrypt']
    );
    return key;
  }catch(e){ return null; }
}

async function verifyPin(){
  const now=Date.now();
  if(_pinFailCount>=5&&now<_pinLockUntil){
    const secs=Math.ceil((_pinLockUntil-now)/1000);
    document.getElementById('lockError').textContent='Too many attempts — wait '+secs+'s';
    _lockBuffer=''; updateLockDots();
    return;
  }
  const raw = await getPinHash();
  if(!raw) return;
  let match = false;
  let _matchedLegacy = false;
  try {
    const stored = JSON.parse(raw);
    if(stored.hash && stored.salt){
      const saltBytes = Uint8Array.from(atob(stored.salt), c=>c.charCodeAt(0));
      match = (await _hashPin(_lockBuffer, saltBytes)) === stored.hash;
    }
  } catch(e){
    // Legacy format: plain hex string from static-salt SHA-256
    match = (await _hashPinLegacy(_lockBuffer)) === raw;
    if(match) _matchedLegacy = true;
  }
  if(match){
    _pinFailCount=0; _pinLockUntil=0; _savePinLockout();
    // ── Derive AES-GCM session key from the correct PIN ────────────────────
    // Do this before hiding the lock screen so the key is ready for initState().
    try {
      _sessionKey = await _deriveSessionKey(_lockBuffer);
      // Persist key + token so refresh within the inactivity window skips PIN.
      await _storeSessionKey(_sessionKey);
      _writeSessionToken();
    } catch(keyErr) {
      // Key derivation failed — still allow UI unlock, but log warning.
      // initState() will fall back to plaintext load if _sessionKey is null.
      _sessionKey = null;
    }
    // Upgrade legacy static-salt SHA-256 hash to PBKDF2 on first successful login.
    if(_matchedLegacy){
      try{
        var _upgSalt = crypto.getRandomValues(new Uint8Array(16));
        var _upgHash = await _hashPin(_lockBuffer, _upgSalt);
        var _upgStored = JSON.stringify({hash:_upgHash, salt:btoa(String.fromCharCode(..._upgSalt)), hashV:2});
        await _metaSet(PIN_IDB_KEY, _upgStored);
      }catch(e){ /* non-fatal — will retry on next login */ }
    }
    // Set pinEnabled for legacy users whose S was saved before this field existed.
    if(typeof S !== 'undefined' && S && !S.pinEnabled){
      S.pinEnabled = true;
      if(_sessionKey) S.passphraseEnabled = true;
    }
    // Reset activity timer so auto-lock countdown restarts from now.
    _lastActivity = Date.now();
    // Resolve the boot() promise returned by checkLock() (if waiting).
    if(_lockResolve){ var _res=_lockResolve; _lockResolve=null; _res(); }
    document.getElementById('lockScreen').style.display='none';
    document.body.style.overflow='';
    _lockBuffer='';
    updateLockDots();
    // Re-render AI button state in case coach was unlocked.
    if(typeof updateClaudeBtn==='function') updateClaudeBtn();
  } else {
    _pinFailCount++;
    // Exponential lockout: attempts 5→30s, 6→1m, 7→2m, 8→4m, 9→8m, 10+→16m
    var LOCKOUT_MS=[0,0,0,0,0,30000,60000,120000,240000,480000,960000];
    var delay=LOCKOUT_MS[Math.min(_pinFailCount,LOCKOUT_MS.length-1)];
    if(delay>0) _pinLockUntil=Date.now()+delay;
    _savePinLockout();
    // At 10 attempts: show recovery passphrase panel
    if(_pinFailCount>=10){
      var forgotLink=document.getElementById('forgotPinLink');
      if(forgotLink) forgotLink.style.display='block';
      document.getElementById('lockError').textContent='Too many attempts. Use your recovery passphrase.';
    } else {
      var remaining=Math.max(0,5-_pinFailCount);
      var secs=delay>0?Math.ceil(delay/1000):0;
      var errMsg=delay>0
        ?'Too many attempts — wait '+secs+'s'
        :'Incorrect PIN — try again'+(remaining>0&&remaining<=2?' ('+remaining+' left)':'');
      document.getElementById('lockError').textContent=errMsg;
    }
    document.getElementById('lockScreen').classList.add('pin-shake');
    setTimeout(function(){document.getElementById('lockScreen').classList.remove('pin-shake');},400);
    _lockBuffer=''; updateLockDots();
  }
}

function lockKeyPress(key){
  const now=Date.now();
  if(_pinFailCount>=5&&now<_pinLockUntil){
    const secs=Math.ceil((_pinLockUntil-now)/1000);
    document.getElementById('lockError').textContent='Too many attempts — wait '+secs+'s';
    return;
  }
  const errEl=document.getElementById('lockError');
  errEl.textContent='';
  if(key==='del'){ _lockBuffer=_lockBuffer.slice(0,-1); updateLockDots(); return; }
  if(key==='bio'){ /* future: WebAuthn */ return; }
  if(_lockBuffer.length>=_pinLen) return;
  _lockBuffer+=key;
  updateLockDots();
  if(_lockBuffer.length===_pinLen) verifyPin();
}

function updateLockDots(){
  for(var i=0;i<6;i++){
    var d=document.getElementById('ld'+i);
    if(!d) continue;
    d.style.display=i<_pinLen?'':'none';
    var filled=i<_lockBuffer.length;
    d.classList.toggle('filled',filled);
    // A-01: keep aria-label in sync so screen readers can navigate the dot grid.
    d.setAttribute('aria-label','Digit '+(i+1)+': '+(filled?'filled':'empty'));
  }
  var s=document.getElementById('lockPinStatus');
  if(s) s.textContent=_lockBuffer.length===_pinLen?'PIN complete':_lockBuffer.length+' of '+_pinLen+' digits entered';
}

// ── PIN SETUP ──
function openPinSetup(){
  _setupBuffer=''; _setupStage='enter'; _setupFirst=''; _setupPinConfirmed='';
  document.getElementById('setupError').textContent='';
  // Show PIN entry section, hide passphrase section
  var pinSec=document.getElementById('pinSetupPinSection');
  var passSec=document.getElementById('pinSetupPassphraseSection');
  if(pinSec) pinSec.style.display='';
  if(passSec) passSec.style.display='none';
  updateSetupDots();
  // Sync the length toggle buttons if present
  document.querySelectorAll('[data-action="setPinLen"]').forEach(function(btn){
    btn.classList.toggle('active',parseInt(btn.dataset.arg)===_pinLen);
  });
  // Show Remove PIN button and adjust title if PIN already set
  getPinHash().then(function(h){
    document.getElementById('pinRemoveBtn').style.display=h?'block':'none';
    document.getElementById('pinSetupTitle').textContent=h?'Change 6-Digit PIN':'Set 6-Digit PIN';
    document.getElementById('pinSetupDesc').textContent=h
      ?'Enter a new 6-digit PIN to replace your current one.'
      :'Choose a 6-digit PIN to protect your data.';
  });
  document.getElementById('pinSetupModal').classList.add('open');
  trapFocus(document.getElementById('pinSetupModal'));
}

function closePinSetup(){
  releaseTrap(document.getElementById('pinSetupModal'));
  document.getElementById('pinSetupModal').classList.remove('open');
  _setupBuffer=''; _setupStage='enter'; _setupFirst=''; _setupPinConfirmed='';
  // Reset passphrase inputs if present
  var sp=document.getElementById('setupPassphrase');
  var sp2=document.getElementById('setupPassphrase2');
  if(sp) sp.value='';
  if(sp2) sp2.value='';
  var pinSec=document.getElementById('pinSetupPinSection');
  var passSec=document.getElementById('pinSetupPassphraseSection');
  if(pinSec) pinSec.style.display='';
  if(passSec) passSec.style.display='none';
}

function setupKeyPress(key){
  if(_setupStage==='passphrase') return; // numpad inactive in passphrase phase
  if(key==='del'){ _setupBuffer=_setupBuffer.slice(0,-1); updateSetupDots(); return; }
  if(_setupBuffer.length>=_pinLen) return;
  _setupBuffer+=key;
  updateSetupDots();
  if(_setupBuffer.length===_pinLen){
    if(_setupStage==='enter'){
      _setupFirst=_setupBuffer;
      _setupBuffer='';
      _setupStage='confirm';
      document.getElementById('pinSetupTitle').textContent='Confirm 6-Digit PIN';
      document.getElementById('pinSetupDesc').textContent='Enter the same 6-digit PIN again to confirm.';
      document.getElementById('setupError').textContent='';
      updateSetupDots();
    } else {
      confirmPinSetup();
    }
  }
}

function updateSetupDots(){
  for(var i=0;i<6;i++){
    var d=document.getElementById('sd'+i);
    if(!d) continue;
    d.style.display=i<_pinLen?'':'none';
    d.classList.toggle('filled',i<_setupBuffer.length);
  }
  var s=document.getElementById('setupPinStatus');
  if(s) s.textContent=_setupBuffer.length===_pinLen?'PIN complete':_setupBuffer.length+' of '+_pinLen+' digits entered';
}

function setPinLen(len){
  _pinLen=parseInt(len)||6;
  _setupBuffer=''; _setupFirst=''; _setupStage='enter';
  var titleEl=document.getElementById('pinSetupTitle');
  var descEl=document.getElementById('pinSetupDesc');
  var errEl=document.getElementById('setupError');
  if(titleEl) titleEl.textContent='Set 6-Digit PIN';
  if(descEl) descEl.textContent='Choose a 6-digit PIN to protect your data.';
  if(errEl) errEl.textContent='';
  updateSetupDots(); // updates settings modal dots (sd0-sd5)
  // Also update onboarding dots if in onboarding context
  if(typeof obUpdatePinDots==='function'){
    if(typeof _obPin!=='undefined') _obPin='';  // reset onboarding buffer too
    if(typeof _obPinFirst!=='undefined') _obPinFirst='';
    if(typeof _obPinPhase!=='undefined') _obPinPhase='enter';
    obUpdatePinDots();
  }
  document.querySelectorAll('[data-action="setPinLen"]').forEach(function(btn){
    btn.classList.toggle('active',parseInt(btn.dataset.arg)===_pinLen);
  });
}

async function confirmPinSetup(){
  if(_setupBuffer!==_setupFirst){
    document.getElementById('setupError').textContent='PINs do not match — try again';
    _setupBuffer=''; _setupStage='enter'; _setupFirst='';
    updateSetupDots();
    return;
  }
  // PIN confirmed — switch to recovery passphrase phase
  _setupPinConfirmed=_setupBuffer;
  _setupBuffer=''; _setupStage='passphrase';
  document.getElementById('pinSetupTitle').textContent='Recovery Passphrase';
  document.getElementById('pinSetupDesc').textContent='Required to recover access if you forget your PIN. Write it down and keep it safe.';
  document.getElementById('setupError').textContent='';
  var pinSec=document.getElementById('pinSetupPinSection');
  var passSec=document.getElementById('pinSetupPassphraseSection');
  if(pinSec) pinSec.style.display='none';
  if(passSec){
    passSec.style.display='';
    var sp=passSec.querySelector('#setupPassphrase');
    if(sp) setTimeout(function(){sp.focus();},80);
  }
}

function cancelPinPassphrase(){
  _setupBuffer=''; _setupStage='enter'; _setupFirst=''; _setupPinConfirmed='';
  document.getElementById('pinSetupTitle').textContent='Set 6-Digit PIN';
  document.getElementById('pinSetupDesc').textContent='Choose a 6-digit PIN to protect your data.';
  document.getElementById('setupError').textContent='';
  var pinSec=document.getElementById('pinSetupPinSection');
  var passSec=document.getElementById('pinSetupPassphraseSection');
  if(pinSec) pinSec.style.display='';
  if(passSec) passSec.style.display='none';
  var sp=document.getElementById('setupPassphrase');
  var sp2=document.getElementById('setupPassphrase2');
  if(sp) sp.value='';
  if(sp2) sp2.value='';
  updateSetupDots();
}

async function submitPinSetupPassphrase(){
  var pass=(document.getElementById('setupPassphrase').value||'').trim();
  var pass2=(document.getElementById('setupPassphrase2').value||'').trim();
  var errEl=document.getElementById('setupError');
  errEl.textContent='';
  if(pass.length<8){errEl.textContent='Passphrase must be at least 8 characters';return;}
  if(pass!==pass2){errEl.textContent='Passphrases do not match';document.getElementById('setupPassphrase2').value='';document.getElementById('setupPassphrase2').focus();return;}
  await _doFinalPinSetup(_setupPinConfirmed,pass);
}

async function _doFinalPinSetup(pin,passphrase){
  // 1. Hash PIN for future verification
  var saltBytes=crypto.getRandomValues(new Uint8Array(16));
  var hash=await _hashPin(pin,saltBytes);
  var stored=JSON.stringify({hash,salt:btoa(String.fromCharCode(...saltBytes)),hashV:2});
  if(!_idb) _idb=await openIDB().catch(function(){return null;});
  if(_idb&&location.protocol!=='file:'){
    await new Promise(function(res,rej){
      var tx=_idb.transaction(IDB_PIN_STORE,'readwrite');
      tx.objectStore(IDB_PIN_STORE).put(stored,PIN_IDB_KEY);
      tx.oncomplete=res; tx.onerror=function(e){rej(e.target.error);};
    });
  } else {
    localStorage.setItem(PIN_IDB_KEY,stored);
  }
  // 2. v2 key-wrapping: generate DEK, wrap under PIN-KEK and recovery-KEK
  if(typeof CRYPTO!=='undefined'){
    try{
      var dek=await CRYPTO.generateDEK();
      var pinKekSalt=crypto.getRandomValues(new Uint8Array(16));
      var pinKek=await CRYPTO.deriveKeyV2(pin,pinKekSalt);
      var dekPinWrapped=await CRYPTO.wrapDEK(pinKek,dek);
      var recKekSalt=crypto.getRandomValues(new Uint8Array(16));
      var recKek=await CRYPTO.deriveKeyV2(passphrase,recKekSalt);
      var dekRecWrapped=await CRYPTO.wrapDEK(recKek,dek);
      await _metaSet(ENC_VERSION_KEY,'2');
      await _metaSet(PIN_KEK_SALT_KEY,CRYPTO._toBase64(pinKekSalt.buffer));
      await _metaSet(DEK_PIN_KEY,JSON.stringify(dekPinWrapped));
      await _metaSet(REC_KEK_SALT_KEY,CRYPTO._toBase64(recKekSalt.buffer));
      await _metaSet(DEK_REC_KEY,JSON.stringify(dekRecWrapped));
      await _metaSet(PIN_LEN_IDB_KEY,String(_pinLen));
      await _metaDel(ENC_SALT_IDB_KEY); // clean up v1 key
      _sessionKey=dek;
      if(typeof S!=='undefined'&&S) await _doPersist(false);
      if(typeof window._syncAIKeyEncryption==='function') await window._syncAIKeyEncryption();
    }catch(e){
      _sessionKey=null;
    }
  }
  closePinSetup();
  var btn=document.getElementById('pinBtn');
  if(btn) btn.textContent='🔒';
  showToast(_sessionKey?'✓ PIN set — data encrypted':'✓ PIN set');
  _setupPinConfirmed='';
  if(typeof S!=='undefined'&&S){
    S.pinEnabled=true;
    if(_sessionKey) S.passphraseEnabled=true;
  }
  if(typeof awardXP==='function') awardXP('pin_enabled');
  if(typeof checkAchievements==='function') checkAchievements('vault_keeper');
}

async function removePin(){
  // ── Decrypt data and AI keys before removing PIN so nothing is lost ────────
  if(_sessionKey && typeof CRYPTO !== 'undefined'){
    const prevKey = _sessionKey;
    _sessionKey = null;
    // Re-save state as plaintext (sessionKey is null so _doPersist writes cleartext).
    if(typeof S !== 'undefined' && S) await _doPersist(false);
    // Re-save AI keys as plaintext.
    if(typeof window._syncAIKeyEncryption === 'function') await window._syncAIKeyEncryption();
  } else {
    _sessionKey = null;
  }
  // Delete PIN hash, all encryption keys (v1 and v2), and length record.
  await _metaDel(PIN_IDB_KEY);
  await _metaDel(ENC_SALT_IDB_KEY);
  await _metaDel(ENC_VERSION_KEY);
  await _metaDel(PIN_KEK_SALT_KEY);
  await _metaDel(DEK_PIN_KEY);
  await _metaDel(REC_KEK_SALT_KEY);
  await _metaDel(DEK_REC_KEY);
  await _metaDel(PIN_LEN_IDB_KEY);
  localStorage.removeItem(PIN_IDB_KEY);
  document.getElementById('pinRemoveBtn').style.display = 'none';
  const btn = document.getElementById('pinBtn');
  if(btn) btn.textContent = '🔓';
  closePinSetup();
  showToast('✓ PIN removed — data is no longer encrypted');
}

// ══════════════════════════════════════════════════════════════
// SESSION KEY DERIVATION
// Reads the per-device enc_salt from IDB, runs PBKDF2(PIN, salt).
// Called by verifyPin() and confirmPinSetup().
// If no salt exists yet (upgrade from pre-encryption build) one is generated,
// saved, and the next _doPersist() will encrypt the plaintext data.
// ══════════════════════════════════════════════════════════════
async function _deriveSessionKey(pin){
  if(typeof CRYPTO==='undefined') return null;
  var encV=await _metaGet(ENC_VERSION_KEY);
  if(encV==='2'){
    // v2: derive PIN-KEK (600k iterations) → unwrap DEK
    var pinKekSaltB64=await _metaGet(PIN_KEK_SALT_KEY);
    var dekPinRaw=await _metaGet(DEK_PIN_KEY);
    if(!pinKekSaltB64||!dekPinRaw) return null;
    var pinKekSalt=CRYPTO._fromBase64(pinKekSaltB64);
    var pinKek=await CRYPTO.deriveKeyV2(pin,pinKekSalt);
    var wrappedPayload=typeof dekPinRaw==='string'?JSON.parse(dekPinRaw):dekPinRaw;
    return CRYPTO.unwrapDEK(pinKek,wrappedPayload);
  }
  // v1: direct PBKDF2(pin, enc_salt) at 210k iterations
  var saltB64=await _metaGet(ENC_SALT_IDB_KEY);
  if(!saltB64){
    var newSalt=crypto.getRandomValues(new Uint8Array(16));
    saltB64=CRYPTO._toBase64(newSalt.buffer);
    await _metaSet(ENC_SALT_IDB_KEY,saltB64);
    return CRYPTO.deriveKey(pin,newSalt);
  }
  return CRYPTO.deriveKey(pin,CRYPTO._fromBase64(saltB64));
}

// ══════════════════════════════════════════════════════════════
// LOCK APP (manual or auto-lock)
// Clears the session key and AI key cache, shows the lock screen.
// S stays in memory — re-unlock does NOT need to re-read IDB.
// ══════════════════════════════════════════════════════════════
async function lockApp(){
  // Flush any in-flight save so the latest encrypted version is in IDB.
  if(_persistTimer){
    clearTimeout(_persistTimer);
    _persistTimer = null;
    await _doPersist(false);
  }
  _sessionKey = null;
  // Clear the session token so refresh also shows PIN after a manual lock.
  _clearSessionToken();
  try { sessionStorage.removeItem(_SS_KEY); } catch(e) {}
  if(typeof clearAIKeyCache === 'function') clearAIKeyCache();
  _lockBuffer = '';
  var lockEl = document.getElementById('lockScreen');
  if(lockEl){ lockEl.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  updateLockDots();
  var errEl = document.getElementById('lockError');
  if(errEl) errEl.textContent = '';
  // Re-arm the lock promise so boot() semantics work on re-unlock.
  // (verifyPin sets _lockResolve to null after resolving — no leftover refs.)
}

// ══════════════════════════════════════════════════════════════
// RECOVERY PASSPHRASE UNLOCK
// Shown after 10 failed PIN attempts. Derives recovery-KEK from
// the passphrase, unwraps the DEK, and unlocks the session.
// ══════════════════════════════════════════════════════════════
function showRecoveryPanel(){
  var numpad=document.querySelector('#lockScreen .pin-pad');
  if(numpad) numpad.style.display='none';
  var dotsEl=document.getElementById('lockDots');
  if(dotsEl) dotsEl.style.display='none';
  var panel=document.getElementById('recoveryPanel');
  if(panel){
    panel.style.display='block';
    var inp=document.getElementById('recoveryInput');
    if(inp) setTimeout(function(){inp.focus();},80);
  }
  document.getElementById('lockError').textContent='';
}

async function verifyRecovery(){
  var passphrase=(document.getElementById('recoveryInput').value||'').trim();
  var errEl=document.getElementById('recoveryError');
  if(!passphrase){errEl.textContent='Enter your recovery passphrase';return;}
  var encV=await _metaGet(ENC_VERSION_KEY);
  if(encV!=='2'){errEl.textContent='No recovery passphrase set for this account';return;}
  var recKekSaltB64=await _metaGet(REC_KEK_SALT_KEY);
  var dekRecRaw=await _metaGet(DEK_REC_KEY);
  if(!recKekSaltB64||!dekRecRaw){errEl.textContent='No recovery passphrase set for this account';return;}
  try{
    var recKekSalt=CRYPTO._fromBase64(recKekSaltB64);
    var recKek=await CRYPTO.deriveKeyV2(passphrase,recKekSalt);
    var wrappedPayload=typeof dekRecRaw==='string'?JSON.parse(dekRecRaw):dekRecRaw;
    _sessionKey=await CRYPTO.unwrapDEK(recKek,wrappedPayload);
    _pinFailCount=0; _pinLockUntil=0;
    await _savePinLockout();
    _lastActivity=Date.now();
    await _storeSessionKey(_sessionKey);
    _writeSessionToken();
    document.getElementById('recoveryPanel').style.display='none';
    document.getElementById('lockScreen').style.display='none';
    document.body.style.overflow='';
    var forgotLink=document.getElementById('forgotPinLink');
    if(forgotLink) forgotLink.style.display='none';
    if(_lockResolve){var _res=_lockResolve;_lockResolve=null;_res();}
    showToast('Access restored — please reset your PIN in Settings','warn-t');
    if(typeof updateClaudeBtn==='function') updateClaudeBtn();
  }catch(e){
    errEl.textContent='Incorrect recovery passphrase — try again';
    document.getElementById('recoveryInput').value='';
  }
}

// ══════════════════════════════════════════════════════════════
// AUTO-LOCK ON INACTIVITY
// Tracks last user interaction. If PIN is set and session is
// idle longer than S.autoLockMins, lockApp() is called.
// Default: 15 minutes. 0 = disabled.
// ══════════════════════════════════════════════════════════════
(function _initAutoLock(){
  var _EVENTS = ['pointerdown','keydown','touchstart','scroll'];
  var _tokenRefreshAt = 0; // throttle sessionStorage writes to once per minute
  _EVENTS.forEach(function(ev){
    document.addEventListener(ev, function(){
      _lastActivity = Date.now();
      // Refresh the session token timestamp at most once per minute so that
      // the inactivity window resets properly when the user is active.
      if(_lastActivity - _tokenRefreshAt > 60000){
        _tokenRefreshAt = _lastActivity;
        _writeSessionToken();
      }
    }, { passive: true, capture: true });
  });
  // Use a guard flag to prevent concurrent lock calls if _doPersist takes longer
  // than the check interval (setInterval does not await async callbacks).
  var _autoLockBusy = false;
  setInterval(function(){
    // Guard: skip if already in the lock process, or if no PIN is set, or already locked.
    if(_autoLockBusy || !_pinActive || document.getElementById('lockScreen').style.display === 'flex') return;
    var mins = (typeof S !== 'undefined' && S && typeof S.autoLockMins === 'number') ? S.autoLockMins : 240;
    if(mins === 0) return;
    if(Date.now() - _lastActivity > mins * 60000){
      _autoLockBusy = true;
      lockApp().then(function(){
        showToast('Locked due to inactivity', 'warn-t');
      }).catch(function(){}).finally(function(){
        _autoLockBusy = false;
      });
    }
  }, 60000);
  // Lock when tab becomes visible again after being hidden (handles system sleep/resume
  // and tab switching). Only fires if the idle time exceeded the configured threshold.
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState !== 'visible') return;
    if(!_pinActive || document.getElementById('lockScreen').style.display === 'flex') return;
    var mins = (typeof S !== 'undefined' && S && typeof S.autoLockMins === 'number') ? S.autoLockMins : 240;
    if(mins === 0) return;
    if(Date.now() - _lastActivity > mins * 60000){
      lockApp().then(function(){ showToast('Locked due to inactivity', 'warn-t'); }).catch(function(){});
    }
  });
}());
