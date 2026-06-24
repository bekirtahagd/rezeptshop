const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { generateToken } = require('../utils/tokens');
const { sendVerificationMail } = require('../config/mailer');

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
      `SELECT token_id, user_id, used, expires_at
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
    if (new Date(row.expires_at) < new Date()) {
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

module.exports = router;
