# Benutzerhandbuch — Rezeptshop

Dieses Handbuch erklärt die Bedienung der beiden Oberflächen des Rezeptshops:
das **Shop-Portal** für Endanwender und das **Admin-Portal** für Administratoren.

> Technische Inbetriebnahme (Docker, Services starten): siehe [`SETUP.md`](SETUP.md).

---

## 1. Überblick

| Portal | Adresse | Für wen |
|---|---|---|
| Shop-Portal (user-portal) | http://localhost:8080 | Endanwender (einkaufen, Wunschlisten) |
| Admin-Portal (admin-portal) | http://localhost:8081 | Administratoren (Produkte & Benutzer verwalten) |
| Mailpit (E-Mail-Postfach im Dev) | http://localhost:8025 | Bestätigungs-/Magic-Link-Mails ansehen |

Die Anmeldung erfolgt über eine E-Mail-Adresse und ein Passwort. Nach dem Login wird ein
Token im Browser gespeichert; läuft er ab oder wird das Konto gesperrt, wird man automatisch
zur Anmeldung zurückgeleitet.

### Test-Accounts (Entwicklungsumgebung)

Passwort überall: **`Test1234!`**

| E-Mail | Rolle | Besonderheit |
|---|---|---|
| `admin@test.de` | admin | Zugang zum Admin-Portal |
| `max@test.de` | user | E-Mail bestätigt (kann einkaufen) |
| `anna@test.de` | user | E-Mail bestätigt |
| `tom@test.de` | user | **unbestätigt** → kann nicht einkaufen |

---

## 2. Shop-Portal (für Endanwender)

### 2.1 Registrieren
1. http://localhost:8080/login.html öffnen → Tab **Registrieren**.
2. E-Mail und Passwort (mind. 8 Zeichen) eingeben → **Registrieren**.
3. Eine Bestätigungsmail wird verschickt. Im Dev liegt sie in **Mailpit**
   (http://localhost:8025) — dort den Bestätigungslink öffnen.
4. Danach im Tab **Login** anmelden.

> Hinweis: Einkaufen (Kasse) ist erst möglich, wenn die E-Mail bestätigt ist.

### 2.2 Anmelden
- **Login**: E-Mail + Passwort eingeben.
- **Magic-Link** (Login ohne Passwort): Tab **Magic-Link** → E-Mail eingeben →
  **Code anfordern**. Den zugesandten Code aus **Mailpit** kopieren, unten eintragen und
  **Einloggen**.

Oben rechts erscheinen nach dem Login die eigene E-Mail und User-ID sowie **Logout**.

### 2.3 Produkte ansehen & suchen
- Die Startseite zeigt alle Produkte als Karten (Name, Kategorie, Preis, Bestand).
- **Suche**: Über das Feld nach Namen suchen und/oder eine **Kategorie** wählen → **Suchen**.
  **Zurücksetzen** zeigt wieder alle Produkte.
- Ausverkaufte Produkte sind rot markiert und nicht bestellbar.

### 2.4 Warenkorb
- **In den Warenkorb**: Auf einer Produktkarte hinzufügen. Ist das Produkt schon im Korb,
  wird die Menge erhöht. Eine kurze Bestätigung erscheint unten rechts.
- **Warenkorb-Seite** (Nav „Warenkorb"): Mengen über **−/+** anpassen, einzelne Positionen
  **Entfernen**, Gesamtsumme sehen.
- Mehr als der Lagerbestand ist nicht möglich (Hinweis erscheint).

### 2.5 Kaufen
1. Im Warenkorb auf **Zur Kasse**.
2. Bei Erfolg: Weiterleitung zu **Bestellungen** mit Bestätigung; der Warenkorb ist geleert.
3. Ist die E-Mail noch nicht bestätigt, erscheint ein Hinweis (kein Kauf möglich).

### 2.6 Bestellungen (Kaufhistorie)
Nav „Bestellungen" zeigt alle bisherigen Käufe (neueste zuerst) mit Datum, Status,
Positionen (Menge, Einzelpreis, Summe) und Gesamtbetrag.

### 2.7 Wunschlisten
- **Neue Liste**: Name (und optional Beschreibung) eingeben → **Liste erstellen**.
- Pro Liste: **Produkt hinzufügen** (Auswahl), Produkte **Entfernen**.
- Unter **Aktionen**: Liste **Umbenennen**; bei eigenen Listen zusätzlich **Teilen** und
  **Löschen**.
- **Teilen**: User-ID der anderen Person + Berechtigung **Lesen** oder **Schreiben** →
  **Teilen**. (Die eigene User-ID steht oben rechts; die der anderen Person muss diese mitteilen.)
- Geteilte Listen anderer erscheinen mit einem orangefarbenen **„geteilt"-Hinweis**.

---

## 3. Admin-Portal (für Administratoren)

Aufruf: http://localhost:8081 — Anmeldung nur mit einem **Administrator-Konto**
(z. B. `admin@test.de`). Normale Konten werden abgewiesen.

### 3.1 Dashboard
Nach dem Login führen zwei Kacheln zur **Produktverwaltung** und **Benutzerverwaltung**
(auch über die obere Navigation erreichbar).

### 3.2 Produktverwaltung
- **Tabelle** aller Produkte (ID, Name, Kategorie, Preis, Bestand).
- **Anlegen**: Formular oben ausfüllen (Name, Preis, Bestand sind Pflicht) → **Anlegen**.
- **Bearbeiten**: In der Zeile **Bearbeiten** → das Formular füllt sich, Änderungen
  **Speichern** (oder **Abbrechen**).
- **Löschen**: In der Zeile **Löschen** (mit Rückfrage).

### 3.3 Benutzerverwaltung
> Der Benutzerdienst bietet keine Suchliste — Benutzer werden über ihre **ID** aufgerufen.
> (Test-IDs: 1 = admin, 2 = max, 3 = anna, 4 = tom.)

- **Nachschlagen**: User-ID eingeben → **Suchen** zeigt die Details (Rolle, gesperrt,
  E-Mail bestätigt, erstellt).
- **Sperren / Entsperren**: Ein gesperrter Benutzer kann sich nicht mehr anmelden.
- **Löschen**: Entfernt das Konto (mit Rückfrage).
- **Admin anlegen**: E-Mail + Passwort → erstellt ein neues Administrator-Konto.

> Sicherheitsregel: Ein Administrator kann sich **nicht selbst** sperren oder löschen.

---

## 4. Häufige Hinweise

- **„Server nicht erreichbar"**: Die Backend-Services laufen nicht — siehe `SETUP.md`
  (`docker compose --profile dev up -d`).
- **„Sitzung abgelaufen"**: Token abgelaufen oder Konto-Daten geändert → einfach neu anmelden.
- **Änderungen nicht sichtbar**: Seite mit **Strg+F5** neu laden (umgeht den Browser-Cache).
- **Browser warnt „Passwort in Datenleck"**: Browser-Sicherheitsfunktion bei gängigen
  Test-Passwörtern — kein Fehler des Shops (siehe `planung/Bekannte-Probleme.md`).
