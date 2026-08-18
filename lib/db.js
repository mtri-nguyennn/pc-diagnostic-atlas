const { Pool } = require('pg');

let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Add your Supabase Postgres connection string.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

function query(text, values) {
  return getPool().query(text, values);
}

module.exports = { getPool, query };
