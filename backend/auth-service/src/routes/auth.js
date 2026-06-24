const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { generateToken } = require('../utils/tokens');
const { signToken, verifyToken } = require('../utils/jwt');
const authenticate = require('../middleware/authenticate');
const { sendVerificationMail, sendMagicLinkMail } = require('../config/mailer');

// Einfache E-Mail-Format-Prüfung (kein RFC-Vollcheck — reicht fürs Frontend-Feedback).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register  (AUTH-1)
// Legt einen neuen User an (email_verified = false) und verschickt die Bestätigungsmail.
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  // 1. Pflichtfelder & Format prüfen
  if (!email || !password) {
    return res.status(400).json({ error: 'email und password sind erforderlich' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Ungültiges E-Mail-Format' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' });
  }

  const client = await db.connect();
  try {
    // 2. E-Mail schon vergeben?
    const existing = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'E-Mail bereits registriert' });
    }

    // 3. Passwort hashen (nie im Klartext speichern)
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. User + Bestätigungs-Token atomar anlegen
    const token = generateToken();
    await client.query('BEGIN');
    const userResult = await client.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING user_id',
      [email, passwordHash]
    );
    const userId = userResult.rows[0].user_id;
    await client.query(
      `INSERT INTO verification_tokens (token, user_id, type, expires_at)
       VALUES ($1, $2, 'email_verification', NOW() + INTERVAL '24 hours')`,
      [token, userId]
    );
    await client.query('COMMIT');

    // 5. Bestätigungsmail senden (nach erfolgreichem Commit)
    await sendVerificationMail(email, token);

    return res.status(201).json({ message: 'Registriert. Bitte E-Mail bestätigen.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Fehler bei /register:', err.message);
    return res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  } finally {
    client.release();
  }
});

// GET /api/auth/confirm/:token  (AUTH-2)
// Bestätigt die E-Mail-Adresse, wenn der Token gültig, unbenutzt und nicht abgelaufen ist.
router.get('/confirm/:token', async (req, res) => {
  const { token } = req.params;

  const client = await db.connect();
  try {
    const result = await client.query(
      `SELECT token_id, user_id, used,
              (expires_at < NOW()) AS is_expired
       FROM verification_tokens
       WHERE token = $1 AND type = 'email_verification'`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Token nicht gefunden' });
    }

    const row = result.rows[0];
    if (row.used) {
      return res.status(400).json({ error: 'Token bereits verwendet' });
    }
    // Ablauf in SQL geprüft (is_expired) — ein JS-Vergleich würde eine zeitzonenlose
    // TIMESTAMP-Spalte als lokale Node-Zeit fehlinterpretieren (UTC-DB vs. Berlin-Node).
    if (row.is_expired) {
      return res.status(400).json({ error: 'Token abgelaufen' });
    }

    // E-Mail bestätigen und Token verbrauchen — atomar
    await client.query('BEGIN');
    await client.query('UPDATE users SET email_verified = true WHERE user_id = $1', [row.user_id]);
    await client.query('UPDATE verification_tokens SET used = true WHERE token_id = $1', [row.token_id]);
    await client.query('COMMIT');

    return res.status(200).json({ message: 'E-Mail bestätigt' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Fehler bei /confirm:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  } finally {
    client.release();
  }
});

// POST /api/auth/login  (AUTH-3)
// Prüft die Zugangsdaten und stellt bei Erfolg ein JWT (24h) aus.
// Login ist auch bei email_verified = false erlaubt (Konzept-Entscheidung) —
// nur sensible Aktionen (Käufe) verlangen später eine bestätigte E-Mail.
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email und password sind erforderlich' });
  }

  try {
    const result = await db.query(
      'SELECT user_id, password, role, locked FROM users WHERE email = $1',
      [email]
    );

    // Einheitliche Fehlermeldung für "User unbekannt" UND "Passwort falsch",
    // damit nicht verraten wird, welche E-Mails registriert sind (keine Enumeration).
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
    }

    const user = result.rows[0];
    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
    }

    // Gesperrte User dürfen sich nicht anmelden.
    if (user.locked) {
      return res.status(403).json({ error: 'Konto gesperrt' });
    }

    const token = signToken({ userId: user.user_id, role: user.role, email });
    return res.status(200).json({ token });
  } catch (err) {
    console.error('Fehler bei /login:', err.message);
    return res.status(500).json({ error: 'Anmeldung fehlgeschlagen' });
  }
});

// GET /api/auth/me  (AUTH-2 Statusabfrage)
// Gibt die Identität + den aktuellen Verifizierungsstatus des eingeloggten Users zurück.
// email_verified kommt FRISCH aus der DB (nicht aus den JWT-Claims), weil der User
// seine E-Mail nach dem Login bestätigt haben kann — der Token-Claim wäre dann veraltet.
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT email, role, email_verified FROM users WHERE user_id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User nicht gefunden' });
    }

    const user = result.rows[0];
    return res.status(200).json({
      userId: req.user.userId,
      email: user.email,
      role: user.role,
      email_verified: user.email_verified,
    });
  } catch (err) {
    console.error('Fehler bei /me:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/auth/logout  (AUTH-4)
// Macht das aktuelle JWT vorzeitig ungültig ("echtes" Logout): die jti des Tokens
// wird in die token_blacklist geschrieben. Ab dann lehnen /validate und die
// authenticate-Middleware dieses Token ab. expires_at = Ablaufzeit des Tokens.
router.post('/logout', authenticate, async (req, res) => {
  try {
    await db.query(
      `INSERT INTO token_blacklist (jti, expires_at)
       VALUES ($1, to_timestamp($2))
       ON CONFLICT (jti) DO NOTHING`,
      [req.user.jti, req.user.exp]
    );
    return res.status(200).json({ message: 'Abgemeldet' });
  } catch (err) {
    console.error('Fehler bei /logout:', err.message);
    return res.status(500).json({ error: 'Abmeldung fehlgeschlagen' });
  }
});

// POST /api/auth/magic-link  (AUTH-5)
// Fordert einen Einmal-Login an. Identische Antwort egal ob E-Mail existiert,
// damit keine registrierten Adressen verraten werden (keine Enumeration).
router.post('/magic-link', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'email ist erforderlich' });
  }

  try {
    const result = await db.query('SELECT user_id FROM users WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      const userId = result.rows[0].user_id;
      const token = generateToken();
      await db.query(
        `INSERT INTO verification_tokens (token, user_id, type, expires_at)
         VALUES ($1, $2, 'magic_link', NOW() + INTERVAL '15 minutes')`,
        [token, userId]
      );
      await sendMagicLinkMail(email, token);
    }

    return res.status(200).json({ message: 'Falls die E-Mail registriert ist, wurde ein Einmal-Link gesendet' });
  } catch (err) {
    console.error('Fehler bei /magic-link:', err.message);
    return res.status(500).json({ error: 'Anfrage fehlgeschlagen' });
  }
});

// GET /api/auth/magic-login/:token  (AUTH-5 — Link-Variante)
// Öffnen des Links aus der Mail → Token prüfen → einmalig verbrauchen → JWT ausstellen.
router.get('/magic-login/:token', async (req, res) => {
  const { token } = req.params;

  const client = await db.connect();
  try {
    const result = await client.query(
      `SELECT vt.token_id, vt.user_id, vt.used,
              (vt.expires_at < NOW()) AS is_expired,
              u.email, u.role, u.locked
       FROM verification_tokens vt
       JOIN users u ON u.user_id = vt.user_id
       WHERE vt.token = $1 AND vt.type = 'magic_link'`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Token nicht gefunden' });
    }

    const row = result.rows[0];
    if (row.used) {
      return res.status(400).json({ error: 'Token bereits verwendet' });
    }
    // Ablauf in SQL geprüft (is_expired) — ein JS-Vergleich würde eine zeitzonenlose
    // TIMESTAMP-Spalte als lokale Node-Zeit fehlinterpretieren (UTC-DB vs. Berlin-Node).
    if (row.is_expired) {
      return res.status(400).json({ error: 'Token abgelaufen' });
    }
    if (row.locked) {
      return res.status(403).json({ error: 'Konto gesperrt' });
    }

    // Token einmalig verbrauchen und JWT ausstellen — atomar
    await client.query('BEGIN');
    await client.query('UPDATE verification_tokens SET used = true WHERE token_id = $1', [row.token_id]);
    await client.query('COMMIT');

    const jwt = signToken({ userId: row.user_id, role: row.role, email: row.email });
    return res.status(200).json({ token: jwt });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Fehler bei GET /magic-login:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  } finally {
    client.release();
  }
});

// POST /api/auth/magic-login  (AUTH-5 — Code-Variante)
// Manuelles Eingeben des Tokens als Code — gleiche Prüfung und JWT-Ausstellung wie beim Link.
// email ist zusätzlich erforderlich, damit ein gestohlener Code allein nicht reicht.
router.post('/magic-login', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'email und code sind erforderlich' });
  }

  const client = await db.connect();
  try {
    const result = await client.query(
      `SELECT vt.token_id, vt.user_id, vt.used,
              (vt.expires_at < NOW()) AS is_expired,
              u.email, u.role, u.locked
       FROM verification_tokens vt
       JOIN users u ON u.user_id = vt.user_id
       WHERE vt.token = $1 AND vt.type = 'magic_link' AND u.email = $2`,
      [code, email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Code ungültig' });
    }

    const row = result.rows[0];
    if (row.used) {
      return res.status(400).json({ error: 'Code bereits verwendet' });
    }
    // Ablauf in SQL geprüft (is_expired) — siehe Begründung bei GET /magic-login.
    if (row.is_expired) {
      return res.status(400).json({ error: 'Code abgelaufen' });
    }
    if (row.locked) {
      return res.status(403).json({ error: 'Konto gesperrt' });
    }

    // Code einmalig verbrauchen und JWT ausstellen — atomar
    await client.query('BEGIN');
    await client.query('UPDATE verification_tokens SET used = true WHERE token_id = $1', [row.token_id]);
    await client.query('COMMIT');

    const jwt = signToken({ userId: row.user_id, role: row.role, email: row.email });
    return res.status(200).json({ token: jwt });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Fehler bei POST /magic-login:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  } finally {
    client.release();
  }
});

// POST /api/auth/validate  (intern — NICHT fürs Frontend)
// Andere Services schicken das vom Client erhaltene JWT hierher und bekommen die
// geprüfte Identität zurück. Geprüft wird: Signatur/Ablauf, Blacklist (ausgeloggt?)
// und live in der DB, ob der User noch existiert und nicht gesperrt ist (locked).
// So wirkt ein Sperren (USER-4) sofort, nicht erst nach Token-Ablauf.
router.post('/validate', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'token ist erforderlich' });
  }

  // Akzeptiert sowohl "Bearer <jwt>" als auch den rohen Token.
  const rawToken = token.startsWith('Bearer ') ? token.slice('Bearer '.length) : token;

  let payload;
  try {
    payload = verifyToken(rawToken);
  } catch (err) {
    return res.status(200).json({ valid: false });
  }

  try {
    const blacklisted = await db.query('SELECT 1 FROM token_blacklist WHERE jti = $1', [payload.jti]);
    if (blacklisted.rows.length > 0) {
      return res.status(200).json({ valid: false });
    }

    const result = await db.query(
      'SELECT role, locked FROM users WHERE user_id = $1',
      [payload.userId]
    );
    if (result.rows.length === 0 || result.rows[0].locked) {
      return res.status(200).json({ valid: false });
    }

    return res.status(200).json({
      valid: true,
      userId: payload.userId,
      role: result.rows[0].role, // aus DB, falls sich die Rolle seit Token-Ausstellung geändert hat
      email: payload.email,
    });
  } catch (err) {
    console.error('Fehler bei /validate:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
