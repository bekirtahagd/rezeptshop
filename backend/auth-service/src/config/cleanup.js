const db = require('./db');

// Aufräum-Job gegen unbegrenztes Wachstum zweier Tabellen, die der auth-service besitzt:
//   - token_blacklist:      abgelaufene jti sind wertlos (ein abgelaufenes JWT scheitert
//                           ohnehin schon an jwt.verify) → gefahrlos löschbar.
//   - verification_tokens:  E-Mail-Bestätigungs- und Magic-Link-Token haben eine feste
//                           Ablaufzeit (24h bzw. 15min) → nach Ablauf nutzlos.
// Beide Tabellen bleiben so dauerhaft klein, ohne dass ein externer Cron-Job nötig ist.

// Standard-Intervall: alle 6 Stunden. Über CLEANUP_INTERVAL_MS überschreibbar (z.B. für Tests).
const CLEANUP_INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MS, 10) || 6 * 60 * 60 * 1000;

// Löscht in beiden Tabellen alle Zeilen, deren expires_at in der Vergangenheit liegt.
// Ablauf wird in SQL geprüft (NOW()), nicht in JS — konsistent mit dem übrigen Code
// (zeitzonensichere TIMESTAMP-Vergleiche in der DB statt in Node).
async function cleanupExpiredTokens() {
  try {
    const blacklist = await db.query('DELETE FROM token_blacklist WHERE expires_at < NOW()');
    const verification = await db.query('DELETE FROM verification_tokens WHERE expires_at < NOW()');
    if (blacklist.rowCount > 0 || verification.rowCount > 0) {
      console.log(
        `Token-Cleanup: ${blacklist.rowCount} Blacklist-, ${verification.rowCount} Verifizierungs-Einträge entfernt`
      );
    }
  } catch (err) {
    // Ein fehlgeschlagener Cleanup darf den Service nicht beeinträchtigen — nur loggen.
    console.error('Token-Cleanup fehlgeschlagen:', err.message);
  }
}

// Startet den periodischen Cleanup und führt ihn einmal direkt beim Start aus.
// .unref(): der Timer hält den Node-Prozess nicht künstlich am Leben.
function startTokenCleanup() {
  cleanupExpiredTokens();
  const timer = setInterval(cleanupExpiredTokens, CLEANUP_INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { startTokenCleanup, cleanupExpiredTokens };
