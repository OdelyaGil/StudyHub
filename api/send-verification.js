const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

const ALLOWED_ORIGINS = [
  'https://study-hub-coral-seven.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
];

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, continueUrl } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const settings = continueUrl ? { url: continueUrl } : undefined;
    const link = await admin.auth().generateEmailVerificationLink(email, settings);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"StudyHub" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'אמת את כתובת המייל שלך – StudyHub',
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px;background:#F4EEF9;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:48px;">🎓</div>
            <h1 style="color:#3785D8;margin:8px 0 0;">StudyHub</h1>
          </div>
          <h2 style="color:#1A1A2E;text-align:center;">ברוך הבא!</h2>
          <p style="color:#555;text-align:center;font-size:15px;line-height:1.7;">
            לאימות כתובת המייל שלך, לחץ/י על הכפתור:
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${link}"
               style="background:#3785D8;color:#fff;padding:14px 36px;text-decoration:none;border-radius:12px;font-size:15px;font-weight:700;display:inline-block;">
              אמת כתובת מייל ✓
            </a>
          </div>
          <p style="color:#aaa;font-size:12px;text-align:center;margin-top:24px;">
            אם לא נרשמת ל-StudyHub, ניתן להתעלם מהמייל הזה.
          </p>
        </div>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('send-verification error:', err);
    return res.status(500).json({ error: String(err) });
  }
};
