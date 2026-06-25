# ERM — Datenmodell

Entity-Relationship-Modell der gemeinsamen PostgreSQL-Datenbank. Das Diagramm rendert direkt
auf GitHub (Mermaid). Quelle der Wahrheit ist [`../database/init.sql`](../database/init.sql);
ausführliche Spaltenerklärungen in
[`../planung/Strukturen/Datenbankschema.md`](../planung/Strukturen/Datenbankschema.md).

```mermaid
erDiagram
    users ||--o{ verification_tokens : "besitzt"
    users ||--o| carts : "hat (0..1)"
    users ||--o{ orders : "tätigt"
    users ||--o{ wishlists : "besitzt"
    users ||--o{ permissions : "erhält"
    carts ||--o{ cart_items : "enthält"
    products ||--o{ cart_items : "liegt in"
    orders ||--o{ orderpositions : "besteht aus"
    products ||--o{ orderpositions : "verkauft als"
    wishlists ||--o{ wishlist_product : "enthält"
    products ||--o{ wishlist_product : "steht auf"

    users {
        int user_id PK
        varchar email UK
        varchar password
        varchar role "admin | user"
        boolean locked
        boolean email_verified
        timestamp created_at
    }
    verification_tokens {
        int token_id PK
        varchar token UK
        int user_id FK
        varchar type "email_verification | magic_link"
        timestamp expires_at
        boolean used
    }
    token_blacklist {
        varchar jti PK "jti eines abgemeldeten JWT"
        timestamp expires_at
    }
    products {
        int product_id PK
        varchar name
        text description
        numeric price
        int amount "Lagerbestand"
        varchar category
        timestamp created_at
    }
    carts {
        int cart_id PK
        int user_id FK "UNIQUE -> 1 Korb je User"
        timestamp created_at
    }
    cart_items {
        int cart_item_id PK
        int cart_id FK
        int product_id FK
        int quantity
    }
    orders {
        int order_id PK
        int user_id FK "ON DELETE SET NULL"
        timestamp date
        varchar status
    }
    orderpositions {
        int orderposition_id PK
        int order_id FK
        int product_id FK "ON DELETE SET NULL"
        numeric purchase_price "Preis zum Kaufzeitpunkt"
        int amount
    }
    wishlists {
        int list_id PK
        int owner_user_id FK
        varchar name
        text description
        timestamp created_at
    }
    wishlist_product {
        int list_id PK_FK
        int product_id PK_FK
    }
    permissions {
        int permission_id PK
        int user_id FK
        varchar resource_type "product | user | wishlist"
        int resource_id
        varchar permission "read | write | owner"
    }
```

## Hinweise

- **Eine gemeinsame Datenbank** für alle fünf Services (kein Schema pro Service).
- **`token_blacklist`** steht bewusst ohne FK: Die `jti` referenziert die ID eines zur
  Laufzeit ausgestellten JWT, keine andere Tabelle (Logout-Mechanismus, AUTH-4).
- **`permissions`** ist generisch: Über `resource_type` + `resource_id` deckt sie
  Produkte, User und Wunschlisten ab (Custom-Berechtigungen read/write/owner).
- **Löschverhalten:** Beim Löschen eines Users werden Korb, Tokens, Wunschlisten und
  Permissions per `CASCADE` mitentfernt; `orders.user_id` und `orderpositions.product_id`
  werden auf `NULL` gesetzt (`SET NULL`), damit die Kaufhistorie erhalten bleibt.
- Eine ältere, handgezeichnete Variante liegt als
  [`../planung/Strukturen/ERM.png`](../planung/Strukturen/ERM.png).
