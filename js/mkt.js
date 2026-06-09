/* FincWin — shared marketing script (CSP-safe, served from 'self').
   Handles: nav scroll border, mobile hamburger menu, copyright year.
   Loaded with `defer` so the DOM is ready. Idempotent — safe to load twice. */
(function () {
  'use strict';

  var nav = document.getElementById('mainNav');
  if (nav) {
    // Scroll border
    var onScroll = function () {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Mobile hamburger — injected so no per-page markup is required.
    // Only on pages that load mkt.css (which styles .nav-burger). Bespoke
    // pages with their own inline nav CSS keep their own mobile handling.
    var links = nav.querySelector('.nav-links');
    var usesMkt = !!document.querySelector('link[href*="mkt.css"]');
    if (usesMkt && links && !nav.querySelector('.nav-burger')) {
      var btn = document.createElement('button');
      btn.className = 'nav-burger';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Toggle menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<span></span><span></span><span></span>';
      btn.addEventListener('click', function () {
        var open = nav.classList.toggle('nav-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      nav.insertBefore(btn, links);

      // Close the menu after tapping a link
      links.addEventListener('click', function (e) {
        if (e.target.closest('a')) {
          nav.classList.remove('nav-open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  // Copyright year
  var yr = String(new Date().getFullYear());
  document.querySelectorAll('.copy-year').forEach(function (e) { e.textContent = yr; });
})();
