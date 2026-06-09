/* FincWin — features page script (external, CSP-safe, served from 'self').
   Module tab navigation, active-tab-on-scroll, and feature search.
   Loaded with `defer`. Nav scroll border + copyright year handled by /js/mkt.js. */
(function () {
  'use strict';

  function scrollToModule(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  var sections = ['budget','loans','savings','investments','ai','gamification','security','sync','compare'];
  var tabs = document.querySelectorAll('.module-tab');

  // Wire tab clicks (replaces blocked inline onclick handlers)
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      if (tab.dataset.module) scrollToModule(tab.dataset.module);
    });
  });

  function updateActiveTab() {
    var current = '';
    sections.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 160) current = id;
    });
    tabs.forEach(function (tab, i) {
      tab.classList.toggle('active', sections[i] === current);
    });
  }
  window.addEventListener('scroll', updateActiveTab, { passive: true });

  var searchEl = document.getElementById('featureSearch');
  if (searchEl) {
    searchEl.addEventListener('input', function () {
      var q = searchEl.value.toLowerCase().trim();
      document.querySelectorAll('.dir-item').forEach(function (item) {
        item.style.display = (!q || item.textContent.toLowerCase().includes(q)) ? '' : 'none';
      });
      document.querySelectorAll('.feature-item').forEach(function (item) {
        item.style.display = (!q || item.textContent.toLowerCase().includes(q)) ? '' : 'none';
      });
    });
  }
})();
