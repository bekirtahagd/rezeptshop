const nodemailer = require('nodemailer');

// Mail-Transport. Die MAIL_*-Werte kommen aus der zentralen .env.
// In der Entwicklung zeigen sie auf Mailpit (in Docker fest auf mailpit:1025 verdrahtet,
// siehe Schritt 2c). Mailpit braucht keine Authentifizierung — daher nur dann auth setzen,
// wenn ein MAIL_USER gesetzt ist (für echten SMTP-Server in Produktion).
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT, 10),
  secure: false, // Mailpit/STARTTLS-frei in Dev; Prod-Server regelt das über Port 587
  auth: process.env.MAIL_USER
    ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
    : undefined,
});

// Verschickt die Bestätigungsmail mit dem Link …/api/auth/confirm/<token>.
// AUTH_PUBLIC_URL = öffentliche Basis-URL des auth-service (Fallback: localhost:3001).
async function sendVerificationMail(toEmail, token) {
  const baseUrl = process.env.AUTH_PUBLIC_URL || 'http://localhost:3001';
  const confirmLink = `${baseUrl}/api/auth/confirm/${token}`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: toEmail,
    subject: 'Bitte bestätige deine E-Mail-Adresse',
    text: `Willkommen beim Rezeptshop!\n\nBitte bestätige deine E-Mail-Adresse über folgenden Link:\n${confirmLink}\n\nDer Link ist 24 Stunden gültig.`,
    html: `<p>Willkommen beim Rezeptshop!</p>
           <p>Bitte bestätige deine E-Mail-Adresse über folgenden Link:</p>
           <p><a href="${confirmLink}">${confirmLink}</a></p>
           <p>Der Link ist 24 Stunden gültig.</p>`,
  });
}

module.exports = { sendVerificationMail };
