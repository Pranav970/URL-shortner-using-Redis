const config = require('../config');
const redis = require('../config/redis');
const urlRepo = require('../repositories/url.repository');
const { generateShortCodeForAttempt, validateCustomAlias } = require('../utils/shortCode');
const { validateUrl } = require('../utils/urlValidator');
const { MAX_COLLISION_RETRIES } = require('../models/url.model');
const logger = require('../utils/logger');

/**
 * Create a short URL.
 *
 * Flow:
 *  1. Validate the original URL
 *  2. If custom alias provided, validate and check availability
 *  3. Otherwise generate a random short code, retrying on collision (up to MAX_COLLISION_RETRIES)
 *  4. Persist to PostgreSQL
 *  5. Prime the Redis cache
 *
 * @param {Object} params
 * @param {string} params.originalUrl
 * @param {string} [params.customAlias]
 * @param {number} [params.expiresInDays]
 * @param {string} [params.title]
 * @returns {Promise<{ shortCode: string, shortUrl: string, record: Object }>}
 */
async function createShortUrl({ originalUrl, customAlias, expiresInDays, title }) {
  // 1. Validate the destination URL
  const { valid, error, normalised } = validateUrl(originalUrl);
  if (!valid) {
    const err = new Error(error);
    err.statusCode = 400;
    throw err;
  }

  const resolvedUrl = normalised;

  // 2. Calculate expiry
  const days = expiresInDays || config.url.defaultExpirationDays;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  let shortCode;

  if (customAlias) {
    // 3a. Custom alias path
    const aliasValidation = validateCustomAlias(customAlias);
    if (!aliasValidation.valid) {
      const err = new Error(aliasValidation.error);
      err.statusCode = 400;
      throw err;
    }

    const exists = await urlRepo.shortCodeExists(customAlias);
    if (exists) {
      const err = new Error(`Custom alias '${customAlias}' is already taken`);
      err.statusCode = 409;
      throw err;
    }

    shortCode = customAlias;
  } else {
    // 3b. Random short code with collision detection
    let created = false;
    for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
      const candidate = generateShortCodeForAttempt(attempt);
      const exists = await urlRepo.shortCodeExists(candidate);

      if (!exists) {
        shortCode = candidate;
        created = true;
        break;
      }

      logger.warn('Short code collision, retrying', { attempt, candidate });
    }

    if (!created) {
      const err = new Error('Failed to generate a unique short code after multiple attempts');
      err.statusCode = 500;
      throw err;
    }
  }

  // 4. Persist to database
  const record = await urlRepo.createUrl({
    shortCode,
    originalUrl: resolvedUrl,
    title,
    expiresAt,
  });

  // 5. Prime the cache so first redirect is fast
  const cacheTtl = Math.max(
    1,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  );
  await redis.set(shortCode, resolvedUrl, Math.min(cacheTtl, config.redis.ttl));

  logger.info('Short URL created', { shortCode, originalUrl: resolvedUrl });

  return {
    shortCode,
    shortUrl: `${config.app.baseUrl}/${shortCode}`,
    record,
  };
}

/**
 * Resolve a short code to the original URL.
 * Uses a cache-aside strategy: Redis → PostgreSQL → cache miss handling.
 *
 * @param {string} shortCode
 * @returns {Promise<{ originalUrl: string, urlId: number, fromCache: boolean }>}
 */
async function resolveShortCode(shortCode) {
  // 1. Check Redis cache first (hot path)
  const cached = await redis.get(shortCode);
  if (cached) {
    logger.debug('Cache hit', { shortCode });
    return { originalUrl: cached, fromCache: true };
  }

  // 2. Cache miss — query PostgreSQL
  logger.debug('Cache miss, querying DB', { shortCode });
  const record = await urlRepo.findByShortCode(shortCode);

  if (!record) {
    const err = new Error('Short URL not found or has expired');
    err.statusCode = 404;
    throw err;
  }

  // 3. Backfill cache
  const now = Date.now();
  const expiresAt = record.expires_at ? new Date(record.expires_at).getTime() : null;
  const remainingTtl = expiresAt
    ? Math.max(1, Math.floor((expiresAt - now) / 1000))
    : config.redis.ttl;

  await redis.set(shortCode, record.original_url, Math.min(remainingTtl, config.redis.ttl));

  return { originalUrl: record.original_url, urlId: record.id, fromCache: false };
}

/**
 * Get full info for a short URL (for the stats/details endpoint).
 *
 * @param {string} shortCode
 * @returns {Promise<Object>}
 */
async function getUrlInfo(shortCode) {
  const record = await urlRepo.findByShortCodeFull(shortCode);
  if (!record) {
    const err = new Error('Short URL not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    ...record,
    shortUrl: `${config.app.baseUrl}/${record.short_code}`,
    isExpired: record.expires_at ? new Date(record.expires_at) < new Date() : false,
  };
}

/**
 * List all URLs (paginated).
 */
async function listUrls(page = 1, limit = 20) {
  const safePage = Math.max(1, parseInt(page, 10));
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (safePage - 1) * safeLimit;

  const { rows, total } = await urlRepo.findAll(safeLimit, offset);

  return {
    data: rows.map((r) => ({ ...r, shortUrl: `${config.app.baseUrl}/${r.short_code}` })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

/**
 * Deactivate (soft-delete) a short URL and invalidate its cache entry.
 *
 * @param {string} shortCode
 */
async function deactivateUrl(shortCode) {
  const record = await urlRepo.deactivateUrl(shortCode);
  if (!record) {
    const err = new Error('Short URL not found');
    err.statusCode = 404;
    throw err;
  }

  // Invalidate cache
  await redis.del(shortCode);

  logger.info('Short URL deactivated', { shortCode });
  return record;
}

module.exports = {
  createShortUrl,
  resolveShortCode,
  getUrlInfo,
  listUrls,
  deactivateUrl,
};
