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

// Verhindert, dass Produkt-Freitexte (Name, Zutaten, Rezept) im HTML-Teil der Mail als
// Markup interpretiert werden (die Werte stammen aus der DB / Admin-Eingabe).
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Verschickt die Kaufbestätigung (INV-8) nach einem erfolgreichen Kauf.
// order = { order_id, date, status, positions: [{ name, amount, purchase_price, ingredients, recipe }], total }
// Zutaten (ingredients) + Zubereitung (recipe) sind das "gekaufte" Rezept und werden nur hier,
// nach dem Kauf, ausgeliefert — auf der Produkt-Detailseite bleiben sie verborgen.
async function sendPurchaseConfirmationMail(toEmail, order) {
  const lines = order.positions.map(
    (p) => `  - ${p.amount}x ${p.name} à ${Number(p.purchase_price).toFixed(2)} €`
  );
  const rowsHtml = order.positions
    .map(
      (p) =>
        `<tr><td>${p.amount}x</td><td>${escapeHtml(p.name)}</td><td>${Number(p.purchase_price).toFixed(2)} €</td></tr>`
    )
    .join('');

  // Rezept-Abschnitte je gekauftem Produkt (nur wenn ein Rezept/Zutaten hinterlegt sind).
  const recipePositions = order.positions.filter((p) => p.recipe || p.ingredients);

  const recipeText = recipePositions
    .map((p) => {
      const parts = [`\n🧾 Rezept für ${p.name}`];
      if (p.ingredients) parts.push(`\nZutaten:\n${p.ingredients}`);
      if (p.recipe) parts.push(`\nZubereitung:\n${p.recipe}`);
      return parts.join('\n');
    })
    .join('\n');

  const recipeHtml = recipePositions
    .map((p) => {
      const parts = [`<h3>🧾 Rezept für ${escapeHtml(p.name)}</h3>`];
      if (p.ingredients) {
        parts.push(`<p><strong>Zutaten:</strong></p><p style="white-space: pre-wrap;">${escapeHtml(p.ingredients)}</p>`);
      }
      if (p.recipe) {
        parts.push(`<p><strong>Zubereitung:</strong></p><p style="white-space: pre-wrap;">${escapeHtml(p.recipe)}</p>`);
      }
      return parts.join('');
    })
    .join('<hr>');

  const recipeTextBlock = recipeText
    ? `\n\n─────────────────────────────\nDeine Rezepte:\n${recipeText}`
    : '';
  const recipeHtmlBlock = recipeHtml
    ? `<hr><h2>Deine Rezepte</h2>${recipeHtml}`
    : '';

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: toEmail,
    subject: `Deine Bestellung #${order.order_id} im Rezeptshop`,
    text: `Vielen Dank für deinen Einkauf!\n\nBestellnummer: ${order.order_id}\n\n${lines.join('\n')}\n\nGesamtsumme: ${Number(order.total).toFixed(2)} €${recipeTextBlock}`,
    html: `<p>Vielen Dank für deinen Einkauf!</p>
           <p>Bestellnummer: <strong>${order.order_id}</strong></p>
           <table>${rowsHtml}</table>
           <p>Gesamtsumme: <strong>${Number(order.total).toFixed(2)} €</strong></p>
           ${recipeHtmlBlock}`,
  });
}

module.exports = { sendPurchaseConfirmationMail };
