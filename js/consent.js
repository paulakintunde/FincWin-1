/* FincWin — Cookie consent (GDPR / UK PECR compliant)
   Self-contained: injects its own styles + DOM, stores the choice, and exposes
   a small API for any future analytics/marketing tags to gate on.

   Compliance notes:
   • Non-essential cookies (analytics, marketing) default to OFF — no pre-ticking.
   • "Reject All" is presented as prominently as "Accept All" on the first layer.
   • Granular control via "Manage" → per-category toggles.
   • Choice persists for 180 days, then we re-ask; bumping VERSION re-asks sooner.

   Public API (window.FincWinConsent):
     .get()              → {v, necessary, analytics, marketing, ts} | null (no choice yet)
     .allows('analytics')→ boolean
     .open()             → re-open the manager (e.g. from a "Cookie settings" link)
     .save({analytics, marketing})
   Also: dispatches `fincwin:consent` on document and sets window.__fwConsent. */
(function () {
  'use strict';

  var VERSION = 1;
  var KEY = 'fw_cookie_consent';
  var EXPIRY_DAYS = 180;
  // This script's own resolved URL — used to locate the site root reliably.
  var SELF_SRC = (document.currentScript && document.currentScript.src) || '';

  // ── Analytics (GA4) ──────────────────────────────────────────────────────────
  // Loads Google Analytics ONLY after the visitor grants analytics consent
  // (privacy-first / PECR-compliant: no tag fires until opt-in).
  // To enable: set your GA4 Measurement ID below, or define `window.FW_GA_ID`
  // before this script loads. Leave empty to disable analytics entirely — the
  // banner still works and simply records the choice with nothing to gate.
  var GA_MEASUREMENT_ID = (typeof window.FW_GA_ID === 'string' && window.FW_GA_ID) || '';
  var gaLoaded = false;
  function loadAnalytics() {
    if (gaLoaded || !GA_MEASUREMENT_ID) return;
    gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_MEASUREMENT_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
  }

  // ── Storage ────────────────────────────────────────────────────────────────
  function read() {
    try {
      var r = JSON.parse(localStorage.getItem(KEY));
      if (!r || r.v !== VERSION) return null;
      if (r.ts && (Date.now() - new Date(r.ts).getTime()) / 864e5 > EXPIRY_DAYS) return null;
      return r;
    } catch (e) { return null; }
  }

  function persist(prefs) {
    var rec = {
      v: VERSION,
      necessary: true,
      analytics: !!prefs.analytics,
      marketing: !!prefs.marketing,
      ts: new Date().toISOString()
    };
    try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch (e) {}
    // Mirror to a cookie so edge/server code could read it if ever needed.
    try {
      var v = 'n' + (rec.analytics ? 'a' : '') + (rec.marketing ? 'm' : '');
      document.cookie = 'fw_consent=' + v + '; Max-Age=' + (EXPIRY_DAYS * 86400) + '; Path=/; SameSite=Lax';
    } catch (e) {}
    window.__fwConsent = rec;
    if (rec.analytics) loadAnalytics();
    try { document.dispatchEvent(new CustomEvent('fincwin:consent', { detail: rec })); } catch (e) {}
    return rec;
  }

  // ── Link to the cookie policy, correct at any depth and on file:// ─────────
  // Derive it from THIS script's own URL (.../js/consent.js → site root), which
  // the browser has already resolved to an absolute URL. Works on the live
  // domain, in subdirectories, and when opened locally via file://.
  function policyHref() {
    var src = SELF_SRC.replace(/[?#].*$/, '');
    if (/js\/consent\.js$/.test(src)) return src.replace(/js\/consent\.js$/, 'cookie-policy.html');
    return 'cookie-policy.html'; // fallback: same directory
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('fw-consent-styles')) return;
    var css = '' +
      '.fw-consent{position:fixed;left:20px;bottom:20px;z-index:2147483000;width:min(420px,calc(100vw - 40px));font-family:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}' +
      '.fw-consent[hidden]{display:none;}' +
      '.fw-consent-card{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.18);padding:22px 22px 18px;animation:fwConsentIn .35s cubic-bezier(.16,1,.3,1);}' +
      '@keyframes fwConsentIn{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}' +
      '.fw-consent-head{display:flex;gap:14px;align-items:flex-start;}' +
      '.fw-consent-ic{flex:none;width:40px;height:40px;border-radius:11px;background:#eef3e9;display:flex;align-items:center;justify-content:center;color:#3d4d2b;}' +
      '.fw-consent-ic svg{width:22px;height:22px;}' +
      '.fw-consent-title{font-size:16px;font-weight:600;color:#111;margin:2px 0 6px;}' +
      '.fw-consent-text{font-size:13px;line-height:1.55;color:#5b6470;margin:0 0 6px;}' +
      '.fw-consent-policy{font-size:13px;font-weight:500;color:#5a6e3f;text-decoration:underline;text-underline-offset:2px;}' +
      '.fw-consent-policy:hover{color:#3d4d2b;}' +
      '.fw-consent-actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;}' +
      '.fw-consent-actions .fw-btn{flex:1 1 auto;}' +
      '.fw-btn{appearance:none;border:1.5px solid transparent;border-radius:50px;padding:11px 18px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:background .18s,border-color .18s,color .18s;white-space:nowrap;}' +
      '.fw-btn-primary{background:#5a6e3f;color:#fff;}' +
      '.fw-btn-primary:hover{background:#3d4d2b;}' +
      '.fw-btn-ghost{background:#fff;color:#1f2937;border-color:rgba(0,0,0,.18);}' +
      '.fw-btn-ghost:hover{border-color:rgba(0,0,0,.45);}' +
      '.fw-consent-prefs{margin-top:18px;border-top:1px solid rgba(0,0,0,.08);padding-top:16px;}' +
      '.fw-consent-prefs[hidden]{display:none;}' +
      '.fw-consent-prefs-label{font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#3d4d2b;margin-bottom:14px;}' +
      '.fw-pref{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid rgba(0,0,0,.05);}' +
      '.fw-pref:last-of-type{border-bottom:none;}' +
      '.fw-pref-name{font-size:13.5px;font-weight:600;color:#111;margin-bottom:2px;}' +
      '.fw-pref-desc{font-size:12px;line-height:1.5;color:#6b7280;max-width:260px;}' +
      '.fw-switch{flex:none;position:relative;display:inline-block;width:42px;height:24px;margin-top:2px;}' +
      '.fw-switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;}' +
      '.fw-slider{position:absolute;inset:0;border-radius:50px;background:#cfd4d9;transition:background .2s;pointer-events:none;}' +
      '.fw-slider::before{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s;}' +
      '.fw-switch input:checked + .fw-slider{background:#5a6e3f;}' +
      '.fw-switch input:checked + .fw-slider::before{transform:translateX(18px);}' +
      '.fw-switch input:focus-visible + .fw-slider{outline:2px solid #5a6e3f;outline-offset:2px;}' +
      '.fw-switch--locked .fw-slider{background:#9bb89f;}' +
      '.fw-switch--locked input{cursor:not-allowed;}' +
      '.fw-consent-actions--save{margin-top:16px;}' +
      '@media (max-width:480px){.fw-consent{left:12px;right:12px;bottom:12px;width:auto;}.fw-consent-card{padding:18px 16px 16px;}.fw-pref-desc{max-width:none;}}';
    var s = document.createElement('style');
    s.id = 'fw-consent-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ── Markup ─────────────────────────────────────────────────────────────────
  var COOKIE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5Z"/><circle cx="8.5" cy="11.5" r="1" fill="currentColor"/><circle cx="13" cy="15.5" r="1" fill="currentColor"/><circle cx="15.5" cy="11" r="1" fill="currentColor"/></svg>';

  var root;

  function build() {
    injectStyles();
    root = document.createElement('div');
    root.className = 'fw-consent';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Cookie consent');
    root.setAttribute('aria-live', 'polite');
    root.innerHTML =
      '<div class="fw-consent-card">' +
        '<div class="fw-consent-head">' +
          '<div class="fw-consent-ic">' + COOKIE_SVG + '</div>' +
          '<div>' +
            '<div class="fw-consent-title">We use cookies</div>' +
            '<p class="fw-consent-text">We use essential cookies to keep the site running. We’d also like to use analytics and marketing cookies to improve your experience.</p>' +
            '<a class="fw-consent-policy" href="' + policyHref() + '">Cookie Policy</a>' +
          '</div>' +
        '</div>' +
        '<div class="fw-consent-actions">' +
          '<button type="button" class="fw-btn fw-btn-primary" data-act="accept">Accept All</button>' +
          '<button type="button" class="fw-btn fw-btn-ghost" data-act="reject">Reject All</button>' +
          '<button type="button" class="fw-btn fw-btn-ghost" data-act="manage" aria-expanded="false" aria-controls="fw-consent-prefs">Manage</button>' +
        '</div>' +
        '<div class="fw-consent-prefs" id="fw-consent-prefs" hidden>' +
          '<div class="fw-consent-prefs-label">Manage Preferences</div>' +
          '<div class="fw-pref">' +
            '<div class="fw-pref-info"><div class="fw-pref-name">Strictly Necessary</div><div class="fw-pref-desc">Essential for the site to function. Cannot be disabled.</div></div>' +
            '<label class="fw-switch fw-switch--locked"><input type="checkbox" checked disabled aria-label="Strictly necessary cookies (always on)"><span class="fw-slider"></span></label>' +
          '</div>' +
          '<div class="fw-pref">' +
            '<div class="fw-pref-info"><div class="fw-pref-name">Analytics</div><div class="fw-pref-desc">Helps us understand how visitors use the site anonymously.</div></div>' +
            '<label class="fw-switch"><input type="checkbox" data-cat="analytics" aria-label="Analytics cookies"><span class="fw-slider"></span></label>' +
          '</div>' +
          '<div class="fw-pref">' +
            '<div class="fw-pref-info"><div class="fw-pref-name">Marketing</div><div class="fw-pref-desc">Used to show relevant ads and measure campaign performance.</div></div>' +
            '<label class="fw-switch"><input type="checkbox" data-cat="marketing" aria-label="Marketing cookies"><span class="fw-slider"></span></label>' +
          '</div>' +
          '<div class="fw-consent-actions fw-consent-actions--save">' +
            '<button type="button" class="fw-btn fw-btn-primary" data-act="save">Save my choices</button>' +
            '<button type="button" class="fw-btn fw-btn-ghost" data-act="reject">Reject All</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    root.addEventListener('click', onClick);
    document.body.appendChild(root);
  }

  // ── Behaviour ──────────────────────────────────────────────────────────────
  function prefsFromToggles() {
    return {
      analytics: !!root.querySelector('input[data-cat="analytics"]').checked,
      marketing: !!root.querySelector('input[data-cat="marketing"]').checked
    };
  }
  function setToggles(p) {
    root.querySelector('input[data-cat="analytics"]').checked = !!p.analytics;
    root.querySelector('input[data-cat="marketing"]').checked = !!p.marketing;
  }
  function showManage(show) {
    var panel = root.querySelector('.fw-consent-prefs');
    var btn = root.querySelector('[data-act="manage"]');
    panel.hidden = !show;
    if (btn) btn.setAttribute('aria-expanded', show ? 'true' : 'false');
  }
  function close() { if (root) root.hidden = true; }

  function onClick(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    if (act === 'manage') { showManage(root.querySelector('.fw-consent-prefs').hidden); return; }
    if (act === 'accept') { persist({ analytics: true, marketing: true }); close(); return; }
    if (act === 'reject') { persist({ analytics: false, marketing: false }); close(); return; }
    if (act === 'save')   { persist(prefsFromToggles()); close(); return; }
  }

  function open() {
    if (!root) build();
    var existing = read();
    setToggles(existing || { analytics: false, marketing: false });
    showManage(true);
    root.hidden = false;
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();  // always present, so `.fw-btn` / re-open controls are styled everywhere
    var existing = read();
    if (existing) {                       // already decided on a previous visit
      window.__fwConsent = existing;
      if (existing.analytics) loadAnalytics();
      return;
    }
    build();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Let any element opt into re-opening the manager: <a data-cookie-settings>…</a>
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-cookie-settings]');
    if (t) { e.preventDefault(); open(); }
  });

  window.FincWinConsent = {
    VERSION: VERSION,
    get: read,
    allows: function (cat) { var r = read(); return cat === 'necessary' ? true : !!(r && r[cat]); },
    open: open,
    save: function (p) { return persist(p || {}); }
  };
})();
