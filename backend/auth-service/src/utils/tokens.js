const crypto = require('crypto');

// Erzeugt einen nicht erratbaren Einmal-Token (32 zufällige Bytes als Hex-String).
// Verwendet für Bestätigungslinks (AUTH-2) und später Magic-Links (AUTH-5).
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { generateToken };
