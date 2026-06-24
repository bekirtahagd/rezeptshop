# Konzept: wishlist-service (Port 3004)

Deckt **WUN-1 bis WUN-4** ab: Wunschlisten erstellen, bearbeiten, Produkte hinzufügen/
entfernen, löschen und mit anderen Usern teilen (read/write/owner).

## Architektur (1:1 wie user-/inventory-service)

Der Service prüft **selbst keine JWTs und keine Berechtigungen**. Er delegiert per HTTP
(natives `fetch`, Node 20):

- **auth-service** `POST /api/auth/validate` → „Ist das Token gültig? Wer ist der User?"
  (in `middleware/authenticate.js`, schützt **alle** Endpunkte → 401 ohne gültiges Token).
- **authorization-service** `POST /api/authorization/check` → „Darf dieser User das?"
- **authorization-service** `POST /api/authorization/grant` → Teilen (WUN-4).

Nicht erreichbarer Zieldienst → **503**. Der Service kennt das `JWT_SECRET` nicht.

## Berechtigungsmodell

Jeder Zugriff auf eine konkrete Liste lädt zuerst die Liste (`loadWishlist(id)` → `owner_user_id`,
sonst **404**) und ruft dann:

```
checkPermission({ userId, role, resourceType:'wishlist', resourceId:id, ownerId:owner_user_id, action })
```

Der authorization-service entscheidet (hardcoded `rules.js`):
- Besitzer (`userId === ownerId`) → immer erlaubt.
- Admin → immer erlaubt.
- Sonst → DB-Lookup in `permissions` (Stufen read < write < owner).

**Action→Stufe-Mapping** (nutzt das bestehende 3-Stufen-Modell, **kein Eingriff** in den
authorization-service nötig):

| Aktion | action | nötige Stufe |
|---|---|---|
| Liste/Produkte lesen | `read` | read |
| Umbenennen, Produkt hinzufügen/entfernen | `write` | write |
| Liste löschen, Liste teilen | `owner` | owner |

WUN-1 (eigene Liste anlegen) braucht **keine** Authz: man wird selbst Besitzer.

## Endpunkte

Alle unter `router.use(authenticate)`.

| # | Methode + Pfad | Body | Regel | Erfolg |
|---|---|---|---|---|
| WUN-1 | `POST /api/wishlists` | `{name, description?}` | jeder eingeloggte User; `name` Pflicht (400) | 201 Liste |
| — | `GET /api/wishlists` | — | eigene + geteilte Listen (SQL filtert) | 200 `[...]` |
| — | `GET /api/wishlists/:id` | — | `read`; Liste inkl. Produkten | 200 `{...,products:[]}` |
| WUN-2 | `PUT /api/wishlists/:id` | `{name?, description?}` | `write`; mind. ein Feld (400) | 200 Liste |
| WUN-2 | `POST /api/wishlists/:id/products` | `{productId}` | `write`; Produkt muss existieren (404); idempotent | 201 |
| WUN-2 | `DELETE /api/wishlists/:id/products/:productId` | — | `write`; nicht in Liste → 404 | 200 |
| WUN-3 | `DELETE /api/wishlists/:id` | — | `owner`; CASCADE räumt `wishlist_product` | 200 |
| WUN-4 | `POST /api/wishlists/:id/share` | `{userId, authorizationType}` | `owner`; `authorizationType ∈ {read,write,owner}` (400); Zieluser muss existieren (404); delegiert an `/grant` | 200 |

## Fehler-Konventionen

- 401 — kein/ungültiges Token
- 403 — Token gültig, aber Aktion nicht erlaubt
- 404 — Liste / Produkt / Zieluser nicht gefunden
- 400 — fehlende/ungültige Felder
- 503 — auth- oder authorization-service nicht erreichbar

## Dateien

```
src/
├── index.js                   # PORT 3004, /health, mount /api/wishlists
├── config/db.js               # PostgreSQL-Pool (zentrale .env)
├── config/services.js         # validateToken, checkPermission, grantPermission, ServiceUnavailableError
├── middleware/authenticate.js # delegiert an auth-service /validate
└── routes/wishlists.js        # alle Endpunkte + loadWishlist()-Helper
```

Abhängigkeiten: `express`, `pg`, `dotenv` (kein bcrypt/nodemailer).

## Hinweise

- Zeit-/Ablaufvergleiche gibt es hier keine.
- `permissions` hat **keinen** Fremdschlüssel auf `wishlists` — beim Löschen einer Liste
  bleiben evtl. vergebene Permissions als Waisen zurück (harmlos: `resource_id` zeigt dann
  ins Leere, wird nie wieder gematcht).
- Getestet wird endpunktweise in `bruno/wishlist-service/` (idempotent, echte Asserts).
