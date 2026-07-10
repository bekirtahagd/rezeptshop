-- DUMMY-DATEN — nur für Entwicklung
-- Wird automatisch geladen via: docker compose --profile dev up
--
-- Test-Accounts (alle haben dasselbe Passwort):
--   Passwort:     Test1234!
--   bcrypt-Hash:  $2b$10$wCR7a4oo.HlAjqTwNrqWue6aBZfETcmXKz6qU1SxpwHvcH8tnrYqO
--
-- Hinweis: Dieser Hash wurde mit bcryptjs (wie im auth-service) für "Test1234!" erzeugt.
-- Neuen Hash generieren (aus backend/auth-service/):
--   node -e "console.log(require('bcryptjs').hashSync('Test1234!',10))"

-- ─────────────────────────────────────────────────────────────
-- IDEMPOTENZ — db-seed ist ein Dev-RESET
-- ─────────────────────────────────────────────────────────────
-- Vor dem Befüllen ALLE App-Tabellen leeren und die Serial-IDs zurücksetzen.
-- Grund: db-seed läuft bei jedem `docker compose --profile dev up` erneut. Ohne diesen
-- Reset fügen die nicht-eindeutigen INSERTs (products/orders/wishlists) bei jedem Lauf neue
-- Kopien ein → doppelte Produkte usw. Mit TRUNCATE ist der Stand nach jedem Lauf identisch.
--
-- ACHTUNG: Das löscht auch zur Laufzeit selbst angelegte Accounts/Daten (z. B. via
-- Registrierung im Frontend). Genau das ist gewollt — db-seed setzt den Dev-Stand zurück.
TRUNCATE TABLE
  token_blacklist,
  permissions,
  wishlist_product,
  wishlists,
  orderpositions,
  orders,
  cart_items,
  carts,
  verification_tokens,
  products,
  users
RESTART IDENTITY CASCADE;

-- ─────────────────────────────────────────────────────────────
-- USERS
-- Abdeckung: AUTH-1/3, USER-1/2/3/4
-- ─────────────────────────────────────────────────────────────
INSERT INTO users (email, password, role, locked, email_verified) VALUES
  ('admin@test.de',      '$2b$10$wCR7a4oo.HlAjqTwNrqWue6aBZfETcmXKz6qU1SxpwHvcH8tnrYqO', 'admin', false, true),
  ('max@test.de',        '$2b$10$wCR7a4oo.HlAjqTwNrqWue6aBZfETcmXKz6qU1SxpwHvcH8tnrYqO', 'user',  false, true),
  ('anna@test.de',       '$2b$10$wCR7a4oo.HlAjqTwNrqWue6aBZfETcmXKz6qU1SxpwHvcH8tnrYqO', 'user',  false, true),
  ('tom@test.de',        '$2b$10$wCR7a4oo.HlAjqTwNrqWue6aBZfETcmXKz6qU1SxpwHvcH8tnrYqO', 'user',  false, false),
  ('gesperrt@test.de',   '$2b$10$wCR7a4oo.HlAjqTwNrqWue6aBZfETcmXKz6qU1SxpwHvcH8tnrYqO', 'user',  true,  true),
  -- Dedizierte Accounts für Auth-Tests (AUTH-2 / AUTH-5), damit max/anna/tom sauber bleiben:
  ('verify@test.de',     '$2b$10$wCR7a4oo.HlAjqTwNrqWue6aBZfETcmXKz6qU1SxpwHvcH8tnrYqO', 'user',  false, false),  -- unverifiziert, für Bestätigungs-Flow
  ('magic@test.de',      '$2b$10$wCR7a4oo.HlAjqTwNrqWue6aBZfETcmXKz6qU1SxpwHvcH8tnrYqO', 'user',  false, true)    -- verifiziert, für Magic-Link-Flow
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
-- image_url = Dateiname im Ordner assets/product-images (per Bind-Mount), den der
-- image-assets-nginx unter http://localhost:8082/<datei> ausliefert. Die seed-*.svg
-- sind mitversioniert, daher haben die Dummy-Produkte von Anfang an gültige Bilder.
-- recipe (Zubereitung) + ingredients (Zutaten) sind das "gekaufte" Rezept: nur per Kauf-Mail.
-- allergens ist Freitext und darf öffentlich auf der Detailseite stehen.
INSERT INTO products (name, description, price, amount, category, image_url, ingredients, recipe, allergens, prep_time_minutes, servings) VALUES
  ('Schoko-Brownies',         'Saftige Brownies mit dunkler Schokolade',          4.99,  50, 'Backen',  'brownies.png',
    E'200 g dunkle Schokolade\n150 g Butter\n200 g Zucker\n3 Eier\n100 g Mehl\n1 Prise Salz',
    E'1. Backofen auf 180 °C vorheizen und eine Form einfetten.\n2. Schokolade und Butter über dem Wasserbad schmelzen.\n3. Zucker und Eier schaumig rühren, geschmolzene Schokolade unterrühren.\n4. Mehl und Salz unterheben.\n5. Teig in die Form geben und 25 Minuten backen.\n6. Vollständig abkühlen lassen und in Stücke schneiden.',
    'Gluten, Eier, Milch', 40, 12),
  ('Pasta Carbonara',         'Klassische Carbonara mit Ei und Speck',             3.99,  30, 'Pasta',   'carbonara.png',
    E'400 g Spaghetti\n150 g Guanciale oder Speck\n4 Eigelb\n100 g Pecorino\nSchwarzer Pfeffer\nSalz',
    E'1. Spaghetti in Salzwasser al dente kochen.\n2. Speck in einer Pfanne knusprig auslassen.\n3. Eigelb mit geriebenem Pecorino und Pfeffer verrühren.\n4. Nudeln abgießen (etwas Nudelwasser aufheben) und zum Speck geben.\n5. Pfanne vom Herd nehmen, Ei-Käse-Masse unterrühren, bei Bedarf Nudelwasser zugeben.\n6. Sofort servieren.',
    'Gluten, Eier, Milch', 25, 4),
  ('Veganer Burger',          'Saftiger Burger mit schwarzen Bohnen',              5.99,  20, 'Vegan',   'burger.png',
    E'250 g schwarze Bohnen\n1 Zwiebel\n50 g Haferflocken\n1 EL Tomatenmark\nGewürze nach Wahl\n4 Burger-Buns',
    E'1. Bohnen abtropfen lassen und grob zerdrücken.\n2. Zwiebel fein hacken und mit Haferflocken, Tomatenmark und Gewürzen untermengen.\n3. Aus der Masse 4 Patties formen.\n4. In einer Pfanne mit etwas Öl pro Seite 4 Minuten braten.\n5. Buns aufschneiden, nach Wunsch belegen und servieren.',
    'Gluten', 30, 4),
  ('Tiramisu',                'Italienisches Tiramisu mit Mascarpone',             4.49,  15, 'Backen',  'tiramisu.png',
    E'500 g Mascarpone\n3 Eier\n100 g Zucker\n200 g Löffelbiskuits\n300 ml starker Espresso\nKakaopulver',
    E'1. Eigelb mit Zucker cremig rühren, Mascarpone unterrühren.\n2. Eiweiß steif schlagen und unterheben.\n3. Löffelbiskuits kurz in Espresso tunken und in eine Form legen.\n4. Die Hälfte der Creme daraufstreichen, Vorgang wiederholen.\n5. Mindestens 4 Stunden kühlen.\n6. Vor dem Servieren mit Kakao bestäuben.',
    'Gluten, Eier, Milch', 30, 8),
  ('Grüner Smoothie',         'Spinat, Banane, Ingwer und Apfel',                 2.99, 100, 'Vegan',   'smoothie.png',
    E'2 Handvoll Spinat\n1 Banane\n1 Apfel\n1 Stück Ingwer\n200 ml Wasser',
    E'1. Spinat waschen, Apfel entkernen und grob würfeln.\n2. Alle Zutaten in einen Mixer geben.\n3. Mit dem Wasser fein pürieren.\n4. In ein Glas füllen und sofort genießen.',
    'Keine bekannten Allergene', 5, 2),
  ('Rindersteak Marinade',    'Würzige Marinade für perfektes Steak',             6.99,   0, 'Fleisch', 'steak.png',
    E'4 EL Sojasauce\n2 EL Olivenöl\n2 Knoblauchzehen\n1 TL Senf\nPfeffer\nRosmarin',
    E'1. Knoblauch fein hacken.\n2. Alle Zutaten in einer Schüssel verrühren.\n3. Das Steak rundum mit der Marinade einreiben.\n4. Mindestens 2 Stunden im Kühlschrank ziehen lassen.\n5. Anschließend scharf anbraten.',
    'Soja, Senf', 15, 4)
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
