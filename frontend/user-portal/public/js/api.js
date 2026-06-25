// api.js — zentrale Service-URLs + ein kleiner fetch-Wrapper.
// Wird von allen Seiten geladen (vor der jeweiligen Seiten-JS).

// Die Backends laufen auf dem Host (Docker mappt die Ports nach localhost).
// CORS ist in allen Services für localhost:8080/8081 freigeschaltet.
const SERVICES = {
  auth: 'http://localhost:3001',
  inventory: 'http://localhost:3003',
  wishlist: 'http://localhost:3004',
  user: 'http://localhost:3005',
};

// Preise/Mengen kommen vom Backend als NUMERIC-STRING ("12.50") -> hier sauber formatieren.
function formatPrice(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '–';
  return n.toFixed(2).replace('.', ',') + ' €';
}

// Zentraler fetch-Wrapper:
//  - hängt automatisch den Bearer-Token an (sofern vorhanden und auth !== false)
//  - schickt/parst JSON
//  - wirft bei Fehlerstatus einen Error mit der Backend-Meldung (res.body.error)
//  - fängt "Server nicht erreichbar" ab (Backend down / falscher Port)
async function apiFetch(url, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getToken(); // aus auth.js
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error('Server nicht erreichbar. Läuft das Backend?');
  }

  // 204 / leerer Body -> kein JSON-Parsing
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = (data && data.error) || `Fehler ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
