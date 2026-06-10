// Firebase singletons — initialised once on first auth action
let _fbAuth = null;
let _fbDb   = null;

async function _initFirebase() {
  if (_fbAuth) return;
  const cfg = window.__FINCWIN_CONFIG__;
  if (!cfg) throw new Error('Firebase config not loaded');
  const [
    { initializeApp, getApps, getApp },
    { getAuth },
    { getFirestore },
  ] = await Promise.all([
    import('./vendor/firebase/firebase-app.js'),
    import('./vendor/firebase/firebase-auth.js'),
    import('./vendor/firebase/firebase-firestore.js'),
  ]);
  const app = getApps().length > 0 ? getApp() : initializeApp(cfg);
  _fbAuth = getAuth(app);
  _fbDb   = getFirestore(app);
}

function _applyFirestoreDoc(d) {
  if (d.licenseKey) localStorage.setItem('fw_license_key',  d.licenseKey);
  if (d.instanceId) localStorage.setItem('fw_instance_id',  d.instanceId);
  if (d.plan)       localStorage.setItem('fw_plan',         d.plan);
  if (d.profile)    localStorage.setItem('fw_profile',      JSON.stringify(d.profile));
}

// Auto-redirect if already fully authenticated
(async function checkSession() {
  try {
    await _initFirebase();
    const { onAuthStateChanged } = await import('./vendor/firebase/firebase-auth.js');
    onAuthStateChanged(_fbAuth, async (user) => {
      if (!user) return;
      localStorage.setItem('fw_signed_in', '1');
      // Any signed-in user belongs in the app. Restore a cached licence first so
      // the app boots into the correct tier, then route straight to app.html.
      if (localStorage.getItem('fw_license_key')) {
        window.location.href = 'app.html'; return;
      }
      try {
        const { doc, getDoc } = await import('./vendor/firebase/firebase-firestore.js');
        const snap = await getDoc(doc(_fbDb, 'users', user.uid));
        if (snap.exists()) {
          if (snap.data().licenseKey)   _applyFirestoreDoc(snap.data());
          else if (snap.data().profile) localStorage.setItem('fw_profile', JSON.stringify(snap.data().profile));
        }
      } catch {}
      window.location.href = 'app.html';
    });
  } catch {}
})();

// ── Tab switching ──────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');

  // Activate panel is a distinct step — hide the peer tabs bar
  document.getElementById('auth-tabs').style.display = tab === 'activate' ? 'none' : '';

  // Bidirectional hash sync
  if (tab === 'register') {
    history.replaceState(null, '', '#register');
  } else if (tab === 'signin') {
    history.replaceState(null, '', window.location.pathname);
  }
}

// ── Sign in ────────────────────────────────────────────────────────────────────
async function handleSignin(e) {
  e.preventDefault();
  const statusEl = document.getElementById('signin-status');
  const btn      = document.getElementById('btn-signin');
  _hideStatus(statusEl);
  btn.textContent = 'Signing in…'; btn.disabled = true;

  const email = document.getElementById('si-email').value.trim();
  const pass  = document.getElementById('si-pass').value;

  try {
    await _initFirebase();
    const { signInWithEmailAndPassword } = await import('./vendor/firebase/firebase-auth.js');
    const { user } = await signInWithEmailAndPassword(_fbAuth, email, pass);
    localStorage.setItem('fw_signed_in', '1');

    if (!localStorage.getItem('fw_license_key')) {
      try {
        const { doc, getDoc } = await import('./vendor/firebase/firebase-firestore.js');
        const snap = await getDoc(doc(_fbDb, 'users', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          if (d.licenseKey) { _applyFirestoreDoc(d); window.location.href = 'app.html'; return; }
          if (d.profile)    localStorage.setItem('fw_profile', JSON.stringify(d.profile));
        }
      } catch {}
      // Signed in as a Free user (no licence key) — go straight into the app.
      // The app boots the Free tier; paid features gate themselves via requirePlan().
      window.location.href = 'app.html';
      return;
    }
    window.location.href = 'app.html';
  } catch (err) {
    btn.textContent = 'Sign in'; btn.disabled = false;
    _showStatus(statusEl, 'error', _fbMsg(err.code));
  }
}

// ── Register ───────────────────────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const statusEl = document.getElementById('reg-status');
  const btn      = document.getElementById('btn-register');
  _hideStatus(statusEl);
  btn.textContent = 'Creating account…'; btn.disabled = true;

  const fname = document.getElementById('reg-fname').value.trim();
  const lname = document.getElementById('reg-lname').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const key   = document.getElementById('reg-key').value.trim();

  try {
    await _initFirebase();
    const {
      createUserWithEmailAndPassword, updateProfile,
      linkWithCredential, EmailAuthProvider,
    } = await import('./vendor/firebase/firebase-auth.js');
    const { doc, setDoc } = await import('./vendor/firebase/firebase-firestore.js');

    let userCred;
    if (_fbAuth.currentUser?.isAnonymous) {
      userCred = await linkWithCredential(
        _fbAuth.currentUser,
        EmailAuthProvider.credential(email, pass)
      );
    } else {
      userCred = await createUserWithEmailAndPassword(_fbAuth, email, pass);
    }
    const user = userCred.user;
    localStorage.setItem('fw_signed_in', '1');

    if (fname) await updateProfile(user, { displayName: fname + (lname ? ' ' + lname : '') });

    const profile = { fname, lname, display: fname, email };
    await setDoc(doc(_fbDb, 'users', user.uid), { profile }, { merge: true });
    localStorage.setItem('fw_profile', JSON.stringify(profile));

    btn.textContent = 'Create account'; btn.disabled = false;

    if (key && key.length === 19) {
      // Account created with a key — carry it forward to the activation step
      document.getElementById('activate-key').value = key;
      switchTab('activate');
      _showStatus(
        document.getElementById('activate-status'),
        'info',
        'Account created! Now activate your licence key to unlock FincWin on this device.'
      );
      return;
    }

    // No key provided — show success then redirect to account
    _showStatus(statusEl, 'info', 'Account created! Taking you into FincWin…');
    setTimeout(() => { window.location.href = 'app.html'; }, 1500);
  } catch (err) {
    btn.textContent = 'Create account'; btn.disabled = false;
    _showStatus(statusEl, 'error', _fbMsg(err.code));
  }
}

// ── Licence activation (Step 2) ────────────────────────────────────────────────
async function activateLicence() {
  const key      = document.getElementById('activate-key').value.trim();
  const statusEl = document.getElementById('activate-status');
  const btn      = document.getElementById('btn-activate');

  if (!key || key.length < 19) {
    _showStatus(statusEl, 'error', 'Please enter a complete licence key (XXXX-XXXX-XXXX-XXXX).');
    return;
  }

  _hideStatus(statusEl);
  btn.textContent = 'Activating…'; btn.disabled = true;

  try {
    const instanceName =
      (navigator.userAgentData?.platform || navigator.platform || 'Device') +
      ' — ' + navigator.userAgent.slice(0, 30);
    const res  = await fetch('/api/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: key, instance_name: instanceName }),
    });
    const data = await res.json();

    if (data.activated) {
      localStorage.setItem('fw_signed_in', '1');
      const instanceId = data.instance?.id || '';
      const plan       = data.meta?.variant_name || 'Pro';

      localStorage.setItem('fw_license_key',   key);
      localStorage.setItem('fw_instance_id',   instanceId);
      localStorage.setItem('fw_instance_name', data.instance?.name || instanceName);
      localStorage.setItem('fw_plan',          plan);

      let profile = null;
      if (data.meta?.customer_name || data.meta?.customer_email) {
        const parts = (data.meta.customer_name || '').split(' ');
        profile = {
          fname:   parts[0] || '',
          lname:   parts.slice(1).join(' ') || '',
          display: parts[0] || '',
          email:   data.meta.customer_email || '',
        };
        localStorage.setItem('fw_profile', JSON.stringify(profile));
      }

      try {
        await _initFirebase();
        if (_fbAuth.currentUser) {
          const { doc, setDoc } = await import('./vendor/firebase/firebase-firestore.js');
          const payload = { licenseKey: key, instanceId, plan };
          if (profile) payload.profile = profile;
          await setDoc(doc(_fbDb, 'users', _fbAuth.currentUser.uid), payload, { merge: true });
        }
      } catch (fsErr) {
        console.warn('[activation] Firestore write failed (non-fatal):', fsErr);
      }

      if (!instanceId) {
        _showStatus(statusEl, 'info',
          'Licence verified — instance ID missing. If the account page shows no data, sign out and re-activate.');
        setTimeout(() => { window.location.href = 'account.html'; }, 3000);
        return;
      }
      window.location.href = 'account.html';
    } else {
      _showStatus(statusEl, 'error', data.error || 'Activation failed. Check your key and try again.');
      btn.textContent = 'Activate this device'; btn.disabled = false;
    }
  } catch {
    // Dev-only fallback — never runs in production
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (key.replace(/-/g, '').length === 16) {
        localStorage.setItem('fw_license_key', key);
        localStorage.setItem('fw_plan', 'Pro');
        window.location.href = 'account.html';
        return;
      }
    }
    _showStatus(statusEl, 'error', 'Could not reach the activation server. Check your connection and try again.');
    btn.textContent = 'Activate this device'; btn.disabled = false;
  }
}

// ── Forgot password ────────────────────────────────────────────────────────────
async function showForgot(e) {
  e.preventDefault();
  const email    = document.getElementById('si-email').value.trim();
  const statusEl = document.getElementById('signin-status');
  if (!email) {
    _showStatus(statusEl, 'error', 'Enter your email address above, then click Forgot again.');
    document.getElementById('si-email').focus();
    return;
  }
  try {
    await _initFirebase();
    const { sendPasswordResetEmail } = await import('./vendor/firebase/firebase-auth.js');
    await sendPasswordResetEmail(_fbAuth, email);
    _showStatus(statusEl, 'info', 'Password reset email sent to ' + email + '. Check your inbox (and spam folder).');
  } catch (err) {
    _showStatus(statusEl, 'error', _fbMsg(err.code));
  }
}

// ── Key formatter ──────────────────────────────────────────────────────────────
function formatKey(input) {
  const v = input.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16);
  input.value = (v.match(/.{1,4}/g) || []).join('-');
}

// ── Password visibility toggle ─────────────────────────────────────────────────
function togglePasswordVisibility(e) {
  const btn     = e.currentTarget;
  const input   = document.getElementById(btn.dataset.target);
  const showing = btn.classList.toggle('visible');
  input.type    = showing ? 'text' : 'password';
  btn.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
}

// ── Status message helpers ─────────────────────────────────────────────────────
function _showStatus(el, type, msg) {
  el.textContent = msg;
  el.className   = 'status-msg ' + type + ' show';
}
function _hideStatus(el) {
  el.className = 'status-msg';
}

// ── Firebase error code → human message ───────────────────────────────────────
function _fbMsg(code) {
  return ({
    'auth/invalid-email':             'Invalid email address.',
    'auth/user-not-found':            'No account found with that email.',
    'auth/wrong-password':            'Incorrect password.',
    'auth/invalid-credential':        'Incorrect email or password.',
    'auth/email-already-in-use':      'An account with that email already exists.',
    'auth/weak-password':             'Password must be at least 6 characters.',
    'auth/too-many-requests':         'Too many attempts — please try again in a few minutes.',
    'auth/network-request-failed':    'Network error. Check your connection and try again.',
    'auth/user-disabled':             'This account has been disabled.',
    'auth/credential-already-in-use': 'These credentials are already linked to another account.',
  })[code] || 'Something went wrong. Please try again.';
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  // Tab buttons
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Footer "switch tab" links (data-switch-tab attribute)
  document.querySelectorAll('[data-switch-tab]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      switchTab(link.dataset.switchTab);
    });
  });

  // Forms
  document.getElementById('form-signin').addEventListener('submit', handleSignin);
  document.getElementById('form-register').addEventListener('submit', handleRegister);

  // Forgot password
  document.getElementById('link-forgot').addEventListener('click', showForgot);

  // Activate button (Step 2)
  document.getElementById('btn-activate').addEventListener('click', activateLicence);

  // Password visibility toggles
  document.querySelectorAll('.btn-pw-toggle').forEach(btn => {
    btn.addEventListener('click', togglePasswordVisibility);
  });

  // Key format inputs
  document.querySelectorAll('.key-input').forEach(inp => {
    inp.addEventListener('input', () => formatKey(inp));
  });

  // Hash-based initial tab routing
  if (window.location.hash === '#register') switchTab('register');
  else if (window.location.hash === '#activate') switchTab('activate');
});
