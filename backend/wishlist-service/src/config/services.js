// Kommunikation mit den anderen Microservices über HTTP (natives fetch, Node 20).
// Der wishlist-service prüft NIE selbst JWTs oder Berechtigungen — er fragt:
//   - auth-service          → "Ist dieses Token gültig? Wer ist der User?"
//   - authorization-service → "Darf dieser User diese Aktion ausführen?" (/check)
//   - authorization-service → "Vergib diese Berechtigung." (/grant, für WUN-4 Teilen)
//
// Service-URLs kommen aus der .env (lokal: localhost). In Docker überschreibt die
// docker-compose.yml sie fest mit den Container-Namen (http://auth-service:3001 usw.).

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const AUTHORIZATION_SERVICE_URL = process.env.AUTHORIZATION_SERVICE_URL || 'http://localhost:3002';

// Eigene Fehlerklasse, damit Route-Handler einen nicht erreichbaren Dienst sauber
// als 503 melden können (statt eines generischen 500).
class ServiceUnavailableError extends Error {
  constructor(service) {
    super(`${service} ist nicht erreichbar`);
    this.name = 'ServiceUnavailableError';
    this.service = service;
  }
}

// Schickt das Bearer-Token an den auth-service und gibt die geprüfte Identität zurück.
// Rückgabe: { valid, userId, role, email }  (bei valid:false fehlen die übrigen Felder)
async function validateToken(bearerToken) {
  let response;
  try {
    response = await fetch(`${AUTH_SERVICE_URL}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: bearerToken }),
    });
  } catch (err) {
    throw new ServiceUnavailableError('auth-service');
  }

  if (!response.ok) {
    // 400 (fehlendes token) o.ä. → als ungültig behandeln
    return { valid: false };
  }
  return response.json();
}

// Fragt den authorization-service, ob eine Aktion erlaubt ist.
// params: { userId, role, resourceType, resourceId, ownerId?, action }
// Rückgabe: true | false
async function checkPermission(params) {
  let response;
  try {
    response = await fetch(`${AUTHORIZATION_SERVICE_URL}/api/authorization/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (err) {
    throw new ServiceUnavailableError('authorization-service');
  }

  if (!response.ok) return false;
  const data = await response.json();
  return data.allowed === true;
}

// Vergibt eine Custom-Permission über den authorization-service (WUN-4 Teilen).
// params: { requesterId, requesterRole, targetUserId, resourceId, resourceType, ownerId, permission }
// Rückgabe: { ok, status } — der Aufrufer entscheidet, wie er status-Codes weiterreicht.
async function grantPermission(params) {
  let response;
  try {
    response = await fetch(`${AUTHORIZATION_SERVICE_URL}/api/authorization/grant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (err) {
    throw new ServiceUnavailableError('authorization-service');
  }

  return { ok: response.ok, status: response.status };
}

module.exports = { validateToken, checkPermission, grantPermission, ServiceUnavailableError };
