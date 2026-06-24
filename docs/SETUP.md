# Setup-Anleitung — Rezeptshop

## Voraussetzungen

| Tool | Zweck | Download |
|---|---|---|
| Git | Versionskontrolle | git-scm.com |
| Docker Desktop | Alle Services + DB starten | docker.com |
| Node.js (v18+) | Lokale Entwicklung ohne Docker | nodejs.org |

---

## Projekt klonen & einrichten

```bash
git clone https://github.com/bekirtahagd/rezeptshop.git
cd rezeptshop
```

**`.env` Datei anlegen** (einmalig, nicht im Repo enthalten):
```bash
cp .env.example .env
```
Dann `.env` öffnen und die Passwörter anpassen.

---

## Mit Docker starten (empfohlen)

Docker startet alle Services, die Datenbank und die Frontends automatisch.
Kein manuelles `npm install` nötig.
**Ihr müsst docker desktop gestartet haben!!**

```bash
# Nur Datenbank starten (zum Entwickeln eines einzelnen Services lokal)
docker compose up postgres -d

# Datenbank + pgAdmin + Dummy-Daten + Mailpit starten (empfohlen für Entwicklung)
docker compose --profile dev up postgres pgadmin db-seed mailpit -d

# Alles starten (alle Services + DB + Frontends) — erst wenn alle Dockerfiles befüllt sind
docker compose up -d

# Alles starten inkl. pgAdmin + Dummy-Daten
docker compose --profile dev up db-seed -d

# Alles stoppen
docker compose down

# Alles Stoppen + Datenbank-Daten löschen (Entwickler Tools)
docker compose --profile dev down -v

# Alles stoppen + Datenbank-Daten löschen (sauberer Neustart)
docker compose down -v
```

> **Wichtig:** `docker compose up` schlägt fehl solange ein Service ein leeres Dockerfile hat.
> Einzelne Services können mit `docker compose up postgres` gezielt gestartet werden
> sobald ihr Dockerfile befüllt ist.

---

## Dummy-Daten (nur Entwicklung)

Mit `--profile dev` wird automatisch ein `db-seed`-Container gestartet, der Testdaten in die Datenbank einfügt. Der Container beendet sich danach von selbst.

**Was eingefügt wird:**

| Tabelle | Inhalt |
|---|---|
| `users` | 1 Admin + 6 User; Spezialfälle: 1 unverifiziert (`tom@test.de`), 1 gesperrt (`gesperrt@test.de`), 2 für Auth-Tests (`verify@test.de`, `magic@test.de`) |
| `products` | 6 Produkte in 4 Kategorien — eines mit `amount=0` (für Warenkorb-Test) |
| `carts` / `cart_items` | 2 gefüllte Warenkörbe |
| `orders` / `orderpositions` | 2 abgeschlossene Bestellungen mit Positionen |
| `wishlists` / `wishlist_product` | 3 Wunschlisten mit Produkten |
| `permissions` | anna: `read` auf max' Liste; tom: `write` auf max' Liste |
| `verification_tokens` | Bestätigungslink für tom + offener Magic-Link für max; zusätzlich je 3 Zustände (gültig / abgelaufen / benutzt) für `verify@test.de` (E-Mail-Bestätigung) und `magic@test.de` (Magic-Link) |
| `token_blacklist` | leer — wird erst zur Laufzeit beim Logout befüllt (AUTH-4) |

**Test-Accounts:**

| E-Mail | Rolle | Passwort | Besonderheit |
|---|---|---|---|
| `admin@test.de` | admin | `Test1234!` | Vollzugriff |
| `max@test.de` | user | `Test1234!` | Hat Wishlists, Bestellungen, Warenkorb |
| `anna@test.de` | user | `Test1234!` | Hat Leserecht auf max' Wishlist |
| `tom@test.de` | user | `Test1234!` | E-Mail **nicht** verifiziert; Schreibrecht auf max' Wishlist |
| `gesperrt@test.de` | user | `Test1234!` | Account **gesperrt** |
| `verify@test.de` | user | `Test1234!` | unverifiziert — 3 Bestätigungs-Tokens (gültig / abgelaufen / benutzt) für AUTH-2-Tests |
| `magic@test.de` | user | `Test1234!` | verifiziert — 3 Magic-Link-Tokens (gültig / abgelaufen / benutzt) für AUTH-5-Tests |

> **Hinweis zu Passwörtern:** Die bcrypt-Hashes in `database/dummy-daten.sql` sind Platzhalter.
> Login-Tests funktionieren erst sobald der auth-service implementiert ist und die Hashes
> mit `node -e "require('bcryptjs').hash('Test1234!', 10).then(console.log)"` neu generiert wurden.
> (Wir nutzen `bcryptjs` statt `bcrypt` — reines JS, kein nativer Build im Alpine-Container.)

**Doppelter Start kein Problem:** `ON CONFLICT DO NOTHING` verhindert Fehler wenn die Daten bereits existieren.

**Erreichbare Adressen nach `docker compose up`:**

| Service | URL |
|---|---|
| User-Portal | http://localhost:8080 |
| Admin-Portal | http://localhost:8081 |
| auth-service API | http://localhost:3001 |
| authorization-service API | http://localhost:3002 |
| inventory-service API | http://localhost:3003 |
| wishlist-service API | http://localhost:3004 |
| user-service API | http://localhost:3005 |
| pgAdmin (nur --profile dev) | http://localhost:5050 |
| Mailpit Postfach (nur --profile dev) | http://localhost:8025 |

---

## Mailpit — Test-Postfach (nur Entwicklung)

Der `auth-service` verschickt E-Mails (Registrierungs-Bestätigung, Magic-Link).
In der Entwicklung soll **keine echte Mail** verschickt werden. Dafür gibt es **Mailpit** —
ein Mail-Auffangbecken, das jede ausgehende Mail abfängt und in einer Web-Oberfläche anzeigt.

Mailpit gehört wie pgAdmin und db-seed ins **`dev`-Profil** und startet daher nur mit `--profile dev`:

```bash
docker compose --profile dev up postgres mailpit -d
```

- **Postfach im Browser:** http://localhost:8025 — hier landen alle Mails, ideal zum Anklicken
  der Bestätigungs- und Magic-Links.
- **SMTP-Port:** `1025` (dorthin sendet der auth-service). Keine Authentifizierung nötig.
- **Keine** Mail verlässt je das System.

**Konfiguration (analog zum `DATABASE_URL`-Prinzip):**

| Umgebung | Mail-Host | Erklärung |
|---|---|---|
| In Docker | `mailpit` | In `docker-compose.yml` für den auth-service **fest verdrahtet** |
| Lokal (`npm start`) | `localhost` | Wert aus `.env` — erreicht den über Port 1025 exponierten Mailpit |

> **Produktion sieht anders aus:** Den Mailpit-Container gibt es nur in der Entwicklung.
> Für echten Versand werden in `.env` die `MAIL_*`-Werte auf einen echten SMTP-Server gesetzt
> (`MAIL_HOST`, `MAIL_PORT=587`, `MAIL_USER`, `MAIL_PASS`) — der Code im auth-service bleibt gleich.

---

## Lokal entwickeln (ohne Docker)

Wenn ihr an einem einzelnen Service arbeitet und Docker nicht starten wollt:

**Node-Pakete installieren** (einmalig nach dem Klonen oder nach neuen Paketen):

*Windows / PowerShell:*
```powershell
Get-ChildItem -Path "backend" -Directory | ForEach-Object {
    Push-Location $_.FullName
    Write-Host "Installiere in: $($_.Name)" -ForegroundColor Green
    npm install
    Pop-Location
}
```

*Git Bash / Mac / Linux:*
```bash
cd backend/auth-service && npm install && cd ../..
cd backend/authorization-service && npm install && cd ../..
cd backend/inventory-service && npm install && cd ../..
cd backend/wishlist-service && npm install && cd ../..
cd backend/user-service && npm install && cd ../..
```

**Einzelnen Service starten:**
```bash
cd backend/authorization-service
npm start
```

> Hinweis: Bei lokaler Entwicklung muss PostgreSQL separat laufen.
> Einfachste Lösung: `docker compose up postgres` in einem separaten Terminal.

---

## pgAdmin einrichten (Datenbank-UI)

1. `docker compose --profile dev up` starten
2. Browser: http://localhost:5050
3. Login mit den Werten aus eurer `.env` (`PGADMIN_EMAIL` / `PGADMIN_PASSWORD`)
4. Neuen Server hinzufügen:
   - **Host:** `postgres` (nicht localhost!)
   - **Port:** `5432`
   - **Database:** Wert aus `POSTGRES_DB`
   - **Username:** Wert aus `POSTGRES_USER`
   - **Password:** Wert aus `POSTGRES_PASSWORD`

---

## Lokal entwickeln — DATABASE_URL

Die `.env`-Datei enthält zwei verschiedene Verwendungen der DB-URL:

- **Lokal (`npm start`):** `DATABASE_URL=postgresql://...@localhost:5432/rezeptshop`
- **In Docker:** Die `docker-compose.yml` überschreibt die URL automatisch mit `@postgres:5432`

Das heißt: die `.env` bleibt immer auf `localhost` — Docker regelt den Rest selbst.

---

## Häufige Probleme

**Port bereits belegt:**
```bash
docker compose down
```

**Datenbank-Fehler nach Schema-Änderungen:**
```bash
docker compose down -v                              # löscht Datenbank-Daten
docker compose --profile dev up postgres db-seed    # startet mit frischer DB + Dummy-Daten
```

**Dummy-Daten wurden nicht geladen:**
```bash
docker logs rezeptshop-db-seed    # Logs des Seed-Containers prüfen
```

**Neues npm-Paket in einem Service installiert:**
```bash
docker compose build auth-service   # Image neu bauen
docker compose up
```
