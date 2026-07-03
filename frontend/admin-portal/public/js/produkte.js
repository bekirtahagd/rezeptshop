// produkte.js — Produktverwaltung (INV-3/4/5): Liste, Anlegen, Bearbeiten, Löschen.

const tableContainer = document.getElementById('table-container');
const form = document.getElementById('product-form');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showMsg(text, type = 'info') {
  document.getElementById('form-msg').innerHTML = `<div class="msg ${type}">${text}</div>`;
}
function clearMsg() {
  document.getElementById('form-msg').innerHTML = '';
}

// ---------- Produktliste ----------
async function loadProducts() {
  tableContainer.innerHTML = '<p>Produkte werden geladen …</p>';
  try {
    const products = await apiFetch(SERVICES.inventory + '/api/products');
    renderTable(products);
  } catch (err) {
    tableContainer.innerHTML = '';
    showMsg('Produkte konnten nicht geladen werden: ' + err.message, 'error');
  }
}

function renderTable(products) {
  if (!products.length) {
    tableContainer.innerHTML = '<p>Noch keine Produkte angelegt.</p>';
    return;
  }

  const rows = products
    .map(
      (p) => `
      <tr>
        <td class="num">${p.product_id}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.category || '–')}</td>
        <td class="num">${formatPrice(p.price)}</td>
        <td class="num">${p.amount}</td>
        <td>
          <button type="button" class="btn small" data-edit="${p.product_id}">Bearbeiten</button>
          <button type="button" class="btn danger small" data-del="${p.product_id}">Löschen</button>
        </td>
      </tr>`
    )
    .join('');

  tableContainer.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr><th class="num">ID</th><th>Name</th><th>Kategorie</th><th class="num">Preis</th><th class="num">Bestand</th><th>Aktionen</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  // Bearbeiten -> Formular befüllen
  tableContainer.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = products.find((x) => String(x.product_id) === btn.dataset.edit);
      if (p) startEdit(p);
    });
  });
  // Löschen
  tableContainer.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = products.find((x) => String(x.product_id) === btn.dataset.del);
      if (p) deleteProduct(p);
    });
  });
}

// ---------- Anlegen / Bearbeiten ----------
function startEdit(p) {
  document.getElementById('product-id').value = p.product_id;
  document.getElementById('p-name').value = p.name;
  document.getElementById('p-category').value = p.category || '';
  document.getElementById('p-price').value = p.price;
  document.getElementById('p-amount').value = p.amount;
  document.getElementById('p-description').value = p.description || '';

  document.getElementById('form-title').textContent = `Produkt #${p.product_id} bearbeiten`;
  document.getElementById('submit-btn').textContent = 'Speichern';
  document.getElementById('cancel-btn').classList.remove('hidden');
  clearMsg();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  form.reset();
  document.getElementById('product-id').value = '';
  document.getElementById('form-title').textContent = 'Neues Produkt';
  document.getElementById('submit-btn').textContent = 'Anlegen';
  document.getElementById('cancel-btn').classList.add('hidden');
  clearMsg();
}

document.getElementById('cancel-btn').addEventListener('click', resetForm);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg();

  const id = document.getElementById('product-id').value;
  const body = {
    name: document.getElementById('p-name').value.trim(),
    category: document.getElementById('p-category').value.trim(),
    description: document.getElementById('p-description').value.trim(),
    price: Number(document.getElementById('p-price').value),
    amount: Number(document.getElementById('p-amount').value),
  };

  try {
    if (id) {
      await apiFetch(SERVICES.inventory + '/api/products/' + id, { method: 'PUT', body });
      showToast(`Produkt #${id} gespeichert.`, 'ok');
    } else {
      const created = await apiFetch(SERVICES.inventory + '/api/products', { method: 'POST', body });
      showToast(`Produkt „${created.name}" angelegt (#${created.product_id}).`, 'ok');
    }
    resetForm();
    loadProducts();
  } catch (err) {
    showMsg(err.message, 'error');
  }
});

async function deleteProduct(p) {
  if (!confirm(`Produkt „${p.name}" (#${p.product_id}) wirklich löschen?`)) return;
  try {
    await apiFetch(SERVICES.inventory + '/api/products/' + p.product_id, { method: 'DELETE' });
    showToast(`Produkt „${p.name}" gelöscht.`, 'ok');
    // Falls es gerade im Formular bearbeitet wurde -> zurücksetzen.
    if (document.getElementById('product-id').value === String(p.product_id)) resetForm();
    loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------- Bootstrap ----------
requireAdmin().then((ok) => {
  if (ok) {
    renderNav();
    loadProducts();
  }
});
