const urlService = require('../services/url.service');
const analyticsService = require('../services/analytics.service');
const logger = require('../utils/logger');

/**
 * POST /api/urls
 * Create a new short URL.
 */
async function createUrl(req, res, next) {
  try {
    const { originalUrl, customAlias, expiresInDays, title } = req.body;

    const result = await urlService.createShortUrl({
      originalUrl,
      customAlias,
      expiresInDays,
      title,
    });

    return res.status(201).json({
      success: true,
      data: {
        shortCode: result.shortCode,
        shortUrl: result.shortUrl,
        originalUrl: result.record.original_url,
        title: result.record.title,
        expiresAt: result.record.expires_at,
        createdAt: result.record.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /:shortCode
 * Redirect to the original URL (hot path — must be fast).
 */
async function redirectUrl(req, res, next) {
  try {
    const { shortCode } = req.params;

    const { originalUrl, urlId, fromCache } = await urlService.resolveShortCode(shortCode);

    // Track click asynchronously (non-blocking)
    if (urlId) {
      analyticsService.recordClick({
        urlId,
        shortCode,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
      });
    }

    // 301 = permanent (browser caches) | 302 = temporary (always hits server)
    // We use 302 so analytics always runs and expiry works correctly
    res.setHeader('X-Cache', fromCache ? 'HIT' : 'MISS');
    return res.redirect(302, originalUrl);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/urls
 * List all short URLs (paginated).
 */
async function listUrls(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await urlService.listUrls(page, limit);

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/urls/:shortCode
 * Get metadata for a specific short URL.
 */
async function getUrlInfo(req, res, next) {
  try {
    const { shortCode } = req.params;
    const info = await urlService.getUrlInfo(shortCode);

    return res.json({
      success: true,
      data: info,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/urls/:shortCode
 * Deactivate (soft-delete) a short URL.
 */
async function deleteUrl(req, res, next) {
  try {
    const { shortCode } = req.params;
    await urlService.deactivateUrl(shortCode);

    return res.json({
      success: true,
      message: `Short URL '${shortCode}' has been deactivated`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/:shortCode
 * Get click analytics for a short URL.
 */
async function getAnalytics(req, res, next) {
  try {
    const { shortCode } = req.params;
    const analytics = await analyticsService.getUrlAnalytics(shortCode);

    return res.json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics
 * Get system-wide analytics summary.
 */
async function getSystemAnalytics(req, res, next) {
  try {
    const stats = await analyticsService.getSystemAnalytics();
    return res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createUrl,
  redirectUrl,
  listUrls,
  getUrlInfo,
  deleteUrl,
  getAnalytics,
  getSystemAnalytics,
};
