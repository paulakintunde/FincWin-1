export const config = { runtime: 'edge' };

const ALLOWED_SUBJECTS = ['support', 'feature', 'billing', 'feedback', 'press', 'other'];

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { name, email, subject, message } = body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return json({ error: 'name, email, and message are required' }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email address' }, 400);
  }

  if (name.length > 200 || email.length > 200 || message.length > 5000) {
    return json({ error: 'Input too long' }, 400);
  }

  const subjectLabel = ALLOWED_SUBJECTS.includes(subject) ? subject : 'other';

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set');
    return json({ error: 'Email service not configured' }, 503);
  }

  const subjectLine = `[FincWin Contact] ${subjectLabel} — ${name}`;

  const html = `
<div style="font-family:system-ui,sans-serif;max-width:600px;color:#111">
  <h2 style="color:#5a6e3f;margin-bottom:4px">New contact form submission</h2>
  <p style="color:#6b7280;margin-top:0;font-size:13px">${new Date().toUTCString()}</p>
  <table style="width:100%;border-collapse:collapse;margin-top:24px">
    <tr><td style="padding:10px 12px;background:#f5f4f0;font-weight:600;font-size:13px;width:120px">Name</td><td style="padding:10px 12px;font-size:14px">${esc(name)}</td></tr>
    <tr><td style="padding:10px 12px;background:#f5f4f0;font-weight:600;font-size:13px">Email</td><td style="padding:10px 12px;font-size:14px"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
    <tr><td style="padding:10px 12px;background:#f5f4f0;font-weight:600;font-size:13px">Topic</td><td style="padding:10px 12px;font-size:14px">${esc(subjectLabel)}</td></tr>
    <tr><td style="padding:10px 12px;background:#f5f4f0;font-weight:600;font-size:13px;vertical-align:top">Message</td><td style="padding:10px 12px;font-size:14px;white-space:pre-wrap">${esc(message)}</td></tr>
  </table>
  <p style="margin-top:24px;font-size:12px;color:#6b7280">Reply directly to this email to respond to ${esc(name)}.</p>
</div>`;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'FincWin Contact <contact@fincwin.com>',
      to: ['paul.haking@gmail.com'],
      reply_to: email,
      subject: subjectLine,
      html,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.text().catch(() => '');
    console.error('Resend error', resendRes.status, err);
    return json({ error: 'Failed to send message. Please try again.' }, 502);
  }

  return json({ ok: true }, 200);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
