# Architektur

Microservice-Architektur des Rezeptshops. Die Diagramme rendern direkt auf GitHub (Mermaid).
Ausführliche Begründung der Entwurfsentscheidungen:
[`../planung/architecture.md`](../planung/architecture.md).

## Komponenten & Ports

```mermaid
flowchart TB
    subgraph Browser
        UP["user-portal<br/>nginx :8080"]
        AP["admin-portal<br/>nginx :8081"]
    end

    subgraph Services["Backend (Node.js + Express)"]
        AUTH["auth-service<br/>:3001"]
        AUTHZ["authorization-service<br/>:3002"]
        INV["inventory-service<br/>:3003"]
        WISH["wishlist-service<br/>:3004"]
        USER["user-service<br/>:3005"]
    end

    DB[("PostgreSQL<br/>eine gemeinsame DB")]
    MAIL["Mailpit (Dev)<br/>:8025"]

    UP -->|REST + JWT| AUTH
    UP -->|REST + JWT| INV
    UP -->|REST + JWT| WISH
    AP -->|REST + JWT| AUTH
    AP -->|REST + JWT| INV
    AP -->|REST + JWT| USER

    INV -->|validate JWT| AUTH
    WISH -->|validate JWT| AUTH
    USER -->|validate JWT| AUTH
    INV -->|check permission| AUTHZ
    WISH -->|check / grant| AUTHZ
    USER -->|check permission| AUTHZ

    AUTH --> DB
    AUTHZ --> DB
    INV --> DB
    WISH --> DB
    USER --> DB
    AUTH -.Mails.-> MAIL
    INV -.Kaufbestätigung.-> MAIL
```

## Berechtigungs-Fluss (Beispiel: Produkt anlegen)

Jeder fachliche Service prüft **nicht selbst** JWTs oder Rechte, sondern delegiert:
Token-Validierung an den `auth-service`, Rechteprüfung an den `authorization-service`.

```mermaid
sequenceDiagram
    participant B as admin-portal
    participant I as inventory-service
    participant A as auth-service
    participant Z as authorization-service
    participant DB as PostgreSQL

    B->>I: POST /api/products (Bearer JWT)
    I->>A: POST /validate (Token)
    A->>DB: Signatur + Blacklist + locked prüfen
    A-->>I: { valid, userId, role }
    I->>Z: POST /check { userId, role, resourceType:"product", action:"write" }
    Z-->>I: { allowed: true }  (nur Admin)
    I->>DB: INSERT INTO products
    I-->>B: 201 Created
```

## Kernprinzipien

- **JWT** stellt und validiert **ausschließlich** der `auth-service`. Andere Services kennen
  das `JWT_SECRET` nicht — sie rufen `POST /validate` auf.
- **Berechtigungen** prüft **ausschließlich** der `authorization-service`
  (`POST /api/authorization/check`); fachliche Services delegieren mit `userId` + `role`.
- **Eine gemeinsame PostgreSQL-Datenbank** für alle Services (kein Schema pro Service).
- **Frontends** sind reine statische Vanilla-JS-Apps, ausgeliefert über **nginx** (Volume-Mount,
  kein Build). Kommunikation mit den Services per `fetch` über CORS (`:8080`/`:8081` erlaubt).
- **Stateless**: JWT im Browser (`localStorage`); echtes Logout über `token_blacklist`.
- **Zugriffsmodell — Login für die gesamte Anwendung erforderlich (bewusste Entscheidung):**
  Es gibt **keinen anonymen Zugriff**. `login.html` (Login/Registrierung/Magic-Link) ist die
  einzige öffentlich erreichbare Seite; jede andere Seite ruft `requireLogin()` auf und leitet
  ohne gültigen Token zur Anmeldung um. Entsprechend verlangen **alle** Backend-Endpunkte ein
  gültiges JWT — auch das reine Lesen von Produkten. Die Regel „jeder darf Produkte lesen"
  bedeutet daher **jeder eingeloggte User** (nicht die anonyme Öffentlichkeit): Sie unterscheidet
  Leserechte (jeder angemeldete User) von Schreibrechten (nur Admin), nicht angemeldet vs. anonym.

Siehe auch: [`ERM.md`](ERM.md) (Datenmodell), [`../planung/CORS.md`](../planung/CORS.md) (CORS).
