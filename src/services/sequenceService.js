const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Sequence Service
 * Handles atomic generation of daily sequential gate pass numbers.
 * Uses database transactions to ensure concurrency safety.
 */

/**
 * Get the next sequential number for a given date.
 * Uses Prisma interactive transactions for atomicity.
 *
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Promise<number>} The next sequence number
 */
async function getNextSequence(dateStr) {
  const result = await prisma.$transaction(async (tx) => {
    // Try to find existing sequence for this date
    let sequence = await tx.dailySequence.findUnique({
      where: { date: dateStr },
    });

    if (sequence) {
      // Increment the existing sequence atomically
      sequence = await tx.dailySequence.update({
        where: { date: dateStr },
        data: { lastSeq: { increment: 1 } },
      });
    } else {
      // Create a new sequence starting at 1
      sequence = await tx.dailySequence.create({
        data: {
          date: dateStr,
          lastSeq: 1,
        },
      });
    }

    return sequence.lastSeq;
  }, {
    // Serializable isolation level for maximum concurrency safety
    isolationLevel: 'Serializable',
  });

  return result;
}

/**
 * Get the current sequence number for a given date without incrementing.
 * Used for preview/display purposes.
 *
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Promise<number>} The next available sequence number (current + 1)
 */
async function peekNextSequence(dateStr) {
  const sequence = await prisma.dailySequence.findUnique({
    where: { date: dateStr },
  });

  return sequence ? sequence.lastSeq + 1 : 1;
}

module.exports = { getNextSequence, peekNextSequence };
