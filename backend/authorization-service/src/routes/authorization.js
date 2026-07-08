const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAllowed, meetsPermissionLevel } = require('../config/rules');

// POST /api/authorization/check
// Ablauf:
//   1. Hardcodierte Regeln prüfen (isAllowed)
//   2. Wenn Ergebnis null → Custom Permission aus DB lesen
router.post('/check', async (req, res) => {
  const { userId, role, resourceType, resourceId, ownerId, action } = req.body;

  if (!userId || !role || !resourceType || !resourceId || !action) {
    return res.status(400).json({ error: 'userId, role, resourceType, resourceId und action sind erforderlich' });
  }

  const validTypes = ['product', 'user', 'wishlist'];
  if (!validTypes.includes(resourceType)) {
    return res.status(400).json({ error: `Ungültiger resourceType. Erlaubt: ${validTypes.join(', ')}` });
  }

  // Schritt 1: Hardcodierte Regeln — gibt true, false oder null zurück
  const hardcoded = isAllowed(userId, role, resourceType, resourceId, ownerId, action);

  if (hardcoded === true)  return res.json({ allowed: true });
  if (hardcoded === false) return res.json({ allowed: false });

  // Schritt 2: null → Custom Permission aus der permissions-Tabelle prüfen.
  // resource_id ist eine INT-Spalte. Platzhalter-IDs ohne Bezug auf eine echte Zeile
  // (z.B. 'new' beim Anlegen eines Produkts/Admins) können nie eine Permission haben —
  // wir lehnen sie direkt ab, statt mit einem nicht-numerischen Wert die DB abzufragen.
  if (!/^\d+$/.test(String(resourceId))) {
    return res.json({ allowed: false });
  }

  try {
    const result = await db.query(
      'SELECT permission FROM permissions WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3',
      [userId, resourceType, resourceId]
    );

    if (result.rows.length === 0) return res.json({ allowed: false });

    const allowed = meetsPermissionLevel(result.rows[0].permission, action);
    return res.json({ allowed });
  } catch (err) {
    console.error('DB-Fehler bei /check:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/authorization/grant
// Speichert eine Custom-Permission in der permissions-Tabelle.
// ON CONFLICT ... DO UPDATE = Upsert: wenn der User bereits eine Permission auf diese
// Ressource hat, wird sie überschrieben statt einen Fehler zu werfen.
router.post('/grant', async (req, res) => {
  const { requesterId, requesterRole, targetUserId, resourceId, resourceType, ownerId, permission } = req.body;

  if (!requesterId || !requesterRole || !targetUserId || !resourceId || !resourceType || !permission) {
    return res.status(400).json({ error: 'Fehlende Pflichtfelder: requesterId, requesterRole, targetUserId, resourceId, resourceType, permission' });
  }

  const validPermissions = ['read', 'write', 'owner'];
  if (!validPermissions.includes(permission)) {
    return res.status(400).json({ error: `Ungültige Permission. Erlaubt: ${validPermissions.join(', ')}` });
  }

  const validTypes = ['product', 'user', 'wishlist'];
  if (!validTypes.includes(resourceType)) {
    return res.status(400).json({ error: `Ungültiger resourceType. Erlaubt: ${validTypes.join(', ')}` });
  }

  const isOwner = String(requesterId) === String(ownerId);
  const isAdmin = requesterRole === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Nur der Besitzer oder ein Admin darf Berechtigungen vergeben' });
  }

  try {
    await db.query(
      `INSERT INTO permissions (user_id, resource_type, resource_id, permission)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, resource_type, resource_id)
       DO UPDATE SET permission = EXCLUDED.permission`,
      [targetUserId, resourceType, resourceId, permission]
    );
    return res.json({ message: 'Permission granted' });
  } catch (err) {
    console.error('DB-Fehler bei /grant:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
