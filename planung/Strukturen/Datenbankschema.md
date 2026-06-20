# Datenbankschema – Rezeptshop

Eine gemeinsame PostgreSQL-Datenbank für alle Services.
Das vollständige Diagramm liegt als `ERM.mmd` im selben Ordner.

---

## users

**Zweck:** Speichert alle registrierten Konten — sowohl normale User als auch Admins.

**Felder:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `user_id` | SERIAL PK | Eindeutige ID des Accounts |
| `email` | VARCHAR UNIQUE | E-Mail-Adresse, gleichzeitig der Login-Name |
| `password` | VARCHAR | bcrypt-gehashtes Passwort |
| `role` | VARCHAR | `'user'` oder `'admin'` — steuert Zugriffsrechte |
| `locked` | BOOLEAN | `true` = Admin hat den Account gesperrt (USER-4) |
| `email_verified` | BOOLEAN | `true` = Bestätigungslink wurde geklickt (AUTH-2) |
| `created_at` | TIMESTAMP | Registrierungszeitpunkt |

**Benutzt von:**
- `auth-service` — liest/schreibt beim Login und bei der Registrierung
- `user-service` — liest, sperrt, löscht Accounts (nur Admin)
- `authorization-service` — liest `role`, um Grundregeln zu prüfen

---

## verification_tokens

**Zweck:** Temporäre Einmal-Token für E-Mail-basierte Flows. Jeder Token ist nach Benutzung oder Ablauf ungültig.

**Felder:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `token_id` | SERIAL PK | Interne ID |
| `token` | VARCHAR UNIQUE | Zufälliger String (UUID), wird in der Mail verschickt |
| `user_id` | INT FK → users | Zu welchem Account dieser Token gehört |
| `type` | VARCHAR | `'email_verification'` oder `'magic_link'` |
| `expires_at` | TIMESTAMP | Nach diesem Zeitpunkt ist der Token ungültig |
| `used` | BOOLEAN | `true` = bereits benutzt, darf nicht erneut akzeptiert werden |
| `created_at` | TIMESTAMP | Erstellungszeitpunkt |

**Benutzt von:**
- `auth-service` — erstellt Token beim Registrieren (AUTH-2) und bei Magic-Link-Anfragen (AUTH-5); markiert Token als `used` wenn der Link geklickt wird

**Was ist der Unterschied zu JWTs?**
JWTs werden **nicht** in der Datenbank gespeichert. Nach dem Login bekommt der Browser einen JWT und speichert ihn selbst (z.B. im `localStorage`). Bei jedem Request schickt der Browser den JWT im Header mit — der Server prüft nur die Signatur, ohne die DB zu fragen. `verification_tokens` hingegen sind kurzlebige Tokens für Mail-Links, die nur einmal gültig sind und deshalb in der DB verwaltet werden müssen.

---

## products

**Zweck:** Katalog aller Produkte (Rezepte) im Shop.

**Felder:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `product_id` | SERIAL PK | Eindeutige Produkt-ID |
| `name` | VARCHAR | Produktname |
| `description` | TEXT | Beschreibung |
| `price` | NUMERIC(10,2) | Preis in Euro |
| `amount` | INT | Aktuell verfügbarer Bestand |
| `category` | VARCHAR | Kategorie (z.B. "Vegan", "Backen") — zweites Suchkriterium für INV-2 |
| `created_at` | TIMESTAMP | Erstellungszeitpunkt |

**Benutzt von:**
- `inventory-service` — vollständiger Lese- und Schreibzugriff (INV-1 bis INV-5)
- `inventory-service` — prüft `amount > 0` bevor ein Produkt in den Warenkorb gelegt wird (INV-6)
- `inventory-service` — reduziert `amount` beim Kauf (INV-7)

---

## carts

**Zweck:** Jeder eingeloggte User hat genau einen Warenkorb. Die Tabelle verknüpft einen User mit seinem Warenkorb-Container.

**Felder:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `cart_id` | SERIAL PK | Warenkorb-ID |
| `user_id` | INT UNIQUE FK → users | Ein Warenkorb pro User (UNIQUE stellt das sicher) |
| `created_at` | TIMESTAMP | Erstellungszeitpunkt |

**Benutzt von:**
- `inventory-service` — legt beim ersten Login/Zugriff automatisch einen Warenkorb an; liest und schreibt Warenkorb-Daten (INV-6)

---

## cart_items

**Zweck:** Die einzelnen Produkte im Warenkorb eines Users, mit ihrer gewünschten Menge.

**Felder:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `cart_item_id` | SERIAL PK | Interne ID |
| `cart_id` | INT FK → carts | Zu welchem Warenkorb der Eintrag gehört |
| `product_id` | INT FK → products | Welches Produkt |
| `quantity` | INT | Gewünschte Menge |

`UNIQUE(cart_id, product_id)` verhindert, dass dasselbe Produkt doppelt im Warenkorb auftaucht — stattdessen wird `quantity` erhöht.

**Benutzt von:**
- `inventory-service` — hinzufügen, entfernen, Menge ändern (INV-6); beim Kauf werden alle `cart_items` in `orderpositions` überführt und danach gelöscht (INV-7)

---

## orders

**Zweck:** Kopfdaten einer abgeschlossenen Bestellung. Jede Bestellung gehört zu einem User und hat einen Status.

**Felder:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `order_id` | SERIAL PK | Eindeutige Bestellnummer |
| `user_id` | INT FK → users (SET NULL) | Wer bestellt hat — bleibt auch nach User-Löschung erhalten |
| `date` | TIMESTAMP | Kaufzeitpunkt |
| `status` | VARCHAR | `'pending'`, `'completed'` oder `'cancelled'` |

`SET NULL` bei User-Löschung: Wenn ein Admin einen User löscht (USER-2), bleiben die Bestellungen in der DB — nur `user_id` wird auf `NULL` gesetzt. Kaufhistorie geht nicht verloren.

**Benutzt von:**
- `inventory-service` — erstellt eine neue Order beim Kauf (INV-7); listet Bestellhistorie auf (INV-7)

---

## orderpositions

**Zweck:** Die einzelnen Produkte einer Bestellung — als Snapshot zum Kaufzeitpunkt. Auch wenn das Produkt später teurer wird oder gelöscht wird, bleibt der historische Eintrag korrekt.

**Felder:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `orderposition_id` | SERIAL PK | Interne ID |
| `order_id` | INT FK → orders | Zu welcher Bestellung |
| `product_id` | INT FK → products (SET NULL) | Welches Produkt — `NULL` wenn Produkt gelöscht wurde |
| `purchase_price` | NUMERIC(10,2) | Preis zum Kaufzeitpunkt (Snapshot!) |
| `amount` | INT | Gekaufte Menge |

**Benutzt von:**
- `inventory-service` — beim Kauf werden alle `cart_items` als `orderpositions` gespeichert (INV-7)

---

## wishlists

**Zweck:** Wunschlisten der User. Jede Liste hat einen Besitzer und kann Produkte enthalten sowie mit anderen geteilt werden.

**Felder:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `list_id` | SERIAL PK | Eindeutige Listen-ID |
| `owner_user_id` | INT FK → users | Wer die Liste erstellt hat und besitzt |
| `name` | VARCHAR | Name der Liste |
| `description` | TEXT | Beschreibung der Liste |
| `created_at` | TIMESTAMP | Erstellungszeitpunkt |

**Benutzt von:**
- `wishlist-service` — erstellen, umbenennen, löschen (WUN-1, WUN-2, WUN-3)
- `authorization-service` — liest `owner_user_id`, um zu prüfen ob jemand der Besitzer ist

---

## permissions

**Zweck:** Zentrale Berechtigungstabelle für alle Ressourcentypen im System. Speichert Custom-Permissions — also Rechte, die über die hardcodierten Grundregeln hinausgehen (z.B. "User A darf die Wunschliste von User B lesen").

Die hardcodierten Grundregeln (Admins dürfen alles, User dürfen nur eigene Ressourcen) stehen als Code im `authorization-service` und brauchen keinen DB-Eintrag.

**Felder:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `permission_id` | SERIAL PK | Interne ID |
| `user_id` | INT FK → users | Wer die Berechtigung bekommt |
| `resource_type` | VARCHAR | `'product'`, `'user'` oder `'wishlist'` |
| `resource_id` | INT | ID der Ressource — je nach `resource_type`: `product_id`, `user_id` oder `list_id` |
| `permission` | VARCHAR | `'read'`, `'write'` oder `'owner'` |

`UNIQUE(user_id, resource_type, resource_id)` — ein User kann pro Ressource nur eine Berechtigungsstufe haben.

**Berechtigungsstufen:**
- `read` — darf die Ressource lesen
- `write` — darf die Ressource lesen und bearbeiten
- `owner` — darf alles, inklusive Rechte vergeben

**Benutzt von:**
- `wishlist-service` — schreibt einen neuen Eintrag wenn der Besitzer jemanden berechtigt (WUN-4)
- `authorization-service` — liest diese Tabelle bei jeder Ressourcen-Anfrage, um Custom-Permissions zu prüfen (AUTO-1)

---

## wishlist_product

**Zweck:** Verknüpfungstabelle zwischen Wunschlisten und Produkten (n:m).

**Felder:**

| Feld | Typ | Beschreibung |
|---|---|---|
| `list_id` | INT FK → wishlists | Die Liste |
| `product_id` | INT FK → products | Das Produkt |

Primärschlüssel ist die Kombination `(list_id, product_id)` — dasselbe Produkt kann nicht doppelt in einer Liste stehen.

**Benutzt von:**
- `wishlist-service` — Produkt zur Liste hinzufügen / entfernen (WUN-2)
