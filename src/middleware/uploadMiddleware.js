const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

/**
 * Multer disk storage configuration.
 * Generates unique, unpredictable filenames using timestamp + random bytes.
 */
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `photo-${uniqueSuffix}${ext}`);
  },
});

/**
 * File filter: only accept JPEG and PNG images.
 */
function fileFilter(_req, file, cb) {
  const allowedMimes = ['image/jpeg', 'image/png'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG and PNG images are allowed.'), false);
  }
}

/**
 * Configured multer instance.
 * - Stores files to UPLOAD_DIR
 * - Accepts only JPEG/PNG
 * - Limits file size to 2MB
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});

module.exports = upload;
