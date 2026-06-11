/* FincWin — landing page script (external, CSP-safe, served from 'self').
   Billing toggle + smooth-scroll anchors. Loaded with `defer`.
   Nav scroll border + copyright year are handled by /js/mkt.js. */
(function () {
  'use strict';

  // LemonSqueezy checkout URLs — replace with real variant URLs before going live
  var LS_PRO_ANNUAL  = 'https://REPLACE_WITH_LS_PRO_ANNUAL_CHECKOUT_URL';
  var LS_PRO_MONTHLY = 'https://REPLACE_WITH_LS_PRO_MONTHLY_CHECKOUT_URL';

  // Billing toggle
  function setBilling(type) {
    var isAnnual = type === 'annual';
    var a = document.getElementById('btnAnnual');
    var m = document.getElementById('btnMonthly');
    if (a) a.classList.toggle('active', isAnnual);
    if (m) m.classList.toggle('active', !isAnnual);
    var price   = document.getElementById('proPrice');
    var period  = document.getElementById('proPeriod');
    var alt     = document.getElementById('proAltPrice');
    var cta     = document.getElementById('proCtaBtn');
    if (price)  price.textContent  = isAnnual ? '$39' : '$4.99';
    if (period) period.textContent = isAnnual ? '/year' : '/month';
    if (alt)    alt.textContent    = isAnnual ? 'Or $4.99/month.' : 'Or $39/year — save 35%.';
    if (cta) {
      cta.textContent = isAnnual ? 'Get Pro — $39/yr' : 'Get Pro — $4.99/mo';
      cta.href        = isAnnual ? LS_PRO_ANNUAL : LS_PRO_MONTHLY;
    }
  }
  var btnA = document.getElementById('btnAnnual');
  var btnM = document.getElementById('btnMonthly');
  if (btnA) btnA.addEventListener('click', function () { setBilling('annual'); });
  if (btnM) btnM.addEventListener('click', function () { setBilling('monthly'); });

  // Smooth scroll for in-page anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
  });
})();
