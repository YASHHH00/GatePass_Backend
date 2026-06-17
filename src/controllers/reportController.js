const { z } = require('zod');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const reportService = require('../services/reportService');
const { formatDateString } = require('../utils/dateUtils');

// Validation schema for report query parameters
const reportQuerySchema = z.object({
  profession: z.enum(['Visitor', 'Worker', 'Student'], {
    errorMap: () => ({ message: 'Profession must be Visitor, Worker, or Student.' }),
  }),
  duration: z.enum(['1M', '2M', '3M', '6M', '1Y'], {
    errorMap: () => ({ message: 'Duration must be one of: 1M, 2M, 3M, 6M, 1Y.' }),
  }),
});

/**
 * GET /api/reports
 * Fetch report data.
 */
async function getReport(req, res, next) {
  try {
    const parsed = reportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return sendError(res, 'Validation failed.', 400, errors);
    }

    const { profession, duration } = parsed.data;
    const reportData = await reportService.getReportData(profession, duration);

    return sendSuccess(res, reportData);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reports/export/excel
 * Generate and stream an Excel report.
 */
async function exportExcel(req, res, next) {
  try {
    const parsed = reportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return sendError(res, 'Validation failed.', 400, errors);
    }

    const { profession, duration } = parsed.data;
    const reportData = await reportService.getReportData(profession, duration);

    if (reportData.totalCount === 0) {
      return sendError(res, 'No data available to export.', 404);
    }

    const workbook = reportService.generateExcelReport(reportData.records, profession);
    const today = formatDateString(new Date());
    const filename = `${profession}_Report_${today}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reports/export/pdf
 * Generate and stream a PDF report.
 */
async function exportPdf(req, res, next) {
  try {
    const parsed = reportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return sendError(res, 'Validation failed.', 400, errors);
    }

    const { profession, duration } = parsed.data;
    const reportData = await reportService.getReportData(profession, duration);

    if (reportData.totalCount === 0) {
      return sendError(res, 'No data available to export.', 404);
    }

    const doc = reportService.generatePdfReport(reportData.records, profession, duration);
    const today = formatDateString(new Date());
    const filename = `${profession}_Report_${today}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);
    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { getReport, exportExcel, exportPdf };
