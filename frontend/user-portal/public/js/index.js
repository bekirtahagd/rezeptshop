// index.js — Produktseite (Shop-Startseite).
// Etappe 1: nur Login-Schutz + Nav. Etappe 2 ergänzt das Laden/Suchen der Produkte.

if (!requireLogin()) {
  // requireLogin() leitet bereits zum Login um.
} else {
  renderNav();
}
