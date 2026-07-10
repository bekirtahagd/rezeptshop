# Konzept — user-service (Port 3005)

Der **user-service** ist die Admin-Verwaltung der Benutzerkonten. Er deckt vier
Prüfungspunkte ab (USER-1 bis USER-4) und folgt exakt dem Muster des bereits fertigen
`inventory-service`.

## Grundprinzip (wie alle Nicht-Auth-Services)

Der user-service prüft **nie selbst** JWTs oder Berechtigungen, sondern delegiert per HTTP:

| Frage | Zielservice | Endpunkt |
|---|---|---|
| „Ist das Token gültig? Wer ist der User?" | auth-service | `POST /api/auth/validate` |
| „Darf dieser User diese Aktion ausführen?" | authorization-service | `POST /api/authorization/check` |

- Jeder Endpunkt verlangt ein gültiges JWT (`authenticate`-Middleware → sonst `401`).
- Ist ein Zielservice nicht erreichbar → `503`.
- Der user-service kennt das `JWT_SECRET` **nicht**.

## Endpunkte

| ID | Methode + Pfad | Zweck | Wer darf |
|---|---|---|---|
| USER-1 | `GET /api/users/:id` | User-Details abrufen | Admin (jeden) · User (nur eigenes Profil) |
| USER-2 | `DELETE /api/users/:id` | User-Account löschen | Admin (jeden, außer sich selbst) · User (nur sich selbst) |
| USER-3 | `POST /api/users/admin` | Admin-Account anlegen | nur Admin |
| USER-4 | `PUT /api/users/:id/lock` · `/unlock` | User sperren/entsperren | nur Admin (außer sich selbst) |

### USER-1 — `GET /api/users/:id`
Berechtigung: `check({ resourceType:'user', resourceId::id, action:'read' })`.
Die hardcodierte Regel im authorization-service erlaubt einem Admin jeden User und einem
normalen User nur das **eigene** Profil → sonst `403`. Rückgabe **ohne `password`**:
`user_id, email, role, locked, email_verified, created_at`. Unbekannte ID → `404`.

### USER-2 — `DELETE /api/users/:id`
- Admin löscht **eigenen** Account → `400` (Self-Lockout-Schutz, der letzte Admin darf sich
  nicht selbst entfernen).
- User löscht **eigenen** Account → erlaubt (Selbst-Löschung).
- sonst → `check({ action:'delete' })` (nur Admin) → bei `false` `403`.

`DELETE FROM users WHERE user_id = $1`. Fremdschlüssel räumen abhängige Daten automatisch:
Warenkorb, Tokens, Permissions und Wishlists per `CASCADE`; Bestellungen bleiben erhalten
(`orders.user_id` → `SET NULL`, Kaufhistorie geht nicht verloren). Unbekannte ID → `404`.

### USER-3 — `POST /api/users/admin`
Berechtigung: `check({ resourceType:'user', resourceId:'new', action:'create' })` → nur Admin
(`resourceId` ist ein Platzhalter, da noch keine ID existiert — analog zu `POST /products`).
Body `{ email, password }` validieren (sonst `400`), E-Mail-Dublette → `409`. Passwort mit
`bcryptjs` hashen (kompatibel zu den vorhandenen `$2b$`-Seed-Hashes). Anlegen mit
`role = 'admin'` und `email_verified = true` (vom Admin erstellte Konten brauchen keinen
Bestätigungs-Flow). Rückgabe `{ user_id, email, role }` → `201`.

### USER-4 — `PUT /api/users/:id/lock` und `/unlock`
Gemeinsame Logik, gesetztes Flag `locked = true` (lock) bzw. `false` (unlock).
Berechtigung: `check({ action:'lock' | 'unlock' })` → nur Admin, sonst `403`. Anschließend:
Admin sperrt **eigenen** Account → `400` (Self-Lockout-Schutz). `UPDATE users SET locked = $1`.
Unbekannte ID → `404`. Rückgabe `{ user_id, email, locked }` → `200`.

> Die Sperre wirkt **sofort**: der auth-service prüft `locked` bei jedem `/validate`
> live aus der Datenbank — ein gesperrter User verliert sofort den Zugriff auf alle Services.

## Warum keine Änderung am authorization-service nötig ist

Die Regel für `resourceType: 'user'` (`config/rules.js`) liefert:
- `role === 'admin'` → **immer** `true`,
- non-Admin → nur bei `action 'read'`/`'write'` auf dem **eigenen** Profil `true`, **sonst `false`**.

Damit sind `delete`, `lock`, `unlock`, `create` automatisch admin-only. Die einzige
zusätzliche Logik (Selbst-Löschung für User, Self-Lockout-Schutz für Admins) liegt bewusst im
user-service, weil sie account-spezifisch ist und nicht zum generischen Berechtigungsmodell gehört.

## Statuscodes (Übersicht)

| Code | Bedeutung |
|---|---|
| 200 | Erfolg (get, delete, lock, unlock) |
| 201 | Admin angelegt |
| 400 | Validierung fehlt · Admin-Selbst-Aktion (Self-Lockout) |
| 401 | kein/ungültiges Token |
| 403 | keine Berechtigung (z. B. User löscht fremden Account) |
| 404 | User nicht gefunden |
| 409 | E-Mail bereits vergeben (USER-3) |
| 503 | auth-service oder authorization-service nicht erreichbar |

## Dateistruktur

```
backend/user-service/
├── Dockerfile
├── package.json            # + pg, dotenv, bcryptjs
└── src/
    ├── index.js            # Express, /health, Routen
    ├── config/
    │   ├── db.js           # PostgreSQL-Pool (Kopie inventory-service)
    │   └── services.js     # validateToken + checkPermission (Kopie)
    ├── middleware/
    │   └── authenticate.js # JWT-Delegation an auth-service (Kopie)
    └── routes/
        └── users.js        # USER-1 bis USER-4
```

## Test (Bruno)

Kollektion `bruno/user-service/`. Login-Helfer (`admin@test.de` → `{{adminToken}}`,
`max@test.de` → `{{token}}`), dann pro Endpunkt Erfolgs- und Fehlerfälle mit echten
`assert`-Blöcken. Tests idempotent (ohne DB-Reset wiederholbar): zum Testen von delete/lock
wird jeweils ein Wegwerf-User angelegt und am Ende wieder freigegeben/gelöscht.

---

## Nachträgliche Härtung (Session 12) — Passwort-Validierung bei USER-3

`POST /api/users/admin` prüfte bisher nur, ob `email`/`password` vorhanden sind — anders als
`/register` im auth-service, das E-Mail-Format und Mindestlänge erzwingt. Ein Admin konnte so
mit ungültiger Mail oder 1-Zeichen-Passwort angelegt werden. Behoben: dieselben Prüfungen wie
in `/register` inline ergänzt (`EMAIL_REGEX` + `password.length < 8` → jeweils `400`). Bewusst
als Kopie der Regeln — die Services teilen keinen Code, nur die DB.
