// === tour.js ===
// 5-step onboarding spotlight tour. Fires once after wizard completion.
// Gated by localStorage flag 'fincwin_tour_done'.
// Replayable via replayTour() called from Settings.

(function(){

var TOUR_FLAG = 'fincwin_tour_done';

var TOUR_STEPS = [
  {
    tab: 'dashboard',
    target: '.dash-kpi-row',
    fallback: '#section-dashboard',
    title: 'Your money at a glance',
    body: 'These live tiles show your income, spending, net cash flow, and debt ratio for the month. They update every time you add data.',
    position: 'bottom'
  },
  {
    tab: 'expenses',
    target: '.envelope-row, .env-grid, #section-expenses .card',
    fallback: '#section-expenses',
    title: 'Track your spending',
    body: 'Add expenses here and they automatically sort into category buckets — Food, Transport, Bills, and more. Tap any bucket to set a spend limit.',
    position: 'bottom'
  },
  {
    tab: 'loans',
    target: '#paydownChart, .loan-strat-row, #section-loans .card',
    fallback: '#section-loans',
    title: 'Pay off debt faster',
    body: 'Add your loans and compare payoff plans. Avalanche (highest interest first) saves the most money. Snowball (smallest balance first) builds momentum.',
    position: 'top'
  },
  {
    tab: 'analytics',
    target: '#coachSection',
    fallback: '#section-analytics',
    title: 'AI Financial Coach',
    body: 'Add an AI key in Settings and ask questions like "Am I saving enough?" or "Which debt should I pay first?" — it reads your actual numbers.',
    position: 'bottom'
  },
  {
    tab: 'settings',
    target: '#section-settings',
    fallback: '#section-settings',
    title: 'You\'re all set!',
    body: 'Change your theme, set a PIN lock, connect cloud sync, and tap Install App to save FincWin to your home screen for offline access.',
    position: 'bottom',
    isLast: true
  }
];

var _tourStep = 0;
var _tourActive = false;

function startTour() {
  if (localStorage.getItem(TOUR_FLAG) === '1') return;
  _tourStep = 0;
  _tourActive = true;
  _renderStep();
}

function replayTour() {
  localStorage.removeItem(TOUR_FLAG);
  _tourStep = 0;
  _tourActive = true;
  _clearOverlay();
  // Navigate to the first step's tab and reset scroll BEFORE rendering,
  // so getBoundingClientRect returns correct values after the repaint.
  if (typeof switchTab === 'function') {
    switchTab('dashboard', document.getElementById('tab-dashboard'));
  }
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  // Use a two-frame delay to let the tab switch and scroll settle in the browser.
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      setTimeout(function() { _renderStep(true); }, 80);
    });
  });
}

function skipTour() {
  localStorage.setItem(TOUR_FLAG, '1');
  _tourActive = false;
  _clearOverlay();
}

function _advanceTour() {
  _tourStep++;
  if (_tourStep >= TOUR_STEPS.length) {
    skipTour();
    return;
  }
  _renderStep();
}

function _renderStep(skipSwitch) {
  _clearOverlay();
  var step = TOUR_STEPS[_tourStep];

  if (!skipSwitch && typeof switchTab === 'function') {
    switchTab(step.tab, document.getElementById('tab-' + step.tab));
  }

  // 350ms — enough for switchTab's slide animation (180ms) + renderSection + layout pass
  setTimeout(function() {
    var targetEl = _resolveTarget(step);
    if (!targetEl) {
      _tourStep++;
      if (_tourStep < TOUR_STEPS.length) _renderStep();
      else skipTour();
      return;
    }
    _buildOverlay(step, targetEl);
  }, 350);
}

function _resolveTarget(step) {
  var selectors = step.target.split(',');
  for (var i = 0; i < selectors.length; i++) {
    var el = document.querySelector(selectors[i].trim());
    if (el) return el;
  }
  if (step.fallback) return document.querySelector(step.fallback);
  return null;
}

function _buildOverlay(step, targetEl) {
  targetEl.scrollIntoView({ behavior: 'instant', block: 'center' });

  var overlay = document.createElement('div');
  overlay.id = 'tourOverlay';

  // Backdrop — dims the page behind the spotlight
  var backdrop = document.createElement('div');
  backdrop.id = 'tourBackdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  overlay.appendChild(backdrop);

  // Spotlight ring — outlines the highlighted element
  var ring = document.createElement('div');
  ring.id = 'tourRing';
  ring.setAttribute('aria-hidden', 'true');
  overlay.appendChild(ring);

  // Tooltip card — built without inline onclick for reliability
  var card = document.createElement('div');
  card.id = 'tourCard';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'false');
  card.setAttribute('aria-labelledby', 'tourCardTitle');
  card.setAttribute('aria-describedby', 'tourCardBody');

  var progress = (_tourStep + 1) + ' / ' + TOUR_STEPS.length;

  // Build step dots
  var dots = '';
  for (var d = 0; d < TOUR_STEPS.length; d++) {
    dots += '<span class="tour-dot' + (d === _tourStep ? ' active' : '') + '"></span>';
  }

  card.innerHTML =
    '<div class="tour-header">' +
      '<div class="tour-progress">' + dots + '</div>' +
      '<div class="tour-step-label">Step ' + (_tourStep + 1) + ' of ' + TOUR_STEPS.length + '</div>' +
    '</div>' +
    '<div class="tour-title" id="tourCardTitle">' + _esc(step.title) + '</div>' +
    '<div class="tour-body" id="tourCardBody">' + _esc(step.body) + '</div>' +
    '<div class="tour-actions">' +
      '<button class="tour-skip-btn" id="tourSkipBtn">Skip tour</button>' +
      '<button class="tour-next-btn" id="tourNextBtn">' +
        (step.isLast ? icon('check') + ' Done' : 'Next &rarr;') +
      '</button>' +
    '</div>';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Wire buttons via addEventListener — not inline onclick (more reliable)
  var nextBtn = document.getElementById('tourNextBtn');
  var skipBtn = document.getElementById('tourSkipBtn');
  if (nextBtn) nextBtn.addEventListener('click', function(e) { e.stopPropagation(); _advanceTour(); });
  if (skipBtn) skipBtn.addEventListener('click', function(e) { e.stopPropagation(); skipTour(); });

  // Two-frame wait: first frame lets scrollIntoView commit, second measures layout
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      _positionRingAndCard(targetEl, card, ring, step.position);
      if (nextBtn) nextBtn.focus();
    });
  });

  // Keyboard: Escape = skip, Enter/Space on focused next btn = advance
  overlay._keyHandler = function(e) {
    if (e.key === 'Escape') { e.preventDefault(); skipTour(); }
    else if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.id === 'tourNextBtn') {
      e.preventDefault(); _advanceTour();
    }
  };
  document.addEventListener('keydown', overlay._keyHandler);
}

function _positionRingAndCard(targetEl, card, ring, position) {
  var rect = targetEl.getBoundingClientRect();
  var pad  = 8;
  var vw   = window.innerWidth;
  var vh   = window.innerHeight;

  // Spotlight ring (position:fixed = viewport-relative)
  ring.style.top    = (rect.top  - pad) + 'px';
  ring.style.left   = (rect.left - pad) + 'px';
  ring.style.width  = (rect.width  + pad * 2) + 'px';
  ring.style.height = (rect.height + pad * 2) + 'px';

  // Card width — clamp to viewport
  var cardW = Math.min(320, vw - 32);
  card.style.width = cardW + 'px';

  // Horizontal: centre on target, clamp to viewport edges
  var idealLeft = rect.left + rect.width / 2 - cardW / 2;
  var leftPos   = Math.max(12, Math.min(idealLeft, vw - cardW - 12));
  card.style.left = leftPos + 'px';

  // Vertical: prefer requested position, flip if no room
  var gapFromTarget = pad + 12;
  var estCardH = 200;

  var topPos;
  if (position === 'bottom') {
    topPos = rect.bottom + gapFromTarget;
    if (topPos + estCardH > vh - 12) {
      topPos = Math.max(12, rect.top - estCardH - gapFromTarget);
    }
  } else {
    topPos = rect.top - estCardH - gapFromTarget;
    if (topPos < 12) {
      topPos = rect.bottom + gapFromTarget;
    }
  }
  card.style.top = Math.max(12, topPos) + 'px';
}

function _clearOverlay() {
  var old = document.getElementById('tourOverlay');
  if (old) {
    if (old._keyHandler) document.removeEventListener('keydown', old._keyHandler);
    old.remove();
  }
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.startTour  = startTour;
window.replayTour = replayTour;
window.skipTour   = skipTour;
// Legacy aliases kept in case other code calls them
window._tourNext  = _advanceTour;
window._tourSkip  = skipTour;

})();
