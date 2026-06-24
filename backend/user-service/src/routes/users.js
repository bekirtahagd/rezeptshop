const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const authenticate = require('../middleware/authenticate');
const { checkPermission, ServiceUnavailableError } = require('../config/services');

// Alle User-Endpunkte verlangen ein gültiges JWT (Grundregel).
router.use(authenticate);

// Wandelt einen ServiceUnavailableError in 503 um, alles andere in 500.
// Wird von den Route-Handlern im catch verwendet, damit ein nicht erreichbarer
// authorization-service sauber als 503 gemeldet wird.
function handleServiceError(err, res) {
  if (err instanceof ServiceUnavailableError) {
    return res.status(503).json({ error: 'Berechtigungsdienst nicht erreichbar' });
  }
  console.error('Interner Fehler:', err.message);
  return res.status(500).json({ error: 'Interner Fehler' });
}

// GET /api/users/:id  (USER-1)
// User-Details abrufen. Admin darf jeden lesen, ein normaler User nur sein eigenes Profil
// (hardcodierte 'user'-Regel im authorization-service, action 'read').
router.get('/:id', async (req, res) => {
  try {
    const allowed = await checkPermission({
      userId: req.user.userId,
      role: req.user.role,
      resourceType: 'user',
      resourceId: req.params.id,
      action: 'read',
    });
    if (!allowed) {
      return res.status(403).json({ error: 'Keine Berechtigung — nur das eigene Profil oder als Admin' });
    }

    const result = await db.query(
      `SELECT user_id, email, role, locked, email_verified, created_at
       FROM users WHERE user_id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User nicht gefunden' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    return handleServiceError(err, res);
  }
});

// DELETE /api/users/:id  (USER-2)
// Löschregeln:
//   - Admin löscht eigenen Account  → 400 (Self-Lockout-Schutz)
//   - User löscht eigenen Account   → erlaubt (Selbst-Löschung)
//   - sonst                         → nur Admin (authorization-check, action 'delete')
// Abhängige Daten räumen die Fremdschlüssel: Warenkorb/Tokens/Permissions/Wishlists per
// CASCADE, Bestellungen bleiben als Historie erhalten (orders.user_id → SET NULL).
router.delete('/:id', async (req, res) => {
  const isSelf = String(req.user.userId) === String(req.params.id);

  if (isSelf && req.user.role === 'admin') {
    return res.status(400).json({ error: 'Ein Admin kann den eigenen Account nicht löschen' });
  }

  try {
    if (!isSelf) {
      const allowed = await checkPermission({
        userId: req.user.userId,
        role: req.user.role,
        resourceType: 'user',
        resourceId: req.params.id,
        action: 'delete',
      });
      if (!allowed) {
        return res.status(403).json({ error: 'Keine Berechtigung — nur Admins dürfen fremde Accounts löschen' });
      }
    }

    const result = await db.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING user_id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User nicht gefunden' });
    }
    return res.status(200).json({ message: 'User gelöscht' });
  } catch (err) {
    return handleServiceError(err, res);
  }
});

// POST /api/users/admin  (USER-3)
// Admin-Account anlegen (nur Admin). resourceId 'new', weil noch keine ID existiert.
router.post('/admin', async (req, res) => {
  const { email, password } = req.body;

  try {
    const allowed = await checkPermission({
      userId: req.user.userId,
      role: req.user.role,
      resourceType: 'user',
      resourceId: 'new',
      action: 'create',
    });
    if (!allowed) {
      return res.status(403).json({ error: 'Keine Berechtigung — nur Admins dürfen Admins anlegen' });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'email und password sind erforderlich' });
    }

    const exists = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'E-Mail bereits vergeben' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (email, password, role, email_verified)
       VALUES ($1, $2, 'admin', true)
       RETURNING user_id, email, role`,
      [email, hash]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return handleServiceError(err, res);
  }
});

// Gemeinsame Logik für USER-4: setzt das Flag `locked` (true = sperren, false = entsperren).
// Nur Admin (authorization-check action 'lock'/'unlock'); ein Admin darf sich aber nicht
// selbst sperren (Self-Lockout-Schutz). Die Sperre wirkt sofort, da der auth-service
// `locked` bei jedem /validate live aus der DB prüft.
async function setLocked(req, res, locked, action) {
  const isSelf = String(req.user.userId) === String(req.params.id);

  try {
    const allowed = await checkPermission({
      userId: req.user.userId,
      role: req.user.role,
      resourceType: 'user',
      resourceId: req.params.id,
      action,
    });
    if (!allowed) {
      return res.status(403).json({ error: 'Keine Berechtigung — nur Admins dürfen User sperren/entsperren' });
    }

    if (isSelf) {
      return res.status(400).json({ error: 'Ein Admin kann den eigenen Account nicht sperren' });
    }

    const result = await db.query(
      'UPDATE users SET locked = $1 WHERE user_id = $2 RETURNING user_id, email, locked',
      [locked, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User nicht gefunden' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    return handleServiceError(err, res);
  }
}

// PUT /api/users/:id/lock   (USER-4) — User sperren
router.put('/:id/lock', (req, res) => setLocked(req, res, true, 'lock'));

// PUT /api/users/:id/unlock (USER-4) — User entsperren
router.put('/:id/unlock', (req, res) => setLocked(req, res, false, 'unlock'));

module.exports = router;
