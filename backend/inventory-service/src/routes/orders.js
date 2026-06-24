const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticate = require('../middleware/authenticate');
const { sendPurchaseConfirmationMail } = require('../config/mailer');

// Alle Bestell-Endpunkte verlangen ein gültiges JWT. Bestellungen gehören immer dem
// eingeloggten User (req.user.userId) — kein zusätzlicher /check nötig.
router.use(authenticate);

// POST /api/orders  (INV-7 Kauf + INV-8 Bestätigungsmail)
// Wandelt den Warenkorb des Users in eine abgeschlossene Bestellung um.
// Läuft komplett in EINER Transaktion mit SELECT ... FOR UPDATE auf die Produktzeilen,
// damit zwei gleichzeitige Käufe den Bestand nicht "überverkaufen" können.
router.post('/', async (req, res) => {
  const userId = req.user.userId;
  const client = await db.connect();
  try {
    // 1. Käufe verlangen eine bestätigte E-Mail (Entscheidung aus dem auth-Konzept).
    //    /validate liefert email_verified nicht — daher hier frisch aus der DB lesen.
    const userResult = await client.query(
      'SELECT email_verified FROM users WHERE user_id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User nicht gefunden' });
    }
    if (!userResult.rows[0].email_verified) {
      return res.status(403).json({ error: 'Bitte bestätige zuerst deine E-Mail-Adresse, um einzukaufen' });
    }

    // 2. Warenkorb laden.
    const cartResult = await client.query('SELECT cart_id FROM carts WHERE user_id = $1', [userId]);
    if (cartResult.rows.length === 0) {
      return res.status(400).json({ error: 'Warenkorb ist leer' });
    }
    const cartId = cartResult.rows[0].cart_id;

    const itemsResult = await client.query(
      'SELECT product_id, quantity FROM cart_items WHERE cart_id = $1',
      [cartId]
    );
    if (itemsResult.rows.length === 0) {
      return res.status(400).json({ error: 'Warenkorb ist leer' });
    }

    await client.query('BEGIN');

    // 3. Je Position: Produkt sperren (FOR UPDATE), Bestand prüfen.
    const positions = [];
    for (const item of itemsResult.rows) {
      const productResult = await client.query(
        'SELECT product_id, name, price, amount FROM products WHERE product_id = $1 FOR UPDATE',
        [item.product_id]
      );
      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Produkt ${item.product_id} existiert nicht mehr` });
      }
      const product = productResult.rows[0];
      if (item.quantity > product.amount) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Nicht genug Bestand für "${product.name}" (verfügbar: ${product.amount}, gewünscht: ${item.quantity})`,
        });
      }
      positions.push({
        product_id: product.product_id,
        name: product.name,
        purchase_price: product.price, // Preis zum KAUFZEITPUNKT (Historie bleibt korrekt)
        amount: item.quantity,
      });
    }

    // 4. Bestellung anlegen.
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, status) VALUES ($1, 'completed')
       RETURNING order_id, date, status`,
      [userId]
    );
    const order = orderResult.rows[0];

    // 5. Positionen anlegen + Bestand reduzieren.
    for (const pos of positions) {
      await client.query(
        `INSERT INTO orderpositions (order_id, product_id, purchase_price, amount)
         VALUES ($1, $2, $3, $4)`,
        [order.order_id, pos.product_id, pos.purchase_price, pos.amount]
      );
      await client.query(
        'UPDATE products SET amount = amount - $1 WHERE product_id = $2',
        [pos.amount, pos.product_id]
      );
    }

    // 6. Warenkorb leeren.
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

    await client.query('COMMIT');

    const total = positions.reduce((sum, p) => sum + Number(p.purchase_price) * p.amount, 0);
    const orderSummary = {
      order_id: order.order_id,
      date: order.date,
      status: order.status,
      positions,
      total: Number(total.toFixed(2)),
    };

    // 7. Bestätigungsmail (INV-8) — NACH dem Commit. Ein Mailfehler darf den bereits
    //    abgeschlossenen Kauf nicht rückgängig machen, daher nur geloggt.
    try {
      await sendPurchaseConfirmationMail(req.user.email, orderSummary);
    } catch (mailErr) {
      console.error('Kaufbestätigungsmail konnte nicht gesendet werden:', mailErr.message);
    }

    return res.status(201).json(orderSummary);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Fehler bei POST /orders:', err.message);
    return res.status(500).json({ error: 'Kauf fehlgeschlagen' });
  } finally {
    client.release();
  }
});

// GET /api/orders  (INV-7 Kaufhistorie)
// Alle Bestellungen des eingeloggten Users inkl. Positionen, neueste zuerst.
router.get('/', async (req, res) => {
  try {
    const ordersResult = await db.query(
      'SELECT order_id, date, status FROM orders WHERE user_id = $1 ORDER BY date DESC, order_id DESC',
      [req.user.userId]
    );

    const orders = [];
    for (const order of ordersResult.rows) {
      // product_id kann NULL sein (Produkt nachträglich gelöscht) — Name aus products
      // dann nicht verfügbar, der Eintrag bleibt aber in der Historie erhalten.
      const positionsResult = await db.query(
        `SELECT op.product_id, p.name, op.purchase_price, op.amount,
                (op.purchase_price * op.amount) AS subtotal
         FROM orderpositions op
         LEFT JOIN products p ON p.product_id = op.product_id
         WHERE op.order_id = $1
         ORDER BY op.orderposition_id`,
        [order.order_id]
      );
      const total = positionsResult.rows.reduce((sum, row) => sum + Number(row.subtotal), 0);
      orders.push({
        order_id: order.order_id,
        date: order.date,
        status: order.status,
        positions: positionsResult.rows,
        total: Number(total.toFixed(2)),
      });
    }

    return res.status(200).json(orders);
  } catch (err) {
    console.error('Fehler bei GET /orders:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
