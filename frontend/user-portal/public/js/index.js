// index.js — Produktseite: Produkte laden, suchen (INV-2), in den Warenkorb legen (INV-6).

const grid = document.getElementById('product-grid');

// Verhindert, dass Produktnamen/-beschreibungen aus der DB als HTML interpretiert werden.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showMsg(text, type = 'info') {
  document.getElementById('products-msg').innerHTML = `<div class="msg ${type}">${text}</div>`;
}
function clearMsg() {
  document.getElementById('products-msg').innerHTML = '';
}

// Baut das Kategorie-Dropdown einmalig aus den vorhandenen Produkten (distinct).
async function initCategories() {
  try {
    const products = await apiFetch(SERVICES.inventory + '/api/products');
    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
    const select = document.getElementById('search-category');
    for (const cat of categories) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    }
  } catch {
    // Nicht kritisch — Suche per Name funktioniert auch ohne Dropdown.
  }
}

// Lädt Produkte vom inventory-service, optional gefiltert nach Name + Kategorie.
async function loadProducts(filters = {}) {
  grid.innerHTML = '<p>Produkte werden geladen …</p>';
  const params = new URLSearchParams();
  if (filters.name) params.set('name', filters.name);
  if (filters.category) params.set('category', filters.category);
  const query = params.toString() ? '?' + params.toString() : '';

  try {
    const products = await apiFetch(SERVICES.inventory + '/api/products' + query);
    renderProducts(products);
  } catch (err) {
    grid.innerHTML = '';
    showMsg('Produkte konnten nicht geladen werden: ' + err.message, 'error');
  }
}

function renderProducts(products) {
  if (!products.length) {
    grid.innerHTML = '<p>Keine Produkte gefunden.</p>';
    return;
  }

  grid.innerHTML = '';
  for (const p of products) {
    const soldOut = Number(p.amount) <= 0;
    const card = document.createElement('article');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-image">Bild</div>
      ${p.category ? `<span class="tag">${escapeHtml(p.category)}</span>` : ''}
      <h3>${escapeHtml(p.name)}</h3>
      <p class="card-desc">${escapeHtml(p.description || '')}</p>
      <p class="card-price">${formatPrice(p.price)}</p>
      <p class="card-stock">${soldOut ? 'Ausverkauft' : 'Auf Lager: ' + p.amount}</p>
      <button type="button" class="${soldOut ? 'soldout' : ''}" ${soldOut ? 'disabled' : ''}>
        ${soldOut ? 'Ausverkauft' : 'In den Warenkorb'}
      </button>
    `;
    if (!soldOut) {
      card.querySelector('button').addEventListener('click', () => addToCart(p));
    }
    grid.appendChild(card);
  }
}

// Legt ein Produkt in den Warenkorb bzw. erhöht die Menge, falls es schon drin ist.
// Das Backend SETZT die Menge absolut -> wir lesen die aktuelle Menge und schicken +1.
// 409 = nicht verfügbar / Bestand überschritten.
async function addToCart(product) {
  try {
    const cart = await apiFetch(SERVICES.inventory + '/api/cart');
    const existing = cart.items.find((i) => i.product_id === product.product_id);
    const newQty = (existing ? Number(existing.quantity) : 0) + 1;

    const updated = await apiFetch(SERVICES.inventory + '/api/cart', {
      method: 'POST',
      body: { productId: product.product_id, quantity: newQty },
    });

    const inCart = updated.items.find((i) => i.product_id === product.product_id);
    const qty = inCart ? inCart.quantity : newQty;
    // Toast statt Inline-Meldung: auch beim Hinzufügen aus der unteren Seitenhälfte sichtbar.
    showToast(`„${product.name}" im Warenkorb — Menge: ${qty}.`, 'ok');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------- Suche ----------
document.getElementById('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  clearMsg();
  loadProducts({
    name: document.getElementById('search-name').value.trim(),
    category: document.getElementById('search-category').value,
  });
});

document.getElementById('search-reset').addEventListener('click', () => {
  document.getElementById('search-name').value = '';
  document.getElementById('search-category').value = '';
  clearMsg();
  loadProducts();
});

// ---------- Bootstrap (zuletzt, damit alle Deklarationen oben stehen) ----------
if (requireLogin()) {
  renderNav();
  initCategories();
  loadProducts();
}
