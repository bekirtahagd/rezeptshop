// login.js (admin-portal) — Login + Rollen-Check: nur Admins kommen rein.

// Schon als Admin eingeloggt? -> direkt ins Dashboard.
if (getToken()) {
  currentUser().then((u) => {
    if (u && u.role === 'admin') window.location.href = 'index.html';
  });
}

function showMsg(text, type = 'error') {
  document.getElementById('login-msg').innerHTML = `<div class="msg ${type}">${text}</div>`;
}

// Wurde ein Nicht-Admin abgewiesen (von requireAdmin umgeleitet)?
if (new URLSearchParams(location.search).get('denied') === '1') {
  showMsg('Dieses Portal ist nur für Administratoren.', 'error');
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  document.getElementById('login-msg').innerHTML = '';
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const data = await apiFetch(SERVICES.auth + '/api/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    });
    setToken(data.token);

    // Rolle prüfen: Nur Admins dürfen ins Admin-Portal.
    _cachedUser = null;
    const user = await currentUser();
    if (!user || user.role !== 'admin') {
      clearToken();
      showMsg('Dieses Konto ist kein Administrator.', 'error');
      return;
    }
    window.location.href = 'index.html';
  } catch (err) {
    showMsg(err.message);
  }
});
