const { sendSuccess } = require('../utils/responseHelper');
const licenseService = require('../services/licenseService');

/**
 * GET /api/license/status
 * Check the license status. No authentication required.
 */
async function getStatus(req, res, next) {
  try {
    const status = await licenseService.checkLicenseStatus();
    return sendSuccess(res, status);
  } catch (err) {
    next(err);
  }
}

module.exports = { getStatus };
