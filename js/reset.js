// reset.js — handles the password-reset landing page (reset.html).
// Reads the oobCode minted by api/forgot-password.js, verifies it, and lets the
// user set a new password via the vendored Firebase Auth SDK. No inline scripts
// (CSP forbids them) — all wiring is done with addEventListener here.

let _fbAuth = null;

async function _initFirebase() {
  if (_fbAuth) return;
  const cfg = window.__FINCWIN_CONFIG__;
  if (!cfg) throw new Error('Firebase config not loaded');
  const [{ initializeApp, getApps, getApp }, { getAuth }] = await Promise.all([
    import('./vendor/firebase/firebase-app.js'),
    import('./vendor/firebase/firebase-auth.js'),
  ]);
  const app = getApps().length > 0 ? getApp() : initializeApp(cfg);
  _fbAuth = getAuth(app);
}

function _show(el, type, msg) {
  el.textContent = msg;
  el.className = 'status-msg ' + type + ' show';
}

function _fbMsg(code) {
  return ({
    'auth/expired-action-code': 'This reset link has expired. Request a new one from the sign-in page.',
    'auth/invalid-action-code': 'This reset link is invalid or has already been used. Request a new one.',
    'auth/user-disabled':       'This account has been disabled.',
    'auth/user-not-found':      'No account found for this reset link.',
    'auth/weak-password':       'Password must be at least 6 characters.',
  })[code] || 'Something went wrong. Please request a new reset link.';
}

document.addEventListener('DOMContentLoaded', async function () {
  const statusEl  = document.getElementById('reset-status');
  const formEl    = document.getElementById('form-reset');
  const passEl    = document.getElementById('rs-pass');
  const btnEl     = document.getElementById('btn-reset');
  const doneEl    = document.getElementById('reset-done');

  const oobCode = new URLSearchParams(window.location.search).get('oobCode');
  if (!oobCode) {
    formEl.style.display = 'none';
    _show(statusEl, 'error', 'This link is missing its reset code. Request a new one from the sign-in page.');
    return;
  }

  // Verify the code up front so we can fail fast on expired/used links.
  try {
    await _initFirebase();
    const { verifyPasswordResetCode } = await import('./vendor/firebase/firebase-auth.js');
    const email = await verifyPasswordResetCode(_fbAuth, oobCode);
    _show(statusEl, 'info', 'Resetting the password for ' + email + '.');
  } catch (err) {
    formEl.style.display = 'none';
    _show(statusEl, 'error', _fbMsg(err.code));
    return;
  }

  // Password visibility toggle (matches signin.html markup).
  const toggle = document.querySelector('.btn-pw-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      const showing = toggle.classList.toggle('visible');
      passEl.type = showing ? 'text' : 'password';
      toggle.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
    });
  }

  formEl.addEventListener('submit', async function (e) {
    e.preventDefault();
    const newPass = passEl.value;
    if (newPass.length < 6) {
      _show(statusEl, 'error', 'Password must be at least 6 characters.');
      passEl.focus();
      return;
    }
    btnEl.disabled = true;
    btnEl.textContent = 'Saving…';
    try {
      const { confirmPasswordReset } = await import('./vendor/firebase/firebase-auth.js');
      await confirmPasswordReset(_fbAuth, oobCode, newPass);
      formEl.style.display = 'none';
      _hideStatus(statusEl);
      doneEl.style.display = 'block';
    } catch (err) {
      _show(statusEl, 'error', _fbMsg(err.code));
      btnEl.disabled = false;
      btnEl.textContent = 'Set new password';
    }
  });

  function _hideStatus(el) { el.className = 'status-msg'; }
});
