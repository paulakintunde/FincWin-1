/**
 * Self-hosted password-reset email.
 *
 * Replaces the client-side Firebase sendPasswordResetEmail() flow so the email:
 *   - is sent from our authenticated domain (noreply@fincwin.com) via Resend
 *     → passes SPF/DKIM/DMARC, lands in the inbox instead of spam
 *   - has a clean, branded subject ("Reset your FincWin password")
 *   - links to https://www.fincwin.com/reset (handled by reset.html), not
 *     the default *.firebaseapp.com action handler
 *
 * Uses the Firebase Admin SDK to mint the reset oobCode, then sends the email
 * ourselves. Always returns a generic success response so the endpoint cannot
 * be used to enumerate which email addresses have accounts.
 *
 * Required Vercel env vars:
 *   FIREBASE_SERVICE_ACCOUNT — the full service-account JSON (single line)
 *                              Firebase Console → Project Settings → Service
 *                              accounts → Generate new private key
 *   RESEND_API_KEY           — already set (used by api/contact.js)
 *
 * Runs on the Node runtime (not edge) because firebase-admin needs Node APIs.
 */

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { checkRateLimit } from '../lib/rate-limit.js';

const SITE_ORIGIN = 'https://www.fincwin.com';

// ── Admin SDK singleton (survives warm invocations) ──────────────────────────
let _adminAuth = null;
function adminAuth() {
  if (_adminAuth) return _adminAuth;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(JSON.parse(raw)) });
  _adminAuth = getAuth(app);
  return _adminAuth;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!await checkRateLimit(ip, 'forgot', { limit: 5, windowSecs: 60 })) {
    return res.status(429).json({ error: 'Too many requests — please try again shortly.' });
  }

  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }
  const cleanEmail = email.trim().toLowerCase();

  // Generic response used for every outcome (success, no-such-user, etc.) so we
  // never reveal whether an account exists for this address.
  const generic = { ok: true };

  let resetLink;
  try {
    // generatePasswordResetLink returns the default action URL containing the
    // oobCode; we extract the code and point it at our own reset page instead.
    const defaultLink = await adminAuth().generatePasswordResetLink(cleanEmail);
    const oobCode = new URL(defaultLink).searchParams.get('oobCode');
    if (!oobCode) throw new Error('No oobCode in generated link');
    resetLink = `${SITE_ORIGIN}/reset?oobCode=${encodeURIComponent(oobCode)}`;
  } catch (err) {
    // Unknown email → Firebase throws auth/user-not-found. Swallow it and return
    // the generic success so the response is identical to the happy path.
    if (err.code === 'auth/user-not-found' || err.code === 'auth/email-not-found') {
      return res.status(200).json(generic);
    }
    console.error('forgot-password: generate link failed', err.code || err.message);
    return res.status(500).json({ error: 'Could not start password reset. Please try again.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('forgot-password: RESEND_API_KEY not set');
    return res.status(503).json({ error: 'Email service not configured' });
  }

  try {
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'FincWin <noreply@fincwin.com>',
        to: [cleanEmail],
        subject: 'Reset your FincWin password',
        html: emailHtml(resetLink),
        text: emailText(resetLink),
      }),
    });
    if (!sent.ok) {
      console.error('forgot-password: Resend error', sent.status, await sent.text().catch(() => ''));
      return res.status(502).json({ error: 'Could not send the reset email. Please try again.' });
    }
  } catch (err) {
    console.error('forgot-password: Resend fetch failed', err.message);
    return res.status(502).json({ error: 'Could not send the reset email. Please try again.' });
  }

  return res.status(200).json(generic);
}

// ── Email body ────────────────────────────────────────────────────────────────
function emailHtml(link) {
  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <p style="font-family:Georgia,serif;font-size:22px;font-weight:600;color:#5a6e3f;margin:0 0 24px">FincWin</p>
  <h1 style="font-size:20px;font-weight:600;margin:0 0 12px">Reset your password</h1>
  <p style="font-size:15px;line-height:1.6;color:#3a3a3a;margin:0 0 24px">
    We received a request to reset the password for your FincWin account. Click the button below to choose a new one. This link expires in one hour.
  </p>
  <p style="margin:0 0 28px">
    <a href="${link}" style="display:inline-block;background:#5a6e3f;color:#fff;text-decoration:none;font-size:15px;font-weight:500;padding:12px 28px;border-radius:8px">Reset password</a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0 0 8px">If the button doesn't work, copy and paste this link into your browser:</p>
  <p style="font-size:13px;line-height:1.6;word-break:break-all;margin:0 0 28px"><a href="${link}" style="color:#5a6e3f">${link}</a></p>
  <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:0;border-top:1px solid #eee;padding-top:20px">
    If you didn't request this, you can safely ignore this email — your password won't change.
  </p>
</div>`;
}

function emailText(link) {
  return [
    'Reset your FincWin password',
    '',
    'We received a request to reset the password for your FincWin account.',
    'Open this link to choose a new password (expires in one hour):',
    '',
    link,
    '',
    "If you didn't request this, you can safely ignore this email — your password won't change.",
  ].join('\n');
}
