// bestellungen.js — Kaufhistorie (INV-7): GET /api/orders, neueste zuerst.

const container = document.getElementById('orders-container');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showMsg(text, type = 'info') {
  document.getElementById('orders-msg').innerHTML = `<div class="msg ${type}">${text}</div>`;
}

// Datum (ISO) -> lesbares deutsches Format.
function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

async function loadOrders() {
  container.innerHTML = '<p>Bestellungen werden geladen …</p>';
  try {
    const orders = await apiFetch(SERVICES.inventory + '/api/orders');
    renderOrders(orders);
  } catch (err) {
    container.innerHTML = '';
    showMsg('Bestellungen konnten nicht geladen werden: ' + err.message, 'error');
  }
}

function renderOrders(orders) {
  if (!orders.length) {
    container.innerHTML =
      '<p>Du hast noch keine Bestellungen.</p>' +
      '<p><a href="index.html">Jetzt einkaufen</a></p>';
    return;
  }

  container.innerHTML = '';
  for (const order of orders) {
    const card = document.createElement('article');
    card.className = 'order-card';

    const rows = order.positions
      .map(
        (p) => `
        <tr>
          <td>${escapeHtml(p.name || 'Produkt entfernt')}</td>
          <td class="num">${p.amount}×</td>
          <td class="num">${formatPrice(p.purchase_price)}</td>
          <td class="num">${formatPrice(p.subtotal)}</td>
        </tr>`
      )
      .join('');

    card.innerHTML = `
      <div class="order-head">
        <span><strong>Bestellung #${order.order_id}</strong></span>
        <span class="order-status">${escapeHtml(order.status)}</span>
        <span class="order-date">${formatDate(order.date)}</span>
      </div>
      <table class="order-table">
        <thead>
          <tr><th>Produkt</th><th class="num">Menge</th><th class="num">Einzelpreis</th><th class="num">Summe</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="order-total">Gesamt: ${formatPrice(order.total)}</div>
    `;
    container.appendChild(card);
  }
}

// ---------- Bootstrap ----------
if (requireLogin()) {
  renderNav();
  // Kommt man frisch von einem erfolgreichen Kauf? -> Erfolgs-Banner zeigen.
  const neu = new URLSearchParams(location.search).get('neu');
  if (neu) {
    showMsg(`Kauf erfolgreich! Deine Bestellung #${escapeHtml(neu)} wurde aufgegeben.`, 'ok');
  }
  loadOrders();
}
