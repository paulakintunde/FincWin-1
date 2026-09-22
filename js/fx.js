// === fx.js — Multi-currency FX rate helper (E6 Phase 1) ===
// Fetches live rates from open.er-api.com (1-hour sessionStorage cache).
// All amounts are converted TO the user's home currency for totals and KPI displays.
// Rows show original currency + "≈ home" when currencies differ.
//
// Rate sources, in order of preference:
//   1. S.fxHistory[monthKey] — snapshot frozen at the end of that month, so past
//      months keep the rate they were budgeted at instead of drifting with today's.
//   2. _fxRates — this session's live fetch.
//   3. S.fxRates — last good fetch, persisted so conversion still works offline.
// Conversion uses cross rates (rate[to] / rate[from]), so a table fetched against
// any base stays correct after the user changes their home currency.
// If no table has both currencies, the amount is reported as noRate and totals
// exclude it — a foreign amount is never added to home-currency totals unconverted.

(function(){

var FX_CACHE_KEY = 'fincwin_fx_rates';
var FX_TTL = 3600000; // 1 hour ms
var FX_HISTORY_MONTHS = 36;

var _fxRates = null; // { base, rates: {CODE: rate}, fetchedAt }

// Attempt to load cache on module init
try {
  var cached = JSON.parse(sessionStorage.getItem(FX_CACHE_KEY) || 'null');
  if (cached && cached.rates) {
    if (!cached.fetchedAt && cached.fetched) cached.fetchedAt = cached.fetched; // pre-rename cache
    _fxRates = cached;
  }
} catch(e) {}

function _isFetchableCode(code) {
  return typeof code === 'string' && /^[A-Z]{3}$/.test(code);
}

function _hasRates(t) {
  return !!(t && t.base && t.rates && Object.keys(t.rates).length);
}

// Live table: this session's fetch, else the last persisted one.
function _liveTable() {
  if (_hasRates(_fxRates)) return _fxRates;
  if (typeof S !== 'undefined' && S && _hasRates(S.fxRates)) return S.fxRates;
  return null;
}

function _realMonthKey() {
  var d = new Date();
  return MS[d.getMonth()] + ' ' + d.getFullYear();
}

// Units of `code` per 1 unit of the table's base.
function _rateIn(table, code) {
  if (!table) return null;
  if (code === table.base) return 1;
  var r = table.rates[code];
  return (typeof r === 'number' && r > 0) ? r : null;
}

function _crossRate(table, fromCode, toCode) {
  var f = _rateIn(table, fromCode), t = _rateIn(table, toCode);
  return (f && t) ? { rate: t / f, asOf: table.fetchedAt || 0 } : null;
}

// Keep only currencies the app can use, so month snapshots stay small in synced state.
function _trimRates(table) {
  var keep = {};
  if (typeof CURRENCY_MAP !== 'undefined') Object.keys(CURRENCY_MAP).forEach(function(c){ keep[c] = 1; });
  var collect = function(o){ if (o && o.currency && typeof o.currency === 'string') keep[o.currency] = 1; };
  if (typeof S !== 'undefined' && S) {
    Object.values(S.months || {}).forEach(function(m){
      (m.weeks || []).forEach(function(w){ (w.items || []).forEach(collect); });
      (m.revenue || []).forEach(collect);
    });
    (S.loans || []).forEach(collect);
    (S.savings || []).forEach(collect);
    (S.investments || []).forEach(collect);
    if (S.currency && S.currency.code) keep[S.currency.code] = 1;
  }
  var rates = {};
  Object.keys(keep).forEach(function(c){ if (table.rates[c]) rates[c] = table.rates[c]; });
  return { base: table.base, rates: rates, fetchedAt: table.fetchedAt };
}

function _recordRates(table) {
  if (typeof S === 'undefined' || !S || S._isDemo) return;
  S.fxRates = { base: table.base, rates: table.rates, fetchedAt: table.fetchedAt };
  if (!S.fxHistory || typeof S.fxHistory !== 'object') S.fxHistory = {};
  S.fxHistory[_realMonthKey()] = _trimRates(table);
  // Cap history so synced state doesn't grow forever
  var keys = Object.keys(S.fxHistory);
  if (keys.length > FX_HISTORY_MONTHS) {
    keys.sort(function(a, b){ return (S.fxHistory[a].fetchedAt || 0) - (S.fxHistory[b].fetchedAt || 0); });
    keys.slice(0, keys.length - FX_HISTORY_MONTHS).forEach(function(k){ delete S.fxHistory[k]; });
  }
  if (typeof persist === 'function') persist(false);
}

async function fetchFXRates(baseCurrency) {
  // Custom/non-ISO home currencies can't be looked up — rows show original amounts only.
  if (!_isFetchableCode(baseCurrency)) return _liveTable();
  // Return cached if valid and same base
  if (_fxRates && _fxRates.base === baseCurrency && (Date.now() - (_fxRates.fetchedAt || 0)) < FX_TTL) {
    return _fxRates;
  }
  try {
    var res = await fetch('https://open.er-api.com/v6/latest/' + encodeURIComponent(baseCurrency));
    if (!res.ok) throw new Error('FX ' + res.status);
    var data = await res.json();
    if (data.result !== 'success' || !data.rates) throw new Error('FX api error');
    _fxRates = { base: baseCurrency, rates: data.rates, fetchedAt: Date.now() };
    try { sessionStorage.setItem(FX_CACHE_KEY, JSON.stringify(_fxRates)); } catch(e) {}
    _recordRates(_fxRates);
  } catch(e) {
    console.warn('[FX] Rate fetch failed:', e.message);
    if (typeof showToast === 'function') {
      var fallback = _liveTable();
      showToast(fallback
        ? '⚠ Offline — using exchange rates from ' + new Date(fallback.fetchedAt).toLocaleDateString()
        : '⚠ Could not load exchange rates — foreign amounts excluded from totals', 'warn-t');
    }
  }
  return _liveTable();
}

// Convert `amount` in `fromCode` to the user's home currency.
// `monthKey` (optional) selects that month's frozen rate snapshot, if one exists.
// Returns { value, converted, originalAmount, originalCode, asOf, noRate }
// When noRate is true, `value` is 0 so callers that only read .value can't
// accidentally add a foreign amount to a home-currency total.
function convertToHome(amount, fromCode, monthKey) {
  var homeCode = (typeof getCurrency === 'function') ? getCurrency().code : 'USD';
  if (!fromCode || fromCode === homeCode) {
    return { value: amount, converted: false };
  }
  var cr = null;
  if (monthKey && monthKey !== _realMonthKey() && typeof S !== 'undefined' && S && S.fxHistory && S.fxHistory[monthKey]) {
    cr = _crossRate(S.fxHistory[monthKey], fromCode, homeCode);
  }
  if (!cr) cr = _crossRate(_liveTable(), fromCode, homeCode);
  if (!cr) {
    return { value: 0, converted: false, noRate: true, originalAmount: amount, originalCode: fromCode };
  }
  return {
    value: amount * cr.rate,
    converted: true,
    originalAmount: amount,
    originalCode: fromCode,
    asOf: cr.asOf
  };
}

// Format an item amount for row display:
// If same currency as home: plain fmt(amount)
// If different: "EUR 45.00 ≈ $49.23"  (or just "EUR 45.00" when no rate)
// opts.monthKey selects that month's rate snapshot (expense/income rows).
function fmtItemAmount(amount, itemCurrency, opts) {
  var homeCode = (typeof getCurrency === 'function') ? getCurrency().code : 'USD';
  if (!itemCurrency || itemCurrency === homeCode) {
    return (typeof fmt === 'function') ? fmt(amount) : String(amount);
  }
  var origSym = '';
  if (typeof CURRENCY_MAP !== 'undefined' && CURRENCY_MAP[itemCurrency]) {
    origSym = CURRENCY_MAP[itemCurrency].symbol || itemCurrency;
  } else {
    origSym = itemCurrency + ' ';
  }
  var origStr = origSym + (amount || 0).toFixed(2);
  var conv = convertToHome(amount, itemCurrency, opts && opts.monthKey);
  if (conv.noRate || !conv.converted) {
    return '<span title="No exchange rate available — not included in totals">' + origStr + '</span>';
  }
  var homeFmt = (typeof fmt === 'function') ? fmt(conv.value) : String(conv.value.toFixed(2));
  var asOf = conv.asOf ? ' · rate as of ' + new Date(conv.asOf).toLocaleDateString() : '';
  // Stacked layout: home amount (primary) on top, original amount (muted) below
  // opts.inline=true falls back to the old single-line format for contexts like table headers
  if (opts && opts.inline) {
    return origStr + ' <span class="fx-approx" aria-label="approximately" title="' + asOf.replace(' · ', '') + '">≈</span> ' + homeFmt;
  }
  return homeFmt + '<br><span class="fx-orig" title="Original: ' + origStr + asOf + '">' + origStr + '</span>';
}

// Exported to window so state.js totalling and render functions can use them
window.fetchFXRates  = fetchFXRates;
window.convertToHome = convertToHome;
window.fmtItemAmount = fmtItemAmount;

})();
