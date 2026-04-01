const db = require('../config/database');

/**
 * Record a click event for a URL.
 *
 * @param {Object} params
 * @param {number} params.urlId
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @param {string} [params.referer]
 */
async function recordClick({ urlId, ipAddress, userAgent, referer }) {
  await db.query(
    `INSERT INTO clicks (url_id, ip_address, user_agent, referer)
     VALUES ($1, $2, $3, $4)`,
    [urlId, ipAddress || null, userAgent || null, referer || null]
  );
}

/**
 * Get aggregated click stats for a short URL.
 *
 * @param {number} urlId
 * @returns {Promise<Object>}
 */
async function getClickStats(urlId) {
  const [totalResult, recentResult, refererResult] = await Promise.all([
    // Total click count
    db.query('SELECT COUNT(*) AS total FROM clicks WHERE url_id = $1', [urlId]),

    // Clicks over last 7 days (grouped by day)
    db.query(
      `SELECT
         DATE_TRUNC('day', clicked_at) AS day,
         COUNT(*) AS count
       FROM clicks
       WHERE url_id = $1
         AND clicked_at >= NOW() - INTERVAL '7 days'
       GROUP BY day
       ORDER BY day ASC`,
      [urlId]
    ),

    // Top referrers
    db.query(
      `SELECT
         COALESCE(referer, 'Direct') AS referer,
         COUNT(*) AS count
       FROM clicks
       WHERE url_id = $1
       GROUP BY referer
       ORDER BY count DESC
       LIMIT 10`,
      [urlId]
    ),
  ]);

  return {
    totalClicks: parseInt(totalResult.rows[0].total, 10),
    clicksByDay: recentResult.rows.map((r) => ({
      day: r.day,
      count: parseInt(r.count, 10),
    })),
    topReferrers: refererResult.rows.map((r) => ({
      referer: r.referer,
      count: parseInt(r.count, 10),
    })),
  };
}

/**
 * Get overall system-wide analytics.
 *
 * @returns {Promise<Object>}
 */
async function getSystemStats() {
  const result = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM urls) AS total_urls,
       (SELECT COUNT(*) FROM urls WHERE is_active = true) AS active_urls,
       (SELECT COUNT(*) FROM clicks) AS total_clicks,
       (SELECT COUNT(*) FROM clicks WHERE clicked_at >= NOW() - INTERVAL '24 hours') AS clicks_last_24h,
       (SELECT COUNT(*) FROM clicks WHERE clicked_at >= NOW() - INTERVAL '7 days') AS clicks_last_7d`
  );
  return result.rows[0];
}

module.exports = { recordClick, getClickStats, getSystemStats };
