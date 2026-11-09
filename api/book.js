// Book a call form → email to hello@veerpoint.io via Zoho SMTP.
// Env (set in Vercel, never in code): ZOHO_SMTP_HOST, ZOHO_SMTP_USER, ZOHO_APP_PASSWORD. Optional: BOOK_TO.
const nodemailer = require('nodemailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v, max) => String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  // Bots: filled honeypot or submitted faster than a person can type. Pretend success.
  if (body.website || (Number(body.elapsed) > 0 && Number(body.elapsed) < 2500)) {
    return res.status(200).json({ ok: true });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const company = clean(body.company, 160);
  const phone = clean(body.phone, 40);
  if (!name || !company || !EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  const { ZOHO_SMTP_HOST, ZOHO_SMTP_USER, ZOHO_APP_PASSWORD } = process.env;
  if (!ZOHO_SMTP_HOST || !ZOHO_SMTP_USER || !ZOHO_APP_PASSWORD) {
    console.error('book: SMTP env vars missing');
    return res.status(500).json({ ok: false, error: 'config' });
  }

  const transport = nodemailer.createTransport({
    host: ZOHO_SMTP_HOST,
    port: 465,
    secure: true,
    auth: { user: ZOHO_SMTP_USER, pass: ZOHO_APP_PASSWORD },
  });

  const text = [
    'New Book a call request from veerpoint.io',
    '',
    `Name:    ${name}`,
    `Email:   ${email}`,
    `Company: ${company}`,
    `Phone:   ${phone || '-'}`,
    '',
    'Reply to this email to answer them directly.',
  ].join('\n');

  try {
    await transport.sendMail({
      from: `"Veerpoint website" <${ZOHO_SMTP_USER}>`,
      to: process.env.BOOK_TO || 'hello@veerpoint.io',
      replyTo: { name, address: email },
      subject: `Book a call: ${name}, ${company}`,
      text,
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('book: send failed', e && e.code, e && e.responseCode);
    return res.status(502).json({ ok: false, error: 'send' });
  }
};
