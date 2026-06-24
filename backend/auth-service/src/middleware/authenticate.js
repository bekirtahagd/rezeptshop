const db = require('../config/db');
const { verifyToken } = require('../utils/jwt');

// Schützt Endpunkte, die ein gültiges JWT verlangen (z.B. /me, /logout).
// Liest das Token aus dem "Authorization: Bearer <jwt>"-Header, prüft Signatur/Ablauf
// und schaut nach, ob die jti in der token_blacklist steht (= ausgeloggt).
// Bei Erfolg liegt die Identität anschließend in req.user.
//
// Hinweis: Hier wird bewusst KEIN locked-Check gemacht — ein gesperrter User darf
// seinen eigenen Status (/me) noch sehen und sich abmelden (/logout). Das Sperren
// greift bei /login (403) und beim internen /validate (für andere Services).
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Kein Token' });
  }

  const token = authHeader.slice('Bearer '.length);

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }

  try {
    const blacklisted = await db.query('SELECT 1 FROM token_blacklist WHERE jti = $1', [payload.jti]);
    if (blacklisted.rows.length > 0) {
      return res.status(401).json({ error: 'Token abgemeldet' });
    }
  } catch (err) {
    console.error('DB-Fehler in authenticate:', err.message);
    return res.status(500).json({ error: 'Datenbankfehler' });
  }

  req.user = {
    userId: payload.userId,
    role: payload.role,
    email: payload.email,
    jti: payload.jti,
    exp: payload.exp,
  };
  next();
}

module.exports = authenticate;
