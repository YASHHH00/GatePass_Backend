const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const { getNextSequence } = require('./sequenceService');
const { getTodayDateString, formatDateString } = require('../utils/dateUtils');

const prisma = new PrismaClient();

/**
 * Gate Pass Service
 * Business logic for creating, searching, and renewing gate passes.
 */

/**
 * Generate the gate pass number from components.
 * Format: {Prefix}{YYYY}{MM}{DD}{SeqNum}
 * Prefix is determined by profession: V=Visitor, W=Worker, S=Student
 *
 * @param {string} profession - Visitor | Worker | Student
 * @param {string} dateStr - Date string YYYY-MM-DD
 * @param {number} seqNum - Sequential number for the day
 * @returns {string} Gate pass number
 */
function generateGatePassNumber(profession, dateStr, seqNum) {
  const prefixMap = {
    Visitor: 'V',
    Worker: 'W',
    Student: 'S',
  };

  const prefix = prefixMap[profession] || 'V';
  const [year, month, day] = dateStr.split('-');

  return `${prefix}${year}${month}${day}${seqNum}`;
}

/**
 * Create a new gate pass.
 *
 * @param {object} data - Gate pass form data
 * @param {string} photoPath - Relative path to the uploaded photo
 * @returns {Promise<object>} Created gate pass record
 */
async function createGatePass(data, photoPath) {
  const dateStr = getTodayDateString();
  const seqNum = await getNextSequence(dateStr);
  const gatePassNumber = generateGatePassNumber(data.profession, dateStr, seqNum);

  const gatePass = await prisma.gatePass.create({
    data: {
      gatePassNumber,
      version: 1,
      parentId: null,
      isLatest: true,
      name: data.name,
      phoneNumber: data.phoneNumber,
      gender: data.gender,
      fatherName: data.fatherName,
      profession: data.profession,
      permanentAddress: data.permanentAddress,
      stateDistrict: data.stateDistrict,
      circleOffice: data.circleOffice,
      firmName: data.firmName || null,
      whomToMeet: data.whomToMeet,
      reason: data.reason,
      vehicleNumber: data.vehicleNumber,
      idType: data.idType,
      idNumber: data.idNumber,
      material: data.material || null,
      photoPath,
      validUpto: new Date(data.validUpto),
    },
  });

  return gatePass;
}

/**
 * Search for a gate pass by ID Number.
 * Returns the latest version and version history.
 *
 * @param {string} idNumber - ID proof number to search for
 * @returns {Promise<object|null>} { current, history } or null if not found
 */
async function searchByIdNumber(idNumber) {
  // Find the latest version for this ID number
  const current = await prisma.gatePass.findFirst({
    where: {
      idNumber,
      isLatest: true,
    },
  });

  if (!current) {
    return null;
  }

  // Find all versions related to this gate pass
  // If current is the original (parentId is null), find all with parentId = current.id + the original
  // If current has a parentId, find all with same parentId + the original
  const originalId = current.parentId || current.id;

  const allVersions = await prisma.gatePass.findMany({
    where: {
      OR: [
        { id: originalId },
        { parentId: originalId },
      ],
    },
    select: {
      version: true,
      gatePassNumber: true,
      dateOfIssue: true,
      validUpto: true,
    },
    orderBy: { version: 'asc' },
  });

  return {
    current,
    history: allVersions,
  };
}

/**
 * Renew an existing gate pass.
 *
 * @param {number} originalId - The ID of the original gate pass (first version)
 * @param {object} data - Updated form data
 * @param {string|null} newPhotoPath - New photo path, or null to reuse existing
 * @returns {Promise<object>} The newly created renewal record
 */
async function renewGatePass(originalId, data, newPhotoPath) {
  // Find the original record
  const original = await prisma.gatePass.findUnique({
    where: { id: originalId },
  });

  if (!original) {
    const err = new Error('Original gate pass record not found.');
    err.statusCode = 404;
    throw err;
  }

  // Find the current latest version
  const currentLatest = await prisma.gatePass.findFirst({
    where: {
      OR: [
        { id: originalId, isLatest: true },
        { parentId: originalId, isLatest: true },
      ],
    },
    orderBy: { version: 'desc' },
  });

  if (!currentLatest) {
    const err = new Error('No active version found for this gate pass.');
    err.statusCode = 404;
    throw err;
  }

  const newVersion = currentLatest.version + 1;
  const photoPath = newPhotoPath || currentLatest.photoPath;

  // Generate new gate pass number
  const dateStr = getTodayDateString();
  const seqNum = await getNextSequence(dateStr);
  const gatePassNumber = generateGatePassNumber(
    data.profession || currentLatest.profession,
    dateStr,
    seqNum
  );

  // Use a transaction to ensure atomicity
  const newGatePass = await prisma.$transaction(async (tx) => {
    // Mark the current latest as not latest
    await tx.gatePass.update({
      where: { id: currentLatest.id },
      data: { isLatest: false },
    });

    // Create the new version
    const created = await tx.gatePass.create({
      data: {
        gatePassNumber,
        version: newVersion,
        parentId: originalId,
        isLatest: true,
        name: data.name,
        phoneNumber: data.phoneNumber,
        gender: data.gender,
        fatherName: data.fatherName,
        profession: data.profession,
        permanentAddress: data.permanentAddress,
        stateDistrict: data.stateDistrict,
        circleOffice: data.circleOffice,
        firmName: data.firmName || null,
        whomToMeet: data.whomToMeet,
        reason: data.reason,
        vehicleNumber: data.vehicleNumber,
        idType: data.idType,
        idNumber: data.idNumber,
        material: data.material || null,
        photoPath,
        validUpto: new Date(data.validUpto),
      },
    });

    return created;
  });

  return newGatePass;
}

module.exports = {
  createGatePass,
  searchByIdNumber,
  renewGatePass,
  generateGatePassNumber,
};
