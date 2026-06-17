const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const {
  createGatePass,
  searchGatePass,
  renewGatePass,
  getNextSequence,
} = require('../controllers/gatePassController');

const router = express.Router();

// All gate pass routes require authentication
router.use(authMiddleware);

/**
 * POST /api/gate-pass
 * Create a new gate pass (multipart/form-data with photo)
 */
router.post('/', upload.single('photo'), createGatePass);

/**
 * GET /api/gate-pass/search?idNumber={idNumber}
 * Search for a gate pass by ID number
 */
router.get('/search', searchGatePass);

/**
 * POST /api/gate-pass/renew
 * Renew an existing gate pass (multipart/form-data with optional photo)
 */
router.post('/renew', upload.single('photo'), renewGatePass);

/**
 * GET /api/gate-pass/sequence?date={YYYY-MM-DD}
 * Get next available sequence number for a date
 */
router.get('/sequence', getNextSequence);

module.exports = router;
