require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Server-side cutoff for a runaway query (unfiltered Reports/Dashboard scan,
  // lock wait, etc). Set below the frontend's 30s axios timeout so a slow
  // query fails fast with a clear Postgres error instead of hanging until
  // the client times out with no diagnostic information.
  statement_timeout: 25000,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query:     (text, params) => pool.query(text, params),
  getClient: ()             => pool.connect(),
  pool,
};
