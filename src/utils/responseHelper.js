/**
 * Standardized API response helpers.
 * Ensures consistent response format across all endpoints.
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {object|string} dataOrMessage - Response data object or success message string
 * @param {number} statusCode - HTTP status code (default: 200)
 */
function sendSuccess(res, dataOrMessage, statusCode = 200) {
  const response = { success: true };

  if (typeof dataOrMessage === 'string') {
    response.message = dataOrMessage;
  } else {
    response.data = dataOrMessage;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Array} errors - Optional array of field-level errors
 */
function sendError(res, message, statusCode = 500, errors = []) {
  const response = {
    success: false,
    message,
  };

  if (errors.length > 0) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
}

module.exports = { sendSuccess, sendError };
