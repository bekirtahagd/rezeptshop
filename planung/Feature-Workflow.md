# Feature-Workflow — Backend-Service implementieren

Dieser Workflow gilt für jeden der fünf Backend-Services.
Schritt für Schritt — von "frisch geklont" bis "Feature fertig und getestet".

---

## Schritt 1 — Umgebung vorbereiten

### 1a. Aktuellen Stand holen

```bash
git switch main
git pull origin main
git switch -c feature/mein-feature-name
```

### 1b. Datenbank und pgAdmin starten

```bash
docker compose --profile dev up postgres pgadmin db-seed -d
```

Das startet:
- PostgreSQL auf Port 5432 (Datenbank mit allen Tabellen)
- pgAdmin auf http://localhost:5050 (Datenbank-UI)
- db-seed: lädt die Dummy-Daten und beendet sich dann von selbst

> `db-seed` läuft **nicht** automatisch — es muss explizit aufgelistet werden,
> solange nicht alle Services gestartet werden. `--profile dev` allein reicht nicht.

> Die Dummy-Daten enthalten 5 Test-Accounts, 6 Produkte, Warenkörbe, Bestellungen,
> Wunschlisten und Permissions — alles was du zum Testen brauchst.
> Siehe `docs/SETUP.md` für die vollständige Übersicht.

### 1c. npm-Pakete installieren (einmalig nach dem Klonen)

In den Ordner deines Services wechseln und installieren:

```bash
cd backend/auth-service
npm install
```

Wenn dein Feature zusätzliche Pakete braucht, jetzt installieren:

```bash
# Beispiel für den auth-service:
npm install bcrypt jsonwebtoken pg nodemailer dotenv
```

---

## Schritt 2 — Dateistruktur anlegen

Jeder Service folgt **exakt dieser Struktur** — keine Abweichungen:

```
backend/mein-service/
├── src/
│   ├── index.js            ← Express-App, Port festlegen, Routes einbinden
│   ├── config/
│   │   └── db.js           ← PostgreSQL Connection Pool (immer gleich für alle Services)
│   └── routes/
│       └── mein-feature.js ← Route-Handler für die Endpoints des Features
├── package.json
├── Dockerfile
└── KONZEPT.md              ← Erklärung des Services (vor der Implementierung lesen!)
```

Als Referenz: `backend/authorization-service/src/` ist vollständig implementiert und folgt genau dieser Struktur.

### Wichtige Regeln für alle Services

- **CommonJS** — immer `require()`, niemals `import`
- **Kein TypeScript** — nur `.js`-Dateien
- **`db.js`** — der `dotenv`-Pfad muss auf die zentrale `.env` im Repo-Root zeigen, nicht auf eine lokale. Alle Services teilen sich eine einzige `.env`.
- **JWT nicht selbst prüfen** — das macht nur der auth-service. Alle anderen Services rufen zuerst `POST /api/auth/validate` auf und leiten `userId` + `role` weiter.
- **Berechtigungen nicht selbst prüfen** — immer an `POST /api/authorization/check` delegieren.

---

## Schritt 3 — Service lokal starten und testen

### 3a. Service starten

```bash
# Terminal 1: Datenbank läuft bereits (aus Schritt 1b)
# Terminal 2: Service starten
cd backend/mein-service
npm start
```

Der Service meldet sich mit: `mein-service läuft auf Port 300X`

### 3b. Bruno öffnen

Bruno ist unser API-Testing-Tool (wie Postman, nur dateibasiert und git-freundlich): Damit
schickst du HTTP-Requests an deinen Service, ohne ein Frontend zu brauchen, und siehst direkt
Statuscode und Antwort. Unsere Requests liegen als `.bru`-Dateien im Repo, sind also für
alle per `git pull` verfügbar.

1. **Bruno starten.**
2. **Collection öffnen:** `Open Collection` → den Ordner `rezeptshop/bruno/` auswählen
   (dort liegt `bruno.json`). Links erscheint die Collection „Rezeptshop API" mit einem
   Unterordner pro Service.
3. **Environment auf `local` setzen — der wichtigste und am leichtesten übersehene Schritt:**

   In den Requests stehen keine festen URLs, sondern Platzhalter wie `{{authBaseUrl}}`. Diese
   werden erst durch ein **Environment** mit echten Werten gefüllt (`authBaseUrl` →
   `http://localhost:3001` usw., definiert in `bruno/environments/local.bru`). Ohne
   ausgewähltes Environment bleibt der Platzhalter leer und du bekommst den Fehler
   **„invalid address"**.

   So wählst du es aus:
   - **Zuerst einen Request öffnen** (z. B. einen aus deinem Service-Ordner anklicken). Das
     Environment-Dropdown erscheint nämlich nur bei geöffnetem Request.
   - **Oben rechts** im Bruno-Fenster auf das Dropdown **„No Environment"** klicken →
     **`local`** auswählen.
   - Kontrolle: In der URL-Zeile ist `{{authBaseUrl}}` jetzt aufgelöst (Maus drüberhalten
     zeigt `http://localhost:3001`).

   > Verwechslungsgefahr: Der Tab **„Environments"** im Workspace-Overview (zeigt evtl. `0`)
   > ist der **globale** — den brauchen wir nicht. Unser Environment gehört **zur Collection**
   > und taucht nur im Dropdown oben rechts bei geöffnetem Request auf.

### 3c. .bru-Dateien für deinen Service anlegen

Für jeden Endpoint deines Services eine `.bru`-Datei in `bruno/mein-service/` anlegen.
Orientiere dich an den bestehenden Dateien in `bruno/authorization-service/`.

**Reihenfolge beim Testen beachten:**
- Erst schreibende Requests (POST, PUT) — legen Testdaten an
- Dann lesende Requests (GET) — prüfen ob die Daten korrekt angelegt wurden
- Dann Fehlerfälle — 400 (fehlende Felder), 403 (keine Berechtigung), 404 (nicht gefunden)

### 3d. Jeden Endpoint durchklicken und Response prüfen

| Was prüfen | Erwartung |
|---|---|
| HTTP-Statuscode | 200/201 bei Erfolg, 400/403/404 bei Fehlern |
| Response-Body | Enthält die erwarteten Felder |
| Datenbank | Daten korrekt gespeichert? (pgAdmin: http://localhost:5050) |

---

## Schritt 4 — KONZEPT.md aktualisieren

Jeder Service hat eine `KONZEPT.md` im Service-Ordner. Diese wird **nach** der Implementierung aktualisiert.

Die KONZEPT.md beschreibt was implementiert wurde, welche Endpoints fertig sind und welche Designentscheidungen getroffen wurden. Halte es kurz — es ist eine Übergabe an die nächste Person, kein Roman. Als Referenz: `backend/authorization-service/KONZEPT.md`.

---

## Schritt 5 — Commit und Pull Request

```bash
git add backend/mein-service/src/
git add bruno/mein-service/
git add backend/mein-service/KONZEPT.md
git commit -m "feat(mein-service): Endpoint XY implementiert"
git push -u origin feature/mein-feature-name
```

Dann auf GitHub einen **Pull Request** erstellen → ein anderes Team-Mitglied reviewt → Merge in `main`.

**Goldene Regel: Niemals direkt in `main` committen.**

---

## Kurzreferenz: Ports & Dummy-Daten

| Service | Port |
|---|---|
| auth-service | 3001 |
| authorization-service | 3002 |
| inventory-service | 3003 |
| wishlist-service | 3004 |
| user-service | 3005 |

| User | Rolle | Passwort | Besonderheit |
|---|---|---|---|
| admin@test.de | admin | Test1234! | Vollzugriff |
| max@test.de | user | Test1234! | Hat Wishlists, Warenkorb, Bestellungen |
| anna@test.de | user | Test1234! | Leserecht auf max' Wishlist |
| tom@test.de | user | Test1234! | E-Mail nicht verifiziert, Schreibrecht auf max' Wishlist |
| gesperrt@test.de | user | Test1234! | Account gesperrt |
