// wunschliste-herz.js — Herz-Button zum Merken von Produkten (WUN-2).
// Wird von index.js (Produktkarten) und produkt.js (Detailseite) benutzt.
// Lädt nach api.js + auth.js, aber VOR der jeweiligen Seiten-JS.
//
// Warum ein Popover und nicht nur ein Toggle?
// Ein User kann mehrere Wunschlisten haben ("Weihnachten", "Schnelles" …). Ein Herz,
// das stumm toggelt, müsste sich eine Liste aussuchen — das wäre geraten. Deshalb:
// Herz = "liegt in mindestens einer meiner Listen", Klick öffnet die Listenauswahl.
//
// Das Backend hat keinen Endpunkt "in welchen Listen liegt Produkt X?". Wir bauen den
// Zustand daher einmal pro Seitenaufruf aus GET /api/wishlists + GET /api/wishlists/:id
// zusammen und halten ihn danach lokal aktuell (kein Neuladen nach jedem Klick).

// Eigene Listen: [{ list_id, name, productIds: Set<number> }]
let myWishlists = [];
let wishlistsReady = false; // false = Laden fehlgeschlagen -> Klick zeigt Fehler-Toast
let heartPopover = null;
let openHeartBtn = null; // Herz, zu dem das Popover gerade offen ist

function wlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- Zustand laden ----------

// Muss vor dem Rendern der Produkte aufgerufen (und abgewartet) werden, damit die
// Herzen sofort in der richtigen Farbe erscheinen und nicht sichtbar umspringen.
async function initWishlistHearts() {
  try {
    const me = await currentUser();
    if (!me) return false;

    const lists = await apiFetch(SERVICES.wishlist + '/api/wishlists');
    // Nur eigene Listen: in geteilte Listen schreibt man bewusst über die Wunschlisten-Seite,
    // und GET /api/wishlists verrät nicht, ob ein Share nur 'read' ist — wir würden sonst
    // Listen anbieten, bei denen das Hinzufügen später an einem 403 scheitert.
    const own = lists.filter((l) => Number(l.owner_user_id) === Number(me.userId));

    myWishlists = await Promise.all(
      own.map((l) =>
        apiFetch(SERVICES.wishlist + '/api/wishlists/' + l.list_id)
          .then((full) => ({
            list_id: l.list_id,
            name: l.name,
            productIds: new Set((full.products || []).map((p) => Number(p.product_id))),
          }))
          // Einzelne Liste nicht lesbar? Dann lieber leer anzeigen als die ganze Seite kippen.
          .catch(() => ({ list_id: l.list_id, name: l.name, productIds: new Set() }))
      )
    );
    wishlistsReady = true;
    return true;
  } catch {
    wishlistsReady = false;
    return false;
  }
}

function isOnAnyWishlist(productId) {
  const pid = Number(productId);
  return myWishlists.some((l) => l.productIds.has(pid));
}

// ---------- Herz-Button ----------

const HEART_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09' +
  'C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

// Liefert den fertigen Herz-Button. Die aufrufende Seite hängt ihn nur noch ins DOM.
function createHeartButton(product) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'heart-btn';
  btn.dataset.productId = product.product_id;
  btn.innerHTML = HEART_SVG;
  updateHeartButton(btn);

  btn.addEventListener('click', (e) => {
    // Auf der Übersicht ist die GANZE Karte ein Link zur Detailseite (siehe index.js).
    // Ohne stopPropagation würde jeder Herz-Klick zusätzlich wegnavigieren.
    e.stopPropagation();
    e.preventDefault();
    toggleHeartPopover(btn, product);
  });

  return btn;
}

function updateHeartButton(btn) {
  const active = isOnAnyWishlist(btn.dataset.productId);
  btn.classList.toggle('active', active);
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  const label = active ? 'In Wunschliste — Listen bearbeiten' : 'Zu Wunschliste hinzufügen';
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

// Nach jeder Änderung: alle Herzen dieses Produkts auf der Seite neu einfärben.
function refreshHearts(productId) {
  document
    .querySelectorAll('.heart-btn[data-product-id="' + productId + '"]')
    .forEach(updateHeartButton);
}

// ---------- Popover ----------

// Genau EIN Popover für die ganze Seite (am <body>), das umpositioniert wird —
// statt eines versteckten Popovers pro Produktkarte.
function ensurePopover() {
  if (heartPopover) return heartPopover;

  heartPopover = document.createElement('div');
  heartPopover.className = 'wishlist-popover';
  heartPopover.hidden = true;
  document.body.appendChild(heartPopover);

  // Klick außerhalb schließt. Der Klick auf ein Herz erreicht das document nicht
  // (stopPropagation oben), deshalb schließt das Herz sich hier nicht selbst weg.
  document.addEventListener('click', (e) => {
    if (!heartPopover.hidden && !heartPopover.contains(e.target)) closePopover();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePopover();
  });

  // Beim Scrollen/Resizen NICHT schließen, sondern mitwandern: sonst könnte man ein
  // Popover, das unten aus dem Bild ragt, nie erreichen — es verschwände beim ersten
  // Scrollversuch. Das Scrollen INNERHALB der Listen (.wl-rows) ignorieren wir dabei.
  window.addEventListener('resize', repositionPopover);
  window.addEventListener(
    'scroll',
    (e) => {
      if (e.target instanceof Node && heartPopover.contains(e.target)) return;
      repositionPopover();
    },
    true
  );

  return heartPopover;
}

function repositionPopover() {
  if (heartPopover && !heartPopover.hidden && openHeartBtn) positionPopover(openHeartBtn);
}

function closePopover() {
  if (heartPopover) heartPopover.hidden = true;
  openHeartBtn = null;
}

function toggleHeartPopover(btn, product) {
  if (!wishlistsReady) {
    showToast('Wunschlisten sind gerade nicht erreichbar.', 'error');
    return;
  }
  // Zweiter Klick auf dasselbe Herz schließt wieder.
  if (openHeartBtn === btn && heartPopover && !heartPopover.hidden) {
    closePopover();
    return;
  }

  ensurePopover();
  openHeartBtn = btn;
  renderPopover(product);
  heartPopover.hidden = false;
  positionPopover(btn); // erst nach hidden=false — vorher hat das Popover keine Maße
}

// Positioniert das Popover am Herz — und zwar so, dass es IMMER vollständig im
// sichtbaren Bereich liegt. Sonst gilt: bei vielen Listen ragt es unten heraus und
// ist nicht erreichbar (genau der Bug).
//
// Drei Schritte:
//  1. Die Listen-Höhe an den tatsächlich verfügbaren Platz anpassen (.wl-rows scrollt).
//  2. Nach oben aufklappen, wenn unten zu wenig Platz ist und oben mehr.
//  3. Horizontal am Viewport-Rand abfangen.
const POPOVER_MARGIN = 8;
const ROWS_MIN_HEIGHT = 80; // darunter wird die Liste unbrauchbar
const ROWS_MAX_HEIGHT = 220;

function positionPopover(btn) {
  const rect = btn.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const viewportW = document.documentElement.clientWidth;

  const spaceBelow = viewportH - rect.bottom - POPOVER_MARGIN * 2;
  const spaceAbove = rect.top - POPOVER_MARGIN * 2;

  // --- 1. Listenhöhe an den verfügbaren Platz anpassen ---
  const rows = heartPopover.querySelector('.wl-rows');
  // Titel + "Neue Liste"-Zeile + Paddings: alles außer der scrollbaren Liste.
  const chrome = heartPopover.offsetHeight - rows.offsetHeight;
  // Auf der Seite, auf der wir landen werden, ist so viel Platz:
  const space = Math.max(spaceBelow, spaceAbove);
  const rowsHeight = Math.max(ROWS_MIN_HEIGHT, Math.min(ROWS_MAX_HEIGHT, space - chrome));
  rows.style.maxHeight = rowsHeight + 'px';

  // --- 2. Vertikal: nach unten, sonst nach oben aufklappen ---
  const height = heartPopover.offsetHeight; // erst JETZT messen (Höhe steht fest)
  const fitsBelow = height <= spaceBelow;
  const flipUp = !fitsBelow && spaceAbove > spaceBelow;

  let top = flipUp ? rect.top - height - POPOVER_MARGIN : rect.bottom + POPOVER_MARGIN;
  // Letzte Sicherung: nie über den oberen/unteren Viewport-Rand hinaus.
  top = Math.max(POPOVER_MARGIN, Math.min(top, viewportH - height - POPOVER_MARGIN));

  // --- 3. Horizontal: Rechtskante am Herz, aber im Viewport bleiben ---
  const width = heartPopover.offsetWidth;
  const maxLeft = viewportW - width - POPOVER_MARGIN;
  const left = Math.max(POPOVER_MARGIN, Math.min(rect.right - width, maxLeft));

  heartPopover.style.top = window.scrollY + top + 'px';
  heartPopover.style.left = window.scrollX + left + 'px';
}

function renderPopover(product) {
  const pid = Number(product.product_id);

  const rows = myWishlists
    .map(
      (l) => `
      <label class="wl-row">
        <input type="checkbox" data-list-id="${l.list_id}" ${l.productIds.has(pid) ? 'checked' : ''}>
        <span>${wlEscape(l.name)}</span>
      </label>`
    )
    .join('');

  heartPopover.innerHTML = `
    <p class="wl-title">Zu Wunschliste</p>
    <div class="wl-rows">
      ${rows || '<p class="wl-empty">Du hast noch keine Wunschliste.</p>'}
    </div>
    <form class="wl-new">
      <input type="text" placeholder="Neue Liste …" maxlength="60" required>
      <button type="submit" title="Liste anlegen und Produkt merken">+</button>
    </form>
  `;

  heartPopover.querySelectorAll('input[data-list-id]').forEach((box) => {
    box.addEventListener('change', () => {
      const list = myWishlists.find((l) => String(l.list_id) === box.dataset.listId);
      if (list) setMembership(list, product, box.checked, box);
    });
  });

  const form = heartPopover.querySelector('.wl-new');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const name = input.value.trim();
    if (name) createListAndAdd(name, product, form);
  });
}

// ---------- Aktionen ----------

// Hinzufügen ist im Backend idempotent (ON CONFLICT DO NOTHING), Entfernen liefert 404,
// wenn das Produkt gar nicht drin war — beides unkritisch, weil die Checkbox den
// lokalen Zustand widerspiegelt.
async function setMembership(list, product, shouldBeIn, checkbox) {
  const pid = Number(product.product_id);
  const base = SERVICES.wishlist + '/api/wishlists/' + list.list_id;
  checkbox.disabled = true;

  try {
    if (shouldBeIn) {
      await apiFetch(base + '/products', { method: 'POST', body: { productId: pid } });
      list.productIds.add(pid);
      showToast(`„${product.name}" in „${list.name}" gemerkt.`, 'ok');
    } else {
      await apiFetch(base + '/products/' + pid, { method: 'DELETE' });
      list.productIds.delete(pid);
      showToast(`„${product.name}" aus „${list.name}" entfernt.`, 'ok');
    }
    refreshHearts(pid);
  } catch (err) {
    checkbox.checked = !shouldBeIn; // Häkchen zurückdrehen: der Server hat nicht mitgespielt
    showToast(err.message, 'error');
  } finally {
    checkbox.disabled = false;
  }
}

// Neue Liste anlegen und das Produkt gleich hineinlegen — spart dem User den Umweg
// über die Wunschlisten-Seite.
async function createListAndAdd(name, product, form) {
  const pid = Number(product.product_id);
  const submitBtn = form.querySelector('button');
  submitBtn.disabled = true;

  try {
    const created = await apiFetch(SERVICES.wishlist + '/api/wishlists', {
      method: 'POST',
      body: { name },
    });
    const entry = { list_id: created.list_id, name: created.name, productIds: new Set() };
    myWishlists.push(entry);

    await apiFetch(SERVICES.wishlist + '/api/wishlists/' + entry.list_id + '/products', {
      method: 'POST',
      body: { productId: pid },
    });
    entry.productIds.add(pid);

    showToast(`Liste „${entry.name}" erstellt und „${product.name}" gemerkt.`, 'ok');
    refreshHearts(pid);
    renderPopover(product); // Popover offen lassen, neue Liste erscheint angehakt
    positionPopover(openHeartBtn);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}
