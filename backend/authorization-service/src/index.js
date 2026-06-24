require('dotenv').config({ path: require('path').resolve(__dirname, '../../..', '.env') });

const express = require('express');
const cors = require('cors');
const authorizationRoutes = require('./routes/authorization');

const app = express();
const PORT = process.env.PORT || 3002;

// CORS: nur die beiden Frontend-Origins erlauben (Browser-Schutz). Wir nutzen Bearer-Tokens
// im Authorization-Header, keine Cookies → kein credentials-Handling nötig. app.use(cors())
// beantwortet den OPTIONS-Preflight automatisch (kein app.options('*') — bricht in Express 5).
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8080,http://localhost:8081')
  .split(',').map((o) => o.trim());
app.use(cors({ origin: allowedOrigins }));

app.use(express.json());
app.use('/api/authorization', authorizationRoutes);

app.listen(PORT, () => {
  console.log(`Authorization-Service läuft auf Port ${PORT}`);
});
