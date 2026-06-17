const { sendError } = require('../utils/responseHelper');

/**
 * Global error handling middleware.
 * Must be registered after all routes in Express.
 * 4-argument signature is required for Express to recognize it as an error handler.
 */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, _next) {
  // Log error details in development
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  } else {
    // In production, log only the message (no stack traces)
    console.error('❌ Error:', err.message);
  }

  // Handle Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 'File too large. Maximum size is 2MB.', 400);
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return sendError(res, 'Unexpected file field.', 400);
  }

  // Handle Prisma known errors
  if (err.code === 'P2002') {
    const target = err.meta?.target;
    return sendError(res, `Duplicate value for unique field: ${target}`, 409);
  }

  if (err.code === 'P2025') {
    return sendError(res, 'Record not found.', 404);
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendError(res, 'Validation failed.', 400, errors);
  }

  // Default: Internal server error
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error.'
      : err.message || 'Internal server error.';

  return sendError(res, message, statusCode);
}

module.exports = errorMiddleware;
