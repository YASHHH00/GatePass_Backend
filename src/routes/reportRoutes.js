const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getReport, exportExcel, exportPdf } = require('../controllers/reportController');

const router = express.Router();

// All report routes require authentication
router.use(authMiddleware);

/**
 * GET /api/reports?profession={profession}&duration={duration}
 * Get report data
 */
router.get('/', getReport);

/**
 * GET /api/reports/export/excel?profession={profession}&duration={duration}
 * Export report as Excel
 */
router.get('/export/excel', exportExcel);

/**
 * GET /api/reports/export/pdf?profession={profession}&duration={duration}
 * Export report as PDF
 */
router.get('/export/pdf', exportPdf);

module.exports = router;
