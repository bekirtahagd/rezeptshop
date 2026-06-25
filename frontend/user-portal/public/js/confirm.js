// confirm.js — Landingpage für den Bestätigungslink aus der Registrierungs-Mail.
// Liest den Token aus ?token=, ruft GET /api/auth/confirm/:token auf und zeigt das Ergebnis.
// Confirm stellt kein JWT aus -> danach zur Anmeldung. Pre-auth: kein requireLogin.

const status = document.getElementById('confirm-status');

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
    await apiFetch(SERVICES.auth + '/api/auth/confirm/' + token, { auth: false });
    setStatus(
      '<div class="msg ok">Deine E-Mail-Adresse wurde bestätigt. Du kannst dich jetzt anmelden.</div>' +
        '<p><a class="btn" href="login.html">Zur Anmeldung</a></p>'
    );
  } catch (err) {
    // 404 unbekannt / 400 abgelaufen oder bereits benutzt
    setStatus(
      `<div class="msg error">${err.message}</div>` +
        '<p><a href="login.html">Zur Anmeldung</a></p>'
    );
  }
}

run();
