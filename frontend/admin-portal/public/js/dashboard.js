// dashboard.js — Admin-Startseite. Nur Admins (requireAdmin) sehen sie.

requireAdmin().then((ok) => {
  if (ok) renderNav();
});
