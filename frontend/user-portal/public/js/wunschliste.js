// wunschliste.js — Wunschlisten (WUN-1–4): erstellen, umbenennen, Produkte
// hinzufügen/entfernen, teilen, löschen. Eigene + geteilte Listen.

const container = document.getElementById('lists-container');
let me = null; // eingeloggter User (für Besitzer-Check)
let allProducts = []; // für das "Produkt hinzufügen"-Dropdown

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showMsg(text, type = 'info') {
  document.getElementById('lists-msg').innerHTML = `<div class="msg ${type}">${text}</div>`;
}

// Lädt alle Listen (eigene + geteilte) inkl. ihrer Produkte.
async function loadLists() {
  container.innerHTML = '<p>Wunschlisten werden geladen …</p>';
  try {
    const lists = await apiFetch(SERVICES.wishlist + '/api/wishlists');
    // Produkte je Liste nachladen (GET /:id liefert die Produkte) und – nur für eigene
    // Listen – die Zugriffsliste (GET /:id/shares), damit der Besitzer sieht, wer Zugriff hat.
    const detailed = await Promise.all(
      lists.map(async (l) => {
        const detail = await apiFetch(SERVICES.wishlist + '/api/wishlists/' + l.list_id).catch(
          () => ({ ...l, products: [] })
        );
        const isOwner = me && Number(l.owner_user_id) === Number(me.userId);
        const shares = isOwner
          ? await apiFetch(SERVICES.wishlist + '/api/wishlists/' + l.list_id + '/shares').catch(
              () => []
            )
          : [];
        // my_permission steckt in der Listen-Antwort (l), nicht im Detail -> mit übernehmen.
        return { ...l, ...detail, shares };
      })
    );
    renderLists(detailed);
  } catch (err) {
    container.innerHTML = '';
    showMsg('Wunschlisten konnten nicht geladen werden: ' + err.message, 'error');
  }
}

function renderLists(lists) {
  if (!lists.length) {
    container.innerHTML = '<p>Du hast noch keine Wunschlisten. Erstelle oben deine erste!</p>';
    return;
  }

  container.innerHTML = '';
  for (const list of lists) {
    container.appendChild(buildListCard(list));
  }
}

function buildListCard(list) {
  const isOwner = me && Number(list.owner_user_id) === Number(me.userId);
  // Schreib-Aktionen (Produkte/Beschreibung ändern): Besitzer ODER Empfänger mit 'write'.
  // Teilen & Löschen bleiben dem Besitzer vorbehalten.
  const canWrite = isOwner || list.my_permission === 'write';
  const card = document.createElement('article');
  card.className = 'wishlist-card';

  // Produktzeilen. "Entfernen" ist eine Schreib-Aktion → nur mit Schreibrecht.
  const productRows = (list.products || [])
    .map(
      (p) => `
      <li class="wishlist-product">
        <span>${escapeHtml(p.name)} <span class="muted">· ${formatPrice(p.price)}</span></span>
        ${canWrite ? `<button type="button" class="btn danger small" data-remove="${p.product_id}">Entfernen</button>` : ''}
      </li>`
    )
    .join('');

  // Dropdown mit allen Produkten zum Hinzufügen
  const options = allProducts
    .map((p) => `<option value="${p.product_id}">${escapeHtml(p.name)}</option>`)
    .join('');

  // Zugriffsliste (nur beim Besitzer gefüllt): pro Berechtigung eine Zeile mit
  // Stufen-Auswahl (Lesen/Schreiben), "Ändern" und "Entfernen".
  const sharesHtml = (list.shares || [])
    .map(
      (s) => `
      <li class="share-row" data-share-userid="${escapeHtml(s.user_id)}">
        <span class="share-user">User #${escapeHtml(s.user_id)}</span>
        <select data-share-level>
          <option value="read"${s.permission === 'read' ? ' selected' : ''}>Lesen</option>
          <option value="write"${s.permission === 'write' ? ' selected' : ''}>Schreiben</option>
        </select>
        <button type="button" class="btn small" data-share-update>Ändern</button>
        <button type="button" class="btn danger small" data-share-remove>Entfernen</button>
      </li>`
    )
    .join('');

  card.innerHTML = `
    <div class="wishlist-head">
      <h3>${escapeHtml(list.name)}</h3>
      ${
        isOwner
          ? ''
          : `<span class="shared-badge">geteilt · Besitzer #${escapeHtml(list.owner_user_id)} · ${canWrite ? 'Schreibzugriff' : 'Lesezugriff'}</span>`
      }
    </div>
    ${list.description ? `<p class="wishlist-desc">${escapeHtml(list.description)}</p>` : ''}

    <ul class="wishlist-products">
      ${productRows || '<li class="muted">Noch keine Produkte in dieser Liste.</li>'}
    </ul>

    ${
      canWrite
        ? `
    <div class="wishlist-add">
      <select data-add-select>${options}</select>
      <button type="button" class="btn small" data-add-btn>Produkt hinzufügen</button>
    </div>

    <details class="wishlist-actions">
      <summary>Aktionen</summary>

      <div class="action-block">
        <label class="action-label">Name &amp; Beschreibung bearbeiten</label>
        <input type="text" data-edit-name value="${escapeHtml(list.name)}" placeholder="Name">
        <textarea data-edit-desc rows="2" placeholder="Beschreibung (optional)">${escapeHtml(list.description || '')}</textarea>
        <button type="button" class="btn small" data-edit-btn>Speichern</button>
      </div>
      ${
        isOwner
          ? `
      <div class="action-block">
        <label class="action-label">Zugriff verwalten</label>
        <ul class="share-list" data-share-list>
          ${sharesHtml || '<li class="muted">Diese Liste ist noch nicht geteilt.</li>'}
        </ul>
        <div class="action-row">
          <input type="number" data-share-user placeholder="User-ID" min="1">
          <select data-share-type>
            <option value="read">Lesen</option>
            <option value="write">Schreiben</option>
          </select>
          <button type="button" class="btn small" data-share-btn>Teilen</button>
        </div>
      </div>
      <div class="action-row">
        <button type="button" class="btn danger small" data-delete-btn>Liste löschen</button>
      </div>`
          : ''
      }
    </details>`
        : '<p class="muted read-only-hint">Geteilte Liste – nur Lesezugriff.</p>'
    }
  `;

  bindCardEvents(card, list);
  return card;
}

function bindCardEvents(card, list) {
  const id = list.list_id;

  // Produkt entfernen
  card.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => removeProduct(id, btn.dataset.remove));
  });

  // Produkt hinzufügen
  const addBtn = card.querySelector('[data-add-btn]');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const select = card.querySelector('[data-add-select]');
      if (select && select.value) addProduct(id, select.value);
    });
  }

  // Name & Beschreibung bearbeiten
  const editBtn = card.querySelector('[data-edit-btn]');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const name = card.querySelector('[data-edit-name]').value.trim();
      const description = card.querySelector('[data-edit-desc]').value.trim();
      if (!name) {
        showToast('Der Name darf nicht leer sein.', 'error');
        return;
      }
      updateList(id, name, description);
    });
  }

  // Teilen (nur Besitzer)
  const shareBtn = card.querySelector('[data-share-btn]');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const userId = card.querySelector('[data-share-user]').value.trim();
      const type = card.querySelector('[data-share-type]').value;
      if (userId) shareList(id, userId, type);
    });
  }

  // Bestehende Zugriffe ändern / entziehen (nur Besitzer)
  card.querySelectorAll('.share-row').forEach((row) => {
    const targetUserId = row.dataset.shareUserid;

    const updateBtn = row.querySelector('[data-share-update]');
    if (updateBtn) {
      updateBtn.addEventListener('click', () => {
        const level = row.querySelector('[data-share-level]').value;
        shareList(id, targetUserId, level);
      });
    }

    const removeBtn = row.querySelector('[data-share-remove]');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => revokeShare(id, targetUserId));
    }
  });

  // Löschen (nur Besitzer)
  const delBtn = card.querySelector('[data-delete-btn]');
  if (delBtn) {
    delBtn.addEventListener('click', () => deleteList(id, list.name));
  }
}

// ---------- Aktionen ----------

document.getElementById('create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('create-name').value.trim();
  const description = document.getElementById('create-desc').value.trim();
  if (!name) return;
  try {
    await apiFetch(SERVICES.wishlist + '/api/wishlists', {
      method: 'POST',
      body: { name, description: description || undefined },
    });
    document.getElementById('create-form').reset();
    showToast(`Liste „${name}" erstellt.`, 'ok');
    loadLists();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function addProduct(listId, productId) {
  try {
    await apiFetch(SERVICES.wishlist + '/api/wishlists/' + listId + '/products', {
      method: 'POST',
      body: { productId: Number(productId) },
    });
    showToast('Produkt hinzugefügt.', 'ok');
    loadLists();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function removeProduct(listId, productId) {
  try {
    await apiFetch(SERVICES.wishlist + '/api/wishlists/' + listId + '/products/' + productId, {
      method: 'DELETE',
    });
    showToast('Produkt entfernt.', 'ok');
    loadLists();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updateList(listId, name, description) {
  try {
    // description immer mitschicken: leerer String löscht eine vorhandene Beschreibung.
    await apiFetch(SERVICES.wishlist + '/api/wishlists/' + listId, {
      method: 'PUT',
      body: { name, description },
    });
    showToast('Liste gespeichert.', 'ok');
    loadLists();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function shareList(listId, userId, authorizationType) {
  try {
    await apiFetch(SERVICES.wishlist + '/api/wishlists/' + listId + '/share', {
      method: 'POST',
      body: { userId: Number(userId), authorizationType },
    });
    const label = authorizationType === 'write' ? 'Schreiben' : 'Lesen';
    showToast(`Zugriff für User #${userId} gesetzt: ${label}.`, 'ok');
    loadLists();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function revokeShare(listId, userId) {
  if (!confirm(`Zugriff von User #${userId} auf diese Liste wirklich entziehen?`)) return;
  try {
    await apiFetch(SERVICES.wishlist + '/api/wishlists/' + listId + '/share/' + userId, {
      method: 'DELETE',
    });
    showToast(`Zugriff von User #${userId} entzogen.`, 'ok');
    loadLists();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteList(listId, name) {
  if (!confirm(`Wunschliste „${name}" wirklich löschen?`)) return;
  try {
    await apiFetch(SERVICES.wishlist + '/api/wishlists/' + listId, { method: 'DELETE' });
    showToast(`Liste „${name}" gelöscht.`, 'ok');
    loadLists();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------- Bootstrap ----------
if (requireLogin()) {
  (async () => {
    renderNav();
    me = await currentUser();
    try {
      allProducts = await apiFetch(SERVICES.inventory + '/api/products');
    } catch {
      allProducts = [];
    }
    loadLists();
  })();
}
