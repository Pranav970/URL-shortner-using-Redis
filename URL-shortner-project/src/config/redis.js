const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

let client;

function getRedisClient() {
  if (!client) {
    client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      keyPrefix: config.redis.keyPrefix,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
        if (times > 10) {
          logger.error('Redis max retries exceeded');
          return null; // Stop retrying
        }
        return delay;
      },
      lazyConnect: false,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    });

    client.on('connect', () => {
      logger.info('Redis client connected');
    });

    client.on('ready', () => {
      logger.info('Redis client ready');
    });

    client.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    client.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });
  }

  return client;
}

/**
 * Get cached value by key
 */
async function get(key) {
  try {
    return await getRedisClient().get(key);
  } catch (err) {
    logger.error('Redis GET error', { key, error: err.message });
    return null; // Fail open — fallback to DB
  }
}

/**
 * Set a value with optional TTL in seconds
 */
async function set(key, value, ttlSeconds) {
  try {
    if (ttlSeconds) {
      return await getRedisClient().setex(key, ttlSeconds, value);
    }
    return await getRedisClient().set(key, value);
  } catch (err) {
    logger.error('Redis SET error', { key, error: err.message });
    return null;
  }
}

/**
 * Delete a key
 */
async function del(key) {
  try {
    return await getRedisClient().del(key);
  } catch (err) {
    logger.error('Redis DEL error', { key, error: err.message });
    return null;
  }
}

/**
 * Increment a counter key
 */
async function incr(key) {
  try {
    return await getRedisClient().incr(key);
  } catch (err) {
    logger.error('Redis INCR error', { key, error: err.message });
    return null;
  }
}

/**
 * Expire a key
 */
async function expire(key, ttlSeconds) {
  try {
    return await getRedisClient().expire(key, ttlSeconds);
  } catch (err) {
    logger.error('Redis EXPIRE error', { key, error: err.message });
    return null;
  }
}

/**
 * Test connection
 */
async function testConnection() {
  try {
    const pong = await getRedisClient().ping();
    logger.info('Redis connected', { response: pong });
    return true;
  } catch (err) {
    logger.error('Redis connection failed', { error: err.message });
    return false;
  }
}

/**
 * Graceful shutdown
 */
async function closeConnection() {
  if (client) {
    await client.quit();
    client = null;
    logger.info('Redis connection closed');
  }
}

module.exports = {
  getRedisClient,
  get,
  set,
  del,
  incr,
  expire,
  testConnection,
  closeConnection,
};
