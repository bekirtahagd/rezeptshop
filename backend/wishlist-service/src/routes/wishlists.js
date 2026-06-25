const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authenticate = require('../middleware/authenticate');
const { checkPermission, grantPermission, ServiceUnavailableError } = require('../config/services');

// Alle Wunschlisten-Endpunkte verlangen ein gültiges JWT (Grundregel).
router.use(authenticate);

// Wandelt einen ServiceUnavailableError in 503 um, alles andere in 500.
function handleServiceError(err, res) {
  if (err instanceof ServiceUnavailableError) {
    return res.status(503).json({ error: 'Berechtigungsdienst nicht erreichbar' });
  }
  console.error('Interner Fehler:', err.message);
  return res.status(500).json({ error: 'Interner Fehler' });
}

// Lädt eine Wunschliste; gibt die Zeile zurück oder null (→ Aufrufer meldet 404).
// Wird vor jedem konkreten Listen-Zugriff aufgerufen, um owner_user_id für die
// Berechtigungsprüfung zu kennen.
async function loadWishlist(listId) {
  const result = await db.query(
    'SELECT list_id, owner_user_id, name, description, created_at FROM wishlists WHERE list_id = $1',
    [listId]
  );
  return result.rows[0] || null;
}

// ─────────────────────────────────────────────────────────────
// WUN-1 — POST /api/wishlists
// Eigene Wunschliste anlegen. Keine Berechtigungsprüfung nötig: der Ersteller wird
// automatisch Besitzer (owner_user_id = eigene userId).
// ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, description } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name ist erforderlich' });
  }

  try {
    const result = await db.query(
      `INSERT INTO wishlists (owner_user_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING list_id, owner_user_id, name, description, created_at`,
      [req.user.userId, name.trim(), description ?? null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return handleServiceError(err, res);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/wishlists
// Eigene Listen + per WUN-4 mit mir geteilte Listen. Die Filterung passiert in SQL,
// daher kein Per-Liste-Berechtigungs-Call nötig.
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT w.list_id, w.owner_user_id, w.name, w.description, w.created_at
       FROM wishlists w
       WHERE w.owner_user_id = $1
          OR EXISTS (
            SELECT 1 FROM permissions p
            WHERE p.user_id = $1 AND p.resource_type = 'wishlist' AND p.resource_id = w.list_id
          )
       ORDER BY w.list_id`,
      [req.user.userId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    return handleServiceError(err, res);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/wishlists/:id
// Eine Liste samt enthaltener Produkte lesen. Erfordert 'read' (Besitzer/Admin oder
// per Share berechtigt).
// ─────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const list = await loadWishlist(req.params.id);
    if (!list) return res.status(404).json({ error: 'Wunschliste nicht gefunden' });

    const allowed = await checkPermission({
      userId: req.user.userId,
      role: req.user.role,
      resourceType: 'wishlist',
      resourceId: req.params.id,
      ownerId: list.owner_user_id,
      action: 'read',
    });
    if (!allowed) return res.status(403).json({ error: 'Keine Leseberechtigung für diese Liste' });

    const products = await db.query(
      `SELECT p.product_id, p.name, p.description, p.price, p.amount, p.category
       FROM wishlist_product wp
       JOIN products p ON p.product_id = wp.product_id
       WHERE wp.list_id = $1
       ORDER BY p.product_id`,
      [req.params.id]
    );

    return res.status(200).json({ ...list, products: products.rows });
  } catch (err) {
    return handleServiceError(err, res);
  }
});

// ─────────────────────────────────────────────────────────────
// WUN-2 — PUT /api/wishlists/:id
// Liste umbenennen/Beschreibung ändern. Erfordert 'write'.
// ─────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { name, description } = req.body;

  if (name === undefined && description === undefined) {
    return res.status(400).json({ error: 'Mindestens eines von name oder description ist erforderlich' });
  }
  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    return res.status(400).json({ error: 'name darf nicht leer sein' });
  }

  try {
    const list = await loadWishlist(req.params.id);
    if (!list) return res.status(404).json({ error: 'Wunschliste nicht gefunden' });

    const allowed = await checkPermission({
      userId: req.user.userId,
      role: req.user.role,
      resourceType: 'wishlist',
      resourceId: req.params.id,
      ownerId: list.owner_user_id,
      action: 'write',
    });
    if (!allowed) return res.status(403).json({ error: 'Keine Schreibberechtigung für diese Liste' });

    // COALESCE: nur übergebene Felder ändern, der Rest bleibt unverändert.
    const result = await db.query(
      `UPDATE wishlists
       SET name = COALESCE($2, name), description = COALESCE($3, description)
       WHERE list_id = $1
       RETURNING list_id, owner_user_id, name, description, created_at`,
      [req.params.id, name !== undefined ? name.trim() : null, description ?? null]
    );
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    return handleServiceError(err, res);
  }
});

// ─────────────────────────────────────────────────────────────
// WUN-2 — POST /api/wishlists/:id/products  { productId }
// Produkt zur Liste hinzufügen. Erfordert 'write'. Idempotent (ON CONFLICT DO NOTHING).
// ─────────────────────────────────────────────────────────────
router.post('/:id/products', async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({ error: 'productId ist erforderlich' });
  }

  try {
    const list = await loadWishlist(req.params.id);
    if (!list) return res.status(404).json({ error: 'Wunschliste nicht gefunden' });

    const allowed = await checkPermission({
      userId: req.user.userId,
      role: req.user.role,
      resourceType: 'wishlist',
      resourceId: req.params.id,
      ownerId: list.owner_user_id,
      action: 'write',
    });
    if (!allowed) return res.status(403).json({ error: 'Keine Schreibberechtigung für diese Liste' });

    const product = await db.query('SELECT 1 FROM products WHERE product_id = $1', [productId]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Produkt nicht gefunden' });
    }

    await db.query(
      `INSERT INTO wishlist_product (list_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (list_id, product_id) DO NOTHING`,
      [req.params.id, productId]
    );
    return res.status(201).json({ list_id: Number(req.params.id), product_id: Number(productId) });
  } catch (err) {
    return handleServiceError(err, res);
  }
});

// ─────────────────────────────────────────────────────────────
// WUN-2 — DELETE /api/wishlists/:id/products/:productId
// Produkt aus der Liste entfernen. Erfordert 'write'.
// ─────────────────────────────────────────────────────────────
router.delete('/:id/products/:productId', async (req, res) => {
  try {
    const list = await loadWishlist(req.params.id);
    if (!list) return res.status(404).json({ error: 'Wunschliste nicht gefunden' });

    const allowed = await checkPermission({
      userId: req.user.userId,
      role: req.user.role,
      resourceType: 'wishlist',
      resourceId: req.params.id,
      ownerId: list.owner_user_id,
      action: 'write',
    });
    if (!allowed) return res.status(403).json({ error: 'Keine Schreibberechtigung für diese Liste' });

    const result = await db.query(
      'DELETE FROM wishlist_product WHERE list_id = $1 AND product_id = $2 RETURNING product_id',
      [req.params.id, req.params.productId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produkt ist nicht in dieser Liste' });
    }
    return res.status(200).json({ message: 'Produkt aus Liste entfernt' });
  } catch (err) {
    return handleServiceError(err, res);
  }
});

// ─────────────────────────────────────────────────────────────
// WUN-3 — DELETE /api/wishlists/:id
// Liste löschen. Erfordert 'owner' (echter Besitzer, Admin oder per Share 'owner').
// CASCADE räumt wishlist_product. Hinweis: permissions-Zeilen bleiben als Waisen.
// ─────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const list = await loadWishlist(req.params.id);
    if (!list) return res.status(404).json({ error: 'Wunschliste nicht gefunden' });

    const allowed = await checkPermission({
      userId: req.user.userId,
      role: req.user.role,
      resourceType: 'wishlist',
      resourceId: req.params.id,
      ownerId: list.owner_user_id,
      action: 'owner',
    });
    if (!allowed) return res.status(403).json({ error: 'Keine Berechtigung zum Löschen dieser Liste' });

    await db.query('DELETE FROM wishlists WHERE list_id = $1', [req.params.id]);
    return res.status(200).json({ message: 'Wunschliste gelöscht' });
  } catch (err) {
    return handleServiceError(err, res);
  }
});

// ─────────────────────────────────────────────────────────────
// WUN-4 — POST /api/wishlists/:id/share  { userId, authorizationType }
// Liste mit einem anderen User teilen. Die Berechtigungsprüfung übernimmt der
// authorization-service in /grant (nur echter Besitzer oder Admin darf vergeben).
// ─────────────────────────────────────────────────────────────
router.post('/:id/share', async (req, res) => {
  const { userId: targetUserId, authorizationType } = req.body;

  if (!targetUserId || !authorizationType) {
    return res.status(400).json({ error: 'userId und authorizationType sind erforderlich' });
  }
  // owner ist NICHT teilbar: Eine Liste hat genau einen Besitzer (Aufgabenstellung).
  // Teilen vergibt nur Lese- oder Schreibrechte.
  const validTypes = ['read', 'write'];
  if (!validTypes.includes(authorizationType)) {
    return res.status(400).json({ error: `Ungültiger authorizationType. Erlaubt: ${validTypes.join(', ')}` });
  }

  try {
    const list = await loadWishlist(req.params.id);
    if (!list) return res.status(404).json({ error: 'Wunschliste nicht gefunden' });

    const target = await db.query('SELECT 1 FROM users WHERE user_id = $1', [targetUserId]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'Ziel-User nicht gefunden' });
    }

    const result = await grantPermission({
      requesterId: req.user.userId,
      requesterRole: req.user.role,
      targetUserId,
      resourceId: req.params.id,
      resourceType: 'wishlist',
      ownerId: list.owner_user_id,
      permission: authorizationType,
    });

    if (!result.ok) {
      if (result.status === 403) {
        return res.status(403).json({ error: 'Nur der Besitzer oder ein Admin darf diese Liste teilen' });
      }
      if (result.status === 400) {
        return res.status(400).json({ error: 'Ungültige Teilen-Anfrage' });
      }
      return res.status(500).json({ error: 'Berechtigung konnte nicht vergeben werden' });
    }

    return res.status(200).json({
      message: 'Wunschliste geteilt',
      list_id: Number(req.params.id),
      userId: targetUserId,
      authorizationType,
    });
  } catch (err) {
    return handleServiceError(err, res);
  }
});

module.exports = router;
