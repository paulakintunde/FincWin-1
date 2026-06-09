/* FincWin — contact page script (external, CSP-safe, served from 'self').
   Handles contact form submission to /api/contact. Loaded with `defer`.
   Nav scroll border + copyright year handled by /js/mkt.js. */
(function () {
  'use strict';

  var form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = document.getElementById('submitBtn');
    var errEl = document.getElementById('formError');
    errEl.classList.remove('visible');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    var payload = {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      subject: document.getElementById('subject').value,
      message: document.getElementById('message').value.trim(),
    };

    try {
      var res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }
      document.getElementById('contactForm').classList.add('hidden');
      document.getElementById('formSuccess').classList.remove('hidden');
    } catch (err) {
      errEl.textContent = err.message || 'Something went wrong. Please try again.';
      errEl.classList.add('visible');
      btn.disabled = false;
      btn.textContent = 'Send message →';
    }
  });
})();
