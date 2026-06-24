const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT-Laufzeit: 24 Stunden. So lange bleibt ein User "angemeldet" (AUTH-4),
// ohne dass der Server eine klassische Session im Speicher halten muss.
const TOKEN_TTL = '24h';

// Stellt ein signiertes JWT aus.
// Payload-Claims: { userId, role, email }. Zusätzlich bekommt jedes Token eine
// zufällige jti (Token-ID) — über die jti wird beim Logout (AUTH-4) ein einzelnes
// Token in der token_blacklist gesperrt. JWT_SECRET kommt aus der zentralen .env.
function signToken({ userId, role, email }) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ userId, role, email }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
    jwtid: jti,
  });
  return token;
}

// Prüft Signatur & Ablauf eines Tokens. Wirft bei ungültigem/abgelaufenem Token
// (JsonWebTokenError / TokenExpiredError) — der Aufrufer fängt das ab.
// Rückgabe: das decodierte Payload (enthält userId, role, email, jti, iat, exp).
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
