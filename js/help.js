/* FincWin — help page: sidebar scroll-spy (CSP-safe, served from 'self').
   Highlights the sidebar link for whichever .help-section is in view.
   Replaces the page's former inline <script>, which the strict CSP
   (script-src 'self') blocked. Loaded with `defer` so the DOM is ready.
   The nav scroll-border and the copyright year are handled by js/mkt.js. */
(function () {
  'use strict';
  var sections = document.querySelectorAll('.help-section[id]');
  var links = document.querySelectorAll('.sidebar a');
  if (!sections.length || !('IntersectionObserver' in window)) return;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (l) { l.classList.remove('active'); });
      var active = document.querySelector('.sidebar a[href="#' + e.target.id + '"]');
      if (active) { active.classList.add('active'); active.scrollIntoView({ block: 'nearest' }); }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  sections.forEach(function (s) { observer.observe(s); });
})();
