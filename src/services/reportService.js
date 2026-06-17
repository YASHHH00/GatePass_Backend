const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { getStartDateFromDuration, getHumanReadableDuration, formatDateString } = require('../utils/dateUtils');

const prisma = new PrismaClient();

/**
 * Report Service
 * Handles querying gate pass data for reports and generating Excel/PDF exports.
 */

/**
 * Fetch report data based on profession and duration.
 *
 * @param {string} profession - Visitor | Worker | Student
 * @param {string} duration - 1M | 2M | 3M | 6M | 1Y
 * @returns {Promise<object>} Report data with records and metadata
 */
async function getReportData(profession, duration) {
  const startDate = getStartDateFromDuration(duration);
  const now = new Date();

  const records = await prisma.gatePass.findMany({
    where: {
      profession,
      dateOfIssue: { gte: startDate },
      isLatest: true,
    },
    orderBy: { dateOfIssue: 'desc' },
  });

  const totalCount = records.length;

  // Determine actual data range
  let actualFrom = startDate;
  let isPartialData = false;
  let partialDataMessage = null;

  if (totalCount > 0) {
    // Find the earliest record
    const earliestRecord = records[records.length - 1];
    actualFrom = earliestRecord.dateOfIssue;

    if (actualFrom > startDate) {
      isPartialData = true;
      const durationStr = getHumanReadableDuration(actualFrom, now);
      partialDataMessage = `Only ${durationStr} of data is available. Report generated for all available records up to today.`;
    }
  } else {
    // No records found - try to get all available data
    const allRecords = await prisma.gatePass.findMany({
      where: {
        profession,
        isLatest: true,
      },
      orderBy: { dateOfIssue: 'desc' },
    });

    if (allRecords.length > 0) {
      const earliestRecord = allRecords[allRecords.length - 1];
      actualFrom = earliestRecord.dateOfIssue;
      isPartialData = true;
      const durationStr = getHumanReadableDuration(actualFrom, now);
      partialDataMessage = `No data found for the requested duration. Returning all available data (${durationStr}).`;

      return {
        records: allRecords,
        totalCount: allRecords.length,
        requestedFrom: formatDateString(startDate),
        actualFrom: formatDateString(actualFrom),
        isPartialData,
        partialDataMessage,
      };
    }
  }

  return {
    records,
    totalCount,
    requestedFrom: formatDateString(startDate),
    actualFrom: formatDateString(actualFrom),
    isPartialData,
    partialDataMessage,
  };
}

/**
 * Generate an Excel workbook from report data.
 *
 * @param {Array} records - Array of gate pass records
 * @param {string} profession - Report category
 * @returns {ExcelJS.Workbook} The generated workbook
 */
function generateExcelReport(records, profession) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NTPC Gate Pass System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(`${profession} Report`);

  // Define columns
  worksheet.columns = [
    { header: 'Gate Pass Number', key: 'gatePassNumber', width: 20 },
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Phone', key: 'phoneNumber', width: 15 },
    { header: 'Gender', key: 'gender', width: 10 },
    { header: 'Father Name', key: 'fatherName', width: 20 },
    { header: 'Profession', key: 'profession', width: 12 },
    { header: 'Address', key: 'permanentAddress', width: 30 },
    { header: 'State & District', key: 'stateDistrict', width: 20 },
    { header: 'Circle/Office', key: 'circleOffice', width: 15 },
    { header: 'Firm Name', key: 'firmName', width: 20 },
    { header: 'Whom To Meet', key: 'whomToMeet', width: 20 },
    { header: 'Reason', key: 'reason', width: 25 },
    { header: 'Vehicle Number', key: 'vehicleNumber', width: 15 },
    { header: 'ID Type', key: 'idType', width: 15 },
    { header: 'ID Number', key: 'idNumber', width: 20 },
    { header: 'Material', key: 'material', width: 20 },
    { header: 'Date of Issue', key: 'dateOfIssue', width: 18 },
    { header: 'Valid Upto', key: 'validUpto', width: 18 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2E4057' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 25;

  // Add data rows
  records.forEach((record) => {
    worksheet.addRow({
      ...record,
      dateOfIssue: record.dateOfIssue ? new Date(record.dateOfIssue).toISOString().split('T')[0] : '',
      validUpto: record.validUpto ? new Date(record.validUpto).toISOString().split('T')[0] : '',
      firmName: record.firmName || '',
      material: record.material || '',
    });
  });

  // Auto-filter on header row
  worksheet.autoFilter = {
    from: 'A1',
    to: `R${records.length + 1}`,
  };

  return workbook;
}

/**
 * Generate a PDF document from report data.
 *
 * @param {Array} records - Array of gate pass records
 * @param {string} profession - Report category
 * @param {string} duration - Duration label
 * @returns {PDFDocument} The PDF document (stream)
 */
function generatePdfReport(records, profession, duration) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    bufferPages: true,
  });

  // --- Cover Page ---
  doc.fontSize(28).font('Helvetica-Bold').text('NTPC Gate Pass Report', {
    align: 'center',
  });
  doc.moveDown(2);

  doc.fontSize(18).font('Helvetica').text(`Category: ${profession}`, {
    align: 'center',
  });
  doc.moveDown(0.5);

  const durationLabels = {
    '1M': '1 Month',
    '2M': '2 Months',
    '3M': '3 Months',
    '6M': '6 Months',
    '1Y': '1 Year',
  };
  doc.fontSize(14).text(`Duration: ${durationLabels[duration] || duration}`, {
    align: 'center',
  });
  doc.moveDown(0.5);

  doc.fontSize(14).text(`Generated: ${new Date().toISOString().split('T')[0]}`, {
    align: 'center',
  });
  doc.moveDown(0.5);

  doc.fontSize(14).text(`Total Records: ${records.length}`, {
    align: 'center',
  });

  // --- Records ---
  records.forEach((record, index) => {
    doc.addPage();

    // Record header
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(`Record ${index + 1}: ${record.gatePassNumber}`, { underline: true });
    doc.moveDown(0.5);

    // Embed photo if it exists
    const photoFullPath = path.resolve(record.photoPath);
    if (fs.existsSync(photoFullPath)) {
      try {
        doc.image(photoFullPath, {
          width: 100,
          height: 120,
        });
        doc.moveDown(0.5);
      } catch (imgErr) {
        doc.fontSize(10).font('Helvetica').text('[Photo unavailable]');
        doc.moveDown(0.3);
      }
    }

    // Record details
    doc.fontSize(11).font('Helvetica');

    const fields = [
      ['Name', record.name],
      ['Phone Number', record.phoneNumber],
      ['Gender', record.gender],
      ['Father Name', record.fatherName],
      ['Profession', record.profession],
      ['Permanent Address', record.permanentAddress],
      ['State & District', record.stateDistrict],
      ['Circle/Office', record.circleOffice],
      ['Firm Name', record.firmName || 'N/A'],
      ['Whom To Meet', record.whomToMeet],
      ['Reason', record.reason],
      ['Vehicle Number', record.vehicleNumber],
      ['ID Type', record.idType],
      ['ID Number', record.idNumber],
      ['Material', record.material || 'N/A'],
      ['Date of Issue', new Date(record.dateOfIssue).toISOString().split('T')[0]],
      ['Valid Upto', new Date(record.validUpto).toISOString().split('T')[0]],
      ['Version', record.version.toString()],
    ];

    fields.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(value || '');
    });
  });

  return doc;
}

module.exports = {
  getReportData,
  generateExcelReport,
  generatePdfReport,
};
