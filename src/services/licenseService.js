const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

/**
 * License Service
 * Manages license verification with grace period fallback.
 * Uses database LicenseCache as primary store and a JSON file as fallback.
 */

const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL;
const LICENSE_GRACE_PERIOD_DAYS = parseInt(process.env.LICENSE_GRACE_PERIOD_DAYS || '3', 10);
const LICENSE_CACHE_FILE_PATH = process.env.LICENSE_CACHE_FILE_PATH || './license_cache.json';

/**
 * Check the license status.
 * 1. Try to reach the license server
 * 2. If reachable and valid → update cache, return "valid"
 * 3. If unreachable → check grace period from cache
 *
 * @returns {Promise<object>} License status object
 */
async function checkLicenseStatus() {
  try {
    // Attempt to verify with the license server
    const serverResult = await verifyWithServer();

    if (serverResult && serverResult.valid) {
      // License is valid — update cache
      await updateCache({
        status: 'valid',
        lastVerified: new Date(),
        graceStartedAt: null,
        expiresAt: serverResult.expiresAt ? new Date(serverResult.expiresAt) : null,
      });

      return { status: 'valid' };
    }

    // Server returned invalid license
    return await handleVerificationFailure();
  } catch (err) {
    // Server is unreachable
    console.error('License server unreachable:', err.message);
    return await handleVerificationFailure();
  }
}

/**
 * Attempt to verify the license with the external server.
 * @returns {Promise<object|null>} Server response or null
 */
async function verifyWithServer() {
  if (!LICENSE_SERVER_URL) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const response = await fetch(LICENSE_SERVER_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Handle verification failure — check cache and grace period.
 * @returns {Promise<object>} License status
 */
async function handleVerificationFailure() {
  const cache = await getCache();

  if (!cache) {
    // No cache exists at all
    return { status: 'expired' };
  }

  if (cache.status === 'valid') {
    // First failure — start grace period
    const now = new Date();
    const graceStartedAt = cache.graceStartedAt || now;

    await updateCache({
      status: 'grace',
      lastVerified: cache.lastVerified,
      graceStartedAt,
      expiresAt: cache.expiresAt,
    });

    const daysRemaining = calculateDaysRemaining(graceStartedAt);

    if (daysRemaining > 0) {
      return {
        status: 'grace',
        daysRemaining,
        gracePeriodDays: LICENSE_GRACE_PERIOD_DAYS,
      };
    } else {
      await updateCache({
        status: 'expired',
        lastVerified: cache.lastVerified,
        graceStartedAt,
        expiresAt: cache.expiresAt,
      });
      return { status: 'expired' };
    }
  }

  if (cache.status === 'grace') {
    // Already in grace period — check if still within limits
    const daysRemaining = calculateDaysRemaining(cache.graceStartedAt);

    if (daysRemaining > 0) {
      return {
        status: 'grace',
        daysRemaining,
        gracePeriodDays: LICENSE_GRACE_PERIOD_DAYS,
      };
    } else {
      // Grace period exceeded
      await updateCache({
        status: 'expired',
        lastVerified: cache.lastVerified,
        graceStartedAt: cache.graceStartedAt,
        expiresAt: cache.expiresAt,
      });
      return { status: 'expired' };
    }
  }

  // status is already 'expired'
  return { status: 'expired' };
}

/**
 * Calculate remaining days in the grace period.
 * @param {Date} graceStartedAt
 * @returns {number} Days remaining (0 if expired)
 */
function calculateDaysRemaining(graceStartedAt) {
  if (!graceStartedAt) return 0;

  const now = new Date();
  const start = new Date(graceStartedAt);
  const elapsed = (now - start) / (1000 * 60 * 60 * 24);
  const remaining = LICENSE_GRACE_PERIOD_DAYS - elapsed;

  return Math.max(0, Math.ceil(remaining));
}

/**
 * Get cached license data from database, falling back to JSON file.
 * @returns {Promise<object|null>}
 */
async function getCache() {
  try {
    const dbCache = await prisma.licenseCache.findUnique({
      where: { id: 1 },
    });

    if (dbCache) return dbCache;
  } catch (err) {
    console.error('Database cache read failed, trying file cache:', err.message);
  }

  // Fallback to JSON file
  return readFileCache();
}

/**
 * Update license cache in database and JSON file.
 * @param {object} data - Cache data to update
 */
async function updateCache(data) {
  try {
    await prisma.licenseCache.upsert({
      where: { id: 1 },
      update: {
        status: data.status,
        lastVerified: data.lastVerified,
        graceStartedAt: data.graceStartedAt,
        expiresAt: data.expiresAt,
        gracePeriodDays: LICENSE_GRACE_PERIOD_DAYS,
      },
      create: {
        id: 1,
        status: data.status,
        lastVerified: data.lastVerified,
        graceStartedAt: data.graceStartedAt,
        expiresAt: data.expiresAt,
        gracePeriodDays: LICENSE_GRACE_PERIOD_DAYS,
      },
    });
  } catch (err) {
    console.error('Database cache write failed:', err.message);
  }

  // Also write to file as fallback
  writeFileCache(data);
}

/**
 * Read the JSON file cache.
 * @returns {object|null}
 */
function readFileCache() {
  try {
    const filePath = path.resolve(LICENSE_CACHE_FILE_PATH);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      // Convert date strings back to Date objects
      if (data.lastVerified) data.lastVerified = new Date(data.lastVerified);
      if (data.graceStartedAt) data.graceStartedAt = new Date(data.graceStartedAt);
      if (data.expiresAt) data.expiresAt = new Date(data.expiresAt);
      return data;
    }
  } catch (err) {
    console.error('File cache read failed:', err.message);
  }
  return null;
}

/**
 * Write the JSON file cache.
 * @param {object} data
 */
function writeFileCache(data) {
  try {
    const filePath = path.resolve(LICENSE_CACHE_FILE_PATH);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('File cache write failed:', err.message);
  }
}

module.exports = { checkLicenseStatus };
