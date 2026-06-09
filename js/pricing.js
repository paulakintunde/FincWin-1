/* FincWin — pricing page script (external, CSP-safe, served from 'self').
   Billing toggle, FAQ accordion, and scroll reveal. Loaded with `defer`.
   Nav scroll border + copyright year are handled by /js/mkt.js. */
(function () {
  'use strict';

  // Billing toggle — updates Pro card price, tagline, period, and CTA
  document.querySelectorAll('.btog-opt').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.btog-opt').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      var annual   = btn.dataset.period === 'annual';
      var amountEl = document.getElementById('pro-amount');
      var tagEl    = document.getElementById('pro-tagline');
      var periodEl = document.getElementById('pro-period');
      var ctaEl    = document.getElementById('pro-cta');
      var saveEl   = document.getElementById('btog-save-pill');

      if (annual) {
        amountEl.innerHTML   = '<sup>$</sup>39';
        tagEl.textContent    = 'Full access, billed annually';
        periodEl.textContent = 'Or $4.99/month. Cancel anytime.';
        ctaEl.textContent    = 'Get Pro — $39/yr';
        saveEl.style.opacity = '1';
      } else {
        amountEl.innerHTML   = '<sup>$</sup>4<span class="price-cents">.99</span>';
        tagEl.textContent    = 'Full access, billed monthly';
        periodEl.textContent = 'Or $39/year — save 35%.';
        ctaEl.textContent    = 'Get Pro — $4.99/mo';
        saveEl.style.opacity = '0';
      }
    });
  });

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item   = btn.closest('.faq-item');
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(function (i) {
        i.classList.remove('open');
        var q = i.querySelector('.faq-question');
        if (q) q.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });

  // Scroll reveal
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  }
})();
