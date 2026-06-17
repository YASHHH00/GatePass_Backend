const { z } = require('zod');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const gatePassService = require('../services/gatePassService');
const { peekNextSequence } = require('../services/sequenceService');

/**
 * ID Number validation patterns per ID type.
 */
const idPatterns = {
  Aadhaar: /^\d{12}$/,
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  'Driving License': /^[A-Za-z0-9]{10,16}$/,
  'Voter ID': /^[A-Za-z0-9]{10}$/,
  Passport: /^[A-Za-z]{1}\d{7}$/,
};

/**
 * Zod schema for gate pass creation/renewal.
 */
const gatePassSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  phoneNumber: z
    .string()
    .regex(/^\d{10}$/, 'Phone number must be exactly 10 digits.'),
  gender: z.enum(['Male', 'Female', 'Others'], {
    errorMap: () => ({ message: 'Gender must be Male, Female, or Others.' }),
  }),
  fatherName: z.string().min(1, "Father's name is required."),
  profession: z.enum(['Visitor', 'Worker', 'Student'], {
    errorMap: () => ({ message: 'Profession must be Visitor, Worker, or Student.' }),
  }),
  permanentAddress: z.string().min(1, 'Permanent address is required.'),
  stateDistrict: z.string().min(1, 'State & District is required.'),
  circleOffice: z.string().min(1, 'Circle/Office is required.'),
  firmName: z.string().optional().nullable(),
  whomToMeet: z.string().min(1, 'Whom to meet is required.'),
  reason: z.string().min(1, 'Reason is required.'),
  vehicleNumber: z.string().min(1, 'Vehicle number is required.'),
  idType: z.enum(['Aadhaar', 'PAN', 'Driving License', 'Voter ID', 'Passport'], {
    errorMap: () => ({
      message: 'ID type must be one of: Aadhaar, PAN, Driving License, Voter ID, Passport.',
    }),
  }),
  idNumber: z.string().min(1, 'ID number is required.'),
  material: z.string().optional().nullable(),
  validUpto: z.string().min(1, 'Valid upto date is required.'),
});

/**
 * Validate ID number format based on ID type.
 */
function validateIdNumber(idType, idNumber) {
  const pattern = idPatterns[idType];
  if (!pattern) return false;
  return pattern.test(idNumber);
}

/**
 * Validate that validUpto is a future date.
 */
function validateFutureDate(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date >= now;
}

/**
 * POST /api/gate-pass
 * Create a new gate pass.
 */
async function createGatePass(req, res, next) {
  try {
    // Validate form fields
    const parsed = gatePassSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return sendError(res, 'Validation failed.', 400, errors);
    }

    const data = parsed.data;

    // Validate ID number format
    if (!validateIdNumber(data.idType, data.idNumber)) {
      return sendError(res, 'Validation failed.', 400, [
        { field: 'idNumber', message: `Invalid ${data.idType} number format.` },
      ]);
    }

    // Validate validUpto is in the future
    if (!validateFutureDate(data.validUpto)) {
      return sendError(res, 'Validation failed.', 400, [
        { field: 'validUpto', message: 'Valid upto date must be a valid future date.' },
      ]);
    }

    // Validate photo upload
    if (!req.file) {
      return sendError(res, 'Validation failed.', 400, [
        { field: 'photo', message: 'Photo is required.' },
      ]);
    }

    // Store relative path
    const photoPath = req.file.path.replace(/\\/g, '/');

    const gatePass = await gatePassService.createGatePass(data, photoPath);

    return sendSuccess(res, gatePass, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/gate-pass/search?idNumber={idNumber}
 * Search for a gate pass by ID number.
 */
async function searchGatePass(req, res, next) {
  try {
    const { idNumber } = req.query;

    if (!idNumber || idNumber.trim() === '') {
      return sendError(res, 'idNumber query parameter is required.', 400);
    }

    const result = await gatePassService.searchByIdNumber(idNumber.trim());

    if (!result) {
      return sendError(res, 'No records found for the provided ID Number.', 404);
    }

    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/gate-pass/renew
 * Renew an existing gate pass.
 */
async function renewGatePass(req, res, next) {
  try {
    // Validate form fields
    const parsed = gatePassSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return sendError(res, 'Validation failed.', 400, errors);
    }

    const data = parsed.data;

    // originalId is required
    const originalId = parseInt(req.body.originalId, 10);
    if (isNaN(originalId)) {
      return sendError(res, 'Validation failed.', 400, [
        { field: 'originalId', message: 'Original gate pass ID is required and must be a number.' },
      ]);
    }

    // Validate ID number format
    if (!validateIdNumber(data.idType, data.idNumber)) {
      return sendError(res, 'Validation failed.', 400, [
        { field: 'idNumber', message: `Invalid ${data.idType} number format.` },
      ]);
    }

    // Validate validUpto is in the future
    if (!validateFutureDate(data.validUpto)) {
      return sendError(res, 'Validation failed.', 400, [
        { field: 'validUpto', message: 'Valid upto date must be a valid future date.' },
      ]);
    }

    // Handle optional new photo
    let newPhotoPath = null;
    if (req.file) {
      newPhotoPath = req.file.path.replace(/\\/g, '/');
    }

    const newGatePass = await gatePassService.renewGatePass(originalId, data, newPhotoPath);

    return sendSuccess(res, newGatePass, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/gate-pass/sequence?date={YYYY-MM-DD}
 * Get the next available sequence number for a date.
 */
async function getNextSequence(req, res, next) {
  try {
    const { date } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return sendError(res, 'Date query parameter is required in YYYY-MM-DD format.', 400);
    }

    const nextSeq = await peekNextSequence(date);

    return sendSuccess(res, { date, nextSequence: nextSeq });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createGatePass,
  searchGatePass,
  renewGatePass,
  getNextSequence,
};
