const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticate = require('../middleware/authenticate');

// Alle Warenkorb-Endpunkte verlangen ein gültiges JWT.
// Der Warenkorb gehört immer dem eingeloggten User (req.user.userId) — ein
// Cross-User-Zugriff ist gar nicht möglich, daher kein zusätzlicher /check nötig.
router.use(authenticate);

// Liefert die cart_id des Users; legt den Warenkorb an, falls noch keiner existiert.
// carts.user_id ist UNIQUE → ON CONFLICT verhindert Dubletten bei parallelen Requests.
async function getOrCreateCartId(userId) {
  const existing = await db.query('SELECT cart_id FROM carts WHERE user_id = $1', [userId]);
  if (existing.rows.length > 0) return existing.rows[0].cart_id;

  const created = await db.query(
    `INSERT INTO carts (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING cart_id`,
    [userId]
  );
  return created.rows[0].cart_id;
}

// Lädt den Warenkorb-Inhalt inkl. Produktdaten und berechnet Zwischensummen + Gesamtsumme.
async function loadCart(cartId) {
  const items = await db.query(
    `SELECT ci.product_id, p.name, p.price, p.amount AS stock, ci.quantity,
            (p.price * ci.quantity) AS subtotal
     FROM cart_items ci
     JOIN products p ON p.product_id = ci.product_id
     WHERE ci.cart_id = $1
     ORDER BY ci.product_id`,
    [cartId]
  );
  const total = items.rows.reduce((sum, row) => sum + Number(row.subtotal), 0);
  return { cart_id: cartId, items: items.rows, total: Number(total.toFixed(2)) };
}

// GET /api/cart  (INV-6)
router.get('/', async (req, res) => {
  try {
    const cartId = await getOrCreateCartId(req.user.userId);
    return res.status(200).json(await loadCart(cartId));
  } catch (err) {
    console.error('Fehler bei GET /cart:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/cart  (INV-6)
// Legt ein Produkt in den Warenkorb. Nicht möglich, wenn das Produkt nicht verfügbar ist
// (amount = 0) oder die gewünschte Gesamtmenge den Bestand übersteigt → 409.
router.post('/', async (req, res) => {
  const { productId, quantity } = req.body;
  const qty = quantity === undefined ? 1 : Number(quantity);

  if (!productId) {
    return res.status(400).json({ error: 'productId ist erforderlich' });
  }
  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'quantity muss eine positive ganze Zahl sein' });
  }

  try {
    const productResult = await db.query(
      'SELECT product_id, amount FROM products WHERE product_id = $1',
      [productId]
    );
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }

    const stock = productResult.rows[0].amount;
    if (stock <= 0) {
      return res.status(409).json({ error: 'Produkt ist nicht verfügbar' });
    }
    if (qty > stock) {
      return res.status(409).json({ error: `Nur ${stock} Stück verfügbar` });
    }

    const cartId = await getOrCreateCartId(req.user.userId);

    // Upsert: liegt das Produkt schon im Korb, wird die neue Menge gesetzt (nicht addiert).
    await db.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
      [cartId, productId, qty]
    );

    return res.status(200).json(await loadCart(cartId));
  } catch (err) {
    console.error('Fehler bei POST /cart:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /api/cart/:productId  (INV-6)
// Entfernt eine Position aus dem Warenkorb (idempotent).
router.delete('/:productId', async (req, res) => {
  try {
    const cartId = await getOrCreateCartId(req.user.userId);
    await db.query(
      'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2',
      [cartId, req.params.productId]
    );
    return res.status(200).json(await loadCart(cartId));
  } catch (err) {
    console.error('Fehler bei DELETE /cart/:productId:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
