const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticate = require('../middleware/authenticate');
const { checkPermission, ServiceUnavailableError } = require('../config/services');

// Alle Produkt-Endpunkte verlangen ein gültiges JWT (Grundregel).
router.use(authenticate);

// Hilfs-Middleware für Schreiboperationen (POST/PUT/DELETE): fragt den
// authorization-service, ob der User Produkte bearbeiten darf (nur Admins).
// Bei Produkten hängt die Entscheidung nicht von einer konkreten resource_id ab
// (hardcodierte Regel: Admin = ja, sonst nein) — für POST (noch keine ID) reicht
// daher ein Platzhalter, der nur die Pflichtfeld-Prüfung des /check erfüllt.
async function requireProductWrite(req, res, next) {
  try {
    const allowed = await checkPermission({
      userId: req.user.userId,
      role: req.user.role,
      resourceType: 'product',
      resourceId: req.params.id || 'new',
      action: 'write',
    });
    if (!allowed) {
      return res.status(403).json({ error: 'Keine Berechtigung — nur Admins dürfen Produkte verwalten' });
    }
    next();
  } catch (err) {
    if (err instanceof ServiceUnavailableError) {
      return res.status(503).json({ error: 'Berechtigungsdienst nicht erreichbar' });
    }
    console.error('Fehler bei der Berechtigungsprüfung:', err.message);
    return res.status(500).json({ error: 'Interner Fehler' });
  }
}

// GET /api/products?name=&category=&minPrice=&maxPrice=  (INV-2)
// Produktsuche mit mehreren, frei kombinierbaren Kriterien. Die WHERE-Klausel wird
// dynamisch aus den vorhandenen Query-Parametern gebaut. Ohne Parameter → alle Produkte.
router.get('/', async (req, res) => {
  const { name, category, minPrice, maxPrice } = req.query;

  const conditions = [];
  const values = [];

  if (name) {
    values.push(`%${name}%`);
    conditions.push(`name ILIKE $${values.length}`);
  }
  if (category) {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }
  if (minPrice) {
    values.push(minPrice);
    conditions.push(`price >= $${values.length}`);
  }
  if (maxPrice) {
    values.push(maxPrice);
    conditions.push(`price <= $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await db.query(
      `SELECT product_id, name, description, price, amount, category, created_at
       FROM products ${where}
       ORDER BY product_id`,
      values
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Fehler bei GET /products:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /api/products/:id  (INV-1)
// Einzelnes Produkt per eindeutiger ID.
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT product_id, name, description, price, amount, category, created_at
       FROM products WHERE product_id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Fehler bei GET /products/:id:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/products  (INV-3, nur Admin)
// Legt ein neues Produkt an.
router.post('/', requireProductWrite, async (req, res) => {
  const { name, description, price, amount, category } = req.body;

  if (!name || price === undefined || amount === undefined) {
    return res.status(400).json({ error: 'name, price und amount sind erforderlich' });
  }
  if (Number(price) < 0 || Number(amount) < 0) {
    return res.status(400).json({ error: 'price und amount dürfen nicht negativ sein' });
  }

  try {
    const result = await db.query(
      `INSERT INTO products (name, description, price, amount, category)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING product_id, name, description, price, amount, category, created_at`,
      [name, description || null, price, amount, category || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Fehler bei POST /products:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT /api/products/:id  (INV-5, nur Admin)
// Aktualisiert nur die übergebenen Felder (dynamisches SET).
router.put('/:id', requireProductWrite, async (req, res) => {
  const allowedFields = ['name', 'description', 'price', 'amount', 'category'];
  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      values.push(req.body[field]);
      updates.push(`${field} = $${values.length}`);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Keine zu aktualisierenden Felder angegeben' });
  }
  if (req.body.price !== undefined && Number(req.body.price) < 0) {
    return res.status(400).json({ error: 'price darf nicht negativ sein' });
  }
  if (req.body.amount !== undefined && Number(req.body.amount) < 0) {
    return res.status(400).json({ error: 'amount darf nicht negativ sein' });
  }

  values.push(req.params.id);

  try {
    const result = await db.query(
      `UPDATE products SET ${updates.join(', ')}
       WHERE product_id = $${values.length}
       RETURNING product_id, name, description, price, amount, category, created_at`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Fehler bei PUT /products/:id:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /api/products/:id  (INV-4, nur Admin)
// Warenkorb-/Wunschlisten-Einträge werden per FK CASCADE mitgelöscht;
// orderpositions behalten die Historie (product_id wird auf NULL gesetzt).
router.delete('/:id', requireProductWrite, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM products WHERE product_id = $1 RETURNING product_id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }
    return res.status(200).json({ message: 'Produkt gelöscht' });
  } catch (err) {
    console.error('Fehler bei DELETE /products/:id:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
