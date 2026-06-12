'use strict';
// firebase.js — Firebase provider plugin for the sync.js plugin registry.
// Extracted from sync.js. Loaded AFTER sync.js (which defines window.registerProvider).
// Registered via: window.registerProvider('firebase', _firebasePlugin)
//
// Security note: window.registerProvider is intentionally public. Only load trusted
// provider scripts. CSP script-src 'self' prevents third-party registration.

// ── Firebase config (moved from sync.js line 20) ──────────────────────────────
const firebaseConfig = window.__FINCWIN_CONFIG__;

// ── Constants (moved from sync.js line 11) ────────────────────────────────────
const SYNC_VERSION = 1;

// ── Module-scoped Firebase singletons (moved from sync.js lines 23-27, 31) ───
let _firebaseApp = null;
let _auth = null;
let _db = null;
let _fsHelpers = null;
let _authHelpers = null;
let _unsubSnapshot = null;

// ── Firebase: lazy-load, auth, Firestore (moved verbatim from sync.js lines 305-323) ──

async function getFirebaseInstances() {
  if (_db) return { auth: _auth, db: _db, fsHelpers: _fsHelpers };
  if (!firebaseConfig) throw new Error('Firebase config not available — deploy with js/config.local.js or set window.__FINCWIN_CONFIG__');
  const [
    { initializeApp },
    { getAuth, signInAnonymously, onAuthStateChanged, linkWithCredential, EmailAuthProvider, signInWithEmailAndPassword },
    { getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot }
  ] = await Promise.all([
    import('../vendor/firebase/firebase-app.js'),
    import('../vendor/firebase/firebase-auth.js'),
    import('../vendor/firebase/firebase-firestore.js')
  ]);
  _firebaseApp = initializeApp(firebaseConfig);
  _auth = getAuth(_firebaseApp);
  _db = getFirestore(_firebaseApp);
  _fsHelpers = { doc, getDoc, setDoc, deleteDoc, onSnapshot };
  _authHelpers = { signInAnonymously, onAuthStateChanged, linkWithCredential, EmailAuthProvider, signInWithEmailAndPassword };
  return { auth: _auth, db: _db, fsHelpers: _fsHelpers };
}

// (moved verbatim from sync.js lines 325-342)
async function ensureSignedIn() {
  const { auth } = await getFirebaseInstances();
  return new Promise((resolve, reject) => {
    const unsub = _authHelpers.onAuthStateChanged(auth, async (user) => {
      unsub();
      if (user) {
        resolve(user);
      } else {
        try {
          const cred = await _authHelpers.signInAnonymously(auth);
          resolve(cred.user);
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}

// (moved verbatim from sync.js lines 344-355)
async function cloudPush(encryptedPayload, uid) {
  const { db } = await getFirebaseInstances();
  const { doc, setDoc } = _fsHelpers;
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    ciphertext: encryptedPayload.ciphertext,
    salt: encryptedPayload.salt,
    iv: encryptedPayload.iv,
    lastModified: encryptedPayload.lastModified,
    version: encryptedPayload.version || SYNC_VERSION
  });
}

// (moved verbatim from sync.js lines 357-363)
async function cloudPull(uid) {
  const { db } = await getFirebaseInstances();
  const { doc, getDoc } = _fsHelpers;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data();
}

// (moved verbatim from sync.js lines 503-508)
function stopLiveSync() {
  if (_unsubSnapshot) {
    _unsubSnapshot();
    _unsubSnapshot = null;
  }
}

// (moved verbatim from sync.js lines 510-554)
// Uses window._syncHelpers (sealed, non-writable) instead of bare window globals (audit H-03, H-04).
async function startLiveSync(uid) {
  stopLiveSync();
  try {
    const { db } = await getFirebaseInstances();
    const { doc, onSnapshot } = _fsHelpers;
    _unsubSnapshot = onSnapshot(
      doc(db, 'users', uid),
      async (snap) => {
        if (!snap.exists()) return;
        if (!window._syncHelpers.hasCachedKey()) return;
        const cloudDoc = snap.data();
        const resolution = detectConflict(
          (typeof S !== 'undefined' && S && S.lastModified) || 0,
          cloudDoc.lastModified || 0,
          (typeof S !== 'undefined' && S && S.lastSyncedAt) || 0
        );
        if (resolution !== 'CLOUD_NEWER') return;
        try {
          const cloudJson = await window._syncHelpers.decryptWithCachedKey(cloudDoc);
          if (typeof _persistTimer !== 'undefined' && _persistTimer) {
            clearTimeout(_persistTimer);
            _persistTimer = null;
          }
          var _liveParsed = JSON.parse(cloudJson);
          if (typeof window._validateStateShape === 'function' && !window._validateStateShape(_liveParsed)) { console.warn('[sync] live snapshot failed shape validation'); return; }
          S = _liveParsed;
          if (typeof normaliseState === 'function') normaliseState();
          if (typeof CMK !== 'undefined') CMK = S.currentMonthKey || Object.keys(S.months || {})[0];
          S.lastSyncedAt = Date.now();
          if (typeof idbSet === 'function') idbSet(SK, JSON.stringify(S)).catch(() => {});
          setSyncStatus('synced');
          renderSyncStatus();
          if (typeof renderDash === 'function') renderDash();
        } catch (e) {
          console.error('[sync] live decrypt failed:', e);
        }
      },
      (err) => {
        console.error('[sync] onSnapshot error:', err);
        setSyncStatus('error');
        renderSyncStatus();
      }
    );
  } catch (err) {
    console.error('[sync] startLiveSync failed:', err);
  }
}

// ── Firebase provider plugin object (D-01) ────────────────────────────────────
// push() returns user.uid so the dispatcher can pass uid to startLive(uid) (D-04).

var _firebasePlugin = {
  push: async function(encryptedPayload) {
    var user = await ensureSignedIn();
    await cloudPush(encryptedPayload, user.uid);
    return user.uid;
  },
  pull: async function() {
    var user = await ensureSignedIn();
    return await cloudPull(user.uid);
  },
  startLive: async function(uid) {
    var resolvedUid = uid || (await ensureSignedIn()).uid;
    await startLiveSync(resolvedUid);
  },
  stopLive: function() {
    stopLiveSync();
  }
};

// ── Self-registration (D-08) ──────────────────────────────────────────────────
if (typeof window.registerProvider === 'function') {
  window.registerProvider('firebase', _firebasePlugin);
}

// ── Phase 3: upgrade anonymous session to permanent email/password account ────
// Called when a user who already has anonymous sync data creates a full account.
// Preserves uid → Firestore doc (sync data) is retained without migration.
async function linkAnonymousToEmail(email, password) {
  const { auth } = await getFirebaseInstances();
  if (!auth.currentUser?.isAnonymous) throw new Error('No anonymous session to upgrade');
  const credential = _authHelpers.EmailAuthProvider.credential(email, password);
  return _authHelpers.linkWithCredential(auth.currentUser, credential);
}

// ── Internal Firebase helpers for QR callers in sync.js (Research Finding 4) ──
// Non-writable + non-configurable so no script can overwrite the references.
// (Previous audit finding: plain window.X = fn assignments are writable by any script.)
[
  ['_fbGetInstances',       getFirebaseInstances],
  ['_fbEnsureSignedIn',    ensureSignedIn],
  ['_fbCloudPull',         cloudPull],
  ['_fbLinkAnonymous',     linkAnonymousToEmail]
].forEach(function(pair) {
  Object.defineProperty(window, pair[0], {
    value: pair[1],
    writable: false,
    configurable: false,
    enumerable: false
  });
});
