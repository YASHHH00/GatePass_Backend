const { verifyToken } = require('../utils/jwtUtils');
const { sendError } = require('../utils/responseHelper');

/**
 * JWT Authentication Middleware.
 * Extracts and verifies Bearer token from Authorization header.
 * Attaches decoded user payload to req.user on success.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Authentication required. No token provided.', 401);
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return sendError(res, 'Authentication required. Token is empty.', 401);
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Token has expired. Please log in again.', 403);
    }
    return sendError(res, 'Invalid token. Authentication failed.', 401);
  }
}

module.exports = authMiddleware;
