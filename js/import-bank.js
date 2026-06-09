// === import-bank.js ===
// Bank statement import: CSV (auto-detect format) + OFX/QFX
// Step flow: Upload → Review per-transaction → Confirm import

'use strict';

// ── Module state ──────────────────────────────────────────────────────────────
let _biTxns = [];        // parsed transaction objects
let _biFilter = 'all';   // 'all' | 'expense' | 'income'
let _biBank = '';        // detected bank name

// ── Bank format profiles ──────────────────────────────────────────────────────
// Each profile: detect(headers[]) → bool, cols(headers[]) → {date,desc,amt,debit,credit}
const _BANK_PROFILES = [
  {
    name: 'TD Bank',
    detect: h => h.some(c => /^date$/i.test(c)) && h.some(c => /^debit/i.test(c)) && h.some(c => /^credit/i.test(c)),
    cols: h => ({ date: h.find(c => /^date$/i.test(c)), desc: h.find(c => /description/i.test(c)), debit: h.find(c => /^debit/i.test(c)), credit: h.find(c => /^credit/i.test(c)), amt: null })
  },
  {
    name: 'RBC Royal Bank',
    detect: h => h.some(c => /description 1/i.test(c)) || (h.some(c => /cad\$/i.test(c)) && h.some(c => /date/i.test(c))),
    cols: h => ({ date: h.find(c => /date/i.test(c)), desc: h.find(c => /description.?1/i.test(c)) || h.find(c => /description/i.test(c)), amt: h.find(c => /cad\$/i.test(c)) || h.find(c => /amount/i.test(c)), debit: null, credit: null })
  },
  {
    name: 'BMO Bank of Montreal',
    detect: h => h.some(c => /transaction.?date/i.test(c)) && h.some(c => /payee/i.test(c)),
    cols: h => ({ date: h.find(c => /transaction.?date/i.test(c)), desc: h.find(c => /payee/i.test(c)) || h.find(c => /description/i.test(c)), amt: h.find(c => /amount/i.test(c)), debit: null, credit: null })
  },
  {
    name: 'CIBC',
    detect: h => h.length >= 3 && h.length <= 5 && h.some(c => /debit/i.test(c)) && h.some(c => /credit/i.test(c)) && !h.some(c => /transaction.?date/i.test(c)),
    cols: h => ({ date: h[0], desc: h[1], debit: h.find(c => /debit/i.test(c)), credit: h.find(c => /credit/i.test(c)), amt: null })
  },
  {
    name: 'Scotiabank',
    detect: h => h.some(c => /^date$/i.test(c)) && h.some(c => /description/i.test(c)) && h.some(c => /withdrawals/i.test(c)),
    cols: h => ({ date: h.find(c => /^date$/i.test(c)), desc: h.find(c => /description/i.test(c)), debit: h.find(c => /withdrawal/i.test(c)), credit: h.find(c => /deposit/i.test(c)), amt: null })
  },
  {
    name: 'Capital One',
    detect: h => h.some(c => /transaction.?date/i.test(c)) && h.some(c => /debit/i.test(c)) && h.some(c => /credit/i.test(c)),
    cols: h => ({ date: h.find(c => /transaction.?date/i.test(c)), desc: h.find(c => /description/i.test(c)), debit: h.find(c => /debit/i.test(c)), credit: h.find(c => /credit/i.test(c)), amt: null })
  },
  {
    name: 'Chase',
    detect: h => h.some(c => /transaction.?date/i.test(c)) && h.some(c => /\btype\b/i.test(c)) && h.some(c => /\bamount\b/i.test(c)) && !h.some(c => /debit/i.test(c)),
    cols: h => ({ date: h.find(c => /transaction.?date/i.test(c)), desc: h.find(c => /description/i.test(c)), amt: h.find(c => /\bamount\b/i.test(c)), debit: null, credit: null })
  },
  {
    name: 'Bank of America',
    detect: h => h.some(c => /posting.?date/i.test(c)) || h.some(c => /reference.?number/i.test(c)),
    cols: h => ({ date: h.find(c => /posting.?date/i.test(c)) || h.find(c => /date/i.test(c)), desc: h.find(c => /payee|description/i.test(c)), amt: h.find(c => /amount/i.test(c)), debit: null, credit: null })
  },
  {
    name: 'American Express',
    detect: h => h.some(c => /date/i.test(c)) && h.some(c => /amount/i.test(c)) && !h.some(c => /debit|credit|withdrawal/i.test(c)) && h.length <= 6,
    cols: h => ({ date: h.find(c => /date/i.test(c)), desc: h.find(c => /description|payee|merchant/i.test(c)) || h[1], amt: h.find(c => /amount/i.test(c)), debit: null, credit: null })
  },
  {
    name: 'Wells Fargo',
    detect: h => !h.some(c => /[a-z]/i.test(c)) && h.length >= 5,  // Wells Fargo exports with no header row
    cols: h => ({ date: h[0], desc: h[4] || h[1], amt: h[1], debit: null, credit: null })
  },
  // Generic fallback
  {
    name: 'Generic CSV',
    detect: () => true,
    cols: h => ({
      date: h.find(c => /date/i.test(c)) || h[0] || '',
      desc: h.find(c => /desc|payee|merchant|name/i.test(c)) || h[1] || '',
      amt: h.find(c => /amount|debit/i.test(c)) || h[2] || '',
      debit: null, credit: null
    })
  }
];

// ── PapaParse CSV helper (js/vendor/papaparse.min.js loaded as a defer script) ──
async function _parseCsvWithPapa(text, errEl) {
  text = text.replace(/^﻿/, '');
  const Papa = window.Papa;
  if (!Papa) { errEl.textContent = 'CSV parser not ready — please refresh and try again.'; return; }
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  // Prototype-pollution guard: filter dangerous field names before any object access
  const headers = (result.meta.fields || []).filter(function(h) {
    return h !== '__proto__' && h !== 'constructor' && h !== 'prototype';
  });
  const rows = result.data;
  if (!rows.length) { errEl.textContent = 'No transactions found in file.'; return; }
  const profile = _BANK_PROFILES.find(function(p) { return p.detect(headers); }) || _BANK_PROFILES[_BANK_PROFILES.length - 1];
  _biBank = profile.name;
  const colMap = profile.cols(headers);
  _biTxns = _buildTxns({ headers: headers, rows: rows }, colMap);
  if (!_biTxns.length) { errEl.textContent = 'No transactions could be read from this file.'; return; }
  _renderBankReview();
}

// ── OFX/QFX parser ────────────────────────────────────────────────────────────
function _parseOFX(text) {
  // Handle both SGML (OFX 1.x) and XML (OFX 2.x / QFX)
  const rows = [];
  // Extract each transaction block
  const txnBlocks = text.split(/<\/?STMTTRN>/gi).filter((_, i) => i % 2 === 1);
  if (!txnBlocks.length) {
    // Try XML-style
    const xmlBlocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)].map(m => m[1]);
    txnBlocks.push(...xmlBlocks);
  }
  for (const block of txnBlocks) {
    const get = tag => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([^<\n\r]+)`, 'i'));
      return m ? m[1].trim() : '';
    };
    const dtRaw = get('DTPOSTED') || get('DTUSER');
    const amtRaw = parseFloat(get('TRNAMT')) || 0;
    const name = get('NAME') || get('MEMO') || 'Transaction';
    const type = get('TRNTYPE').toUpperCase();
    if (!amtRaw && !name) continue;
    // Parse OFX date: YYYYMMDDHHMMSS or YYYYMMDD[tz]
    let dateStr = dtRaw.slice(0, 8);
    if (dateStr.length === 8) dateStr = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
    rows.push({ _date: dateStr, _name: name, _amt: amtRaw, _isDebit: amtRaw < 0 || type === 'DEBIT' });
  }
  return { headers: ['_ofx'], rows, isOFX: true };
}

// ── Build transaction objects ─────────────────────────────────────────────────
function _buildTxns(parsed, colMap) {
  const txns = [];
  for (const row of parsed.rows) {
    let date = '', name = '', amt = 0, isExpense = true;
    if (parsed.isOFX) {
      date = row._date; name = row._name;
      amt = Math.abs(row._amt); isExpense = row._isDebit;
    } else {
      date = (row[colMap.date] || '').trim();
      name = (row[colMap.desc] || 'Transaction').substring(0, 60).trim();
      if (colMap.debit && colMap.credit) {
        const dv = parseFloat((row[colMap.debit] || '').replace(/[$, ]/g, '')) || 0;
        const cv = parseFloat((row[colMap.credit] || '').replace(/[$, ]/g, '')) || 0;
        if (!dv && !cv) continue;
        if (dv > 0) { amt = dv; isExpense = true; }
        else { amt = cv; isExpense = false; }
      } else {
        const raw = parseFloat((row[colMap.amt] || '').replace(/[$, ]/g, '')) || 0;
        if (raw === 0) continue;
        amt = Math.abs(raw); isExpense = raw < 0;
      }
    }
    if (!name || !amt) continue;
    const dp = _parseDateParts(date);
    const week = _dateToWeek(date);
    txns.push({
      date, name, amt,
      day: dp ? dp.day : null,   // day-of-month used as dueDay on import
      type: isExpense ? 'expense' : 'income',
      category: typeof getCat === 'function' ? getCat(name) : 'cat-other',
      week,
      checked: isExpense,  // expenses pre-selected, income opt-in
      _id: Math.random().toString(36).slice(2)
    });
  }
  return txns;
}

function _extractDay(dateStr) {
  if (!dateStr) return 1;
  var m = dateStr.match(/(\d+)[\/\-](\d+)[\/\-](\d+)/);
  if (!m) return 1;
  var parts = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  if (parts[0] > 31) return parts[2];                    // YYYY-MM-DD
  if (parts[2] > 31) return parts[0] > 12 ? parts[0] : parts[1]; // year last: DD/MM or MM/DD
  if (parts[0] > 12) return parts[0];                    // DD/MM/YYYY
  return parts[1];                                        // ambiguous: assume MM/DD/YYYY
}

// Parse a full date string into { yr, mo (0-based), day }, or null on failure.
function _parseDateParts(dateStr) {
  if (!dateStr) return null;
  var m = dateStr.match(/(\d+)[\/\-](\d+)[\/\-](\d+)/);
  if (!m) return null;
  var p = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  var yr, mo, day;
  if (p[0] > 31) { yr = p[0]; mo = p[1] - 1; day = p[2]; }       // YYYY-MM-DD
  else if (p[2] > 31) {                                             // year in position 2
    yr = p[2];
    if (p[0] > 12) { day = p[0]; mo = p[1] - 1; }                 // DD/MM/YYYY
    else { mo = p[0] - 1; day = p[1]; }                            // MM/DD/YYYY
  } else { mo = p[0] - 1; day = p[1]; yr = p[2]; }                // MM/DD/YYYY fallback
  if (isNaN(yr) || isNaN(mo) || isNaN(day) || mo < 0 || mo > 11 || day < 1 || day > 31) return null;
  return { yr, mo, day };
}

// Derive the week index (0-3) for a date string using the same calendar-aware
// logic the rest of the app uses via getWeekForDay().
function _dateToWeek(dateStr) {
  var dp = _parseDateParts(dateStr);
  if (!dp) return 0;
  var _MS = typeof MS !== 'undefined' ? MS : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monthKey = _MS[dp.mo] + ' ' + dp.yr;
  if (typeof getWeekForDay === 'function') return getWeekForDay(dp.day, monthKey);
  // Fallback: fixed 7-day buckets
  return dp.day <= 7 ? 0 : dp.day <= 14 ? 1 : dp.day <= 21 ? 2 : 3;
}

// ── Entry points ──────────────────────────────────────────────────────────────
function openBankImport() {
  _biTxns = []; _biFilter = 'all'; _biBank = '';
  document.getElementById('bankStep1').style.display = '';
  document.getElementById('bankStep2').style.display = 'none';
  document.getElementById('bankImportErr').textContent = '';
  document.getElementById('bankFileInput').value = '';
  document.getElementById('bankFilter-all').classList.add('active');
  document.getElementById('bankFilter-expense').classList.remove('active');
  document.getElementById('bankFilter-income').classList.remove('active');
  const modal = document.getElementById('bankImportModal');
  modal.classList.add('open');
  if (typeof trapFocus === 'function') trapFocus(modal);
  const dz = document.getElementById('bankDropZone');
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('dragging'); };
  dz.ondragleave = () => dz.classList.remove('dragging');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('dragging'); _handleBankFile(e.dataTransfer.files[0]); };
}

function closeBankImport() {
  const modal = document.getElementById('bankImportModal');
  if (typeof releaseTrap === 'function') releaseTrap(modal);
  modal.classList.remove('open');
}

function handleBankFileFromEl() {
  const f = document.getElementById('bankFileInput');
  if (f && f.files && f.files[0]) _handleBankFile(f.files[0]);
}

function bankResetUpload() {
  document.getElementById('bankStep1').style.display = '';
  document.getElementById('bankStep2').style.display = 'none';
  document.getElementById('bankFileInput').value = '';
}

async function _handleBankFile(file) {
  if (!file) return;
  const errEl = document.getElementById('bankImportErr');
  errEl.textContent = '';
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    // XLSX/XLS via a CDN dynamic import cannot be given an SRI hash (audit H-07).
    // Prompt the user to export as CSV instead — all major banks support CSV export.
    errEl.textContent = 'Excel files (.xlsx/.xls) are not supported directly. Please export your statement as CSV from your bank\'s website and re-upload.';
  } else if (ext === 'ofx' || ext === 'qfx') {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const text = e.target.result;
        const parsed = _parseOFX(text);
        _biBank = 'OFX / QFX';
        _biTxns = _buildTxns(parsed, null);
        if (!_biTxns.length) { errEl.textContent = 'No transactions could be read from this file.'; return; }
        _renderBankReview();
      } catch (err) {
        errEl.textContent = 'Could not parse file — try a different export format.';
        console.error('[bank-import]', err);
      }
    };
    reader.readAsText(file);
  } else {
    // CSV (and OFX detected by content)
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const text = e.target.result;
        if (text.includes('<OFX>') || text.includes('<STMTTRN>')) {
          const parsed = _parseOFX(text);
          _biBank = 'OFX / QFX';
          _biTxns = _buildTxns(parsed, null);
          if (!_biTxns.length) { errEl.textContent = 'No transactions could be read from this file.'; return; }
          _renderBankReview();
        } else {
          await _parseCsvWithPapa(text, errEl);
        }
      } catch (err) {
        errEl.textContent = 'Could not parse file — try a different export format.';
        console.error('[bank-import]', err);
      }
    };
    reader.readAsText(file);
  }
}

// ── Duplicate detection ───────────────────────────────────────────────────────
function _dupKey(dateStr, amount, name) {
  return (dateStr || '') + '|' + Math.round((amount || 0) * 100) + '|' + (name || '').toLowerCase().trim();
}

function _buildExistingKeys() {
  // Note (A2): matches previously-imported items only (note: 'Imported: DATE').
  // Manual entries have no stored date field and cannot be matched here.
  const keys = new Set();
  if (typeof S === 'undefined' || !S || !S.months) return keys;
  Object.values(S.months).forEach(function(m) {
    if (!m || !m.weeks) return;
    m.weeks.forEach(function(w) {
      if (!w || !w.items) return;
      w.items.forEach(function(i) {
        const mm = (i.note || '').match(/^Imported:\s*(.+)$/);
        if (mm) keys.add(_dupKey(mm[1].trim(), i.amount, i.name));
      });
    });
  });
  return keys;
}

// ── Month routing ─────────────────────────────────────────────────────────────
function _routeToMonth(dateStr) {
  // Derive "Mon YYYY" key from dateStr; fallback to CMK if parse fails.
  // Does NOT create the month entry — creation happens inside executeBankImport.
  if (!dateStr) return (typeof CMK !== 'undefined' ? CMK : '');
  var m = dateStr.match(/(\d+)[\/\-](\d+)[\/\-](\d+)/);
  if (!m) return (typeof CMK !== 'undefined' ? CMK : '');
  var p = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  var yr, mo; // mo is 0-based
  if (p[0] > 31) { yr = p[0]; mo = p[1] - 1; }       // YYYY-MM-DD
  else if (p[2] > 31) { mo = p[0] - 1; yr = p[2]; }   // MM/DD/YYYY
  else { mo = p[0] - 1; yr = p[2]; }                   // assume MM/DD/YYYY
  if (isNaN(yr) || isNaN(mo) || mo < 0 || mo > 11) return (typeof CMK !== 'undefined' ? CMK : '');
  var key = (typeof MS !== 'undefined' ? MS[mo] : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo]) + ' ' + yr;
  if (key === (typeof CMK !== 'undefined' ? CMK : '')) return CMK;
  if (typeof S !== 'undefined' && S && S.months && S.months[key]) return key;
  return key; // new month; entry created in executeBankImport
}

// ── Review rendering ──────────────────────────────────────────────────────────
function _catOptions() {
  const base = typeof CAT_ALL !== 'undefined'
    ? CAT_ALL.map(c => `<option value="${c.cls}">${c.lbl}</option>`).join('')
    : '<option value="cat-other">Other</option>';
  const custom = (typeof S !== 'undefined' && S && S.customCategories)
    ? S.customCategories.map(c => `<option value="cat-custom-${c.id}">${c.name}</option>`).join('')
    : '';
  return base + custom;
}

function _weekOptions() {
  var labels = ['Wk 1 (1–7)', 'Wk 2 (8–14)', 'Wk 3 (15–21)', 'Wk 4 (22+)'];
  return labels.map((lbl, i) => `<option value="${i}">${lbl}</option>`).join('');
}

function _monthOptions() {
  if (typeof S === 'undefined' || !S) return '';
  return Object.keys(S.months).map(k => `<option value="${k}"${k===CMK?' selected':''}>${k}</option>`).join('');
}

function _renderBankReview() {
  document.getElementById('bankStep1').style.display = 'none';
  document.getElementById('bankStep2').style.display = '';
  // Badge
  const badge = document.getElementById('bankDetectedBadge');
  badge.textContent = '✓ ' + _biBank;
  badge.className = 'bank-detected-badge';

  // Duplicate detection (D-13): flag rows matching previously-imported items
  const existingKeys = _buildExistingKeys();
  _biTxns.forEach(function(t) {
    const key = _dupKey(t.date || '', t.amt, t.name);
    t._isDup = existingKeys.has(key);
    if (t._isDup) t.checked = false;
  });

  // Filter counts
  const visible = _biTxns.filter(t => _biFilter === 'all' || t.type === _biFilter);
  document.getElementById('bankTxnCount').textContent = _biTxns.length + ' transaction' + (_biTxns.length !== 1 ? 's' : '') + ' found';

  // Date-range conflict banner (D-14)
  const bankReviewWrap = document.getElementById('bankReviewWrap');
  var existingBanner = document.getElementById('bankDateRangeBanner');
  if (existingBanner) existingBanner.parentNode.removeChild(existingBanner);
  if (typeof S !== 'undefined' && S && S.months) {
    var coveredMonths = new Set();
    _biTxns.forEach(function(t) { if (t.date) coveredMonths.add(_routeToMonth(t.date)); });
    var overlapping = Array.from(coveredMonths).filter(function(k) { return k && S.months[k]; });
    if (overlapping.length) {
      var dateBanner = document.createElement('div');
      dateBanner.id = 'bankDateRangeBanner';
      dateBanner.style.cssText = 'background:var(--warn-light,#fff3cd);border:1px solid var(--warn,#ffc107);border-radius:6px;padding:8px 12px;font-size:12px;margin-bottom:8px;';
      dateBanner.textContent = 'This file covers ' + overlapping.join(', ') + ' which already has data. Review carefully.';
      document.getElementById('bankStep2').insertBefore(dateBanner, bankReviewWrap);
    }
  }

  // Month routing banner (D-16)
  var existingRouteBanner = document.getElementById('bankRouteBanner');
  if (existingRouteBanner) existingRouteBanner.parentNode.removeChild(existingRouteBanner);
  var routeTargets = {};
  _biTxns.filter(function(t) { return t.type === 'expense'; }).forEach(function(t) {
    var k = _routeToMonth(t.date);
    routeTargets[k] = (routeTargets[k] || 0) + 1;
  });
  var routeKeys = Object.keys(routeTargets);
  if (routeKeys.length) {
    var routeBanner = document.createElement('div');
    routeBanner.id = 'bankRouteBanner';
    routeBanner.style.cssText = 'font-size:12px;margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
    var dominant = routeKeys.sort(function(a,b){return routeTargets[b]-routeTargets[a];})[0];
    var routeCount = _biTxns.filter(function(t){return t.type==='expense';}).length;
    var routeLabel = routeCount + ' transaction' + (routeCount !== 1 ? 's' : '') + ' will go to ' + dominant + '. Override →';
    var routeText = document.createElement('span');
    routeText.textContent = routeLabel;
    var routeSelect = document.createElement('select');
    routeSelect.id = 'bankRouteOverride';
    routeSelect.className = 'fi';
    routeSelect.style.cssText = 'width:auto;padding:4px 8px;font-size:12px;';
    var moKeys = (typeof S !== 'undefined' && S && S.months) ? Object.keys(S.months) : [];
    routeSelect.innerHTML = '<option value="">Auto (by date)</option>' + moKeys.map(function(k){return '<option value="'+k.replace(/"/g,'&quot;')+'">'+k.replace(/</g,'&lt;')+'</option>';}).join('');
    routeBanner.appendChild(routeText);
    routeBanner.appendChild(routeSelect);
    document.getElementById('bankStep2').insertBefore(routeBanner, bankReviewWrap);
  }

  // Table
  const catOpts = _catOptions();
  const wkOpts = _weekOptions();
  const moOpts = _monthOptions();
  const rows = visible.map(t => {
    const rowClass = (t._isDup ? 'bi-dup-row ' : '') + (t.checked ? 'bi-row-checked' : 'bi-row-unchecked');
    const dupBadge = t._isDup ? '<span class="bi-dup-badge">Possible duplicate</span>' : '';
    return `
    <tr data-id="${t._id}" class="${rowClass}">
      <td><input type="checkbox" class="bi-chk" data-id="${t._id}" ${t.checked ? 'checked' : ''} data-action="bankToggleTxn" data-arg="${t._id}"></td>
      <td style="white-space:nowrap;font-size:11px;color:var(--text-muted);">${t.date || '—'}</td>
      <td><input class="bi-name-input" type="text" value="${typeof esc==='function'?esc(t.name):t.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}" data-id="${t._id}" data-action="bankEditName" data-arg="${t._id}" style="width:100%;min-width:120px;max-width:220px;">${dupBadge}</td>
      <td style="text-align:right;font-family:'Instrument Serif',serif;white-space:nowrap;">${typeof fmt === 'function' ? fmt(t.amt) : '$'+t.amt.toFixed(2)}</td>
      <td><select class="bi-sel" data-id="${t._id}" data-action="bankEditCat" data-arg="${t._id}">${catOpts.replace(`value="${t.category}"`, `value="${t.category}" selected`)}</select></td>
      <td><select class="bi-sel" data-id="${t._id}" data-action="bankEditType" data-arg="${t._id}">
        <option value="expense"${t.type==='expense'?' selected':''}>📤 Expense</option>
        <option value="income"${t.type==='income'?' selected':''}>📥 Income</option>
      </select></td>
      <td class="bi-week-cell" style="${t.type==='income'?'display:none':''}">
        <select class="bi-sel bi-wk-sel" data-id="${t._id}" data-action="bankEditWeek" data-arg="${t._id}">${wkOpts.replace(`value="${t.week}"`, `value="${t.week}" selected`)}</select>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('bankReviewTable').innerHTML = `
    <thead><tr>
      <th style="width:28px;"></th>
      <th>Date</th>
      <th>Description</th>
      <th style="text-align:right;">Amount</th>
      <th>Category</th>
      <th>Type</th>
      <th>Week</th>
    </tr></thead>
    <tbody>${rows}</tbody>`;
  // Month selector (legacy — kept for non-routed import fallback)
  if (moOpts && !document.getElementById('bankMonthSel')) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px;';
    wrap.innerHTML = `<label style="font-weight:600;color:var(--text-muted);text-transform:uppercase;font-size:10px;letter-spacing:.5px;">Import into month:</label><select id="bankMonthSel" class="fi" style="width:auto;padding:5px 10px;font-size:12px;">${moOpts}</select>`;
    document.getElementById('bankStep2').insertBefore(wrap, bankReviewWrap);
  }
  _updateBankCount();
}

function _updateBankCount() {
  const sel = _biTxns.filter(t => t.checked).length;
  const el = document.getElementById('bankImportSelectedCount');
  if (el) el.textContent = sel;
}

// ── User interaction handlers ─────────────────────────────────────────────────
function bankSetFilter(filter) {
  _biFilter = filter;
  ['all','expense','income'].forEach(f => {
    const btn = document.getElementById('bankFilter-' + f);
    if (btn) btn.classList.toggle('active', f === filter);
  });
  if (_biTxns.length) _renderBankReview();
}

function bankSelectAll(val) {
  const visible = _biTxns.filter(t => _biFilter === 'all' || t.type === _biFilter);
  visible.forEach(t => t.checked = !!parseInt(val));
  _renderBankReview();
}

function bankToggleTxn(id) {
  const t = _biTxns.find(x => x._id === id);
  if (t) { t.checked = !t.checked; }
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (row) row.className = t && t.checked ? 'bi-row-checked' : 'bi-row-unchecked';
  _updateBankCount();
}

function bankEditName(id) {
  const inp = document.querySelector(`.bi-name-input[data-id="${id}"]`);
  const t = _biTxns.find(x => x._id === id);
  if (t && inp) t.name = inp.value;
}

function bankEditCat(id) {
  const sel = document.querySelector(`select.bi-sel[data-action="bankEditCat"][data-arg="${id}"]`);
  const t = _biTxns.find(x => x._id === id);
  if (t && sel) t.category = sel.value;
}

function bankEditType(id) {
  const sel = document.querySelector(`select.bi-sel[data-action="bankEditType"][data-arg="${id}"]`);
  const t = _biTxns.find(x => x._id === id);
  if (!t || !sel) return;
  t.type = sel.value;
  // Show/hide week cell
  const row = document.querySelector(`tr[data-id="${id}"]`);
  const wkCell = row && row.querySelector('.bi-week-cell');
  if (wkCell) wkCell.style.display = t.type === 'income' ? 'none' : '';
}

function bankEditWeek(id) {
  const sel = document.querySelector(`select.bi-wk-sel[data-arg="${id}"]`);
  const t = _biTxns.find(x => x._id === id);
  if (t && sel) t.week = parseInt(sel.value);
}

// ── Execute import ────────────────────────────────────────────────────────────
function executeBankImport() {
  const selected = _biTxns.filter(t => t.checked);
  if (!selected.length) { if (typeof showToast === 'function') showToast('Select at least one transaction', 'warn-t'); return; }
  // Month routing override: check bankRouteOverride select first, then legacy bankMonthSel
  const routeOverrideEl = document.getElementById('bankRouteOverride');
  const routeOverride = routeOverrideEl && routeOverrideEl.value ? routeOverrideEl.value : null;
  const legacyMonth = (document.getElementById('bankMonthSel') && document.getElementById('bankMonthSel').value) || null;
  let expCount = 0, incCount = 0;
  selected.forEach(t => {
    if (t.type === 'expense') {
      // Route by date (D-15): override → legacy → _routeToMonth(date) → CMK
      const targetKey = routeOverride || legacyMonth || _routeToMonth(t.date) || CMK;
      if (!S.months[targetKey]) {
        S.months[targetKey] = { weeks: [{items:[]},{items:[]},{items:[]},{items:[]}], revenue: [] };
      }
      const wk = Math.min(3, Math.max(0, t.week));
      S.months[targetKey].weeks[wk].items.push({
        name: t.name.substring(0, 60),
        amount: Math.round(t.amt * 100) / 100,
        paid: false,
        dueDay: t.day || null,
        note: 'Imported: ' + (t.date || ''),
        receipt: null
      });
      expCount++;
    } else {
      const targetMonth = routeOverride || legacyMonth || CMK;
      if (!S.months[targetMonth]) {
        S.months[targetMonth] = { weeks: [{items:[]},{items:[]},{items:[]},{items:[]}], revenue: [] };
      }
      S.months[targetMonth].revenue.push({
        name: t.name.substring(0, 60),
        amount: Math.round(t.amt * 100) / 100,
        received: false
      });
      incCount++;
    }
  });
  if (typeof persist === 'function') persist();  // single persist after all pushes
  closeBankImport();
  if (typeof renderSection === 'function') {
    if (expCount && !incCount) renderSection('expenses');
    else if (incCount && !expCount) renderSection('revenue');
    else renderSection(typeof getTab === 'function' ? getTab() : 'dashboard');
  }
  if (typeof updateHealth === 'function') updateHealth();
  const parts = [];
  if (expCount) parts.push(expCount + ' expense' + (expCount !== 1 ? 's' : ''));
  if (incCount) parts.push(incCount + ' income item' + (incCount !== 1 ? 's' : ''));
  if (typeof showToast === 'function') showToast('✓ Imported ' + parts.join(' + '));
}
