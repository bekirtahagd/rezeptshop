// auth.js (admin-portal) — Token-Verwaltung + Admin-Schutz.
// Wie im user-portal, plus requireAdmin(): nur role === 'admin' darf rein.

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

let _cachedUser = null;
async function currentUser() {
  if (_cachedUser) return _cachedUser;
  if (!getToken()) return null;
  try {
    _cachedUser = await apiFetch(SERVICES.auth + '/api/auth/me');
    return _cachedUser;
  } catch (err) {
    if (err.status === 401) clearToken();
    return null;
  }
}

// Schützt eine Admin-Seite: ohne Token ODER ohne Admin-Rolle -> zurück zum Login.
// Async, weil die Rolle frisch über /me geprüft wird. Gibt true zurück, wenn Admin.
async function requireAdmin() {
  if (!getToken()) {
    window.location.href = 'login.html';
    return false;
  }
  const user = await currentUser();
  if (!user) {
    window.location.href = 'login.html';
    return false;
  }
  if (user.role !== 'admin') {
    // Eingeloggt, aber kein Admin -> abmelden und mit Hinweis zum Login.
    clearToken();
    window.location.href = 'login.html?denied=1';
    return false;
  }
  return true;
}

async function logout() {
  try {
    await apiFetch(SERVICES.auth + '/api/auth/logout', { method: 'POST' });
  } catch {
    // lokal trotzdem abmelden
  }
  clearToken();
  _cachedUser = null;
  window.location.href = 'login.html';
}

// Baut die rechte Nav-Seite (nur sinnvoll auf geschützten Admin-Seiten).
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
    `<span class="nav-user">${user.email} (#${user.userId})</span>` +
    '<button type="button" class="linklike" id="nav-logout">Logout</button>';
  document.getElementById('nav-logout').addEventListener('click', logout);
}
