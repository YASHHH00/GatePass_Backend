const express = require('express');
const { getStatus } = require('../controllers/licenseController');

const router = express.Router();

/**
 * GET /api/license/status
 * Check license status — no authentication required.
 */
router.get('/status', getStatus);

module.exports = router;
