const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient } = require('../config/redis');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * General API rate limiter.
 * Applies to all /api/* routes.
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: 'draft-7', // RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  skip: () => config.app.nodeEnv === 'test',
  store: new RedisStore({
    sendCommand: (...args) => getRedisClient().call(...args),
    prefix: 'rl:api:',
  }),
  handler: (req, res, next, options) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      limit: options.max,
    });
    res.status(429).json(options.message);
  },
});

/**
 * Redirect rate limiter — slightly more generous since redirects are read-heavy.
 */
const redirectLimiter = rateLimit({
  windowMs: config.rateLimit.redirectWindowMs,
  max: config.rateLimit.redirectMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many redirect requests, please slow down.',
  },
  skip: () => config.app.nodeEnv === 'test',
  store: new RedisStore({
    sendCommand: (...args) => getRedisClient().call(...args),
    prefix: 'rl:redirect:',
  }),
  keyGenerator: (req) => req.ip,
});

module.exports = { apiLimiter, redirectLimiter };
