const express = require('express');
const rateLimit = require('express-rate-limit');
const { login } = require('../controllers/authController');

const router = express.Router();

// Rate limiter for login: max 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/auth/login
 */
router.post('/login', loginLimiter, login);

module.exports = router;
