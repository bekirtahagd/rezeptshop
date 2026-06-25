# Rezeptshop

Web-Engineering-Gruppenprojekt: ein **Rezept-Webshop** als Microservice-Architektur mit
fünf Backend-Webservices, zwei getrennten Frontends (Shop & Admin), gemeinsamer
PostgreSQL-Datenbank — vollständig über **Docker Compose** startbar.

Reines **Vanilla JS/HTML/CSS** im Frontend, **Node.js + Express (CommonJS)** im Backend,
**JWT**-Authentifizierung, kein Framework, kein Build-Schritt.

---

## Schnellstart

Voraussetzung: **Docker Desktop** läuft.

```bash
# Kompletter Stack: alle Services + DB + Mailpit + Testdaten + beide Frontends
docker compose --profile dev up -d --build
```

Danach erreichbar:

| Oberfläche | URL |
|---|---|
| Shop-Portal (Endanwender) | http://localhost:8080 |
| Admin-Portal | http://localhost:8081 |
| Mailpit (E-Mail-Postfach, Dev) | http://localhost:8025 |
| pgAdmin (Datenbank-UI) | http://localhost:5050 |

Test-Accounts (Passwort überall `Test1234!`): `admin@test.de` (Admin),
`max@test.de` / `anna@test.de` (User), `tom@test.de` (User, unbestätigt).

Details: [`docs/SETUP.md`](docs/SETUP.md) · Bedienung: [`docs/Benutzerhandbuch.md`](docs/Benutzerhandbuch.md).

---

## Architektur

```
            ┌──────────────┐         ┌──────────────┐
            │ user-portal  │         │ admin-portal │   Vanilla JS (nginx)
            │  :8080       │         │  :8081       │
            └──────┬───────┘         └──────┬───────┘
                   │  HTTP/JWT (REST)       │
        ┌──────────┴───────────┬────────────┴───────────┬──────────────┐
        ▼          ▼           ▼            ▼            ▼
   auth-service  authorization  inventory   wishlist    user-service
     :3001       -service       -service    -service     :3005
                  :3002          :3003        :3004
        └──────────┴───────────┴────────────┴────────────┴──────────────┘
                                  │
                          ┌───────▼────────┐
                          │  PostgreSQL    │  eine gemeinsame DB
                          └────────────────┘
```

| Service | Port | Aufgabe |
|---|---|---|
| auth-service | 3001 | Registrierung, Login, Logout, JWT ausstellen/validieren, Magic-Link |
| authorization-service | 3002 | Zentrale Berechtigungsprüfung (Türsteher) |
| inventory-service | 3003 | Produkte, Suche, Warenkorb, Kauf, Kaufhistorie |
| wishlist-service | 3004 | Wunschlisten, Produkte, Teilen |
| user-service | 3005 | Admin: User nachschlagen, sperren, löschen, Admin anlegen |

- **JWT** stellt ausschließlich der `auth-service` aus und validiert sie.
- **Berechtigungen** prüft ausschließlich der `authorization-service` (alle anderen delegieren
  per HTTP an `POST /api/authorization/check`).
- **Eine gemeinsame PostgreSQL-Datenbank** für alle Services.

Mehr: [`docs/Architektur.md`](docs/Architektur.md) (Diagramme) ·
[`planung/architecture.md`](planung/architecture.md) (Begründung) ·
ERM: [`docs/ERM.md`](docs/ERM.md) ·
Datenmodell: [`planung/Strukturen/Datenbankschema.md`](planung/Strukturen/Datenbankschema.md) ·
Mockups: [`docs/Mockup.md`](docs/Mockup.md).

---

## Funktionsumfang

**Shop-Portal:** Registrierung (mit E-Mail-Bestätigung) & Login, passwortloser **Magic-Link**-Login,
Produkte ansehen + **Suche** (Name/Kategorie), **Warenkorb**, **Kauf** + **Kaufhistorie**,
**Wunschlisten** (anlegen, bearbeiten, Produkte verwalten, mit Lese-/Schreibrecht **teilen**).

**Admin-Portal:** Admin-Login (Rollen-Check), **Produktverwaltung** (anlegen/bearbeiten/löschen),
**Benutzerverwaltung** (nachschlagen, sperren/entsperren, löschen, Admin anlegen).

---

## Projektstruktur

```
rezeptshop/
├── docker-compose.yml          # startet alles
├── database/                   # init.sql + dummy-daten.sql (Dev-Seed)
├── backend/                    # 5 Services (je Node.js + Express)
├── frontend/
│   ├── user-portal/public/     # Shop-Portal (HTML/CSS/JS, nginx-Webroot)
│   └── admin-portal/public/    # Admin-Portal
├── bruno/                      # API-Testkollektionen (Bruno)
├── docs/                       # SETUP, Benutzerhandbuch, ERM, ...
└── planung/                    # Architektur, Workflows, Strukturen
```

---

## Tech-Stack

Node.js + Express (CommonJS) · Vanilla JS/HTML/CSS · PostgreSQL · JWT · Docker Compose ·
nginx (Frontend-Auslieferung) · Mailpit (Dev-Mailserver) · Bruno (API-Tests).
