/**
 * Date utility functions for the NTPC Gate Pass application.
 * All dates are stored and compared in UTC.
 */

/**
 * Get today's date formatted as YYYY-MM-DD (UTC).
 * @returns {string}
 */
function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Format a Date object to YYYY-MM-DD string (UTC).
 * @param {Date} date
 * @returns {string}
 */
function formatDateString(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate a start date by subtracting a duration from today.
 * @param {string} duration - One of: 1M, 2M, 3M, 6M, 1Y
 * @returns {Date} The calculated start date
 */
function getStartDateFromDuration(duration) {
  const now = new Date();
  const startDate = new Date(now);

  switch (duration) {
    case '1M':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case '2M':
      startDate.setMonth(startDate.getMonth() - 2);
      break;
    case '3M':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case '6M':
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case '1Y':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      throw new Error(`Invalid duration: ${duration}`);
  }

  return startDate;
}

/**
 * Generate a human-readable string describing the difference between two dates.
 * @param {Date} from - The actual start date
 * @param {Date} to - The end date (usually today)
 * @returns {string} e.g., "2 months and 7 days"
 */
function getHumanReadableDuration(from, to) {
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();

  if (days < 0) {
    months -= 1;
    // Get last day of previous month
    const prevMonth = new Date(to.getFullYear(), to.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(' and ') : '0 days';
}

module.exports = {
  getTodayDateString,
  formatDateString,
  getStartDateFromDuration,
  getHumanReadableDuration,
};
