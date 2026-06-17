const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { generateToken } = require('../utils/jwtUtils');
const { sendSuccess, sendError } = require('../utils/responseHelper');

const prisma = new PrismaClient();

// Validation schema for login
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.'),
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token.
 */
async function login(req, res, next) {
  try {
    // Validate input
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return sendError(res, 'Validation failed.', 400, errors);
    }

    const { username, password } = parsed.data;

    // Look up user
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return sendError(res, 'Invalid credentials.', 401);
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return sendError(res, 'Invalid credentials.', 401);
    }

    // Generate JWT
    const token = generateToken({ id: user.id, username: user.username });

    return sendSuccess(res, {
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login };
