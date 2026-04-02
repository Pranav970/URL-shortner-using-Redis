const logger = require('../utils/logger');
const config = require('../config');

/**
 * 404 handler — catches requests that didn't match any route.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
}

/**
 * Global error handler.
 * Normalises errors to a consistent JSON response shape.
 * Hides internal details in production.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const isOperational = statusCode < 500;

  logger.error('Request error', {
    method: req.method,
    path: req.path,
    statusCode,
    message: err.message,
    stack: isOperational ? undefined : err.stack,
  });

  // Handle PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists',
    });
  }

  // Handle PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Invalid reference to a related resource',
    });
  }

  const response = {
    success: false,
    message: isOperational ? err.message : 'An unexpected error occurred',
  };

  // Include stack trace in development
  if (config.app.nodeEnv === 'development' && !isOperational) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = { notFoundHandler, errorHandler };
