const db = require('../config/database');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * GET /health
 * Lightweight liveness check (no dependency checks).
 * Used by load balancers to quickly verify the process is alive.
 */
function liveness(req, res) {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /health/ready
 * Readiness check — verifies all dependencies are reachable.
 * Returns 503 if any dependency is unhealthy (so LB stops routing traffic).
 */
async function readiness(req, res) {
  const checks = {
    postgres: 'unknown',
    redis: 'unknown',
  };

  let healthy = true;

  // Check PostgreSQL
  try {
    await db.query('SELECT 1');
    checks.postgres = 'ok';
  } catch (err) {
    checks.postgres = 'error';
    healthy = false;
    logger.error('Health check: PostgreSQL failed', { error: err.message });
  }

  // Check Redis
  try {
    const pong = await getRedisClient().ping();
    checks.redis = pong === 'PONG' ? 'ok' : 'error';
    if (checks.redis !== 'ok') healthy = false;
  } catch (err) {
    checks.redis = 'error';
    healthy = false;
    logger.error('Health check: Redis failed', { error: err.message });
  }

  const statusCode = healthy ? 200 : 503;
  return res.status(statusCode).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
}

module.exports = { liveness, readiness };
