const morgan = require('morgan');
const logger = require('../utils/logger');

// Stream morgan output through winston
const stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Skip health check noise in logs
const skip = (req) => {
  return req.path === '/health' || req.path === '/api/health';
};

const requestLogger = morgan(
  ':remote-addr :method :url :status :res[content-length] - :response-time ms',
  { stream, skip }
);

module.exports = requestLogger;
