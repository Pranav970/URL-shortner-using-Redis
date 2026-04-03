'use strict';

const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const db = require('./config/database');
const redis = require('./config/redis');
const { startCleanupJob, stopCleanupJob } = require('./services/cleanup.service');

const PORT = config.app.port;
let server;

async function start() {
  // Verify dependency connections before accepting traffic
  const [dbOk, redisOk] = await Promise.all([
    db.testConnection(),
    redis.testConnection(),
  ]);

  if (!dbOk || !redisOk) {
    logger.error('Startup aborted: one or more dependencies failed health check');
    process.exit(1);
  }

  server = app.listen(PORT, () => {
    logger.info(`URL Shortener running`, {
      port: PORT,
      env: config.app.nodeEnv,
      baseUrl: config.app.baseUrl,
    });
  });

  // Start background jobs
  startCleanupJob();
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  stopCleanupJob();

  // Stop accepting new connections
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await db.closePool();
        await redis.closeConnection();
        logger.info('All connections closed. Exiting cleanly.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', { error: err.message });
        process.exit(1);
      }
    });

    // Force exit after 10 s if graceful close stalls
    setTimeout(() => {
      logger.error('Shutdown timeout exceeded — forcing exit');
      process.exit(1);
    }, 10_000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
  shutdown('unhandledRejection');
});

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
