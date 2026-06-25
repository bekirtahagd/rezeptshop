// benutzer.js — Benutzerverwaltung (USER-1–4): nachschlagen, sperren/entsperren,
// löschen, Admin anlegen. Suche per ID (user-service hat keine Listen-Route).

const result = document.getElementById('user-result');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showMsg(elId, text, type = 'info') {
  document.getElementById(elId).innerHTML = `<div class="msg ${type}">${text}</div>`;
}
function clearMsg(elId) {
  document.getElementById(elId).innerHTML = '';
}

function formatDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ---------- Nachschlagen ----------
document.getElementById('lookup-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('lookup-id').value.trim();
  if (id) lookupUser(id);
});

async function lookupUser(id) {
  clearMsg('lookup-msg');
  result.innerHTML = '<p>Wird geladen …</p>';
  try {
    const user = await apiFetch(SERVICES.user + '/api/users/' + id);
    renderUser(user);
  } catch (err) {
    result.innerHTML = '';
    showMsg('lookup-msg', err.message, 'error'); // z. B. 404 User nicht gefunden
  }
}

function renderUser(user) {
  const locked = user.locked === true;
  const card = document.createElement('div');
  card.className = 'user-card';
  card.innerHTML = `
    <table class="data-table">
      <tbody>
        <tr><th>ID</th><td>${user.user_id}</td></tr>
        <tr><th>E-Mail</th><td>${escapeHtml(user.email)}</td></tr>
        <tr><th>Rolle</th><td>${escapeHtml(user.role)}</td></tr>
        <tr><th>Gesperrt</th><td>${locked ? 'Ja' : 'Nein'}</td></tr>
        <tr><th>E-Mail bestätigt</th><td>${user.email_verified ? 'Ja' : 'Nein'}</td></tr>
        <tr><th>Erstellt</th><td>${formatDate(user.created_at)}</td></tr>
      </tbody>
    </table>
    <div class="form-actions">
      <button type="button" class="btn" id="toggle-lock">${locked ? 'Entsperren' : 'Sperren'}</button>
      <button type="button" class="btn danger" id="delete-user">Löschen</button>
    </div>
  `;
  card.querySelector('#toggle-lock').addEventListener('click', () => toggleLock(user, locked));
  card.querySelector('#delete-user').addEventListener('click', () => deleteUser(user));

  result.innerHTML = '';
  result.appendChild(card);
}

// ---------- Sperren / Entsperren ----------
async function toggleLock(user, currentlyLocked) {
  const action = currentlyLocked ? 'unlock' : 'lock';
  try {
    await apiFetch(SERVICES.user + '/api/users/' + user.user_id + '/' + action, { method: 'PUT' });
    showToast(currentlyLocked ? 'User entsperrt.' : 'User gesperrt.', 'ok');
    lookupUser(user.user_id); // neu laden -> Status aktualisieren
  } catch (err) {
    // z. B. 400 "Ein Admin kann den eigenen Account nicht sperren"
    showToast(err.message, 'error');
  }
}

// ---------- Löschen ----------
async function deleteUser(user) {
  if (!confirm(`User „${user.email}" (#${user.user_id}) wirklich löschen?`)) return;
  try {
    await apiFetch(SERVICES.user + '/api/users/' + user.user_id, { method: 'DELETE' });
    showToast(`User „${user.email}" gelöscht.`, 'ok');
    result.innerHTML = '<p>User wurde gelöscht.</p>';
  } catch (err) {
    // z. B. 400 "Ein Admin kann den eigenen Account nicht löschen"
    showToast(err.message, 'error');
  }
}

// ---------- Admin anlegen ----------
document.getElementById('admin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('admin-msg');
  const email = document.getElementById('a-email').value.trim();
  const password = document.getElementById('a-password').value;
  try {
    const created = await apiFetch(SERVICES.user + '/api/users/admin', {
      method: 'POST',
      body: { email, password },
    });
    showMsg('admin-msg', `Admin „${escapeHtml(created.email)}" angelegt (#${created.user_id}).`, 'ok');
    document.getElementById('admin-form').reset();
  } catch (err) {
    // z. B. 409 E-Mail vergeben, 400 fehlende Felder
    showMsg('admin-msg', err.message, 'error');
  }
});

// ---------- Bootstrap ----------
requireAdmin().then((ok) => {
  if (ok) renderNav();
});
