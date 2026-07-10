const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../config/db');
const authenticate = require('../middleware/authenticate');
const { checkPermission, ServiceUnavailableError } = require('../config/services');

// Spaltenliste, die alle Produkt-Endpunkte zurückgeben (inkl. image_url — der Dateiname
// des Produktbilds, das der nginx-Container `image-assets` ausliefert).
const PRODUCT_COLUMNS =
  'product_id, name, description, price, amount, category, image_url, ' +
  'recipe, ingredients, allergens, prep_time_minutes, servings, created_at';

// recipe (Zubereitung) und ingredients (Zutaten) sind das "gekaufte" Rezept: sie dürfen nur
// Admins (Produktpflege) sehen und werden sonst erst nach dem Kauf per Mail geliefert. Für
// normale User werden sie hier aus der Antwort entfernt, damit sie gar nicht erst im Browser
// landen. allergens/prep_time/servings bleiben öffentlich (Produkt-Detailseite).
function stripSecretFields(row, role) {
  if (role === 'admin') return row;
  const { recipe, ingredients, ...rest } = row;
  return rest;
}

// ── Bild-Upload (multer) ────────────────────────────────────────────────────
// Zielordner = Repo-Ordner assets/product-images (per Bind-Mount unter /app/uploads).
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // Dateiname deterministisch pro Upload: p_<produktId>_<timestamp>.<ext>.
  // Timestamp verhindert Browser-Caching-Probleme beim Ersetzen eines Bildes.
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, `p_${req.params.id}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  // Nur echte Bilddateien akzeptieren.
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Nur Bilddateien sind erlaubt'));
  },
});

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
      `SELECT ${PRODUCT_COLUMNS}
       FROM products ${where}
       ORDER BY product_id`,
      values
    );
    return res.status(200).json(result.rows.map((row) => stripSecretFields(row, req.user.role)));
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
      `SELECT ${PRODUCT_COLUMNS}
       FROM products WHERE product_id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }
    return res.status(200).json(stripSecretFields(result.rows[0], req.user.role));
  } catch (err) {
    console.error('Fehler bei GET /products/:id:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/products  (INV-3, nur Admin)
// Legt ein neues Produkt an.
router.post('/', requireProductWrite, async (req, res) => {
  const {
    name, description, price, amount, category,
    recipe, ingredients, allergens, prep_time_minutes, servings,
  } = req.body;

  if (!name || price === undefined || amount === undefined) {
    return res.status(400).json({ error: 'name, price und amount sind erforderlich' });
  }
  if (Number(price) < 0 || Number(amount) < 0) {
    return res.status(400).json({ error: 'price und amount dürfen nicht negativ sein' });
  }

  try {
    const result = await db.query(
      `INSERT INTO products
         (name, description, price, amount, category, recipe, ingredients, allergens, prep_time_minutes, servings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${PRODUCT_COLUMNS}`,
      [
        name, description || null, price, amount, category || null,
        recipe || null, ingredients || null, allergens || null,
        prep_time_minutes ?? null, servings ?? null,
      ]
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
  const allowedFields = [
    'name', 'description', 'price', 'amount', 'category',
    'recipe', 'ingredients', 'allergens', 'prep_time_minutes', 'servings',
  ];
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
       RETURNING ${PRODUCT_COLUMNS}`,
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

// POST /api/products/:id/image  (nur Admin)
// Lädt ein Produktbild hoch: multer speichert die Datei ins Volume (image-assets liefert sie
// aus), danach wird der Dateiname in products.image_url abgelegt. Ein evtl. vorhandenes altes
// Bild wird gelöscht. Feldname des multipart-Uploads: "image".
// Reihenfolge: erst Admin-Prüfung (requireProductWrite), dann multer — so wird eine Datei von
// Nicht-Admins gar nicht erst auf die Platte geschrieben.
router.post('/:id/image', requireProductWrite, (req, res) => {
  upload.single('image')(req, res, async (uploadErr) => {
    if (uploadErr) {
      // multer-Fehler (zu groß / falscher Typ) → 400 statt 500.
      return res.status(400).json({ error: uploadErr.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Bilddatei übergeben (Feld "image")' });
    }

    try {
      // Existiert das Produkt? Und wie hieß das bisherige Bild?
      const existing = await db.query(
        'SELECT image_url FROM products WHERE product_id = $1',
        [req.params.id]
      );
      if (existing.rows.length === 0) {
        // Produkt weg → gerade hochgeladene Datei wieder entfernen (kein Waisen-File).
        fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
        return res.status(404).json({ error: 'Produkt nicht gefunden' });
      }

      const oldImage = existing.rows[0].image_url;

      const result = await db.query(
        `UPDATE products SET image_url = $1
         WHERE product_id = $2
         RETURNING ${PRODUCT_COLUMNS}`,
        [req.file.filename, req.params.id]
      );

      // Altes Bild aufräumen (falls vorhanden und nicht identisch).
      if (oldImage && oldImage !== req.file.filename) {
        fs.unlink(path.join(UPLOAD_DIR, oldImage), () => {});
      }

      return res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error('Fehler bei POST /products/:id/image:', err.message);
      // DB-Fehler → gerade hochgeladene Datei nicht verwaisen lassen.
      fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
  });
});

// DELETE /api/products/:id  (INV-4, nur Admin)
// Warenkorb-/Wunschlisten-Einträge werden per FK CASCADE mitgelöscht;
// orderpositions behalten die Historie (product_id wird auf NULL gesetzt).
router.delete('/:id', requireProductWrite, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM products WHERE product_id = $1 RETURNING product_id, image_url',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }
    // Zugehörige Bilddatei mit entfernen (best effort).
    const img = result.rows[0].image_url;
    if (img) {
      fs.unlink(path.join(UPLOAD_DIR, img), () => {});
    }
    return res.status(200).json({ message: 'Produkt gelöscht' });
  } catch (err) {
    console.error('Fehler bei DELETE /products/:id:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
