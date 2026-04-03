const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const requestLogger = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health.routes');
const urlRoutes = require('./routes/url.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const redirectRoutes = require('./routes/redirect.routes');

const app = express();

// Security headers
app.use(helmet({ crossOriginEmbedderPolicy: false }));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Compression + body parsing
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// HTTP request logging
app.use(requestLogger);

// Trust proxy (correct req.ip behind Docker/nginx)
app.set('trust proxy', 1);

// Routes
app.use('/health',         healthRoutes);
app.use('/api/urls',       urlRoutes);
app.use('/api/analytics',  analyticsRoutes);
app.use('/',               redirectRoutes);  // catch-all LAST

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
