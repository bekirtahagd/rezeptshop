const { Pool } = require('pg');

// Pool = mehrere DB-Verbindungen werden offen gehalten und wiederverwendet.
// DATABASE_URL kommt aus der zentralen .env im Repo-Root.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
