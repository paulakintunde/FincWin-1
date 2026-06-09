'use strict';
// gdrive.js — Google Drive provider plugin for the sync.js plugin registry.
// Phase 04 replaces Phase 03 no-op stubs with Drive REST API v3 calls.
// Loaded AFTER firebase.js so both providers are registered before boot() runs.
//
// Interface: push(encryptedPayload) | pull() | startLive() | stopLive()
// Security: driveAccessToken stored in IDB meta only — never in S or exported state.

// ── Module-scoped state ───────────────────────────────────────────────────────
var _driveAccessToken = null;   // current GIS token (set by connectGoogleDrive / handleOAuthReturn)
var _driveFileId = null;        // Drive file ID after first push (null until first push)
var _tokenClient = null;        // GIS TokenClient instance (reused across calls)
var _driveEmail = null;         // Google account email (display only)

// ── GIS Script Loader ─────────────────────────────────────────────────────────
function _loadGIS(callback) {
  if (window.google && window.google.accounts) { callback(); return; }
  var s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.onload = callback;
  s.onerror = function() {
    if (typeof setSyncStatus === 'function') setSyncStatus('error');
    if (typeof showToast === 'function') showToast('Could not load Google Sign-In', 'warn-t');
  };
  document.head.appendChild(s);
}

// ── GIS Token Client Initializer ──────────────────────────────────────────────
function _initTokenClient(callback, errorCallback) {
  return window.google.accounts.oauth2.initTokenClient({
    client_id: window.__FINCWIN_CONFIG__ && window.__FINCWIN_CONFIG__.googleClientId,
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    callback: callback,
    error_callback: errorCallback
  });
}

// ── Drive API Helpers ─────────────────────────────────────────────────────────

async function _driveCreate(accessToken, encryptedPayload) {
  var boundary = '-------fincwin_boundary_' + Date.now();
  var metadata = JSON.stringify({ name: 'fincwin-state.enc', parents: ['appDataFolder'] });
  var body =
    '--' + boundary + '\r\n' +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata + '\r\n' +
    '--' + boundary + '\r\n' +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(encryptedPayload) + '\r\n' +
    '--' + boundary + '--';
  var response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&spaces=appDataFolder',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/related; boundary="' + boundary + '"',
        'Authorization': 'Bearer ' + accessToken
      },
      body: body
    }
  );
  if (!response.ok) throw Object.assign(new Error('Drive create failed: ' + response.status), { status: response.status });
  var data = await response.json();
  return data.id;
}

async function _driveUpdate(accessToken, fileId, encryptedPayload) {
  var response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media',
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      body: JSON.stringify(encryptedPayload)
    }
  );
  if (!response.ok) throw Object.assign(new Error('Drive update failed: ' + response.status), { status: response.status });
  return fileId;
}

async function _driveFindFile(accessToken) {
  var q = encodeURIComponent("name='fincwin-state.enc'");
  var response = await fetch(
    'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=' + q + '&fields=files(id,name)',
    { headers: { 'Authorization': 'Bearer ' + accessToken } }
  );
  if (!response.ok) throw Object.assign(new Error('Drive search failed: ' + response.status), { status: response.status });
  var data = await response.json();
  return (data.files && data.files.length > 0) ? data.files[0].id : null;
}

async function _driveDownload(accessToken, fileId) {
  var response = await fetch(
    'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media',
    { headers: { 'Authorization': 'Bearer ' + accessToken } }
  );
  if (!response.ok) throw Object.assign(new Error('Drive download failed: ' + response.status), { status: response.status });
  return response.json();
}

async function _getDriveEmail(accessToken) {
  var response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  });
  if (!response.ok) return null;
  var data = await response.json();
  return data.email || null;  // SECURITY: caller uses textContent= only, never innerHTML
}

// ── Plugin Object ─────────────────────────────────────────────────────────────
var _gdrivePlugin = {
  push: async function(encryptedPayload) {
    if (!_driveAccessToken) throw new Error('Drive not authenticated');
    try {
      if (_driveFileId === null) {
        var newId = await _driveCreate(_driveAccessToken, encryptedPayload);
        _driveFileId = newId;
        if (typeof window._idbSetRaw === 'function') {
          window._idbSetRaw('driveFileId', newId).catch(function(){});
        }
      } else {
        await _driveUpdate(_driveAccessToken, _driveFileId, encryptedPayload);
      }
      return null;  // Drive has no uid — null skips startLive call in dispatcher
    } catch (err) {
      if (err.status === 401) {
        if (typeof setSyncStatus === 'function') setSyncStatus('needs-reauth');
      } else {
        if (typeof setSyncStatus === 'function') setSyncStatus('error');
        if (typeof showToast === 'function') showToast('Drive sync failed — check connection', 'warn-t');
      }
      throw err;
    }
  },

  pull: async function() {
    if (!_driveAccessToken) return null;
    try {
      if (_driveFileId === null) {
        var foundId = await _driveFindFile(_driveAccessToken);
        if (foundId === null) return null;
        _driveFileId = foundId;
        if (typeof window._idbSetRaw === 'function') {
          window._idbSetRaw('driveFileId', foundId).catch(function(){});
        }
      }
      return await _driveDownload(_driveAccessToken, _driveFileId);
    } catch (err) {
      if (err.status === 401) {
        if (typeof setSyncStatus === 'function') setSyncStatus('needs-reauth');
      } else {
        if (typeof setSyncStatus === 'function') setSyncStatus('error');
        if (typeof showToast === 'function') showToast('Drive sync failed — check connection', 'warn-t');
      }
      return null;
    }
  },

  startLive: function() { return Promise.resolve(); },
  stopLive: function() {}
};

// ── Internal Connect Handler ──────────────────────────────────────────────────
async function _onDriveTokenGranted(accessToken) {
  _driveAccessToken = accessToken;
  // CR-02: restore file ID from IDB so push() skips redundant _driveFindFile on every cold boot
  if (_driveFileId === null && typeof window._idbGetRaw === 'function') {
    var storedFileId = await window._idbGetRaw('driveFileId').catch(function(){ return null; });
    if (storedFileId) _driveFileId = storedFileId;
  }
  var email = await _getDriveEmail(accessToken);
  _driveEmail = email;
  if (typeof window._idbSetRaw === 'function') {
    // Encrypt the access token at rest when a session key is active.
    // sessionKeyEncrypt returns the original string when no key is set (S-02).
    var tokenToStore = typeof sessionKeyEncrypt === 'function'
      ? await sessionKeyEncrypt(accessToken)
      : accessToken;
    await window._idbSetRaw('driveAccessToken', tokenToStore);
    await window._idbSetRaw('driveTokenIssuedAt', Date.now());
    await window._idbSetRaw('driveEmail', email);
  }
  // D-09: set active backend, stop Firebase live listener
  if (typeof S !== 'undefined' && S) {
    S.activeBackend = 'gdrive';
    S.driveConnected = true;
    S.driveEmail = email;  // persisted in S blob so renderSyncSectionStatus can display it
    if (!S.syncConfig) S.syncConfig = { cloudEnabled: false, fileEnabled: false };
    S.syncConfig.cloudEnabled = true;  // IN-02: cloudPullOnLoad and cloudSyncPush gate on this flag
  }
  if (typeof idbSet === 'function' && typeof SK !== 'undefined') {
    idbSet(SK, JSON.stringify(S)).catch(function(){});
  }
  if (typeof window.stopProvider === 'function') window.stopProvider('firebase');
  if (typeof cloudPullOnLoad === 'function') cloudPullOnLoad();
  if (typeof renderSyncSectionStatus === 'function') renderSyncSectionStatus();
}

// ── Public connectGoogleDrive — triggers GIS popup (user-initiated) ───────────
function connectGoogleDrive() {
  if(typeof requirePlan==='function'&&!requirePlan('pro','Google Drive Sync')) return;
  var clientId = window.__FINCWIN_CONFIG__ && window.__FINCWIN_CONFIG__.googleClientId;
  if (!clientId || clientId === 'YOUR_GOOGLE_OAUTH_CLIENT_ID') {
    if (typeof showToast === 'function') showToast('Google Client ID not configured — add googleClientId to js/config.local.js', 'warn-t');
    console.error('[gdrive] Missing googleClientId in window.__FINCWIN_CONFIG__');
    return;
  }
  _loadGIS(function() {
    _tokenClient = _initTokenClient(
      function(tokenResponse) {
        if (tokenResponse.error) {
          if (typeof setSyncStatus === 'function') setSyncStatus('needs-reauth');
          if (typeof showToast === 'function') showToast('Google sign-in failed (' + tokenResponse.error + ')', 'warn-t');
          return;
        }
        _onDriveTokenGranted(tokenResponse.access_token);
      },
      function(err) {
        var errType = err && err.type;
        if (errType === 'popup_closed' || errType === 'popup_failed_to_open') {
          if (typeof showToast === 'function') showToast('Sign-in popup blocked or closed — allow popups for localhost:3355', 'warn-t');
        } else {
          if (typeof showToast === 'function') showToast('Google sign-in error: ' + (errType || 'unknown'), 'warn-t');
        }
        console.warn('[gdrive] GIS error:', errType);
      }
    );
    _tokenClient.requestAccessToken();
  });
}

// ── Silent Token Re-Issue — called by handleOAuthReturn in sync.js ────────────
function _silentTokenReissue(storedEmail, callback) {
  _loadGIS(function() {
    // CR-01: always reinitialise so the new callback is registered.
    // GIS token clients are immutable once created — reusing _tokenClient would
    // invoke the stale connectGoogleDrive callback, not this handleOAuthReturn callback.
    _tokenClient = _initTokenClient(callback, function(err) {
      callback({ error: (err && err.type) || 'popup_closed' });
    });
    _tokenClient.requestAccessToken({
      prompt: '',
      login_hint: storedEmail || ''
    });
  });
}

// ── Credential Reset — called by sync.js disconnectDrive() ───────────────────
function _resetCredentials() {
  _driveAccessToken = null;
  _driveFileId = null;
  _tokenClient = null;
  _driveEmail = null;
}

// ── Self-registration ─────────────────────────────────────────────────────────
if (typeof window.registerProvider === 'function') {
  window.registerProvider('gdrive', _gdrivePlugin);
}

// ── Window exposures ──────────────────────────────────────────────────────────
window.connectGoogleDrive = connectGoogleDrive;
window.gdriveSilentReissue = _silentTokenReissue;
window.gdriveResetCredentials = _resetCredentials;
window._onDriveTokenGranted = _onDriveTokenGranted;  // CR-01: handleOAuthReturn applies token to module scope
