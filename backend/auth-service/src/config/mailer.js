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

// Verschickt die Bestätigungsmail mit einem Link auf die Frontend-Seite confirm.html.
// FRONTEND_URL = Basis-URL des user-portals (Fallback: localhost:8080). Die Seite liest den
// Token aus der URL und ruft GET /api/auth/confirm/:token auf — so sieht der User eine
// echte Seite statt rohem JSON.
async function sendVerificationMail(toEmail, token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const confirmLink = `${frontendUrl}/confirm.html?token=${token}`;

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

// Verschickt den Einmal-Login-Link + Code für AUTH-5.
// Der Link zeigt auf die Frontend-Seite magic.html, die den Token aus der URL liest, ihn gegen
// ein JWT tauscht (GET /api/auth/magic-login/:token) und in den Shop weiterleitet. Der Code
// (= derselbe Token) steht zusätzlich in der Mail für die Code-Variante im Frontend.
async function sendMagicLinkMail(toEmail, token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const loginLink = `${frontendUrl}/magic.html?token=${token}`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: toEmail,
    subject: 'Dein Einmal-Login für den Rezeptshop',
    text: `Hallo!\n\nDu hast einen Einmal-Login angefordert.\n\nLink: ${loginLink}\n\nOder gib diesen Code ein: ${token}\n\nDer Link ist 15 Minuten gültig und kann nur einmal verwendet werden.`,
    html: `<p>Hallo!</p>
           <p>Du hast einen Einmal-Login angefordert.</p>
           <p><a href="${loginLink}">Hier klicken, um dich anzumelden</a></p>
           <p>Oder gib diesen Code ein: <strong>${token}</strong></p>
           <p>Der Link ist 15 Minuten gültig und kann nur einmal verwendet werden.</p>`,
  });
}

module.exports = { sendVerificationMail, sendMagicLinkMail };
