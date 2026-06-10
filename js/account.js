// account.js — FincWin account page logic
// Extracted from inline script to comply with CSP script-src 'self' policy.

// ── Auth ────────────────────────────────────────────────────────────────────
// Account-first freemium model: ANY signed-in user may view this page.
//   • Pro users (licence key present)        → full licence / device management.
//   • Free users (signed in, no licence key) → Free-plan view + upgrade CTA.
// We redirect to sign-in ONLY when there is no licence key AND no Firebase session.
// (let, so Firestore restoration can update them on the new-device flow.)
let AUTH_KEY  = localStorage.getItem('fw_license_key');
let AUTH_INST = localStorage.getItem('fw_instance_id');
let IS_FREE   = false;  // true once we confirm a signed-in user with no licence key
let _signedIn = false;  // set when onAuthStateChanged confirms a Firebase session
let _redirectTimer = null;

function _gotoSignin() {
  if (_redirectTimer) { clearTimeout(_redirectTimer); _redirectTimer = null; }
  window.location.replace('signin.html');
}

// No licence key AND no Firebase config → no possible session; leave at once.
if (!AUTH_KEY && !window.__FINCWIN_CONFIG__) {
  _gotoSignin();
} else if (!AUTH_KEY) {
  // Firebase is configured but the session may still be restoring. Give it a
  // window to confirm before bouncing — cancelled the moment a user is found.
  _redirectTimer = setTimeout(() => {
    if (!localStorage.getItem('fw_license_key') && !_signedIn) _gotoSignin();
  }, 5000);
}

// Firebase auth check — runs in background; restores a Pro key for returning
// devices, and renders the Free state for signed-in users without a key.
(async function _firebaseAuthGuard() {
  const cfg = window.__FINCWIN_CONFIG__;
  if (!cfg) {
    if (!AUTH_KEY) _gotoSignin();
    return;
  }
  try {
    const [
      { initializeApp, getApps, getApp },
      { getAuth, onAuthStateChanged, signOut: _fbSignOutFn },
      { getFirestore, doc, getDoc }
    ] = await Promise.all([
      import('./vendor/firebase/firebase-app.js'),
      import('./vendor/firebase/firebase-auth.js'),
      import('./vendor/firebase/firebase-firestore.js'),
    ]);
    const app  = getApps().length > 0 ? getApp() : initializeApp(cfg);
    const auth = getAuth(app);
    const db   = getFirestore(app);

    // Expose for signOut() below
    window._fbSignOut = () => _fbSignOutFn(auth);

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        _signedIn = false;
        // Not signed in: only allowed to stay if an offline Pro key is cached.
        if (!localStorage.getItem('fw_license_key')) _gotoSignin();
        return;
      }

      // Signed in (free or pro) — the user belongs on this page. Stop the bounce.
      _signedIn = true;
      if (_redirectTimer) { clearTimeout(_redirectTimer); _redirectTimer = null; }

      // Pro path already rendered from the cached key (see boot at end of file).
      if (localStorage.getItem('fw_license_key')) return;

      // No local key — restore a Pro licence from Firestore, else render Free.
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data().licenseKey) {
          const d = snap.data();
          localStorage.setItem('fw_license_key', d.licenseKey);
          localStorage.setItem('fw_instance_id', d.instanceId || '');
          localStorage.setItem('fw_plan',        d.plan || 'Pro');
          if (d.profile) localStorage.setItem('fw_profile', JSON.stringify(d.profile));
          AUTH_KEY  = d.licenseKey;
          AUTH_INST = d.instanceId || '';
          IS_FREE   = false;
          loadAccountData(); // render now that we have the key
        } else {
          // Signed-in FREE user — no licence key anywhere. Show the Free view.
          if (snap.exists() && snap.data().profile) {
            localStorage.setItem('fw_profile', JSON.stringify(snap.data().profile));
          }
          IS_FREE = true;
          renderFreeState();
        }
      } catch {
        // On a read error, still let the signed-in user in on a Free view
        // rather than bounce them to sign-in.
        IS_FREE = true;
        renderFreeState();
      }
    });
  } catch (err) {
    console.warn('[account] Firebase auth guard failed:', err);
    if (!AUTH_KEY) _gotoSignin();
  }
})();

// ── Profile helpers ─────────────────────────────────────────────────────────
function getProfile() {
  try { return JSON.parse(localStorage.getItem('fw_profile')) || {}; } catch { return {}; }
}
function setProfile(obj) {
  localStorage.setItem('fw_profile', JSON.stringify({ ...getProfile(), ...obj }));
}

// ── Escape HTML (prevents XSS when inserting user-controlled strings) ───────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Greeting — instant from localStorage, refined after API responds ────────
const hour  = new Date().getHours();
const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
function updateGreeting() {
  const p    = getProfile();
  const name = p.display || p.fname || (AUTH_KEY ? AUTH_KEY.slice(0, 4) + '…' : 'there');
  document.getElementById('page-greeting').textContent = greet + ', ' + name;
}
updateGreeting();

// ── Live data from API ──────────────────────────────────────────────────────
let liveData = null;

async function loadAccountData() {
  if (!AUTH_KEY || !AUTH_INST) {
    renderAll(null);
    return;
  }
  try {
    const res  = await fetch('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: AUTH_KEY, instance_id: AUTH_INST }),
    });
    const data = await res.json();
    if (!data.valid) {
      showBanner(
        'Your licence could not be validated (' + (data.reason || 'invalid_key') + '). ' +
        '<a href="signin.html">Re-activate your key</a> or contact ' +
        '<a href="mailto:support@fincwin.com">support@fincwin.com</a>.'
      );
      renderAll(null);
      return;
    }
    liveData = data;
    const p = getProfile();
    if (data.customer_name && !p.fname) {
      const parts = data.customer_name.split(' ');
      setProfile({
        fname:   parts[0]                 || '',
        lname:   parts.slice(1).join(' ') || '',
        display: parts[0]                 || '',
        email:   data.customer_email      || '',
      });
    } else if (data.customer_email && !p.email) {
      setProfile({ email: data.customer_email });
    }
    if (data.plan) localStorage.setItem('fw_plan', data.plan);
  } catch {
    showBanner('Could not reach the validation server — showing cached data. Some information may be out of date.');
  }
  renderAll(liveData);
}

function renderAll(data) {
  updateGreeting();
  renderOverview(data);
  renderPlan(data);
  renderKeyMeta(data);
  renderDevices(data);
  renderProfile();
}

// ── Free-plan state ───────────────────────────────────────────────────────────
// Rendered for a signed-in user who has no licence key. Mirrors renderAll() but
// frames everything around the Free tier and surfaces the Pro upgrade.
function renderFreeState() {
  updateGreeting();
  const checkIcon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  // Overview stats
  document.getElementById('ov-plan').textContent       = 'Free';
  document.getElementById('ov-plan-sub').textContent   = 'FincWin Free';
  document.getElementById('ov-devices').textContent    = 'This device';
  document.getElementById('ov-key-status').textContent = 'Free plan';
  document.getElementById('ov-expires').textContent    = 'No expiry';

  const freeFeatures = [
    { label: 'Budget Envelopes',  on: true  },
    { label: 'Loan Calculator',   on: true  },
    { label: 'CSV Import',         on: true  },
    { label: 'Basic Export',       on: true  },
    { label: 'On-device Backup',   on: true  },
    { label: 'Cloud Sync',         on: false },
    { label: 'AI Coach',           on: false },
    { label: 'Advanced Reports',   on: false },
    { label: 'Multi-device',       on: false },
  ];
  document.getElementById('ov-features').innerHTML = freeFeatures.map(f =>
    `<div class="feature-row${f.on ? '' : ' off'}">${checkIcon} ${esc(f.label)}</div>`
  ).join('');

  // Plan & billing
  const badge = document.getElementById('plan-badge');
  badge.className = 'plan-badge free';
  document.getElementById('plan-badge-text').textContent = 'Free';
  document.getElementById('plan-name').textContent       = 'FincWin Free';
  document.getElementById('plan-note').textContent =
    'Your data stays on this device. Upgrade to Pro for cloud sync across all your devices.';
  document.getElementById('plan-card-sub').textContent = 'Free forever — no card, no expiry.';

  ['chip-custom-cats', 'chip-5-devices', 'chip-desktop'].forEach(id => {
    const el = document.getElementById(id); if (el) el.className = 'feature-chip';
  });

  // Upgrade box → Pro (not Lifetime) for free users
  const upBox = document.getElementById('upgrade-box');
  if (upBox) {
    upBox.style.display = '';
    const strong = upBox.querySelector('strong');
    const firstP = upBox.querySelector('p');
    if (strong) strong.textContent = 'Upgrade to Pro — $39/year';
    if (firstP) firstP.textContent = 'Cloud sync across devices, AI coach, advanced reports, and automated backups.';
  }
  const creditNote = document.getElementById('upgrade-credit-note'); if (creditNote) creditNote.style.display = 'none';
  const expiredBox = document.getElementById('expired-box');         if (expiredBox) expiredBox.style.display = 'none';
  const subNote    = document.getElementById('billing-sub-note');    if (subNote)    subNote.style.display    = 'none';

  // Licence key section → free messaging (no key yet)
  const keyDisplay = document.getElementById('key-display');
  if (keyDisplay) { keyDisplay.textContent = 'No licence key — Free plan'; keyDisplay.classList.remove('masked'); }
  document.getElementById('key-card-sub').textContent =
    'You’re on the Free plan. Upgrade to Pro to get a licence key, cloud sync, and multi-device access.';
  document.getElementById('key-status-el').textContent = 'Status: Free';
  document.getElementById('key-activations').textContent = 'No licence key';
  document.getElementById('key-expires').textContent = 'Expires: Never';
  document.getElementById('key-plan-el').textContent = 'Plan: Free';

  // Devices
  document.getElementById('devices-subtitle').textContent =
    'Cloud sync is a Pro feature — the Free plan keeps your data on this device.';
  const devName = localStorage.getItem('fw_instance_name') || 'This device';
  document.getElementById('device-list').innerHTML = `
    <div class="device-item">
      <div class="device-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
      </div>
      <div class="device-info">
        <div class="device-name">${esc(devName)}</div>
        <div class="device-meta">Local — data stored on this device</div>
      </div>
      <span class="device-current">This device</span>
    </div>`;
  const devUpgrade = document.getElementById('devices-upgrade-link');
  if (devUpgrade) {
    devUpgrade.style.display = '';
    devUpgrade.innerHTML = 'Want your budget on every device? <a href="pricing.html" class="link-sage">Upgrade to Pro</a> for cloud sync.';
  }

  renderProfile();
}

// ── Overview ────────────────────────────────────────────────────────────────
function renderOverview(data) {
  const plan      = data?.plan || localStorage.getItem('fw_plan') || 'Pro';
  const used      = data?.activation_usage ?? 1;
  const limit     = data?.activation_limit ?? 3;
  const status    = data?.key_status       || 'active';
  const expires   = data?.expires_at       ?? null;
  const isLife    = plan.toLowerCase().includes('lifetime');
  const isExpired = status !== 'active';
  const isSub     = !isLife && !!expires;

  document.getElementById('ov-plan').textContent     = isExpired ? 'Expired' : plan;
  document.getElementById('ov-plan-sub').textContent = isExpired ? 'Renew to restore access' : 'FincWin ' + plan;
  document.getElementById('ov-devices').textContent  = used + ' / ' + limit;
  document.getElementById('ov-key-status').textContent =
    status.charAt(0).toUpperCase() + status.slice(1);
  document.getElementById('ov-expires').textContent  = isLife
    ? 'No expiry — lifetime'
    : expires
      ? (isSub ? 'Renews ' : 'Expires ') + new Date(expires).toLocaleDateString()
      : 'No expiry';

  const features = [
    { label: 'Budget Envelopes', on: true },
    { label: 'AI Coach',         on: true },
    { label: 'Google Drive Sync',on: true },
    { label: 'Loan Calculator',  on: true },
    { label: 'CSV Import',       on: true },
    { label: 'Analytics',        on: true },
    { label: 'Custom Categories',on: isLife },
    { label: '5 Devices',        on: isLife },
    { label: 'Desktop App',      on: isLife },
  ];
  const checkIcon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  document.getElementById('ov-features').innerHTML = features.map(f =>
    `<div class="feature-row${f.on ? '' : ' off'}">${checkIcon} ${esc(f.label)}</div>`
  ).join('');
}

function copyKeyOverview() {
  if (!AUTH_KEY) { showToast('No licence key found'); return; }
  navigator.clipboard.writeText(AUTH_KEY).then(() => showToast('Licence key copied'));
}

// ── Plan ────────────────────────────────────────────────────────────────────
function renderPlan(data) {
  const plan      = data?.plan || localStorage.getItem('fw_plan') || 'Pro';
  const planLow   = plan.toLowerCase();
  const isLife    = planLow.includes('lifetime');
  const isExpired = data && data.key_status && data.key_status !== 'active';
  const isSub     = !isLife && !!(data?.expires_at);  // subscription = has expiry + not lifetime
  const limit     = data?.activation_limit ?? 3;
  const email     = data?.customer_email || getProfile().email || '';

  const badge = document.getElementById('plan-badge');
  const cls   = isExpired ? 'free' : (['lifetime','pro','starter'].find(k => planLow.includes(k)) || 'free');
  badge.className = 'plan-badge ' + cls;
  document.getElementById('plan-badge-text').textContent = isExpired ? 'Expired' : plan;

  document.getElementById('plan-name').textContent = 'FincWin ' + plan;

  if (isExpired) {
    document.getElementById('plan-note').textContent = 'Your subscription has expired — renew to restore Pro access.';
    document.getElementById('plan-card-sub').textContent = 'Subscription inactive';
  } else if (isSub) {
    const renewDate = new Date(data.expires_at).toLocaleDateString();
    document.getElementById('plan-note').textContent = 'Renews ' + renewDate + (email ? ' · ' + email : '');
    document.getElementById('plan-card-sub').textContent = 'Annual subscription — cancel anytime via billing portal';
  } else {
    document.getElementById('plan-note').textContent =
      'One-time purchase' +
      (limit ? ' · ' + limit + '-device activation' : '') +
      (email ? ' · ' + email : '');
    document.getElementById('plan-card-sub').textContent = 'Your purchase gives you lifetime access to this tier.';
  }

  document.getElementById('chip-custom-cats').className = 'feature-chip' + (isLife ? ' on' : '');
  document.getElementById('chip-5-devices').className   = 'feature-chip' + (isLife ? ' on' : '');
  document.getElementById('chip-desktop').className     = 'feature-chip' + (isLife ? ' on' : '');

  // upgrade-box: hide for Lifetime and expired (expired gets its own box)
  document.getElementById('upgrade-box').style.display  = isLife || isExpired ? 'none' : '';
  // credit note: only visible for active Pro subscription users
  const creditNote = document.getElementById('upgrade-credit-note');
  if (creditNote) creditNote.style.display = isSub && !isExpired ? '' : 'none';

  // expired-box: only for expired keys
  const expiredBox = document.getElementById('expired-box');
  if (expiredBox) expiredBox.style.display = isExpired ? '' : 'none';

  // billing sub note: visible for active or expired subscriptions
  const subNote = document.getElementById('billing-sub-note');
  if (subNote) subNote.style.display = isSub || isExpired ? '' : 'none';
}

// ── Key meta ────────────────────────────────────────────────────────────────
function renderKeyMeta(data) {
  const used    = data?.activation_usage ?? '—';
  const limit   = data?.activation_limit ?? '—';
  const status  = data?.key_status       || 'active';
  const expires = data?.expires_at       || null;
  const plan    = data?.plan || localStorage.getItem('fw_plan') || '—';

  document.getElementById('key-activations').textContent =
    'Activations: ' + used + ' / ' + limit + ' used';
  document.getElementById('key-status-el').innerHTML =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg> Status: ' +
    esc(status.charAt(0).toUpperCase() + status.slice(1));
  document.getElementById('key-expires').textContent =
    'Expires: ' + (expires ? new Date(expires).toLocaleDateString() : 'Never');
  document.getElementById('key-plan-el').textContent = 'Plan: ' + plan;

  if (typeof limit === 'number') {
    document.getElementById('key-card-sub').textContent =
      'Use this key to activate FincWin on up to ' + limit + ' device' + (limit === 1 ? '' : 's') + '.';
  }
}

// ── Devices ─────────────────────────────────────────────────────────────────
function renderDevices(data) {
  const used    = data?.activation_usage ?? 1;
  const limit   = data?.activation_limit ?? 3;
  const devName = data?.instance_name
    || localStorage.getItem('fw_instance_name')
    || 'This device';

  document.getElementById('devices-subtitle').textContent =
    used + ' of ' + limit + ' activation' + (limit === 1 ? '' : 's') + ' used.';

  let html = `
    <div class="device-item">
      <div class="device-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
      </div>
      <div class="device-info">
        <div class="device-name">${esc(devName)}</div>
        <div class="device-meta">Active now</div>
      </div>
      <span class="device-current">This device</span>
    </div>`;

  const otherUsed = Math.max(0, used - 1);
  for (let i = 0; i < limit - 1; i++) {
    const isActive = i < otherUsed;
    html += `
    <div class="device-item${isActive ? '' : ' device-item--inactive'}">
      <div class="device-icon${isActive ? '' : ' device-icon--empty'}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${isActive ? 'var(--sage)' : 'var(--muted)'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/></svg>
      </div>
      <div class="device-info">
        <div class="device-name">Slot ${i + 2} — ${isActive ? 'Active' : 'Available'}</div>
        <div class="device-meta">${isActive ? 'Another activated device' : 'Not yet activated'}</div>
      </div>
      ${isActive ? '<button type="button" class="btn-deactivate">Remove</button>' : ''}
    </div>`;
  }

  document.getElementById('device-list').innerHTML = html;
  document.getElementById('devices-upgrade-link').style.display = limit >= 5 ? 'none' : '';
}

// ── Profile ─────────────────────────────────────────────────────────────────
function renderProfile() {
  const p = getProfile();
  document.getElementById('p-fname').value   = p.fname   || '';
  document.getElementById('p-lname').value   = p.lname   || '';
  document.getElementById('p-email').value   = p.email   || (liveData?.customer_email || '');
  document.getElementById('p-display').value = p.display || p.fname || '';
}

// ── Key show / copy ─────────────────────────────────────────────────────────
let keyVisible = false;
function toggleKeyVisibility() {
  if (!AUTH_KEY) { showToast('No licence key on the Free plan — upgrade to Pro to get one'); return; }
  keyVisible = !keyVisible;
  const el = document.getElementById('key-display');
  el.textContent = keyVisible ? AUTH_KEY : '•••• - •••• - •••• - ••••';
  el.classList.toggle('masked', !keyVisible);
}
function copyKey() {
  if (!AUTH_KEY) { showToast('No licence key on the Free plan — upgrade to Pro to get one'); return; }
  navigator.clipboard.writeText(AUTH_KEY).then(() => showToast('Licence key copied'));
}
function copyKeyFull() {
  document.getElementById('key-copy-block').textContent = AUTH_KEY;
  navigator.clipboard.writeText(AUTH_KEY).then(() => showToast('Licence key copied to clipboard'));
}

// ── Profile save ────────────────────────────────────────────────────────────
function saveProfile(e) {
  e.preventDefault();
  const fname   = document.getElementById('p-fname').value.trim();
  const lname   = document.getElementById('p-lname').value.trim();
  const display = document.getElementById('p-display').value.trim();
  const email   = document.getElementById('p-email').value.trim();
  if (!fname) { showToast('First name is required'); return; }
  setProfile({ fname, lname, display: display || fname, email });
  updateGreeting();
  const ok = document.getElementById('profile-success');
  ok.style.display = 'block';
  setTimeout(() => { ok.style.display = 'none'; }, 3000);
}

// ── Deactivate this device ──────────────────────────────────────────────────
async function deactivateDevice() {
  if (!AUTH_INST) {
    showToast('No instance ID found — please re-activate your key on this device.');
    return;
  }
  if (!confirm('Deactivate this device? You can re-activate with your licence key.')) return;
  const btn = document.getElementById('btn-deactivate-all');
  btn.disabled = true; btn.textContent = 'Deactivating…';
  try {
    const res  = await fetch('/api/deactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: AUTH_KEY, instance_id: AUTH_INST }),
    });
    const data = await res.json();
    if (data.deactivated) {
      localStorage.removeItem('fw_instance_id');
      localStorage.removeItem('fw_instance_name');
      showToast('Device deactivated — redirecting…');
      setTimeout(() => { window.location.href = 'signin.html'; }, 2000);
    } else {
      showToast('Deactivation failed: ' + (data.error || 'Unknown error'));
      btn.disabled = false; btn.textContent = 'Deactivate device';
    }
  } catch {
    showToast('Could not reach server. Try again or deactivate from the billing portal.');
    btn.disabled = false; btn.textContent = 'Deactivate device';
  }
}

function otherDeviceNote() {
  showToast('Sign in on the other device and deactivate it from there.');
}

// ── Activate a different key (Pro → Lifetime upgrade path) ─────────────────
async function activateNewKey() {
  const newKey = (document.getElementById('new-key-input').value || '').trim().toUpperCase();
  if (!newKey) { showToast('Enter your new licence key'); return; }
  if (newKey === AUTH_KEY) { showToast('That is already your active key'); return; }

  const btn = document.getElementById('btn-activate-new');
  btn.disabled = true; btn.textContent = 'Activating…';

  try {
    const instanceName = localStorage.getItem('fw_instance_name')
      || navigator.userAgent.slice(0, 50)
      || 'My Device';

    const actRes  = await fetch('/api/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: newKey, instance_name: instanceName }),
    });
    const actData = await actRes.json();

    if (!actData.activated) {
      showToast('Could not activate: ' + (actData.error || 'invalid key'));
      btn.disabled = false; btn.textContent = 'Activate new key';
      return;
    }

    // Deactivate the old key silently — best effort
    if (AUTH_KEY && AUTH_INST) {
      fetch('/api/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: AUTH_KEY, instance_id: AUTH_INST }),
      }).catch(() => {});
    }

    localStorage.setItem('fw_license_key',   newKey);
    localStorage.setItem('fw_instance_id',   actData.instance?.id   || '');
    localStorage.setItem('fw_instance_name', actData.instance?.name || instanceName);
    if (actData.meta?.variant_name) {
      localStorage.setItem('fw_plan', actData.meta.variant_name);
    }

    AUTH_KEY  = newKey;
    AUTH_INST = actData.instance?.id || '';

    document.getElementById('new-key-success').style.display = 'block';
    setTimeout(() => window.location.reload(), 1800);
  } catch {
    showToast('Network error — please try again');
    btn.disabled = false; btn.textContent = 'Activate new key';
  }
}

// ── Clear account data ──────────────────────────────────────────────────────
function clearAccountData() {
  const c = prompt('Type CLEAR to remove all FincWin account data from this device:');
  if (c !== 'CLEAR') return;
  ['fw_license_key', 'fw_instance_id', 'fw_instance_name', 'fw_plan', 'fw_profile', 'fw_signed_in'].forEach(k =>
    localStorage.removeItem(k)
  );
  showToast('Account data cleared — redirecting…');
  setTimeout(() => { window.location.href = 'signin.html'; }, 2000);
}

// ── Sign out ────────────────────────────────────────────────────────────────
function signOut(e) {
  if (e) e.preventDefault();
  localStorage.removeItem('fw_instance_id');
  localStorage.removeItem('fw_instance_name');
  localStorage.removeItem('fw_license_key');
  localStorage.removeItem('fw_plan');
  localStorage.removeItem('fw_signed_in');
  if (typeof window._fbSignOut === 'function') {
    window._fbSignOut().catch(() => {}).finally(() => { window.location.href = 'signin.html'; });
  } else {
    window.location.href = 'signin.html';
  }
}

// ── Section nav ─────────────────────────────────────────────────────────────
function showSection(name, btn) {
  document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  btn.classList.add('active');
}

// ── Banner ──────────────────────────────────────────────────────────────────
function showBanner(html) {
  const b = document.getElementById('error-banner');
  b.innerHTML = html;
  b.style.display = 'block';
}

// ── Toast ───────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Event bindings (replaces inline onclick/onsubmit attributes) ─────────────
// Script runs at end of body so DOM is fully ready — no DOMContentLoaded needed.

// Sidebar navigation
document.querySelectorAll('.sidebar-item[data-section]').forEach(btn => {
  btn.addEventListener('click', () => showSection(btn.dataset.section, btn));
});

// Sign-out link
document.getElementById('btn-signout')?.addEventListener('click', signOut);

// Overview — copy key
document.getElementById('btn-copy-key-ov')?.addEventListener('click', copyKeyOverview);

// Licence section
document.getElementById('btn-toggle-key')?.addEventListener('click', toggleKeyVisibility);
document.getElementById('btn-copy-key-short')?.addEventListener('click', copyKey);
document.getElementById('btn-copy-key-full')?.addEventListener('click', copyKeyFull);
document.getElementById('btn-activate-new')?.addEventListener('click', activateNewKey);

// Profile form
document.getElementById('profile-form')?.addEventListener('submit', saveProfile);

// Danger zone
document.getElementById('btn-deactivate-all')?.addEventListener('click', deactivateDevice);
document.getElementById('btn-clear-data')?.addEventListener('click', clearAccountData);

// Device list — delegated handler for dynamically rendered "Remove" buttons
document.getElementById('device-list')?.addEventListener('click', e => {
  if (e.target.classList.contains('btn-deactivate')) otherDeviceNote();
});

// ── Boot ────────────────────────────────────────────────────────────────────
// Only render immediately when the key is already in localStorage.
// If the key is missing, _firebaseAuthGuard above will restore it from
// Firestore and call loadAccountData() once the key is available.
if (AUTH_KEY) loadAccountData();
