/* FincWin — shared marketing script (CSP-safe, served from 'self').
   Handles: nav scroll border, mobile hamburger menu, copyright year.
   Loaded with `defer` so the DOM is ready. Idempotent — safe to load twice. */
(function () {
  'use strict';

  // Auth-aware nav/footer link routing.
  // Marketing pages default the "App" / "Open app" links to /signin.
  // If the user is already signed in, upgrade those links to /app so they
  // land directly in the dashboard instead of seeing the sign-in screen.
  // Elements opt-in via data-auth-href="/app" on the <a> tag.
  var isAuthed = !!(localStorage.getItem('fw_signed_in') || localStorage.getItem('fw_license_key'));
  if (isAuthed) {
    document.documentElement.classList.add('fw-authed');
    document.querySelectorAll('a[data-auth-href]').forEach(function (a) {
      a.href = a.getAttribute('data-auth-href');
    });
  }

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

  // ── Skip-to-content link (a11y) — injected so no per-page markup is needed.
  // Self-styled (JS-created <style>) so it works even on pages without mkt.css.
  (function () {
    if (document.querySelector('.skip-link')) return;
    var main = document.querySelector('main, [role="main"]') ||
               document.querySelector('section, .hero, header + section');
    if (!main) return;
    if (!main.id) main.id = 'main-content';
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');

    if (!document.getElementById('mkt-skip-styles')) {
      var st = document.createElement('style');
      st.id = 'mkt-skip-styles';
      st.textContent =
        '.skip-link{position:absolute;left:8px;top:-48px;z-index:2147483001;' +
        'background:#5a6e3f;color:#fff;padding:10px 16px;border-radius:8px;' +
        'font:600 14px/1 "Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
        'text-decoration:none;transition:top .15s ease;}' +
        '.skip-link:focus{top:8px;outline:2px solid #fff;outline-offset:2px;}';
      document.head.appendChild(st);
    }
    var a = document.createElement('a');
    a.className = 'skip-link';
    a.href = '#' + main.id;
    a.textContent = 'Skip to content';
    document.body.insertBefore(a, document.body.firstChild);
  })();

  // ── Blog category filter (blog/index.html only)
  (function () {
    var catFilter = document.getElementById('catFilter');
    if (!catFilter) return;
    function filterCat(cat) {
      catFilter.querySelectorAll('[data-cat]').forEach(function (b) {
        b.classList.toggle('active', b.dataset.cat === cat);
      });
      document.querySelectorAll('.blog-card').forEach(function (c) {
        c.style.display = (cat === 'all' || c.dataset.cat === cat) ? '' : 'none';
      });
    }
    catFilter.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cat]');
      if (btn) filterCat(btn.dataset.cat);
    });
    var qCat = (new URLSearchParams(location.search)).get('cat');
    if (qCat && ['budgeting','debt','savings','tools','mindset'].indexOf(qCat) > -1) {
      filterCat(qCat);
    }
  })();

  // ── Cookie settings buttons (footer + cookie-policy page)
  document.querySelectorAll('.footer-cookie-btn, [data-cookie-settings]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (window.FincWinConsent) FincWinConsent.open();
    });
  });

  // ── Scroll reveal — fade/slide `.reveal` elements in as they enter the viewport.
  // Centralised here (CSP-safe, served from 'self') to replace the per-page inline
  // <script> blocks that the strict CSP (script-src 'self') was blocking — those
  // blocks left every `.reveal` section stuck at opacity:0. Idempotent.
  (function () {
    var reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;
    if (!('IntersectionObserver' in window)) {
      reveals.forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  })();

  // ── Active nav state (a11y) — mark the current page's nav link.
  // Normalises .html / clean-URL / index / trailing-slash so it works both
  // locally (file paths) and on the deployed clean-URL site.
  (function () {
    var norm = function (p) {
      return (p || '').replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/$/, '') || '/';
    };
    var here = norm(location.pathname);
    document.querySelectorAll('nav a').forEach(function (a) {
      if (a.classList.contains('nav-cta') || a.classList.contains('nav-logo')) return;
      if (norm(a.pathname) === here) a.setAttribute('aria-current', 'page');
    });
  })();
})();
