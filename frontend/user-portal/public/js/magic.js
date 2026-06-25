// magic.js — Landingpage für den Magic-Link aus der E-Mail.
// Liest den Token aus ?token=, tauscht ihn gegen ein JWT (GET /api/auth/magic-login/:token),
// speichert es und leitet in den Shop weiter. Pre-auth: kein requireLogin.

const status = document.getElementById('magic-status');

function setStatus(html) {
  status.innerHTML = html;
}

async function run() {
  const token = new URLSearchParams(location.search).get('token');
  if (!token) {
    setStatus(
      '<div class="msg error">Kein Token in der URL gefunden.</div>' +
        '<p><a href="login.html">Zur Anmeldung</a></p>'
    );
    return;
  }

  try {
    const data = await apiFetch(SERVICES.auth + '/api/auth/magic-login/' + token, {
      auth: false,
    });
    setToken(data.token);
    setStatus('<div class="msg ok">Erfolgreich angemeldet! Du wirst weitergeleitet …</div>');
    window.location.href = 'index.html';
  } catch (err) {
    // 404 unbekannt / 400 abgelaufen/benutzt / 403 gesperrt
    setStatus(
      `<div class="msg error">${err.message}</div>` +
        '<p>Bitte fordere einen neuen Link an.</p>' +
        '<p><a href="login.html">Zur Anmeldung</a></p>'
    );
  }
}

run();
