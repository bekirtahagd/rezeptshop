// api.js — zentrale Service-URLs + ein kleiner fetch-Wrapper.
// Wird von allen Seiten geladen (vor der jeweiligen Seiten-JS).

// Die Backends laufen auf dem Host (Docker mappt die Ports nach localhost).
// CORS ist in allen Services für localhost:8080/8081 freigeschaltet.
const SERVICES = {
  auth: 'http://localhost:3001',
  inventory: 'http://localhost:3003',
  wishlist: 'http://localhost:3004',
  user: 'http://localhost:3005',
  // nginx-Container `image-assets` — liefert die hochgeladenen Produktbilder aus.
  // Vollständige Bild-URL = images + '/' + product.image_url.
  images: 'http://localhost:8082',
};

// Preise/Mengen kommen vom Backend als NUMERIC-STRING ("12.50") -> hier sauber formatieren.
function formatPrice(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '–';
  return n.toFixed(2).replace('.', ',') + ' €';
}

// Kurz eingeblendete Benachrichtigung unten rechts — immer sichtbar, egal wie weit
// die Seite gescrollt ist. Verschwindet nach `duration` ms von selbst.
// type: 'ok' | 'error' | 'info'
function showToast(text, type = 'info', duration = 3200) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = text; // textContent -> kein HTML-Injection-Risiko
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Zentraler fetch-Wrapper:
//  - hängt automatisch den Bearer-Token an (sofern vorhanden und auth !== false)
//  - schickt/parst JSON
//  - wirft bei Fehlerstatus einen Error mit der Backend-Meldung (res.body.error)
//  - fängt "Server nicht erreichbar" ab (Backend down / falscher Port)
async function apiFetch(url, { method = 'GET', body, auth = true } = {}) {
  // FormData (z. B. Datei-Upload) NICHT als JSON behandeln: kein Content-Type setzen
  // (der Browser setzt multipart/form-data inkl. Boundary selbst) und nicht stringify-en.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const headers = {};
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  let tokenSent = false;
  if (auth) {
    const token = getToken(); // aus auth.js
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
      tokenSent = true;
    }
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : (isFormData ? body : JSON.stringify(body)),
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
    // Abgelaufene/ungültige Session: Wir haben einen Token mitgeschickt, der Server lehnt
    // ihn aber ab (401). Dann sauber ausloggen und zum Login schicken — statt dem User eine
    // technische Fehlermeldung auf einer halb geladenen Seite zu zeigen.
    // (401 ohne Token, z. B. falsches Passwort beim Login, bleibt beim Aufrufer.)
    if (res.status === 401 && tokenSent) {
      clearToken();
      if (!location.pathname.endsWith('login.html')) {
        location.href = 'login.html?session=expired';
        // Promise hängen lassen, die Seite wird ohnehin neu geladen.
        return new Promise(() => {});
      }
    }
    const message = (data && data.error) || `Fehler ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
