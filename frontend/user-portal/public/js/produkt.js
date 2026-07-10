// produkt.js — Produkt-Detailseite (INV-1): ein einzelnes Produkt anzeigen + in den Warenkorb.
// Wichtig: Das eigentliche Rezept (Zutaten + Zubereitung) wird hier NICHT gezeigt — es kommt
// erst nach dem Kauf per Bestätigungsmail. Das Backend liefert diese Felder für normale User
// ohnehin nicht mit (siehe stripSecretFields im inventory-service).

const detail = document.getElementById('product-detail');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showMsg(text, type = 'info') {
  document.getElementById('product-msg').innerHTML = `<div class="msg ${type}">${text}</div>`;
}

// Produkt-ID aus der URL (?id=…).
function getProductId() {
  return new URLSearchParams(location.search).get('id');
}

async function loadProduct() {
  const id = getProductId();
  if (!id) {
    detail.innerHTML = '';
    showMsg('Kein Produkt angegeben.', 'error');
    return;
  }

  try {
    const p = await apiFetch(SERVICES.inventory + '/api/products/' + encodeURIComponent(id));
    renderProduct(p);
  } catch (err) {
    detail.innerHTML = '';
    showMsg('Produkt konnte nicht geladen werden: ' + err.message, 'error');
  }
}

function renderProduct(p) {
  const soldOut = Number(p.amount) <= 0;
  const imgSrc = p.image_url ? SERVICES.images + '/' + p.image_url : '';

  // Zusatzinfos (nur anzeigen, wenn gepflegt).
  const facts = [];
  if (p.allergens) {
    facts.push(`<div class="fact"><span class="fact-label">Allergene</span><span>${escapeHtml(p.allergens)}</span></div>`);
  }
  if (p.prep_time_minutes) {
    facts.push(`<div class="fact"><span class="fact-label">Zubereitungszeit</span><span>${escapeHtml(p.prep_time_minutes)} Min.</span></div>`);
  }
  if (p.servings) {
    facts.push(`<div class="fact"><span class="fact-label">Portionen</span><span>${escapeHtml(p.servings)}</span></div>`);
  }

  detail.innerHTML = `
    <div class="detail-grid">
      <div class="detail-image${imgSrc ? '' : ' placeholder'}">
        ${imgSrc ? `<img src="${imgSrc}" alt="${escapeHtml(p.name)}" onerror="this.parentElement.classList.add('placeholder'); this.remove();">` : ''}
      </div>
      <div class="detail-info">
        ${p.category ? `<span class="tag">${escapeHtml(p.category)}</span>` : ''}
        <h2>${escapeHtml(p.name)}</h2>
        <p class="detail-price">${formatPrice(p.price)}</p>
        <p class="detail-stock">${soldOut ? 'Ausverkauft' : 'Auf Lager: ' + p.amount}</p>
        ${p.description ? `<p class="detail-desc">${escapeHtml(p.description)}</p>` : ''}

        ${facts.length ? `<div class="fact-list">${facts.join('')}</div>` : ''}

        <p class="recipe-hint">🧾 Das vollständige Rezept (Zutaten &amp; Zubereitung) erhältst du nach dem Kauf per E-Mail.</p>

        <button type="button" id="add-btn" class="${soldOut ? 'soldout' : ''}" ${soldOut ? 'disabled' : ''}>
          ${soldOut ? 'Ausverkauft' : 'In den Warenkorb'}
        </button>
      </div>
    </div>
  `;

  if (!soldOut) {
    document.getElementById('add-btn').addEventListener('click', () => addToCart(p));
  }
}

// Legt das Produkt in den Warenkorb bzw. erhöht die Menge (gleiche Logik wie in index.js:
// Backend SETZT die Menge absolut -> aktuelle Menge lesen und +1 schicken).
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
    showToast(`„${product.name}" im Warenkorb — Menge: ${qty}.`, 'ok');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------- Bootstrap ----------
if (requireLogin()) {
  renderNav();
  loadProduct();
}
