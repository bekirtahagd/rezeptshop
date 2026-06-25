// auth.js — Token-Verwaltung (localStorage), Session-Helfer und Nav-Status.
// Wird nach api.js geladen.

const TOKEN_KEY = 'token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Holt das eigene Profil vom auth-service. Cached das Ergebnis pro Seitenaufruf,
// damit nicht jede Funktion erneut /me aufruft.
let _cachedUser = null;
async function currentUser() {
  if (_cachedUser) return _cachedUser;
  if (!getToken()) return null;
  try {
    _cachedUser = await apiFetch(SERVICES.auth + '/api/auth/me');
    return _cachedUser;
  } catch (err) {
    // Token ungültig/abgelaufen -> aufräumen
    if (err.status === 401) clearToken();
    return null;
  }
}

// Schützt eine Seite: ohne Token zurück zum Login.
function requireLogin() {
  if (!getToken()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Logout: Token serverseitig invalidieren (Blacklist), lokal löschen, zum Login.
async function logout() {
  try {
    await apiFetch(SERVICES.auth + '/api/auth/logout', { method: 'POST' });
  } catch {
    // Auch wenn der Server-Call fehlschlägt: lokal abmelden.
  }
  clearToken();
  _cachedUser = null;
  window.location.href = 'login.html';
}

// Baut die rechte Nav-Seite je nach Login-Status.
// Erwartet ein Element mit id="nav-session" im Header.
async function renderNav() {
  const slot = document.getElementById('nav-session');
  if (!slot) return;

  if (!getToken()) {
    slot.innerHTML = '<a href="login.html">Login</a>';
    return;
  }

  const user = await currentUser();
  if (!user) {
    slot.innerHTML = '<a href="login.html">Login</a>';
    return;
  }

  slot.innerHTML =
    `<span class="nav-user">${user.email}</span>` +
    '<button type="button" class="linklike" id="nav-logout">Logout</button>';
  document.getElementById('nav-logout').addEventListener('click', logout);
}
