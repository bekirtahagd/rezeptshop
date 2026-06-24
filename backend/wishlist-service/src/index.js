// Zentrale .env aus dem Repo-Root laden (dieselbe Datei wie bei allen Services).
// __dirname = .../backend/wishlist-service/src  →  drei Ebenen hoch = rezeptshop/ (Repo-Root)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../..', '.env') });

const express = require('express');

const app = express();
const PORT = process.env.PORT || 3004;

// Eingehende JSON-Bodies automatisch parsen (req.body)
app.use(express.json());

// Health-Check: bestätigt nur, dass der Service läuft (praktisch für Docker & schnelle Tests)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'wishlist-service' });
});

// Wunschlisten-Endpunkte (WUN-1 bis WUN-4)
app.use('/api/wishlists', require('./routes/wishlists'));

app.listen(PORT, () => {
  console.log(`Wishlist-Service läuft auf Port ${PORT}`);
});
