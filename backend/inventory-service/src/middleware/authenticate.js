const { validateToken, ServiceUnavailableError } = require('../config/services');

// Schützt ALLE Endpunkte dieses Service (Prüfungs-Grundregel: "Anfragen ohne
// Authentifizierung müssen grundsätzlich abgelehnt werden").
//
// Anders als beim auth-service prüft dieser Service das JWT NICHT selbst (er kennt das
// JWT_SECRET nicht), sondern delegiert an den auth-service (POST /api/auth/validate).
// Bei Erfolg liegt die geprüfte Identität anschließend in req.user.
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Kein Token' });
  }

  let result;
  try {
    result = await validateToken(authHeader);
  } catch (err) {
    if (err instanceof ServiceUnavailableError) {
      console.error('auth-service nicht erreichbar:', err.message);
      return res.status(503).json({ error: 'Authentifizierungsdienst nicht erreichbar' });
    }
    console.error('Fehler bei der Token-Validierung:', err.message);
    return res.status(500).json({ error: 'Interner Fehler' });
  }

  if (!result.valid) {
    return res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }

  req.user = {
    userId: result.userId,
    role: result.role,
    email: result.email,
  };
  next();
}

module.exports = authenticate;
