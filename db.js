const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  console.log('✓ Conectado a NeonDB con SSL');
});

pool.on('error', (err) => {
  console.error('Error imprevisto en NeonDB:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};