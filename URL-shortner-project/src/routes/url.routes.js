const express = require('express');
const router = express.Router();
const urlController = require('../controllers/url.controller');
const { validateBody } = require('../middleware/validate');
const { createUrlSchema } = require('../utils/urlValidator');
const { apiLimiter } = require('../middleware/rateLimiter');

// POST /api/urls — create short URL
router.post('/', apiLimiter, validateBody(createUrlSchema), urlController.createUrl);

// GET /api/urls — list all URLs (paginated)
router.get('/', apiLimiter, urlController.listUrls);

// GET /api/urls/:shortCode — get URL metadata
router.get('/:shortCode', apiLimiter, urlController.getUrlInfo);

// DELETE /api/urls/:shortCode — deactivate URL
router.delete('/:shortCode', apiLimiter, urlController.deleteUrl);

module.exports = router;
