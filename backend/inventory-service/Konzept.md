# Inventory-Service — Konzept & Implementierungsplan

## Was macht dieser Service?

Der **Inventory-Service** ist das Herz des Shops: Er verwaltet **Produkte**, den
**Warenkorb**, den **Kauf** (mit Bestandsreduktion) und die **Kaufhistorie**. Nach einem
Kauf verschickt er außerdem eine **Bestätigungsmail** (INV-8).

Er beantwortet *nicht* die Frage „Wer bist du?" oder „Darfst du das?" — das delegiert er:

| Frage | Wer beantwortet sie | Wie ruft der inventory-service ihn auf |
|---|---|---|
| „Wer bist du?" (gültiges JWT?) | **auth-service** | `POST :3001/api/auth/validate` mit dem Bearer-Token |
| „Darfst du das?" (Berechtigung) | **authorization-service** | `POST :3002/api/authorization/check` mit `userId` + `role` |
| Produkt-/Warenkorb-/Bestelldaten | **gemeinsame PostgreSQL-DB** | direkter SQL-Zugriff (`pg`) |

Der inventory-service kennt das `JWT_SECRET` **nicht** — er prüft Tokens nie selbst, sondern
fragt immer beim auth-service nach. So bleibt die Architektur sauber (ein einziger Türsteher
für Identität, ein einziger für Berechtigungen).

---

## Wofür ist das gut? (Die abgedeckten Anforderungen)

Aus `Prüfungsleistung.md`:

| ID | Anforderung | Punkte | Umsetzung |
|---|---|---|---|
| **INV-1** | Gezielte Produktsuche per ID | 1 | `GET /api/products/:id` |
| **INV-2** | Produktsuche mit ≥ 2 Kriterien | 2 | `GET /api/products?name=&category=&minPrice=&maxPrice=` |
| **INV-3** | Produkte erstellen (Admin) | 2 | `POST /api/products` |
| **INV-4** | Produkte löschen (Admin) | 2 | `DELETE /api/products/:id` |
| **INV-5** | Produkte bearbeiten (Admin) | 2 | `PUT /api/products/:id` |
| **INV-6** | Warenkorb (nicht bei „nicht verfügbar") | 2 | `GET/POST/DELETE /api/cart` |
| **INV-7** | Kauf + persönliche Historie | 2 | `POST /api/orders`, `GET /api/orders` |
| **INV-8** | Kaufbestätigung per E-Mail | 2 | Mailversand im Checkout (Mailpit) |
| **INV-Front** | Alle Features im Frontend | 5 | (im user-/admin-portal, separater Schritt) |

**Grundregel der Prüfung:** *„Anfragen ohne Authentifizierung müssen grundsätzlich abgelehnt
werden."* → **Jeder** Endpunkt dieses Service liegt hinter der `authenticate`-Middleware, die
ein gültiges JWT verlangt (delegiert an den auth-service).

---

## Technologien, die wir brauchen

| Paket | Wofür | Hinweis |
|---|---|---|
| `express` | Webserver / Routing | wie überall |
| `pg` | PostgreSQL-Zugriff (gemeinsame DB) | 1:1 vom auth-service |
| `dotenv` | zentrale `.env` aus dem Repo-Root laden | gleiches Pattern |
| `nodemailer` | Kaufbestätigungsmail (INV-8) | → Mailpit, wie auth-service |
| `fetch` (eingebaut) | HTTP-Calls an auth-/authorization-service | **kein** npm-Paket — in Node 20 global verfügbar (kein `axios` nötig) |

> **Warum `fetch` statt `axios`?** Node 20 (unser `node:20-alpine`-Image) hat `fetch` global
> eingebaut. Für zwei einfache POST-Calls brauchen wir keine zusätzliche Dependency.

---

## Sicherheit & Zugriffslogik (zwei Stufen)

Jeder Request durchläuft potenziell zwei Prüfungen:

**Stufe 1 — Authentifizierung (immer):** Die `authenticate`-Middleware liest den Header
`Authorization: Bearer <jwt>`, schickt das Token an `auth-service POST /validate` und bekommt
`{ valid, userId, role, email }` zurück. Bei `valid: false` (kein/ungültiges/abgelaufenes
Token, ausgeloggt, gesperrt) → **`401`**. Bei Erfolg liegt die Identität in `req.user`.

**Stufe 2 — Autorisierung (nur bei Produkt-Schreiboperationen):** Vor `POST/PUT/DELETE` auf
Produkte fragt der Service `authorization-service POST /check` mit
`{ userId, role, resourceType: 'product', resourceId, action: 'write' }`. Nur Admins bekommen
`allowed: true` (hardcodierte Regel im authorization-service) → sonst **`403`**.

**Warum nicht bei jedem Endpunkt ein /check?**
- **Produkte lesen** (INV-1/2): Die Regel im authorization-service ist „jeder darf lesen" →
  ein /check würde immer `true` liefern. Die Authentifizierung (Stufe 1) reicht hier.
- **Warenkorb & Bestellungen** (INV-6/7): Diese sind **inhärent** an `req.user.userId`
  gebunden — alle Queries filtern auf den eingeloggten User. Ein Cross-User-Zugriff ist gar
  nicht möglich, also ist kein zusätzlicher /check nötig.

**Kauf verlangt bestätigte E-Mail (Konzept-Entscheidung aus dem auth-service):** Vor dem
Checkout (INV-7) prüfen wir `users.email_verified`. Da `/validate` dieses Feld nicht
zurückgibt, liest der inventory-service es **direkt aus der gemeinsamen DB**
(`SELECT email_verified FROM users WHERE user_id = $1`). Unbestätigt → **`403`**.

---

## Bestandslogik (Überverkauf verhindern)

Sowohl beim Hinzufügen in den Warenkorb (INV-6) als auch beim Kauf (INV-7) gilt die
Anforderung *„Nicht möglich wenn Produkt nicht verfügbar ist"*.

- **Warenkorb (INV-6):** `amount = 0` oder gewünschte Menge > Bestand → **`409 Conflict`**.
- **Kauf (INV-7):** Der gesamte Checkout läuft in **einer Transaktion**. Die betroffenen
  Produktzeilen werden mit `SELECT ... FOR UPDATE` gesperrt, bevor der Bestand geprüft und
  reduziert wird. So kann nicht durch zwei gleichzeitige Käufe „überverkauft" werden. Reicht
  der Bestand für eine Position nicht → **Rollback** + `409`.

---

## Die Endpunkte im Detail

Alle unter dem Prefix `/api`, Service läuft auf **Port 3003**, alle hinter `authenticate`.

### INV-1 · `GET /api/products/:id`
Einzelnes Produkt per ID.
- **Response:** `200 { product_id, name, description, price, amount, category, created_at }`
  oder `404 { error }` wenn nicht vorhanden.

### INV-2 · `GET /api/products?name=&category=&minPrice=&maxPrice=`
Produktsuche mit mehreren, frei kombinierbaren Kriterien (≥ 2 erfüllt die Anforderung).
- `name` → `ILIKE '%...%'` (Teiltreffer, Groß-/Kleinschreibung egal)
- `category` → exakter Treffer (`= $n`)
- `minPrice` / `maxPrice` → `price >= / <= $n`
- Die `WHERE`-Klausel wird **dynamisch** aus den vorhandenen Parametern gebaut (nur gesetzte
  Filter zählen). Ohne Parameter → alle Produkte.
- **Response:** `200 [ {...}, {...} ]` (ggf. leeres Array).

### INV-3 · `POST /api/products`  (nur Admin)
- **Stufe 2:** `/check` mit `action:'write'` → sonst `403`.
- **Body:** `{ name, description?, price, amount, category? }` — `name`, `price`, `amount`
  Pflicht; `price >= 0`, `amount >= 0` (sonst `400`).
- **Response:** `201 { ...neues Produkt }`.

### INV-5 · `PUT /api/products/:id`  (nur Admin)
- **Stufe 2:** `/check` mit `action:'write'` → sonst `403`.
- **Body:** beliebige Teilmenge von `{ name, description, price, amount, category }` — nur
  übergebene Felder werden aktualisiert (dynamisches `SET`).
- **Response:** `200 { ...aktualisiertes Produkt }` oder `404`.

### INV-4 · `DELETE /api/products/:id`  (nur Admin)
- **Stufe 2:** `/check` mit `action:'write'` → sonst `403`.
- **Response:** `200 { message }` oder `404`. (FK-Regeln: `cart_items`/`wishlist_product`
  CASCADE, `orderpositions.product_id` SET NULL — Historie bleibt erhalten.)

### INV-6 · `GET /api/cart`
Warenkorb des eingeloggten Users. Existiert noch keiner, wird **automatisch** einer angelegt
(`carts` hat `user_id UNIQUE`).
- **Response:** `200 { cart_id, items: [ { product_id, name, price, quantity, subtotal } ], total }`.

### INV-6 · `POST /api/cart`
- **Body:** `{ productId, quantity }` (quantity default 1, muss `>= 1` sein).
- **Ablauf:** Produkt laden → Verfügbarkeit prüfen (`amount > 0` **und** gewünschte Gesamtmenge
  ≤ Bestand) → sonst `409` → Upsert in `cart_items`
  (`ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = ...`).
- **Response:** `200/201 { ...Warenkorb }`.

### INV-6 · `DELETE /api/cart/:productId`
Entfernt eine Position aus dem Warenkorb des Users.
- **Response:** `200 { message }` (idempotent; auch `200` wenn nichts zu löschen war).

### INV-7 · `POST /api/orders`  (Checkout)
Wandelt den Warenkorb in eine Bestellung um. **Transaktion:**
1. `email_verified` des Users prüfen → unbestätigt: `403`.
2. Warenkorb + Positionen laden → leer: `400`.
3. Je Position: `SELECT ... FOR UPDATE` auf das Produkt, Bestand prüfen → zu wenig: Rollback + `409`.
4. `INSERT INTO orders (user_id, status) ... 'completed'`.
5. Je Position: `INSERT INTO orderpositions (order_id, product_id, purchase_price, amount)`
   (`purchase_price` = aktueller Produktpreis = „Preis zum Kaufzeitpunkt").
6. `UPDATE products SET amount = amount - <menge>` je Position.
7. Warenkorb leeren (`DELETE FROM cart_items WHERE cart_id = ...`).
8. `COMMIT`.
9. **Nach Commit:** Bestätigungsmail senden (INV-8) — ein Mailfehler lässt den Kauf **nicht**
   fehlschlagen (nur Logeintrag).
- **Response:** `201 { order_id, date, status, positions: [...], total }`.

### INV-7 · `GET /api/orders`  (Kaufhistorie)
Alle Bestellungen des eingeloggten Users inkl. Positionen, neueste zuerst.
- **Response:** `200 [ { order_id, date, status, positions: [...], total } ]`.

### INV-8 · Kaufbestätigung per E-Mail
Teil des Checkouts: `sendPurchaseConfirmationMail(email, order)` in `config/mailer.js`
(nodemailer → Mailpit, gleiches Transport-Pattern wie der auth-service). Inhalt: Bestellnummer,
Positionen, Gesamtsumme. Im Dev landet die Mail in Mailpit (http://localhost:8025).

---

## Service-zu-Service-Kommunikation (`config/services.js`)

Zwei kleine `fetch`-Helfer:

```
validateToken(bearerToken)  → POST {AUTH_SERVICE_URL}/api/auth/validate { token }
                            → { valid, userId, role, email }
checkPermission({ userId, role, resourceType, resourceId, action })
                            → POST {AUTHORIZATION_SERVICE_URL}/api/authorization/check {...}
                            → { allowed }
```

**Service-URLs** kommen aus der `.env` (analog `DATABASE_URL`):
- Lokal (`npm start` außerhalb Docker): `AUTH_SERVICE_URL=http://localhost:3001`,
  `AUTHORIZATION_SERVICE_URL=http://localhost:3002`.
- In Docker: in der `docker-compose.yml` fest auf die Container-Namen verdrahtet
  (`http://auth-service:3001`, `http://authorization-service:3002`) — wie `@postgres` bei
  der DATABASE_URL.

Ist ein Zielservice nicht erreichbar, antwortet der inventory-service mit `503`
(„Dienst nicht erreichbar"), statt unkontrolliert abzustürzen.

---

## Geplante Dateistruktur

```
backend/inventory-service/
├── Dockerfile                 # Node-Pattern (wie auth-service), EXPOSE 3003
├── package.json               # express, pg, dotenv, nodemailer
└── src/
    ├── index.js               # Express-App, dotenv→Repo-Root, /health, mountet Routes
    ├── config/
    │   ├── db.js              # PostgreSQL-Pool (1:1 vom auth-service)
    │   ├── mailer.js          # nodemailer→Mailpit + sendPurchaseConfirmationMail()
    │   └── services.js        # validateToken() + checkPermission() (fetch-Helfer)
    ├── middleware/
    │   └── authenticate.js    # ruft auth-service /validate, setzt req.user
    └── routes/
        ├── products.js        # INV-1–5
        ├── cart.js            # INV-6
        └── orders.js          # INV-7/8
```

Konventionen vom auth-/authorization-service: deutsche Kommentare, `async/await` mit
`try/catch`, JSON-Responses (`{message}` / `{error}`), `400` bei fehlenden Pflichtfeldern,
`dotenv`-Pfad `require('path').resolve(__dirname, '../../..', '.env')`.

---

## Nötige Änderungen außerhalb des Service-Ordners

- **`docker-compose.yml`** (inventory-service-Block): `environment` um `AUTH_SERVICE_URL`,
  `AUTHORIZATION_SERVICE_URL` und die `MAIL_*`-Variablen ergänzen (Host fest auf `mailpit`,
  analog auth-service); `depends_on` um auth-service + authorization-service erweitern.
- **`.env` / `.env.example`**: `AUTH_SERVICE_URL=http://localhost:3001` +
  `AUTHORIZATION_SERVICE_URL=http://localhost:3002` ergänzen. Mail-Variablen existieren bereits.
- **`init.sql`**: **keine** Änderung — alle Tabellen (`products`, `carts`, `cart_items`,
  `orders`, `orderpositions`) sind vorhanden.
- **Dummy-Daten**: reichen (6 Produkte inkl. „Rindersteak Marinade" mit `amount = 0` für den
  Nicht-verfügbar-Test; Warenkörbe; Bestellungen für die Historie).

---

## Test (Bruno) — `rezeptshop/bruno/inventory-service/`

Idempotent (ohne DB-Reset wiederholbar), mit echten `assert`-Blöcken. Token wie in der
auth-Kollektion: `login-user` schreibt das JWT per `script:post-response` in `{{token}}`,
`login-admin` in `{{adminToken}}` (neue Env-Var in `environments/local.bru`).

- **login:** `login-user` (max), `login-admin` (admin)
- **products:** `get-by-id`, `search`, `get-404`, `create-admin`, `create-user-verboten (403)`,
  `update-admin`, `delete-admin` (create→delete als wiederholbares Paar)
- **cart:** `add`, `add-nicht-verfuegbar (409)`, `get`, `remove`
- **orders:** `checkout-erfolg`, `checkout-leerer-korb (400)`, `checkout-unverifiziert (403, tom)`,
  `history`

---

## Umsetzungsreihenfolge

1. **Setup:** `package.json`, `Dockerfile`, `src/index.js`, `config/db.js` → `/health` läuft.
2. **Delegation:** `config/services.js` + `middleware/authenticate.js`.
3. **Produkte (INV-1–5):** `routes/products.js`, je Endpunkt in Bruno testen.
4. **Warenkorb (INV-6):** `routes/cart.js`, inkl. 409-Fall.
5. **Kauf + Mail (INV-7/8):** `routes/orders.js` + `config/mailer.js`, inkl. 403/400-Fälle.
6. **Infra:** `docker-compose.yml` / `.env` / `.env.example` ergänzen.
7. **Doku + PR:** Projektstatus aktualisieren, committen, pushen, Pull Request nach `main`.

Nach jedem Endpunkt: in **Bruno** testen, dann der nächste (üblicher Workflow).

---

## Offene / getroffene Entscheidungen

- ✅ **INV-8 wird mitgebaut** (Kaufbestätigungsmail via Mailpit).
- ✅ **Alle Endpunkte verlangen ein JWT** (Prüfungs-Grundregel) — Produkte lesen darf jeder
  eingeloggte User.
- ✅ **Kauf verlangt `email_verified = true`** (per DB-Query geprüft) — setzt die
  auth-service-Entscheidung um.
- 🔵 *Klein, beim Implementieren zu klären:* Soll `purchase_price` der aktuelle `products.price`
  zum Kaufzeitpunkt sein (geplant: **ja**) — so bleibt die Historie korrekt, auch wenn der
  Preis später geändert wird.
