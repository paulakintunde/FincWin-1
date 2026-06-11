// js/config.local.js
// Firebase web config + Google OAuth client ID. These are PUBLIC identifiers,
// not secrets — safe to commit and serve to the browser. Access is enforced by
// firestore.rules (per-user) and the OAuth authorized-origins list, NOT by hiding these.
// Real secrets (Lemon Squeezy / Resend / Admin) live ONLY in Vercel env vars — never here.
// This file is intentionally committed (not gitignored): the no-build static deploy has
// no step to inject config, so the app reads these values directly from window.__FINCWIN_CONFIG__.
window.__FINCWIN_CONFIG__ = {
  apiKey: "AIzaSyDLw-cuS70yV0MHa9M8ov331DrniIbRR74",
  authDomain: "fincwin.firebaseapp.com",
  projectId: "fincwin",
  storageBucket: "fincwin.firebasestorage.app",
  messagingSenderId: "36594855417",
  appId: "1:36594855417:web:0fd97107697550fb24a128",
  googleClientId: "812943954808-da0enpo3g2d1c687rtu5695t9r7nd3da.apps.googleusercontent.com",
  FIREBASE_GOOGLE_CLIENT_ID: "36594855417-nvq9ieq7pga1m0cvjvo93f394logj173.apps.googleusercontent.com"
};
