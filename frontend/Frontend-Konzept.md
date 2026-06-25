# Frontend-Konzept — funktionale Frontends gegen das Backend

> Ergänzt `Konzept.md` (das den nginx-/Auslieferungsteil erklärt). **Diese** Datei beschreibt,
> **was** wir bauen: Seitenstruktur, genutzte Endpunkte pro Seite, die gemeinsamen JS-Helfer und
> das Design-Grundgerüst. Vorgabe bleibt: **pures Vanilla JS/HTML/CSS**, kein Framework, kein
> Build-Tool, schlicht/menschlich (Niveau Studierende).

---

## 1. Zwei Portale, getrennte `public/`-Ordner

| Portal | URL | Zielgruppe | Login-Regel |
|---|---|---|---|
| `user-portal/public/` | http://localhost:8080 | Endanwender | jeder eingeloggte User |
| `admin-portal/public/` | http://localhost:8081 | Admins | nur `role === 'admin'` |

Jedes Portal hat seinen **eigenen** Satz Dateien (auch eigene `api.js`/`auth.js`-Kopie) — die
Portale teilen sich keinen Code, weil nur der jeweilige `public/`-Ordner in nginx gemountet wird.
Das ist etwas Doppelung, aber ehrlich und einfach (kein Build, der Dateien zusammenkopiert).

---

## 2. Gemeinsame Helfer (in jedem Portal `public/js/`)

### `api.js` — zentrale Service-URLs + fetch-Wrapper
```js
const SERVICES = {
  auth:      'http://localhost:3001',
  inventory: 'http://localhost:3003',
  wishlist:  'http://localhost:3004',
  user:      'http://localhost:3005',
};

// Wrapper: hängt automatisch den Bearer-Token an, schickt/parst JSON und wirft bei
// Fehlerstatus einen Error mit der Backend-Fehlermeldung (res.body.error).
async function apiFetch(url, { method = 'GET', body, auth = true } = {}) { ... }
```
- `price`/`amount` kommen als **String** vom Backend → in der Anzeige mit `Number(...)`
  rechnen und mit `toFixed(2)` + `€` formatieren (kleine Helfer-Funktion `formatPrice`).
- Backend nicht erreichbar → freundliche Meldung „Server nicht erreichbar" statt roher Fehler.

### `auth.js` — Token & Session
```js
getToken() / setToken(t) / clearToken()      // localStorage-Schlüssel 'token'
async currentUser()                          // GET /api/auth/me (cached pro Seitenaufruf)
requireLogin()                               // kein Token → redirect login.html
async logout()                               // POST /api/auth/logout + clearToken + redirect
renderNav()                                  // Nav zeigt Login ODER (E-Mail + Logout)
```
Im **admin-portal** zusätzlich `requireAdmin()`: nach `/me` prüfen, ob `role === 'admin'`,
sonst zurück zum Login mit Hinweis „Nur für Admins".

---

## 3. user-portal — Seiten & Endpunkte

| Seite | Inhalt | Genutzte Endpunkte |
|---|---|---|
| `login.html` | 3 Tabs: **Login**, **Registrieren**, **Magic-Link** | `POST /api/auth/login` · `POST /api/auth/register` · `POST /api/auth/magic-link` + `POST /api/auth/magic-login` (Code) |
| `index.html` | Produktliste + Suche (Name) + Kategorie-Filter, „In den Warenkorb", „Auf Wunschliste" | `GET /api/products?name=&category=` · `POST /api/cart` |
| `warenkorb.html` | Warenkorb-Positionen, Menge, Entfernen, Summe, „Zur Kasse" | `GET/POST/DELETE /api/cart` · `POST /api/orders` |
| `bestellungen.html` | Kaufhistorie (neueste zuerst) | `GET /api/orders` |
| `wunschliste.html` | Eigene + geteilte Listen, anlegen/umbenennen/löschen, Produkte entfernen, teilen | `GET/POST/PUT/DELETE /api/wishlists…` · `POST /:id/share` |

**Auth-Fluss:** `login.html` ist die einzige öffentliche Seite. Alle anderen rufen oben
`requireLogin()` auf. Token in `localStorage`. Nav rechts: eingeloggt → E-Mail + „Logout",
sonst „Login".

**Magic-Link (AUTH-5) im Frontend:** Tab fordert per E-Mail einen Einmal-Code an
(`POST /magic-link`, immer „Falls registriert, gesendet"). Der User holt den **Code** aus
Mailpit (localhost:8025) und gibt ihn ein → `POST /magic-login {email, code}` → Token. (Wir
nutzen die **Code**-Variante, weil der Link auf den Backend-Port zeigt, nicht aufs Frontend.)

**Kauf-Sonderfall:** Tom (unverifiziert) bekommt bei „Zur Kasse" ein **403** → wir zeigen
„Bitte bestätige zuerst deine E-Mail-Adresse" statt eines technischen Fehlers.

---

## 4. admin-portal — Seiten & Endpunkte

| Seite | Inhalt | Genutzte Endpunkte |
|---|---|---|
| `login.html` | Login (danach `requireAdmin`) | `POST /api/auth/login` + `/me` role-Check |
| `produkte.html` | Tabelle aller Produkte, Anlegen/Bearbeiten/Löschen | `GET /api/products` · `POST/PUT/DELETE /api/products` |
| `benutzer.html` | User per **ID** nachschlagen → Details; sperren/entsperren/löschen; Admin anlegen | `GET /api/users/:id` · `PUT /:id/lock`/`unlock` · `DELETE /:id` · `POST /api/users/admin` |

**Userverwaltung-Hinweis:** Der user-service hat **keine** Listen-/Such-Route — daher gibt der
Admin eine **User-ID** ein und bekommt die Details. (Test-IDs: 1 admin, 2 max, 3 anna, 4 tom.)
Das ist bewusst so, kein Backend-Eingriff in diesem PR.

---

## 5. Design-Grundgerüst (aus PR #42 geliftet)

- `css/style.css` (komplett übernommen) — warme Erd-Palette (`--color-primary` grün,
  `--color-accent` orange, `--color-bg` creme), **Nunito**, Card-Grid, responsive.
- **Fix:** Tippfehler `.product-gri` → `.product-grid` in der `@media`-Regel.
- Gemeinsames Gerüst je Seite: `<header>` mit Titel + `<nav>`, `<main>` (max 1000px zentriert),
  `<footer>`. Inhalte werden **per JS dynamisch** gefüllt (kein hartkodiertes HTML mehr).
- Kleine Ergänzungen im CSS nach Bedarf: Formulare (Login/Tabs), Tabellen (Admin),
  Statusmeldungen (`.msg.error` / `.msg.ok`) — schlicht, im selben Stil.
- admin-portal nutzt **dasselbe** `style.css` (kopiert), evtl. andere Akzentfarbe, damit man
  die beiden Portale optisch auseinanderhält.

---

## 6. Reihenfolge der Umsetzung (jede Etappe einzeln im Browser gezeigt)

1. Gerüst + `api.js`/`auth.js` + `login.html` (Login/Register/Magic-Link)
2. Produkte + Suche (`index.html`)
3. Warenkorb (`warenkorb.html`)
4. Kauf + Historie (`warenkorb.html` Checkout + `bestellungen.html`)
5. Wunschlisten (`wunschliste.html`)
6. admin-portal Gerüst + Login
7. Produktverwaltung
8. Userverwaltung

---

## 7. Lokales Testen

```bash
# Vollständiger Stack (alle Services + DB + Mailpit + Dummy-Daten + beide Frontends)
docker compose --profile dev up -d --build
```
Dann: user-portal http://localhost:8080, admin-portal http://localhost:8081, Mailpit
http://localhost:8025. Datei ändern → im Browser `Strg+F5` (Volume-Mount, kein Rebuild).
Test-Accounts (PW `Test1234!`): `admin@test.de`, `max@test.de` (verifiziert),
`anna@test.de`, `tom@test.de` (unverifiziert → Kauf 403).
