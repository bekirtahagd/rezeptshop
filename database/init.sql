-- init.sql
-- Wird automatisch von PostgreSQL ausgeführt wenn der Container zum ersten Mal startet.
-- Reihenfolge ist wichtig: referenzierte Tabellen müssen zuerst erstellt werden.

-- ─────────────────────────────────────────────────────────────
-- USERS & AUTH
-- ─────────────────────────────────────────────────────────────

CREATE TABLE users (
    user_id         SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password        VARCHAR(255) NOT NULL,
    role            VARCHAR(10)  NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    locked          BOOLEAN      NOT NULL DEFAULT false,
    email_verified  BOOLEAN      NOT NULL DEFAULT false,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE verification_tokens (
    token_id    SERIAL PRIMARY KEY,
    token       VARCHAR(255) UNIQUE NOT NULL,
    user_id     INT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type        VARCHAR(20)  NOT NULL CHECK (type IN ('email_verification', 'magic_link')),
    expires_at  TIMESTAMP    NOT NULL,
    used        BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- PRODUKTE
-- ─────────────────────────────────────────────────────────────

CREATE TABLE products (
    product_id  SERIAL PRIMARY KEY,
    name        VARCHAR(255)    NOT NULL,
    description TEXT,
    price       NUMERIC(10, 2)  NOT NULL,
    amount      INT             NOT NULL DEFAULT 0,
    category    VARCHAR(100),
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- WARENKORB (INV-6)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE carts (
    cart_id     SERIAL PRIMARY KEY,
    user_id     INT       NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE cart_items (
    cart_item_id  SERIAL PRIMARY KEY,
    cart_id       INT NOT NULL REFERENCES carts(cart_id)    ON DELETE CASCADE,
    product_id    INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    quantity      INT NOT NULL DEFAULT 1,
    UNIQUE (cart_id, product_id)
);

-- ─────────────────────────────────────────────────────────────
-- BESTELLUNGEN (INV-7)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE orders (
    order_id  SERIAL PRIMARY KEY,
    user_id   INT          REFERENCES users(user_id) ON DELETE SET NULL,
    date      TIMESTAMP    NOT NULL DEFAULT NOW(),
    status    VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled'))
);

CREATE TABLE orderpositions (
    orderposition_id  SERIAL PRIMARY KEY,
    order_id          INT            NOT NULL REFERENCES orders(order_id)   ON DELETE CASCADE,
    product_id        INT            REFERENCES products(product_id) ON DELETE SET NULL,
    purchase_price    NUMERIC(10, 2) NOT NULL,
    amount            INT            NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- WUNSCHLISTEN (WUN-1 – WUN-4)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE wishlists (
    list_id         SERIAL PRIMARY KEY,
    owner_user_id   INT          NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE wishlist_product (
    list_id     INT NOT NULL REFERENCES wishlists(list_id)   ON DELETE CASCADE,
    product_id  INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    PRIMARY KEY (list_id, product_id)
);

-- ─────────────────────────────────────────────────────────────
-- BERECHTIGUNGEN (AUTO-1, WUN-4)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE permissions (
    permission_id  SERIAL PRIMARY KEY,
    user_id        INT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    resource_type  VARCHAR(20) NOT NULL CHECK (resource_type IN ('product', 'user', 'wishlist')),
    resource_id    INT         NOT NULL,
    permission     VARCHAR(10) NOT NULL CHECK (permission IN ('read', 'write', 'owner')),
    UNIQUE (user_id, resource_type, resource_id)
);
