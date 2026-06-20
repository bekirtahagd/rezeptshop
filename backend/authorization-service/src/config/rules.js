// Hardcodierte Grundregeln — kein DB-Zugriff hier.
// Rückgabewerte:
//   true  → definitiv erlaubt
//   false → definitiv verboten
//   null  → Entscheidung erfordert DB-Lookup (Custom Permission)

const PERMISSION_LEVELS = { read: 1, write: 2, owner: 3 };

function isAllowed(userId, role, resourceType, resourceId, ownerId, action) {
  if (role === 'admin') return true;

  switch (resourceType) {
    case 'product':
      // Jeder darf lesen, niemand außer Admins darf schreiben/löschen
      return action === 'read';

    case 'user':
      // User dürfen nur ihr eigenes Profil lesen/bearbeiten
      if (action === 'read' || action === 'write') {
        return String(userId) === String(resourceId);
      }
      return false;

    case 'wishlist':
      // Besitzer darf alles
      if (String(userId) === String(ownerId)) return true;
      // Kein Besitzer → Custom Permission in DB prüfen (null = DB-Lookup nötig)
      return null;

    default:
      return false;
  }
}

// Prüft ob eine gespeicherte Permission (z.B. 'write') für die gewünschte Aktion ausreicht.
// 'owner' schließt 'write' ein, 'write' schließt 'read' ein.
function meetsPermissionLevel(storedPermission, requiredAction) {
  const required = PERMISSION_LEVELS[requiredAction] ?? 1;
  const has = PERMISSION_LEVELS[storedPermission] ?? 0;
  return has >= required;
}

module.exports = { isAllowed, meetsPermissionLevel };
