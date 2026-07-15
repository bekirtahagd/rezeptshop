// login.js — Steuert die drei Tabs (Login / Registrieren / Magic-Link) auf login.html.

// Wer schon eingeloggt ist, braucht hier nichts -> direkt in den Shop.
if (getToken()) {
  window.location.href = 'index.html';
}

renderNav();

// kleine Helfer zum Anzeigen von Meldungen
function showMsg(id, text, type = 'error') {
  document.getElementById(id).innerHTML = `<div class="msg ${type}">${text}</div>`;
}
function clearMsg(id) {
  document.getElementById(id).innerHTML = '';
}

// Wurde man wegen abgelaufener/ungültiger Session hierher geleitet? Freundlich erklären.
if (new URLSearchParams(location.search).get('session') === 'expired') {
  showMsg('login-msg', 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.', 'info');
}

// ---------- Tab-Umschaltung ----------
const tabButtons = document.querySelectorAll('.tabs button');
const sections = {
  login: document.getElementById('tab-login'),
  register: document.getElementById('tab-register'),
  magic: document.getElementById('tab-magic'),
};

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    Object.values(sections).forEach((s) => s.classList.add('hidden'));
    sections[btn.dataset.tab].classList.remove('hidden');
  });
});

// ---------- Login ----------
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('login-msg');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const data = await apiFetch(SERVICES.auth + '/api/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    });
    setToken(data.token);
    window.location.href = 'index.html';
  } catch (err) {
    showMsg('login-msg', err.message);
  }
});

// ---------- Registrierung ----------
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('register-msg');
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  try {
    await apiFetch(SERVICES.auth + '/api/auth/register', {
      method: 'POST',
      auth: false,
      body: { email, password },
    });
    showMsg(
      'register-msg',
      'Registriert! Du kannst dich jetzt oben einloggen.',
      'ok'
    );
    document.getElementById('register-form').reset();
  } catch (err) {
    showMsg('register-msg', err.message);
  }
});

// ---------- Magic-Link: Code anfordern ----------
document.getElementById('magic-request-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('magic-msg');
  const email = document.getElementById('magic-email').value.trim();

  try {
    await apiFetch(SERVICES.auth + '/api/auth/magic-link', {
      method: 'POST',
      auth: false,
      body: { email },
    });
    // Anti-Enumeration: Backend antwortet immer gleich.
    showMsg(
      'magic-msg',
      'Falls die E-Mail registriert ist, wurde ein Einmal-Code gesendet. ' +
        'Gib ihn unten ein.',
      'info'
    );
  } catch (err) {
    showMsg('magic-msg', err.message);
  }
});

// ---------- Magic-Link: mit Code einloggen ----------
document.getElementById('magic-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('magic-msg');
  const email = document.getElementById('magic-email').value.trim();
  const code = document.getElementById('magic-code').value.trim();

  if (!email) {
    showMsg('magic-msg', 'Bitte zuerst oben deine E-Mail eintragen.');
    return;
  }
  if (!code) {
    showMsg('magic-msg', 'Bitte den Code aus der Mail eintragen.');
    return;
  }

  try {
    const data = await apiFetch(SERVICES.auth + '/api/auth/magic-login', {
      method: 'POST',
      auth: false,
      body: { email, code },
    });
    setToken(data.token);
    window.location.href = 'index.html';
  } catch (err) {
    showMsg('magic-msg', err.message);
  }
});
