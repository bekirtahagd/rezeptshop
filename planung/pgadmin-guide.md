# pgAdmin – Anleitung

pgAdmin ist das Web-Interface zur PostgreSQL-Datenbank. Es läuft als eigener Docker-Container.

---

## 1. pgAdmin starten

```bash
docker compose --profile dev up postgres pgadmin
```

Danach im Browser öffnen: **http://localhost:5050**

> **Hinweis:** pgAdmin braucht nach dem Start ca. 30–60 Sekunden bis die Seite lädt.
> Einfach kurz warten und die Seite neu laden falls sie nicht sofort erscheint.

**Login-Daten** (aus der `.env`-Datei):
- Email: `PGADMIN_EMAIL`
- Passwort: `PGADMIN_PASSWORD`

---

## 2. Server verbinden (einmalig)

Nach dem ersten Login muss der Datenbankserver einmal manuell registriert werden.

1. Im linken Menü: Rechtsklick auf **Servers** → **Register → Server**

2. Tab **General**:
   - Name: `rezeptshop` (frei wählbar)

3. Tab **Connection**:
   | Feld | Wert |
   |---|---|
   | Host | `postgres` (Docker-Netzwerkname — **nicht** `localhost`) |
   | Port | `5432` |
   | Database | Wert von `POSTGRES_DB` aus der `.env` |
   | Username | Wert von `POSTGRES_USER` aus der `.env` |
   | Password | Wert von `POSTGRES_PASSWORD` aus der `.env` |

4. **Save** klicken.

> Diese Einstellung bleibt gespeichert — beim nächsten Start muss das nicht wiederholt werden.

---

## 3. Tabellen ansehen

Im linken Baum navigieren:

```
Servers
└── rezeptshop
    └── Databases
        └── rezeptshop          ← unsere Datenbank (nicht "postgres")
            └── Schemas
                └── public
                    └── Tables  ← alle 10 Tabellen
```

**Daten einer Tabelle anzeigen:**
Rechtsklick auf eine Tabelle → **View/Edit Data → All Rows**

---

## 4. ERM-Diagramm anzeigen

pgAdmin kann automatisch ein Entity-Relationship-Diagramm aus den bestehenden Tabellen generieren.

1. Rechtsklick auf die Datenbank **rezeptshop** → **ERD Tool**
2. Das Tool öffnet sich — alle Tabellen mit Beziehungen werden geladen
3. Tabellen nach Belieben per Drag & Drop anordnen
4. **Als Bild exportieren:** File → **Generate ERD** (oder Kamera-Icon in der Toolbar) → als PNG speichern

> Das exportierte Bild kann direkt als offizielles ERM in die Projektdokumentation (`docs/`) übernommen werden.

---

## 5. SQL direkt ausführen

Für manuelle Abfragen oder Tests:

1. Rechtsklick auf die Datenbank **rezeptshop** → **Query Tool**
2. SQL eingeben und mit **F5** oder dem Play-Button ausführen

Beispiel:
```sql
SELECT * FROM users;
SELECT * FROM products;
```

---

## 6. Datenbank zurücksetzen (bei Schema-Änderungen)

Das `init.sql`-Script wird nur beim **ersten** Start ausgeführt. Wenn das Schema geändert wurde, muss der Volume gelöscht werden:

```bash
# Container und Volume löschen
docker compose down -v

# Neu starten — init.sql wird jetzt erneut ausgeführt
docker compose --profile dev up postgres pgadmin
```

> **Achtung:** `-v` löscht alle Daten in der Datenbank unwiderruflich.
> Nur ausführen wenn die Daten nicht gebraucht werden (z.B. in der Entwicklung).
