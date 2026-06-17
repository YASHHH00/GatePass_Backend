const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const gatePassRoutes = require('./routes/gatePassRoutes');
const reportRoutes = require('./routes/reportRoutes');
const licenseRoutes = require('./routes/licenseRoutes');
const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();

// ---------------------------------------------------------------------------
// Security Middleware
// ---------------------------------------------------------------------------

// Helmet for HTTP security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS — restrict to localhost/Electron origins in production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['http://localhost:5000', 'app://./']
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

// ---------------------------------------------------------------------------
// Body Parsing
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------------------------------------------------------------------------
// Request Logging
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ---------------------------------------------------------------------------
// Static File Serving — Uploaded Photos
// ---------------------------------------------------------------------------

const uploadDir = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use('/uploads', express.static(path.resolve(uploadDir)));

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

app.use('/api/auth', authRoutes);
app.use('/api/gate-pass', gatePassRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/license', licenseRoutes);

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'NTPC Gate Pass API is running.',
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// 404 Handler
// ---------------------------------------------------------------------------

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
  });
});

// ---------------------------------------------------------------------------
// Global Error Handler
// ---------------------------------------------------------------------------

app.use(errorMiddleware);

module.exports = app;
