# Rezeptshop

Web-Engineering-Gruppenprojekt: ein **Rezept-Webshop** als Microservice-Architektur mit
fünf Backend-Webservices, zwei getrennten Frontends (Shop & Admin), gemeinsamer
PostgreSQL-Datenbank — vollständig über **Docker Compose** startbar.

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

Details: [`docs/SETUP.md`](docs/SETUP.md) · Bedienung: [`docs/Benutzerhandbuch.docx`](docs/Benutzerhandbuch.docx) · Präsentation: [docs/Web-Engineering.pptx](docs/Web-Engineering.pptx).

---

## Architektur

| Service | Port | Aufgabe |
|---|---|---|
| auth-service | 3001 | Registrierung, Login, Logout, JWT ausstellen/validieren, Magic-Link |
| authorization-service | 3002 | Zentrale Berechtigungsprüfung (Türsteher) |
| inventory-service | 3003 | Produkte, Suche, Warenkorb, Kauf, Kaufhistorie |
| wishlist-service | 3004 | Wunschlisten, Produkte, Teilen |
| user-service | 3005 | Admin: User nachschlagen, sperren, löschen, Admin anlegen |

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
├── docker-compose.yml          # startet alles (Services, DB, pgAdmin, Mailpit, Frontends)
├── .env / .env.example         # JWT_SECRET, DB-Zugangsdaten, CORS_ORIGINS
├── database/
│   ├── init.sql                # alle 10 Tabellen, laeuft beim ersten Start
│   └── dummy-daten.sql         # Testdaten, nur mit --profile dev
├── backend/                    # 5 Services, je Node.js + Express (CommonJS)
│   ├── auth-service/           # Port 3001
│   ├── authorization-service/  # Port 3002
│   ├── inventory-service/      # Port 3003
│   ├── wishlist-service/       # Port 3004
│   └── user-service/           # Port 3005
│       ├── Dockerfile
│       ├── package.json
│       └── src/                # index.js, config/, middleware/, routes/, utils/
├── frontend/
│   ├── user-portal/public/     # Shop-Portal — nginx-Webroot
│   │   ├── *.html              # login, index, produkt, warenkorb,
│   │   │                       #   bestellungen, wunschliste, confirm, magic
│   │   ├── css/style.css
│   │   └── js/                 # api.js + auth.js (Helfer) + je Seite eine Datei
│   └── admin-portal/public/    # Admin-Portal — nginx-Webroot
│       ├── *.html              # login, index (Dashboard), produkte, benutzer
│       ├── css/style.css
│       └── js/                 # api.js + auth.js + je Seite eine Datei
├── assets/product-images/      # Produktbilder
├── bruno/                      # API-Testkollektionen, ein Ordner je Service
├── docs/                       # SETUP.md, onboarding.html, Praesentation, Mockup, Benutzerhandbuch
└── planung/                    # Architektur, Git-Workflow, CORS, Strukturen/
```

---

## Tech-Stack

Node.js + Express (CommonJS) · Vanilla JS/HTML/CSS · PostgreSQL · JWT · Docker Compose ·
nginx (Frontend-Auslieferung) · Mailpit (Dev-Mailserver) · Bruno (API-Tests).
