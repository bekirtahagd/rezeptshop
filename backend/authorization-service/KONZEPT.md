# Authorization-Service — Konzept & Implementierungsplan

## Was macht dieser Service?

Der Authorization-Service ist der einzige Ort im System, der entscheidet ob ein User
eine Aktion ausführen darf. Alle anderen Services fragen hier an.

**Eingehende Frage:** "Darf User X (mit Rolle Y) die Aktion Z auf Ressource R ausführen?"
**Antwort:** `{ allowed: true }` oder `{ allowed: false }`

**Wichtig:** Dieser Service prüft **keine JWTs**. Das macht ausschließlich der auth-service.
Dieser Service bekommt nur `userId` und `role` — und vertraut darauf, weil die Anfrage
von einem internen Service kommt, der das JWT bereits geprüft hat.

---

## Die drei Ressourcentypen

| resourceType | Beschreibung |
|---|---|
| `product` | Rezepte im Shop |
| `user` | User-Profile |
| `wishlist` | Wunschlisten von Usern |

---

## Hardcodierte Grundregeln

| Rolle | Ressourcentyp | Aktion | Erlaubt? |
|---|---|---|---|
| admin | alle | alle | immer ja |
| user | product | read | ja |
| user | product | write, delete | nein |
| user | user | read, write | nur das eigene Profil (userId === resourceId) |
| user | user | delete | nein |
| user | wishlist | alle | ja, wenn userId === ownerId (eigene Wishlist) |
| user | wishlist | alle | DB-Lookup in `permissions`-Tabelle wenn nicht Besitzer |

Diese Regeln stehen als Code in `src/config/rules.js` — kein DB-Eintrag nötig.

---

## Custom Permissions (für alle Ressourcentypen)

Für alle Ressourcentypen können Custom Permissions vergeben werden.
Gespeichert in der `permissions`-Tabelle (resource_type + resource_id).
Es gibt drei Stufen — höhere Stufe schließt niedrigere ein:

| Stufe | Kann lesen | Kann schreiben | Kann Rechte vergeben |
|---|---|---|---|
| `read` | ja | nein | nein |
| `write` | ja | ja | nein |
| `owner` | ja | ja | ja |

---

## Die zwei Endpunkte

### 1. `POST /api/authorization/check`

Prüft ob ein User eine Aktion ausführen darf.

**Ablauf:**
1. Hardcodierte Regeln prüfen → `true` (direkt erlaubt) oder `false` (direkt verboten)
2. Wenn `null` → Custom Permission aus `permissions`-Tabelle lesen

**Request-Body:**
```json
{
  "userId": 2,
  "role": "user",
  "resourceType": "wishlist",
  "resourceId": 101,
  "ownerId": 2,
  "action": "write"
}
```

- `ownerId` ist nur bei `resourceType: "wishlist"` relevant
- **Response:** `{ "allowed": true }`

### 2. `POST /api/authorization/grant`

Vergibt eine Custom-Permission auf eine Ressource.
Nur der Besitzer oder ein Admin darf das.

**Request-Body:**
```json
{
  "requesterId": 2,
  "requesterRole": "user",
  "targetUserId": 4,
  "resourceId": 101,
  "resourceType": "wishlist",
  "ownerId": 2,
  "permission": "read"
}
```

- Wenn der User bereits eine Permission auf diese Ressource hat, wird sie überschrieben (Upsert)
- **Response:** `{ "message": "Permission granted" }`

---

## Implementierungsstand

### Phase 1 — Ohne Datenbank ✅
- Express-App auf Port 3002
- Alle Grundregeln implementiert
- Custom Permissions als Dummy-Daten simuliert (`config/rules.js`)
- Beide Endpunkte funktionierten
- Alle 14 Tests bestanden (`test-api.ps1`)

### Phase 2 — Mit Datenbank ✅
- `pg`-Paket installiert (PostgreSQL-Client)
- `src/config/db.js` — Connection Pool zur gemeinsamen PostgreSQL-DB
- `src/config/rules.js` — nur noch hardcodierte Regeln, kein Dummy-Array mehr
  - `isAllowed()` gibt jetzt `null` zurück wenn ein DB-Lookup nötig ist
- `src/routes/authorization.js` — beide Handler sind async
  - `/check` macht DB-Query wenn `isAllowed` null zurückgibt
  - `/grant` schreibt echten Upsert in `permissions`-Tabelle
- `test-api.ps1` aktualisiert: Grant-Tests laufen vor Check-Tests (DB-Daten werden erst angelegt, dann geprüft)
- 15 Tests (1 neu hinzugekommen)

---

## Dateistruktur

```
src/
├── index.js                  # Express-App, Port 3002
├── config/
│   ├── db.js                 # PostgreSQL Connection Pool
│   └── rules.js              # Hardcodierte Grundregeln (kein DB-Zugriff)
└── routes/
    └── authorization.js      # Handler für /check und /grant
```

---

## Ports & Konfiguration

- Läuft auf Port **3002** (intern, nur Docker-Netzwerk)
- Braucht **kein** `JWT_SECRET` — JWT-Validierung macht der auth-service
- Braucht: `DATABASE_URL` (PostgreSQL-Verbindung, aus zentraler `.env`)

---

## Sicherheitsmodell & Request-Flow

### Folgefrage: Woher weiß dieser Service, dass die userId echt ist?

Da dieser Service keine JWTs prüft, könnte ein Aufrufer theoretisch eine fremde `userId`
im Body schicken und sich als jemand anderes ausgeben.

**Antwort:** Das Docker-Netzwerk übernimmt diese Vertrauensebene.

Der `authorization-service` ist von außen **nicht erreichbar** — er lauscht nur im internen
Docker-Netzwerk. Jeder Service, der ihn aufruft, hat davor bereits beim `auth-service`
das JWT validiert und die echte `userId` + `role` extrahiert. Wir vertrauen den internen
Services, weil sie selbst die Authentifizierung bereits durchgeführt haben.

Für ein Produktionssystem würde man zusätzlich Service-to-Service-Authentifizierung
einbauen. Für dieses Projekt ist das Docker-Netzwerk als Vertrauensebene ausreichend
und sollte in der Präsentation so erklärt werden können.

### Der vollständige Request-Flow (Beispiel: User kauft ein Produkt)

```
1. Frontend schickt Request mit JWT im Header
        ↓
2. inventory-service empfängt den Request
        ↓
3. inventory-service → auth-service: POST /api/auth/validate
   Body: { token: "Bearer ..." }
   Antwort: { userId: 2, role: "user" }
        ↓
4. inventory-service → authorization-service: POST /api/authorization/check
   Body: { userId: 2, role: "user", resourceType: "product", resourceId: 5, action: "read" }
   Antwort: { allowed: true }
        ↓
5. inventory-service verarbeitet den Request und antwortet dem Frontend
```

Pro eingehendem Request entstehen **zwei interne HTTP-Calls** (auth + authorization).
Das ist für dieses Projekt vollkommen akzeptabel.

---

## Abhängigkeiten zu anderen Services

- **auth-service** validiert JWTs und gibt `userId` + `role` zurück. Dieser Service bekommt
  diese Werte von den aufrufenden Services weitergereicht.
- **Alle anderen Services** rufen `POST /api/authorization/check` auf, bevor sie
  Requests verarbeiten.
- **wishlist-service** ruft `POST /api/authorization/grant` auf, wenn ein User
  seine Wishlist mit jemand anderem teilt (WUN-4).
