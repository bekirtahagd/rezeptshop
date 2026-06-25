# Mockups — Oberflächen

Schematische Mockups der wichtigsten Seiten beider Portale. Das Design ist bewusst schlicht
(warme Erd-Palette grün/orange/creme, Nunito-Schrift, Card-Grid, responsiv).

> **Hinweis fürs Team:** Da die Frontends fertig sind, ersetzen am besten **echte Screenshots**
> diese Skizzen. Screenshot machen (z. B. `http://localhost:8080`), unter `docs/screenshots/`
> ablegen und hier einbinden: `![Produktseite](screenshots/produkte.png)`.

---

## Shop-Portal (user-portal, :8080)

### Login / Registrierung / Magic-Link
```
┌───────────────────────────────────────────────┐
│ Rezeptshop                       Produkte  Login│
├───────────────────────────────────────────────┤
│            ┌───────────────────────┐            │
│            │ [Login][Registrieren][Magic]│       │
│            │  Anmelden             │            │
│            │  E-Mail   [_________] │            │
│            │  Passwort [_________] │            │
│            │  [     Anmelden     ] │            │
│            └───────────────────────┘            │
└───────────────────────────────────────────────┘
```

### Produkte + Suche
```
┌───────────────────────────────────────────────────────────┐
│ Rezeptshop      Produkte Warenkorb Bestellungen … max (#2) ⏏│
├───────────────────────────────────────────────────────────┤
│  Frische Rezepte, fertig zum Kochen        (Hero)          │
│  [ Suche nach Name ] [ Kategorie ▼ ] [Suchen] [Zurücksetzen]│
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│  │ Backen  │ │ Vegan   │ │ Fleisch │  ← Kategorie-Tag       │
│  │ Brownies│ │ Burger  │ │ Steak   │                       │
│  │ 4,99 €  │ │ 5,99 €  │ │ 6,99 €  │                       │
│  │ Lager:50│ │ Lager:20│ │Ausverk. │  ← rot, deaktiviert    │
│  │[In Korb]│ │[In Korb]│ │[Ausverk]│                       │
│  └─────────┘ └─────────┘ └─────────┘                       │
└───────────────────────────────────────────────────────────┘
              (Toast unten rechts: „… im Warenkorb — Menge: 2")
```

### Warenkorb
```
┌───────────────────────────────────────────────┐
│  Warenkorb                                      │
│  Brownies     [−] 2 [+]   9,98 €   [Entfernen]  │
│  Pasta        [−] 1 [+]   3,99 €   [Entfernen]  │
│  ─────────────────────────────────────────────  │
│  Gesamt                  13,97 €                │
│  [ Zur Kasse ]                                  │
└───────────────────────────────────────────────┘
```

### Wunschlisten
```
┌───────────────────────────────────────────────┐
│  [ Name neue Liste ] [ Beschreibung ] [Erstellen]│
│  ┌───────────────────────────────────────────┐ │
│  │ Lieblingsrezepte                          │ │
│  │  • Brownies · 4,99 €          [Entfernen] │ │
│  │  • Pasta · 3,99 €             [Entfernen] │ │
│  │  [ Produkt ▼ ] [Hinzufügen]               │ │
│  │  ▸ Aktionen: Umbenennen · Teilen · Löschen│ │
│  └───────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
```

---

## Admin-Portal (admin-portal, :8081) — Slate-Header + „Admin"-Badge

### Produktverwaltung
```
┌───────────────────────────────────────────────────────┐
│ Rezeptshop [Admin]   Dashboard Produkte Benutzer  ⏏     │
├───────────────────────────────────────────────────────┤
│  Neues Produkt                                          │
│  [Name*][Kategorie] [Preis*][Bestand*] [Beschreibung]  │
│  [ Anlegen ]                                            │
│  ── Alle Produkte ───────────────────────────────────  │
│  ID  Name        Kategorie  Preis   Bestand  Aktionen   │
│   1  Brownies    Backen     4,99 €    50    [Bearb][Lösch]│
│   2  Pasta       Pasta      3,99 €    30    [Bearb][Lösch]│
└───────────────────────────────────────────────────────┘
```

### Benutzerverwaltung (Lookup per ID)
```
┌───────────────────────────────────────────────┐
│  Benutzer nachschlagen                          │
│  [ User-ID ] [Suchen]                           │
│  ┌───────────────────────────────┐              │
│  │ ID              2             │              │
│  │ E-Mail          max@test.de   │              │
│  │ Rolle           user          │              │
│  │ Gesperrt        Nein          │              │
│  │ [Sperren] [Löschen]           │              │
│  └───────────────────────────────┘              │
│  Admin-Konto anlegen: [E-Mail*][Passwort*] [+]  │
└───────────────────────────────────────────────┘
```
