// === fx.js — Multi-currency FX rate helper (E6 Phase 1) ===
// Fetches live rates from open.er-api.com once per session (1-hour sessionStorage cache).
// All amounts are converted TO the user's home currency for totals and KPI displays.
// Rows show original currency + "≈ home" when currencies differ.

(function(){

var FX_CACHE_KEY = 'fincwin_fx_rates';
var FX_TTL = 3600000; // 1 hour ms

var _fxRates = null; // { base, rates: {CODE: rate}, fetched }

// Attempt to load cache on module init
try {
  var cached = JSON.parse(sessionStorage.getItem(FX_CACHE_KEY) || 'null');
  if (cached && cached.rates) _fxRates = cached;
} catch(e) {}

async function fetchFXRates(baseCurrency) {
  // Return cached if valid and same base
  if (_fxRates && _fxRates.base === baseCurrency && (Date.now() - (_fxRates.fetched || 0)) < FX_TTL) {
    return _fxRates;
  }
  if (typeof showToast === 'function') showToast('Updating exchange rates…');
  try {
    var res = await fetch('https://open.er-api.com/v6/latest/' + encodeURIComponent(baseCurrency));
    if (!res.ok) throw new Error('FX ' + res.status);
    var data = await res.json();
    if (data.result !== 'success') throw new Error('FX api error');
    _fxRates = { base: baseCurrency, rates: data.rates, fetched: Date.now() };
    sessionStorage.setItem(FX_CACHE_KEY, JSON.stringify(_fxRates));
    if (typeof showToast === 'function') showToast('✓ Exchange rates updated');
  } catch(e) {
    // Network/API failure — leave _fxRates as-is (may be stale but better than nothing)
    console.warn('[FX] Rate fetch failed:', e.message);
    if (typeof showToast === 'function') showToast('⚠ Could not update exchange rates', 'warn-t');
  }
  return _fxRates;
}

// Convert `amount` in `fromCode` to the user's home currency.
// Returns { value, converted, originalAmount, originalCode, noRate }
function convertToHome(amount, fromCode) {
  var homeCode = (typeof getCurrency === 'function') ? getCurrency().code : 'USD';
  if (!fromCode || fromCode === homeCode) {
    return { value: amount, converted: false };
  }
  if (!_fxRates || !_fxRates.rates) {
    return { value: amount, converted: false, noRate: true };
  }
  // _fxRates.base === homeCode, so rate[fromCode] = units of fromCode per 1 homeCode
  // To convert: homeAmount = fromAmount / rate[fromCode]
  var rate = _fxRates.rates[fromCode];
  if (!rate) {
    return { value: amount, converted: false, noRate: true };
  }
  return {
    value: amount / rate,
    converted: true,
    originalAmount: amount,
    originalCode: fromCode
  };
}

// Format an item amount for row display:
// If same currency as home: plain fmt(amount)
// If different: "EUR 45.00 ≈ $49.23"  (or just "EUR 45.00" when no rate)
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
  var conv = convertToHome(amount, itemCurrency);
  if (conv.noRate || !conv.converted) return origStr;
  var homeFmt = (typeof fmt === 'function') ? fmt(conv.value) : String(conv.value.toFixed(2));
  // Stacked layout: home amount (primary) on top, original amount (muted) below
  // opts.inline=true falls back to the old single-line format for contexts like table headers
  if (opts && opts.inline) {
    return origStr + ' <span class="fx-approx" aria-label="approximately">≈</span> ' + homeFmt;
  }
  return homeFmt + '<br><span class="fx-orig" title="Original: ' + origStr + '">' + origStr + '</span>';
}

// Exported to window so state.js totalling and render functions can use them
window.fetchFXRates  = fetchFXRates;
window.convertToHome = convertToHome;
window.fmtItemAmount = fmtItemAmount;

})();
