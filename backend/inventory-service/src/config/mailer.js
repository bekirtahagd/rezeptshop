const nodemailer = require('nodemailer');

// Mail-Transport. Die MAIL_*-Werte kommen aus der zentralen .env (gleiches Pattern wie
// im auth-service). In der Entwicklung zeigen sie auf Mailpit (in Docker fest auf
// mailpit:1025 verdrahtet). Mailpit braucht keine Authentifizierung — daher nur dann
// auth setzen, wenn ein MAIL_USER gesetzt ist (für echten SMTP-Server in Produktion).
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT, 10),
  secure: false,
  auth: process.env.MAIL_USER
    ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
    : undefined,
});

// Verschickt die Kaufbestätigung (INV-8) nach einem erfolgreichen Kauf.
// order = { order_id, date, status, positions: [{ name, amount, purchase_price }], total }
async function sendPurchaseConfirmationMail(toEmail, order) {
  const lines = order.positions.map(
    (p) => `  - ${p.amount}x ${p.name} à ${Number(p.purchase_price).toFixed(2)} €`
  );
  const rowsHtml = order.positions
    .map(
      (p) =>
        `<tr><td>${p.amount}x</td><td>${p.name}</td><td>${Number(p.purchase_price).toFixed(2)} €</td></tr>`
    )
    .join('');

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: toEmail,
    subject: `Deine Bestellung #${order.order_id} im Rezeptshop`,
    text: `Vielen Dank für deinen Einkauf!\n\nBestellnummer: ${order.order_id}\n\n${lines.join('\n')}\n\nGesamtsumme: ${Number(order.total).toFixed(2)} €`,
    html: `<p>Vielen Dank für deinen Einkauf!</p>
           <p>Bestellnummer: <strong>${order.order_id}</strong></p>
           <table>${rowsHtml}</table>
           <p>Gesamtsumme: <strong>${Number(order.total).toFixed(2)} €</strong></p>`,
  });
}

module.exports = { sendPurchaseConfirmationMail };
