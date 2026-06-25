// warenkorb.js — Warenkorb-Ansicht (INV-6): laden, Menge ändern, entfernen, Summe.
// Die Kasse (POST /api/orders) folgt in Etappe 4 und wird hier ergänzt.

const container = document.getElementById('cart-container');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showMsg(text, type = 'info') {
  document.getElementById('cart-msg').innerHTML = `<div class="msg ${type}">${text}</div>`;
}
function clearMsg() {
  document.getElementById('cart-msg').innerHTML = '';
}

// Lädt den Warenkorb vom Backend und rendert ihn.
async function loadCart() {
  container.innerHTML = '<p>Warenkorb wird geladen …</p>';
  try {
    const cart = await apiFetch(SERVICES.inventory + '/api/cart');
    renderCart(cart);
  } catch (err) {
    container.innerHTML = '';
    showMsg('Warenkorb konnte nicht geladen werden: ' + err.message, 'error');
  }
}

function renderCart(cart) {
  if (!cart.items.length) {
    container.innerHTML =
      '<p>Dein Warenkorb ist leer.</p>' +
      '<p><a href="index.html">Zu den Produkten</a></p>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'cart-list';

  for (const item of cart.items) {
    const atMax = Number(item.quantity) >= Number(item.stock);
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <span class="cart-name">${escapeHtml(item.name)}</span>
      <span class="cart-qty">
        <button type="button" class="qty-btn" data-act="dec" ${item.quantity <= 1 ? 'disabled' : ''}>−</button>
        <span class="qty-value">${item.quantity}</span>
        <button type="button" class="qty-btn" data-act="inc" ${atMax ? 'disabled' : ''}>+</button>
      </span>
      <span class="cart-subtotal">${formatPrice(item.subtotal)}</span>
      <button type="button" class="btn danger cart-remove">Entfernen</button>
    `;
    row.querySelector('[data-act="dec"]').addEventListener('click', () =>
      setQuantity(item.product_id, Number(item.quantity) - 1)
    );
    row.querySelector('[data-act="inc"]').addEventListener('click', () =>
      setQuantity(item.product_id, Number(item.quantity) + 1)
    );
    row.querySelector('.cart-remove').addEventListener('click', () =>
      removeItem(item.product_id, item.name)
    );
    list.appendChild(row);
  }

  const total = document.createElement('div');
  total.className = 'cart-total';
  total.innerHTML = `<span>Gesamt</span><span>${formatPrice(cart.total)}</span>`;

  const checkoutBtn = document.createElement('button');
  checkoutBtn.className = 'checkout-button';
  checkoutBtn.textContent = 'Zur Kasse';
  checkoutBtn.addEventListener('click', () => checkout(checkoutBtn));

  container.innerHTML = '';
  container.appendChild(list);
  container.appendChild(total);
  container.appendChild(checkoutBtn);
}

// Setzt die Menge einer Position absolut (Backend-Semantik). Bei < 1 nichts tun.
async function setQuantity(productId, newQty) {
  if (newQty < 1) return;
  try {
    const cart = await apiFetch(SERVICES.inventory + '/api/cart', {
      method: 'POST',
      body: { productId, quantity: newQty },
    });
    renderCart(cart);
  } catch (err) {
    // z. B. 409 "Nur X Stück verfügbar"
    showToast(err.message, 'error');
  }
}

async function removeItem(productId, name) {
  try {
    const cart = await apiFetch(SERVICES.inventory + '/api/cart/' + productId, {
      method: 'DELETE',
    });
    renderCart(cart);
    showToast(`„${name}" wurde entfernt.`, 'ok');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Kauf abschließen (INV-7). Erfolg -> zur Bestellhistorie mit Erfolgs-Banner.
// Fehlerfälle: leerer Korb (400), unbestätigte E-Mail (403) -> als Toast.
async function checkout(btn) {
  btn.disabled = true;
  try {
    const order = await apiFetch(SERVICES.inventory + '/api/orders', { method: 'POST' });
    window.location.href = 'bestellungen.html?neu=' + order.order_id;
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
  }
}

// ---------- Bootstrap ----------
if (requireLogin()) {
  renderNav();
  loadCart();
}
