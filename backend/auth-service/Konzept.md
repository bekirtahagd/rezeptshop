# Auth-Service — Konzept & Implementierungsplan

## Was macht dieser Service?

Der **Auth-Service** ist die zentrale Anlaufstelle für **Identität** im System: Er beantwortet
die Frage *„Wer bist du?"*. Er ist der **einzige** Service, der Passwörter prüft, E-Mails zur
Bestätigung/Anmeldung verschickt und **JWTs ausstellt und validiert**.

**Wichtige Abgrenzung zum authorization-service:**

| | auth-service (dieser hier) | authorization-service |
|---|---|---|
| Frage | „Wer bist du?" (Authentifizierung) | „Darfst du das?" (Autorisierung) |
| Prüft Passwörter | ✅ ja | ❌ nein |
| Stellt JWTs aus / prüft sie | ✅ ja (einziger) | ❌ nie |
| Verschickt E-Mails | ✅ ja | ❌ nein |
| Bekommt | E-Mail + Passwort / Token | nur `userId` + `role` |

Die beiden gehören zusammen: Erst klärt der auth-service *wer* der Nutzer ist (aus dem JWT
→ `userId` + `role`), dann reicht der aufrufende Service diese Werte an den
authorization-service weiter, der entscheidet *ob* die Aktion erlaubt ist.

---

## Wofür ist das gut? (Die abgedeckten Anforderungen)

Aus `Prüfungsleistung.md` — **18 Punkte** insgesamt:

| ID | Anforderung | Punkte | Umsetzung in diesem Service |
|---|---|---|---|
| **AUTH-1** | Registrierung per Mail | 2 | `POST /register` legt User an + verschickt Bestätigungsmail |
| **AUTH-2** | Konto verifizieren (Bestätigungslink, Status abrufbar) | 6 | `GET /confirm/:token` + `GET /me` für den Status |
| **AUTH-3** | Anmeldung per Passwort | 2 | `POST /login` prüft Passwort → JWT |
| **AUTH-4** | Angemeldet bleiben (Session) + Logout | 2 | JWT mit Ablaufzeit als Session, `POST /logout` invalidiert |
| **AUTH-5** | Anmeldung per Code/Link (Einmal-Login) | 4 | `POST /magic-link` + `GET /magic-login/:token` |
| **AUTH-Front** | Alle Features im Frontend | 2 | (im user-portal, separater Schritt) |

**Grundregel der Prüfung:** *„Anfragen ohne Authentifizierung müssen grundsätzlich
abgelehnt werden."* → Dafür stellen wir den internen Endpunkt `POST /validate` bereit, den
alle anderen Services nutzen, um ein eingehendes JWT prüfen zu lassen.

---

## Technologien, die wir brauchen

| Paket | Wofür | Hinweis |
|---|---|---|
| `express` | Webserver / Routing | bereits installiert |
| `pg` | PostgreSQL-Zugriff (gemeinsame DB) | wie im authorization-service |
| `dotenv` | zentrale `.env` aus dem Repo-Root laden | gleiches Pattern wie überall |
| `jsonwebtoken` | JWTs erstellen & prüfen | Kernstück von AUTH-3/4/5 |
| `bcryptjs` | Passwörter **hashen** (nie im Klartext speichern!) | siehe Hinweis unten |
| `nodemailer` | E-Mails verschicken (AUTH-1/2/5) | sendet an Mailpit |
| `crypto` (eingebaut) | sichere Zufalls-Tokens für Links/Codes | kein npm-Paket nötig |

> **Hinweis zu bcrypt vs. bcryptjs:** Wir nehmen **`bcryptjs`** (reines JavaScript) statt
> `bcrypt`. `bcrypt` müsste im schlanken `node:alpine`-Container nativ kompiliert werden
> (braucht python/make/g++) — das macht den Docker-Build fragil. `bcryptjs` ist
> funktional gleichwertig und braucht keine Build-Tools. Wer lieber `bcrypt` will, kann
> tauschen — die API ist nahezu identisch.

### Warum überhaupt hashen?
Passwörter werden **niemals** im Klartext gespeichert. `bcryptjs.hash()` macht aus
`"geheim123"` einen unumkehrbaren Hash. Beim Login vergleicht `bcryptjs.compare()` das
eingegebene Passwort mit dem Hash, ohne ihn je zurückrechnen zu müssen. Selbst wenn die
DB geklaut wird, sind die Passwörter geschützt.

### Was ist ein JWT?
Ein **JSON Web Token** ist ein signierter String mit drei Teilen (`header.payload.signature`).
Der **Payload** enthält bei uns `{ userId, role, email, jti }`. Die **Signatur** wird mit
unserem `JWT_SECRET` erzeugt — niemand ohne dieses Secret kann ein gültiges Token fälschen.
Der Client (Frontend) schickt das Token bei jedem Request im Header
`Authorization: Bearer <token>` mit. So bleibt der Nutzer „angemeldet" (AUTH-4), ohne dass
der Server eine klassische Session im Speicher halten muss.

---

## Die Endpunkte im Detail

Alle unter dem Prefix `/api/auth`, Service läuft auf **Port 3001**.

### AUTH-1 · `POST /api/auth/register`
Legt einen neuen User an und verschickt die Bestätigungsmail.
- **Body:** `{ "email": "...", "password": "..." }`
- **Ablauf:**
  1. E-Mail-Format & Pflichtfelder prüfen, schauen ob E-Mail schon existiert
  2. Passwort mit `bcryptjs` hashen
  3. `INSERT INTO users (...)` → `email_verified = false`, `role = 'user'`
  4. Zufalls-Token erzeugen, in `verification_tokens` speichern (`type='email_verification'`, `expires_at` = +24h)
  5. Bestätigungsmail mit Link `…/api/auth/confirm/<token>` senden
- **Response:** `201 { "message": "Registriert. Bitte E-Mail bestätigen." }`

### AUTH-2 · `GET /api/auth/confirm/:token`
Wird durch Klick auf den Link in der Mail aufgerufen.
- **Ablauf:** Token in `verification_tokens` suchen → prüfen: existiert, nicht `used`, nicht
  abgelaufen → `UPDATE users SET email_verified = true` → Token auf `used = true` setzen.
- **Response:** `200 { "message": "E-Mail bestätigt" }` (im Frontend später eine kleine
  Erfolgsseite).

### AUTH-2 (Statusabfrage) · `GET /api/auth/me`
Die Anforderung sagt: *„Der Status muss über den Service abrufbar sein."*
- **Geschützt:** braucht gültiges JWT im `Authorization`-Header.
- **Response:** `{ "userId": 2, "email": "...", "role": "user", "email_verified": true }`

### AUTH-3 · `POST /api/auth/login`
- **Body:** `{ "email": "...", "password": "..." }`
- **Ablauf:** User per E-Mail laden → `bcryptjs.compare()` → prüfen ob `locked = false`
  (gesperrte User dürfen sich nicht anmelden) → JWT mit 24h Laufzeit ausstellen.
- **Response:** `{ "token": "<jwt>" }`
- *Designfrage E-Mail-Bestätigung:* Wir lassen Login auch bei `email_verified = false` zu,
  blockieren aber sensible Aktionen — alternativ kann Login bei unbestätigter Mail
  abgelehnt werden. (Im Konzept als kleine offene Entscheidung markiert, siehe unten.)

### AUTH-4 · `POST /api/auth/logout`
Macht ein ausgestelltes JWT vorzeitig ungültig (echtes Logout).
- **Geschützt:** braucht das aktuelle JWT.
- **Ablauf:** Die `jti` (Token-ID) aus dem JWT in die **`token_blacklist`**-Tabelle
  schreiben (mit `expires_at` = Ablaufzeit des Tokens). Ab dann lehnt `/validate` dieses
  Token ab.
- **Response:** `{ "message": "Abgemeldet" }`

### AUTH-5 · `POST /api/auth/magic-link`
Fordert einen Einmal-Login an (Code **oder** Link).
- **Body:** `{ "email": "..." }`
- **Ablauf:** User suchen → Zufalls-Token erzeugen, in `verification_tokens` speichern
  (`type='magic_link'`, kurze Gültigkeit z.B. 15 Min) → Mail mit Link
  `…/api/auth/magic-login/<token>` **und** dem Token als eingebbarem Code senden.
- **Response:** `{ "message": "Einmal-Link gesendet" }` (aus Sicherheitsgründen identische
  Antwort, auch wenn die E-Mail nicht existiert).

### AUTH-5 · `GET /api/auth/magic-login/:token`  (Link öffnen)
- **Ablauf:** Token prüfen (existiert, `type='magic_link'`, nicht `used`, nicht abgelaufen)
  → auf `used = true` setzen (**einmalig!**) → JWT ausstellen.
- **Response:** `{ "token": "<jwt>" }`

### AUTH-5 · `POST /api/auth/magic-login`  (Code eingeben)
Variante für den **Code** statt des Links — funktioniert wie ein Einmalpasswort.
- **Body:** `{ "email": "...", "code": "<token>" }` → gleiche Prüfung & JWT-Ausstellung.

### Intern · `POST /api/auth/validate`
**Kein Endpunkt fürs Frontend**, sondern für die anderen Services. Sie schicken das vom
Client erhaltene JWT hierher und bekommen die geprüfte Identität zurück.
- **Body:** `{ "token": "Bearer <jwt>" }`
- **Ablauf:** Signatur & Ablauf mit `jsonwebtoken.verify()` prüfen → schauen ob die `jti`
  in `token_blacklist` steht (= ausgeloggt) → **live in der DB** prüfen, ob der User noch
  existiert und nicht `locked` ist (so wirkt ein Sperren / USER-4 sofort, nicht erst nach
  Token-Ablauf) → wenn alles ok: Identität zurückgeben (`role` aus der DB, falls geändert).
- **Response:** `{ "valid": true, "userId": 2, "role": "user", "email": "..." }`
  oder `{ "valid": false }`.

---

## Nötige Datenbank-Änderung: `token_blacklist`

`users` und `verification_tokens` existieren bereits in `init.sql`. Für das **echte Logout**
(AUTH-4) kommt **eine** kleine Tabelle dazu:

```sql
CREATE TABLE token_blacklist (
    jti         VARCHAR(255) PRIMARY KEY,   -- eindeutige Token-ID aus dem JWT
    expires_at  TIMESTAMP    NOT NULL,      -- bis wann das Token sowieso abläuft
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
```

**Warum nur die `jti` statt des ganzen Tokens?** Jedes JWT bekommt beim Ausstellen eine
zufällige ID (`jti`). Wir speichern nur diese kurze ID — das reicht, um das Token zu
erkennen, und ist platzsparender als der ganze Token-String. Abgelaufene Einträge können
gelegentlich aufgeräumt werden (optional), da das Token nach `expires_at` ohnehin ungültig
ist.

---

## Mail im Dev-Betrieb: Mailpit

Für die Entwicklung nutzen wir **Mailpit** als Container (ein Mail-„Auffangbecken"):

- nodemailer schickt echte Mails an `mailpit:1025` (SMTP, ohne Login)
- **keine** Mail verlässt je das System — alle landen in Mailpits Web-Oberfläche
- aufrufbar unter **http://localhost:8025** → ideal, um Bestätigungs-/Magic-Links zu klicken
- gehört ins `dev`-Profil der `docker-compose.yml` (wie pgAdmin) — in Produktion gibt es ihn nicht

**Umgesetzt (Schritt 2c):** Der Mail-Host wird — analog zu `DATABASE_URL` → `@postgres` — in der
`docker-compose.yml` für den auth-service **fest auf `mailpit` verdrahtet** (`MAIL_HOST=mailpit`,
`MAIL_PORT=1025`). Die `.env` zeigt auf `localhost:1025`, damit ein lokaler `npm start`
(außerhalb Docker) den exponierten Mailpit-Port erreicht. `MAIL_USER`/`MAIL_PASS` bleiben leer
(Mailpit braucht keine Auth); `MAIL_FROM` setzt die Absenderadresse.
Für echten Versand später müsste man nur diese Variablen tauschen — der Code bleibt gleich.

---

## Geplante Dateistruktur

```
backend/auth-service/
├── Dockerfile                    # Node-Pattern (wie authorization-service), EXPOSE 3001
├── package.json                  # + pg, dotenv, jsonwebtoken, bcryptjs, nodemailer
└── src/
    ├── index.js                  # Express-App, dotenv, mountet Routes, Port 3001
    ├── config/
    │   ├── db.js                 # PostgreSQL-Pool (1:1 vom authorization-service)
    │   └── mailer.js             # nodemailer-Transport (liest MAIL_* aus .env)
    ├── middleware/
    │   └── authenticate.js       # liest JWT aus Header, prüft Blacklist, setzt req.user
    ├── utils/
    │   ├── jwt.js                # signToken() / verifyToken() — kapselt JWT_SECRET & jti
    │   └── tokens.js             # crypto-Zufallstoken für E-Mail-/Magic-Links
    └── routes/
        └── auth.js               # alle oben beschriebenen Endpunkte
```

Wir übernehmen die **Konventionen des authorization-service**: deutsche Kommentare,
`async/await` mit `try/catch`, JSON-Responses (`{ message }` / `{ error }`), Validierung der
Pflichtfelder mit `400`, `dotenv`-Pfadauflösung zum Repo-Root
(`require('path').resolve(__dirname, '../../..', '.env')`).

---

## Sicherheits-Überlegungen (für die Präsentation)

- **Passwörter** nur als bcrypt-Hash in der DB — nie Klartext.
- **JWT_SECRET** muss in auth-service **und** authorization-service identisch sein (steht
  schon in der zentralen `.env`). Wer das Secret kennt, kann Tokens fälschen → gehört nie
  ins Git (liegt in `.env`, nicht `.env.example`).
- **Einmal-Tokens** (`verification_tokens`) sind zufällig, haben ein Ablaufdatum und werden
  nach Gebrauch auf `used = true` gesetzt → kein Wiederverwenden.
- **Magic-Link / Passwort-Reset-Enumeration:** `POST /magic-link` antwortet immer gleich,
  egal ob die E-Mail existiert → verrät keine registrierten Adressen.
- **Logout** funktioniert echt dank `token_blacklist`, nicht nur clientseitig.
- **`/validate`** ist intern; von außen ist der Service nur über das Docker-Netzwerk bzw.
  den gemappten Port erreichbar — die Vertrauensgrenze ist (wie beim authorization-service)
  das Docker-Netzwerk.

---

## Umsetzungsreihenfolge (so gehen wir gemeinsam vor)

1. ~~**Setup:** `package.json` um Abhängigkeiten ergänzen, `Dockerfile` (EXPOSE 3001),
   `src/index.js` + `config/db.js` nach Vorlage. → Service startet „leer".~~ ✅ erledigt
2. ~~**DB:** `token_blacklist` in `database/init.sql` ergänzen; Mailpit + `.env`-Werte in
   `docker-compose.yml` / `.env` eintragen.~~ ✅ erledigt (Schritt 2a/2b/2c)
3. ~~**AUTH-1 + AUTH-2:** `register`, `confirm` — erste echte Mail in Mailpit getestet.~~ ✅ erledigt
   (`config/mailer.js`, `utils/tokens.js`, `routes/auth.js`; end-to-end gegen Mailpit verifiziert.
   `me` wurde **nach Schritt 4 verschoben**, weil es ein JWT braucht, das erst `login` ausstellt.)
4. ~~**AUTH-3 + AUTH-4:** `utils/jwt.js`, `login`, `validate` + `middleware/authenticate.js`,
   `me`, `logout`.~~ ✅ erledigt
   (Reihenfolge wegen Abhängigkeiten: `jwt.js` → `login` (stellt JWT aus) → `validate` /
   `authenticate` → `me` → `logout`. `/validate` macht zusätzlich zur Signatur- und
   Blacklist-Prüfung einen **Live-DB-Check** auf `locked`/Existenz, damit Sperren (USER-4)
   sofort wirken — der `authenticate`-Middleware für die eigenen Endpunkte `/me`/`/logout`
   macht diesen Check bewusst nicht. Bruno-Requests angelegt.)
5. ~~**AUTH-5:** `magic-link`, `magic-login` (Link + Code).~~ ✅ erledigt
   (`POST /magic-link`, `GET /magic-login/:token`, `POST /magic-login`; 9 Bruno-Requests angelegt.)
6. **Bruno:** zu jedem Endpunkt eine `.bru` in `planung/bruno/auth-service/` anlegen.
7. **Frontend (AUTH-Front):** Formulare im user-portal — eigener, späterer Schritt.

Nach jedem Endpunkt: in **Bruno** testen, dann der nächste (euer üblicher Workflow).

---

## Mini-Entscheidung (entschieden)

**Login bei unbestätigter E-Mail erlauben?** → **Ja, Login ist erlaubt.** Lediglich
„empfindliche" Aktionen (insbesondere **Käufe**) verlangen `email_verified = true`. Das ist
nutzerfreundlich und trotzdem sicher. Wird in **Schritt 4** (`login`) bzw. beim Kauf-Endpunkt
des inventory-service wirksam.
