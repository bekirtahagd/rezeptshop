-- DUMMY-DATEN — nur für Entwicklung
-- Wird automatisch geladen via: docker compose --profile dev up
--
-- Test-Accounts (alle haben dasselbe Passwort):
--   Passwort:     Test1234!
--   bcrypt-Hash:  $2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
--
-- Hinweis: Sobald der auth-service implementiert ist, können neue Hashes
-- mit: node -e "require('bcrypt').hash('Test1234!',10).then(console.log)"
-- generiert und hier eingetragen werden.

-- ─────────────────────────────────────────────────────────────
-- USERS
-- Abdeckung: AUTH-1/3, USER-1/2/3/4
-- ─────────────────────────────────────────────────────────────
INSERT INTO users (email, password, role, locked, email_verified) VALUES
  ('admin@test.de',      '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', false, true),
  ('max@test.de',        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',  false, true),
  ('anna@test.de',       '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',  false, true),
  ('tom@test.de',        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',  false, false),
  ('gesperrt@test.de',   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',  true,  true),
  -- Dedizierte Accounts für Auth-Tests (AUTH-2 / AUTH-5), damit max/anna/tom sauber bleiben:
  ('verify@test.de',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',  false, false),  -- unverifiziert, für Bestätigungs-Flow
  ('magic@test.de',      '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',  false, true)    -- verifiziert, für Magic-Link-Flow
ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- VERIFICATION TOKENS
-- Abdeckung: AUTH-2 (E-Mail-Bestätigung), AUTH-5 (Magic Link)
-- ─────────────────────────────────────────────────────────────
INSERT INTO verification_tokens (token, user_id, type, expires_at, used) VALUES
  -- Offener Bestätigungslink für tom@test.de (email_verified = false) — Erfolgsfall AUTH-2
  ('confirm-token-tom-abc123',
   (SELECT user_id FROM users WHERE email = 'tom@test.de'),
   'email_verification',
   NOW() + INTERVAL '24 hours',
   false),
  -- Offener (gültiger) Magic-Link für max@test.de — Erfolgsfall AUTH-5
  ('magic-token-max-xyz789',
   (SELECT user_id FROM users WHERE email = 'max@test.de'),
   'magic_link',
   NOW() + INTERVAL '15 minutes',
   false),

  -- ── E-Mail-Bestätigung (AUTH-2): alle drei Zustände für verify@test.de ──
  -- gültig & offen → Bestätigung muss klappen
  ('confirm-verify-valid',
   (SELECT user_id FROM users WHERE email = 'verify@test.de'),
   'email_verification', NOW() + INTERVAL '24 hours', false),
  -- abgelaufen → muss mit "Link abgelaufen" abgelehnt werden
  ('confirm-verify-expired',
   (SELECT user_id FROM users WHERE email = 'verify@test.de'),
   'email_verification', NOW() - INTERVAL '1 hour', false),
  -- bereits benutzt → darf kein zweites Mal funktionieren
  ('confirm-verify-used',
   (SELECT user_id FROM users WHERE email = 'verify@test.de'),
   'email_verification', NOW() + INTERVAL '24 hours', true),

  -- ── Magic-Link (AUTH-5): alle drei Zustände für magic@test.de ──
  -- gültig & offen → Einmal-Login muss klappen
  ('magic-magic-valid',
   (SELECT user_id FROM users WHERE email = 'magic@test.de'),
   'magic_link', NOW() + INTERVAL '15 minutes', false),
  -- abgelaufen → muss abgelehnt werden
  ('magic-magic-expired',
   (SELECT user_id FROM users WHERE email = 'magic@test.de'),
   'magic_link', NOW() - INTERVAL '5 minutes', false),
  -- bereits benutzt → Einmal-Login darf nur einmal gehen
  ('magic-magic-used',
   (SELECT user_id FROM users WHERE email = 'magic@test.de'),
   'magic_link', NOW() + INTERVAL '15 minutes', true)
ON CONFLICT (token) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- PRODUKTE
-- Abdeckung: INV-1/2/3/4/5/6/7
-- ─────────────────────────────────────────────────────────────
INSERT INTO products (name, description, price, amount, category) VALUES
  ('Schoko-Brownies',         'Saftige Brownies mit dunkler Schokolade',          4.99,  50, 'Backen'),
  ('Pasta Carbonara',         'Klassische Carbonara mit Ei und Speck',             3.99,  30, 'Pasta'),
  ('Veganer Burger',          'Saftiger Burger mit schwarzen Bohnen',              5.99,  20, 'Vegan'),
  ('Tiramisu',                'Italienisches Tiramisu mit Mascarpone',             4.49,  15, 'Backen'),
  ('Grüner Smoothie',         'Spinat, Banane, Ingwer und Apfel',                 2.99, 100, 'Vegan'),
  ('Rindersteak Marinade',    'Würzige Marinade für perfektes Steak',             6.99,   0, 'Fleisch')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- WARENKORB
-- Abdeckung: INV-6
-- ─────────────────────────────────────────────────────────────
INSERT INTO carts (user_id) VALUES
  ((SELECT user_id FROM users WHERE email = 'max@test.de')),
  ((SELECT user_id FROM users WHERE email = 'anna@test.de'))
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO cart_items (cart_id, product_id, quantity) VALUES
  ((SELECT cart_id FROM carts WHERE user_id = (SELECT user_id FROM users WHERE email = 'max@test.de')),
   (SELECT product_id FROM products WHERE name = 'Schoko-Brownies'), 2),
  ((SELECT cart_id FROM carts WHERE user_id = (SELECT user_id FROM users WHERE email = 'max@test.de')),
   (SELECT product_id FROM products WHERE name = 'Pasta Carbonara'), 1),
  ((SELECT cart_id FROM carts WHERE user_id = (SELECT user_id FROM users WHERE email = 'anna@test.de')),
   (SELECT product_id FROM products WHERE name = 'Veganer Burger'), 1)
ON CONFLICT (cart_id, product_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- BESTELLUNGEN & POSITIONEN
-- Abdeckung: INV-7 (Kaufhistorie)
-- ─────────────────────────────────────────────────────────────
INSERT INTO orders (user_id, status) VALUES
  ((SELECT user_id FROM users WHERE email = 'max@test.de'),  'completed'),
  ((SELECT user_id FROM users WHERE email = 'anna@test.de'), 'completed');

INSERT INTO orderpositions (order_id, product_id, purchase_price, amount) VALUES
  ((SELECT order_id FROM orders WHERE user_id = (SELECT user_id FROM users WHERE email = 'max@test.de') LIMIT 1),
   (SELECT product_id FROM products WHERE name = 'Tiramisu'), 4.49, 2),
  ((SELECT order_id FROM orders WHERE user_id = (SELECT user_id FROM users WHERE email = 'max@test.de') LIMIT 1),
   (SELECT product_id FROM products WHERE name = 'Grüner Smoothie'), 2.99, 1),
  ((SELECT order_id FROM orders WHERE user_id = (SELECT user_id FROM users WHERE email = 'anna@test.de') LIMIT 1),
   (SELECT product_id FROM products WHERE name = 'Veganer Burger'), 5.99, 1);

-- ─────────────────────────────────────────────────────────────
-- WUNSCHLISTEN
-- Abdeckung: WUN-1/2/3/4
-- ─────────────────────────────────────────────────────────────
INSERT INTO wishlists (owner_user_id, name, description) VALUES
  ((SELECT user_id FROM users WHERE email = 'max@test.de'),
   'Lieblingsrezepte', 'Meine liebsten Rezepte zum Nachkochen'),
  ((SELECT user_id FROM users WHERE email = 'max@test.de'),
   'Weihnachtsbäckerei', 'Rezepte für die Weihnachtszeit'),
  ((SELECT user_id FROM users WHERE email = 'anna@test.de'),
   'Vegane Küche', 'Alles rund ums vegane Kochen')
ON CONFLICT DO NOTHING;

INSERT INTO wishlist_product (list_id, product_id) VALUES
  ((SELECT list_id FROM wishlists WHERE name = 'Lieblingsrezepte'),
   (SELECT product_id FROM products WHERE name = 'Schoko-Brownies')),
  ((SELECT list_id FROM wishlists WHERE name = 'Lieblingsrezepte'),
   (SELECT product_id FROM products WHERE name = 'Pasta Carbonara')),
  ((SELECT list_id FROM wishlists WHERE name = 'Lieblingsrezepte'),
   (SELECT product_id FROM products WHERE name = 'Tiramisu')),
  ((SELECT list_id FROM wishlists WHERE name = 'Weihnachtsbäckerei'),
   (SELECT product_id FROM products WHERE name = 'Schoko-Brownies')),
  ((SELECT list_id FROM wishlists WHERE name = 'Weihnachtsbäckerei'),
   (SELECT product_id FROM products WHERE name = 'Tiramisu')),
  ((SELECT list_id FROM wishlists WHERE name = 'Vegane Küche'),
   (SELECT product_id FROM products WHERE name = 'Veganer Burger')),
  ((SELECT list_id FROM wishlists WHERE name = 'Vegane Küche'),
   (SELECT product_id FROM products WHERE name = 'Grüner Smoothie'))
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- BERECHTIGUNGEN
-- Abdeckung: AUTO-1, WUN-4
-- ─────────────────────────────────────────────────────────────
INSERT INTO permissions (user_id, resource_type, resource_id, permission) VALUES
  -- anna darf Lieblingsrezepte von max lesen
  ((SELECT user_id FROM users WHERE email = 'anna@test.de'),
   'wishlist',
   (SELECT list_id FROM wishlists WHERE name = 'Lieblingsrezepte'),
   'read'),
  -- tom darf in Lieblingsrezepte von max schreiben
  ((SELECT user_id FROM users WHERE email = 'tom@test.de'),
   'wishlist',
   (SELECT list_id FROM wishlists WHERE name = 'Lieblingsrezepte'),
   'write')
ON CONFLICT (user_id, resource_type, resource_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- TOKEN-BLACKLIST (AUTH-4 / Logout)
-- ─────────────────────────────────────────────────────────────
-- Hier werden BEWUSST keine Dummy-Daten eingefügt.
-- Ein Eintrag wirkt nur, wenn ein echtes JWT mit derselben jti existiert — und JWTs
-- entstehen erst zur Laufzeit beim Login. Der Logout-Test läuft daher so:
--   1) POST /api/auth/login        → JWT erhalten
--   2) POST /api/auth/logout       → jti landet in token_blacklist
--   3) POST /api/auth/validate     → muss jetzt { valid: false } liefern
-- Vorgefertigte Fake-Einträge würden beim Testen nur verwirren.
