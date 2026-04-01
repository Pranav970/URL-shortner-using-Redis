const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Insert a new short URL record.
 *
 * @param {Object} params
 * @param {string} params.shortCode
 * @param {string} params.originalUrl
 * @param {string} [params.title]
 * @param {Date|null} [params.expiresAt]
 * @returns {Promise<Object>} Created URL record
 */
async function createUrl({ shortCode, originalUrl, title, expiresAt }) {
  const result = await db.query(
    `INSERT INTO urls (short_code, original_url, title, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [shortCode, originalUrl, title || null, expiresAt || null]
  );
  return result.rows[0];
}

/**
 * Find a URL record by short code.
 * Returns null if not found or if expired/inactive.
 *
 * @param {string} shortCode
 * @param {boolean} [includeInactive=false] - include soft-deleted or inactive records
 * @returns {Promise<Object|null>}
 */
async function findByShortCode(shortCode, includeInactive = false) {
  const whereClause = includeInactive
    ? 'WHERE short_code = $1'
    : 'WHERE short_code = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())';

  const result = await db.query(
    `SELECT * FROM urls ${whereClause}`,
    [shortCode]
  );
  return result.rows[0] || null;
}

/**
 * Check whether a short code already exists (regardless of active/expired state).
 * Used during collision detection.
 */
async function shortCodeExists(shortCode) {
  const result = await db.query(
    'SELECT 1 FROM urls WHERE short_code = $1 LIMIT 1',
    [shortCode]
  );
  return result.rowCount > 0;
}

/**
 * Find all URLs (paginated), most recent first.
 *
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<{ rows: Object[], total: number }>}
 */
async function findAll(limit = 20, offset = 0) {
  const [dataResult, countResult] = await Promise.all([
    db.query(
      `SELECT id, short_code, original_url, title, click_count, expires_at, is_active, created_at
       FROM urls
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    db.query('SELECT COUNT(*) AS total FROM urls'),
  ]);

  return {
    rows: dataResult.rows,
    total: parseInt(countResult.rows[0].total, 10),
  };
}

/**
 * Atomically increment the click count for a URL.
 *
 * @param {number} urlId
 * @returns {Promise<void>}
 */
async function incrementClickCount(urlId) {
  await db.query(
    'UPDATE urls SET click_count = click_count + 1, updated_at = NOW() WHERE id = $1',
    [urlId]
  );
}

/**
 * Soft-delete a URL by short code (sets is_active = false).
 *
 * @param {string} shortCode
 * @returns {Promise<Object|null>}
 */
async function deactivateUrl(shortCode) {
  const result = await db.query(
    `UPDATE urls SET is_active = false, updated_at = NOW()
     WHERE short_code = $1
     RETURNING *`,
    [shortCode]
  );
  return result.rows[0] || null;
}

/**
 * Permanently delete expired/inactive URLs older than a given date.
 * Used by the background cleanup job.
 *
 * @param {Date} olderThan
 * @returns {Promise<number>} Number of deleted rows
 */
async function deleteExpiredUrls(olderThan) {
  const result = await db.query(
    `DELETE FROM urls
     WHERE (expires_at IS NOT NULL AND expires_at < $1)
        OR (is_active = false AND updated_at < $1)`,
    [olderThan]
  );
  const count = result.rowCount;
  if (count > 0) {
    logger.info(`Cleanup: deleted ${count} expired/inactive URLs`);
  }
  return count;
}

/**
 * Get a URL with full stats by short code (including inactive / expired).
 */
async function findByShortCodeFull(shortCode) {
  const result = await db.query(
    `SELECT u.*,
       (SELECT COUNT(*) FROM clicks WHERE url_id = u.id) AS total_clicks_db
     FROM urls u
     WHERE u.short_code = $1`,
    [shortCode]
  );
  return result.rows[0] || null;
}

module.exports = {
  createUrl,
  findByShortCode,
  shortCodeExists,
  findAll,
  incrementClickCount,
  deactivateUrl,
  deleteExpiredUrls,
  findByShortCodeFull,
};
