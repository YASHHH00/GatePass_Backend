const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

/**
 * Generate a JWT token for a user.
 * @param {object} payload - { id, username }
 * @returns {string} Signed JWT token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {object} Decoded payload
 * @throws {JsonWebTokenError|TokenExpiredError}
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { generateToken, verifyToken };
