// Hardcodierte Grundregeln — kein DB-Zugriff hier.
// Rückgabewerte:
//   true  → definitiv erlaubt
//   false → definitiv verboten
//   null  → Entscheidung erfordert DB-Lookup (Custom Permission)

const PERMISSION_LEVELS = { read: 1, write: 2, owner: 3 };

// Welche gespeicherte Permission-Stufe verlangt eine angefragte Aktion?
// read → read(1); schreibende Aktionen → write(2); zerstörende/verwaltende → owner(3).
// Fail-safe: unbekannte Aktionen verlangen die höchste Stufe (siehe meetsPermissionLevel),
// damit eine vergessene Zuordnung nie versehentlich zu wenig verlangt.
const ACTION_REQUIRED_LEVEL = {
  read: 1,
  write: 2,
  create: 2,
  delete: 3,
  lock: 3,
  unlock: 3,
  owner: 3,
};

function isAllowed(userId, role, resourceType, resourceId, ownerId, action) {
  if (role === 'admin') return true;

  switch (resourceType) {
    case 'product':
      // Jeder darf lesen. Schreiben/Löschen ist per Baseline nur Admins erlaubt —
      // aber statt hart zu verbieten fallen wir zum DB-Lookup durch (null), damit eine
      // explizit vergebene Custom-Permission (write/owner auf ein Produkt) auch greift.
      if (action === 'read') return true;
      return null;

    case 'user':
      // Eigenes Profil lesen/bearbeiten ist immer erlaubt. Für alles andere (z.B. ein
      // fremdes Profil lesen) entscheidet eine evtl. vergebene Custom-Permission → DB-Lookup.
      if ((action === 'read' || action === 'write') && String(userId) === String(resourceId)) {
        return true;
      }
      return null;

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
// 'owner' schließt 'write' ein, 'write' schließt 'read' ein. Unbekannte Aktion → höchste
// Stufe verlangt (fail-safe: lieber fälschlich verbieten als fälschlich erlauben).
function meetsPermissionLevel(storedPermission, requiredAction) {
  const required = ACTION_REQUIRED_LEVEL[requiredAction] ?? PERMISSION_LEVELS.owner;
  const has = PERMISSION_LEVELS[storedPermission] ?? 0;
  return has >= required;
}

module.exports = { isAllowed, meetsPermissionLevel };
