// Zentrale .env aus dem Repo-Root laden (dieselbe Datei wie bei allen Services).
// __dirname = .../backend/user-service/src  →  drei Ebenen hoch = rezeptshop/ (Repo-Root)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../..', '.env') });

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3005;

// CORS: nur die beiden Frontend-Origins erlauben (Browser-Schutz). Wir nutzen Bearer-Tokens
// im Authorization-Header, keine Cookies → kein credentials-Handling nötig. app.use(cors())
// beantwortet den OPTIONS-Preflight automatisch (kein app.options('*') — bricht in Express 5).
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8080,http://localhost:8081')
  .split(',').map((o) => o.trim());
app.use(cors({ origin: allowedOrigins }));

// Eingehende JSON-Bodies automatisch parsen (req.body)
app.use(express.json());

// Health-Check: bestätigt nur, dass der Service läuft (praktisch für Docker & schnelle Tests)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

// User-Verwaltungs-Endpunkte (USER-1 bis USER-4)
app.use('/api/users', require('./routes/users'));

app.listen(PORT, () => {
  console.log(`User-Service läuft auf Port ${PORT}`);
});
