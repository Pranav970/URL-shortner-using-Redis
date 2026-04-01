const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      user: config.db.user,
      password: config.db.password,
      min: config.db.poolMin,
      max: config.db.poolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
    });

    pool.on('connect', () => {
      logger.debug('New PostgreSQL client connected');
    });

    pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error', { error: err.message });
    });
  }

  return pool;
}

/**
 * Execute a single query using a pool client
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await getPool().query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('Database query error', { text, error: err.message });
    throw err;
  }
}

/**
 * Get a dedicated client for transactions
 */
async function getClient() {
  const client = await getPool().connect();
  const originalQuery = client.query.bind(client);

  // Patch query for logging
  client.query = async (text, params) => {
    const start = Date.now();
    try {
      const result = await originalQuery(text, params);
      const duration = Date.now() - start;
      logger.debug('Transaction query', { text, duration });
      return result;
    } catch (err) {
      logger.error('Transaction query error', { text, error: err.message });
      throw err;
    }
  };

  return client;
}

/**
 * Test connection on startup
 */
async function testConnection() {
  try {
    const result = await query('SELECT NOW() as now');
    logger.info('PostgreSQL connected', { time: result.rows[0].now });
    return true;
  } catch (err) {
    logger.error('PostgreSQL connection failed', { error: err.message });
    return false;
  }
}

/**
 * Graceful shutdown
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL pool closed');
  }
}

module.exports = { query, getClient, testConnection, closePool, getPool };
