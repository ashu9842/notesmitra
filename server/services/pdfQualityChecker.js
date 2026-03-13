import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { createRequire } from 'module';
import logger from '../utils/logger.js';

const require = createRequire(import.meta.url);
const pdfParseLib = require('pdf-parse');
const parsePDF = async (pdfBuffer) => {
  if (typeof pdfParseLib === 'function') {
    return pdfParseLib(pdfBuffer);
  }

  if (typeof pdfParseLib?.default === 'function') {
    return pdfParseLib.default(pdfBuffer);
  }

  if (typeof pdfParseLib?.PDFParse === 'function') {
    const parser = new pdfParseLib.PDFParse({ data: pdfBuffer });
    try {
      return await parser.getText();
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  throw new Error('pdf-parse parser function is unavailable');
};

/**
 * Advanced PDF Quality Checker Service
 * Checks for copyright, blank pages, low quality scans, etc.
 */

// Copyright keywords to detect
const COPYRIGHT_KEYWORDS = [
  'copyright ©',
  'all rights reserved',
  '© copyright',
  'copyrighted material',
  'reproduction prohibited',
  'unauthorized copying',
  'intellectual property',
  'proprietary material',
  'do not copy',
  'no part of this publication may be reproduced',
  'without written permission',
  'pirated copy',
  'illegal copy',
  // University / institution branding
  'lecture notes by dr.',
  'prepared by prof.',
  'department of ',
  'school of engineering',
  'faculty of ',
  'mit opencourseware',
  'nptel',
  'course material ©',
  'examination board',
  'question paper',
  // Other platform watermarks
  'downloaded from',
  'courtesy of',
  'physics wallah',
  'pw skills',
  'unacademy',
  'byjus',
  'byju\'s',
  'vedantu',
  'toppr',
  'testbook',
  'gradeup',
  'coursera',
  'udemy',
  'edx',
  'khan academy',
];

// Textbook publisher patterns
const PUBLISHER_PATTERNS = [
  'pearson',
  'mcgraw-hill',
  'wiley',
  'elsevier',
  'springer',
  'oxford university press',
  'cambridge university press',
  'cengage',
  'routledge',
  'taylor & francis',
  'sage publications',
  'mit press',
  'packt publishing',
  "o'reilly",
  'apress',
  'hmh',
  'scholastic',
  'isbn'
];

// University / institution name patterns (regex-based)
const UNIVERSITY_PATTERNS = [
  /\buniversity of \w+/i,
  /\w+ university\b/i,
  /\binstitute of technology\b/i,
  /\biit[\s-]?\w*/i,
  /\bnit[\s-]?\w*/i,
  /\bvtu\b/i,
  /\banna university\b/i,
  /\bcbse\b/i,
  /\bicse\b/i,
  /\bjee\s+(main|advanced)/i,
  /\bneet\b(?!\w)/i,
  /\bgate\s+\d{4}/i,
  /\bupsc\b/i,
  /\bboard of \w+/i,
  // College / autonomous institution patterns
  /\w+\s+engineering\s+college/i,       // "Dhanalakshmi Srinivasan Engineering College"
  /college of engineering/i,
  /\(autonomous\)/i,                     // "(AUTONOMOUS)" stamp
  /autonomous\s+institution/i,
  /affiliated to \w+/i,                  // "Affiliated to Anna University"
  /accredited by (naac|nba|aicte)/i,    // "Accredited by NAAC"
  /approved by aicte/i,
  /\bpolytechnic\s+college\b/i,
  /\barts\s+and\s+science\s+college\b/i,
];

// Other education platform watermarks
const PLATFORM_PATTERNS = [
  'physics wallah',
  'pw skills',
  'unacademy',
  'byjus',
  "byju's",
  'vedantu',
  'toppr',
  'testbook',
  'gradeup',
  'coursera',
  'udemy',
  'edx',
  'khan academy',
  'mit opencourseware',
  'nptel',
];

// Professor/instructor credit patterns
const PROFESSOR_PATTERNS = [
  /\b(?:prof(?:essor)?|dr)\.?\s+[a-z]+(?:\s+[a-z]+){0,2}\b/i,
  /\b(?:lecture notes|notes)\s+by\s+(?:prof(?:essor)?|dr)\.?\s+[a-z]+(?:\s+[a-z]+){0,2}\b/i,
  /\bprepared by\s+(?:prof(?:essor)?|dr)\.?\s+[a-z]+(?:\s+[a-z]+){0,2}\b/i,
  /\b(?:course material|slides)\s+by\s+(?:prof(?:essor)?|dr)\.?\s+[a-z]+(?:\s+[a-z]+){0,2}\b/i,
];

// Book title / source indicators (high-confidence ownership cues)
const BOOK_SOURCE_PATTERNS = [
  /\b(?:chapter|ch\.)\s*\d+\s*[:\-]\s*[a-z0-9][a-z0-9\s,&'().-]{5,}/i,
  /\b\d+(?:st|nd|rd|th)\s+edition\b/i,
  /\b(?:revised|international)\s+edition\b/i,
  /\bisbn(?:-1[03])?\s*[:\-]?\s*[0-9x\-]{10,20}\b/i,
  /\bby\s+[a-z]+(?:\s+[a-z]+){1,3}\s*(?:press|publisher|edition)\b/i,
];

// Institution logo / emblem / seal indicators in extracted text
const INSTITUTION_LOGO_PATTERNS = [
  /\bofficial\s+(?:logo|emblem|seal|crest)\b/i,
  /\b(?:logo|emblem|seal|crest)\s+of\s+[a-z0-9\s,&'().-]*(?:university|college|institute|school)\b/i,
  /\b(?:university|college|institute)\s+(?:logo|emblem|seal|crest)\b/i,
];

/**
 * Load PDF buffer from file path or cloudinary
 */
const loadPDFBuffer = async (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error('PDF file not found');
  }
  return fs.readFileSync(filePath);
};

/**
 * Check for copyright content in PDF
 */
export const checkCopyright = async (pdfBuffer) => {
  try {
    const data = await parsePDF(pdfBuffer);
    const text = (data.text || '').toLowerCase();

    // Check for copyright keywords
    const foundKeywords = COPYRIGHT_KEYWORDS.filter(keyword =>
      text.includes(keyword.toLowerCase())
    );

    // Check for publisher names
    const foundPublishers = PUBLISHER_PATTERNS.filter(publisher =>
      text.includes(publisher.toLowerCase())
    );

    // Check for university / institution patterns
    const foundUniversity = UNIVERSITY_PATTERNS.filter(re => re.test(text));

    // Check for other platform watermarks
    const foundPlatforms = PLATFORM_PATTERNS.filter(p =>
      text.includes(p.toLowerCase())
    );

    // Check for professor/instructor name credits
    const foundProfessorPatterns = PROFESSOR_PATTERNS.filter(re => re.test(text));

    // Check for named book/textbook ownership indicators
    const foundBookSources = BOOK_SOURCE_PATTERNS.filter(re => re.test(text));

    // Check for institution logo/emblem text markers
    const foundInstitutionLogo = INSTITUTION_LOGO_PATTERNS.filter(re => re.test(text));

    const hasCopyright = foundKeywords.length > 0;
    const hasPublisher = foundPublishers.length > 0;
    const hasUniversity = foundUniversity.length > 0;
    const hasPlatform = foundPlatforms.length > 0;
    const hasProfessorName = foundProfessorPatterns.length > 0;
    const hasInstitutionLogo = foundInstitutionLogo.length > 0;
    const hasEditionMarker = /\b\d{1,2}(?:st|nd|rd|th)\s+ed(?:ition)?\b/i.test(text) || /\bedition\b/i.test(text);
    const hasIsbnMarker = /\bisbn\b/i.test(text);
    const hasBookContext =
      /\b(?:textbook|book|author|chapter)\b/i.test(text) ||
      /\bby\s+[a-z]+(?:\s+[a-z]+){1,3}\b/i.test(text);
    const hasBookSource =
      foundBookSources.length > 0 ||
      (hasBookContext && (hasIsbnMarker || hasEditionMarker || hasPublisher)) ||
      (hasIsbnMarker && (hasEditionMarker || hasPublisher));

    const failed =
      hasCopyright ||
      hasPublisher ||
      hasUniversity ||
      hasPlatform ||
      hasProfessorName ||
      hasInstitutionLogo ||
      hasBookSource;

    const reasonParts = [];
    if (hasInstitutionLogo) reasonParts.push('institution logo/emblem markers');
    if (hasUniversity) reasonParts.push('college/university name');
    if (hasProfessorName) reasonParts.push('professor/instructor name');
    if (hasBookSource) reasonParts.push('book/textbook source markers');
    if (hasPublisher) reasonParts.push('publisher markers');
    if (hasCopyright) reasonParts.push('copyright phrases');
    if (hasPlatform) reasonParts.push('external platform watermark');

    return {
      passed: !failed,
      failReason: failed ? `Detected ${reasonParts.slice(0, 3).join(', ')}` : null,
      hasCopyright,
      hasPublisher,
      hasUniversity,
      hasPlatform,
      hasProfessorName,
      hasBookSource,
      hasInstitutionLogo,
      hasBookContext,
      hasEditionMarker,
      hasIsbnMarker,
      foundKeywords: foundKeywords.slice(0, 3),
      foundPublishers: foundPublishers.slice(0, 2),
      foundPlatforms: foundPlatforms.slice(0, 2),
      foundProfessorPatterns: foundProfessorPatterns.map(re => re.source).slice(0, 2),
      foundBookSources: foundBookSources.map(re => re.source).slice(0, 2),
      foundInstitutionLogo: foundInstitutionLogo.map(re => re.source).slice(0, 2),
      suspicionLevel: failed ? 'high' : 'low'
    };
  } catch (error) {
    logger.error('Copyright check error:', error);
    return {
      passed: true, // Don't block on error
      error: error.message,
      suspicionLevel: 'unknown'
    };
  }
};

/**
 * Check for blank pages in PDF
 */
export const checkBlankPages = async (pdfBuffer) => {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    const data = await parsePDF(pdfBuffer);
    
    // Parse text per page (approximation)
    const text = data.text;
    const totalChars = text.replace(/\s/g, '').length;
    const avgCharsPerPage = totalChars / pageCount;
    
    // If average characters per page is very low, likely has blank pages
    const hasLikelyBlankPages = avgCharsPerPage < 100; // Less than 100 chars per page on average
    
    // Calculate percentage of content
    const contentDensity = Math.min(100, (avgCharsPerPage / 500) * 100); // 500 chars = 100% density
    
    return {
      passed: !hasLikelyBlankPages,
      pageCount,
      avgCharsPerPage: Math.round(avgCharsPerPage),
      contentDensity: Math.round(contentDensity),
      hasLikelyBlankPages,
      warning: hasLikelyBlankPages ? 'PDF may contain blank or near-empty pages' : null
    };
  } catch (error) {
    logger.error('Blank page check error:', error);
    return {
      passed: true, // Don't block on error
      error: error.message
    };
  }
};

/**
 * Check for low quality scan or readability issues
 */
export const checkQuality = async (pdfBuffer) => {
  try {
    const data = await parsePDF(pdfBuffer);
    const text = data.text;
    
    // Check for OCR artifacts and garbled text
    const totalChars = text.length;
    const actualText = text.replace(/[^a-zA-Z0-9]/g, '').length;
    const readabilityRatio = actualText / totalChars;
    
    // Count suspicious characters (OCR artifacts)
    const suspiciousChars = text.match(/[░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀]/g);
    const suspiciousCharCount = suspiciousChars ? suspiciousChars.length : 0;
    
    // Check for excessive special characters (indicator of poor OCR)
    const specialCharRatio = suspiciousCharCount / totalChars;
    
    // Check word separation (spaces between words)
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    
    // Quality determination
    const isLowQuality = 
      readabilityRatio < 0.6 || // Less than 60% alphanumeric
      specialCharRatio > 0.05 || // More than 5% special OCR artifacts
      avgWordLength < 2 || // Words too short (garbled)
      avgWordLength > 15; // Words too long (spaces missing)
    
    const qualityScore = Math.round(
      ((readabilityRatio * 0.5) + 
       ((1 - specialCharRatio) * 0.3) + 
       (Math.min(avgWordLength / 10, 1) * 0.2)) * 100
    );
    
    return {
      passed: !isLowQuality && qualityScore >= 60,
      qualityScore,
      readabilityRatio: Math.round(readabilityRatio * 100),
      suspiciousCharCount,
      avgWordLength: Math.round(avgWordLength * 10) / 10,
      isLowQuality,
      warning: isLowQuality ? 'PDF may be a low quality scan or has readability issues' : null
    };
  } catch (error) {
    logger.error('Quality check error:', error);
    return {
      passed: true, // Don't block on error
      error: error.message,
      qualityScore: 0
    };
  }
};

/**
 * Check PDF metadata for suspicious information
 */
export const checkMetadata = async (pdfBuffer) => {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    const title = pdfDoc.getTitle() || '';
    const author = pdfDoc.getAuthor() || '';
    const creator = pdfDoc.getCreator() || '';
    const producer = pdfDoc.getProducer() || '';
    
    // Check for suspicious metadata
    const suspiciousTerms = ['pirate', 'cracked', 'libgen', 'torrent', 'downloaded'];
    const hasSuspiciousMetadata = suspiciousTerms.some(term =>
      title.toLowerCase().includes(term) ||
      author.toLowerCase().includes(term) ||
      creator.toLowerCase().includes(term)
    );
    
    // Check for publisher in creator/producer
    const hasPublisherInMeta = PUBLISHER_PATTERNS.some(pub =>
      creator.toLowerCase().includes(pub) ||
      producer.toLowerCase().includes(pub)
    );
    
    return {
      passed: !hasSuspiciousMetadata,
      hasSuspiciousMetadata,
      hasPublisherInMeta,
      metadata: {
        title: title.substring(0, 100),
        author: author.substring(0, 50),
        creator: creator.substring(0, 50)
      }
    };
  } catch (error) {
    logger.error('Metadata check error:', error);
    return {
      passed: true, // Don't block on error
      error: error.message
    };
  }
};

/**
 * Detect NotesMitra watermark in a PDF
 * Checks for platform-specific watermark phrases burned in during download.
 * If found, the PDF is a re-upload of a purchased copy and MUST be rejected.
 */
export const checkNotesMitraWatermark = async (pdfBuffer) => {
  try {
    const data = await parsePDF(pdfBuffer);
    const text = data.text.toLowerCase();

    const WATERMARK_SIGNATURES = [
      'notesmitra',
      'licensed copy',
      'redistribution prohibited',
      'licensed to',
      'purchased by',
    ];

    // Flag only if at least 2 signatures are found (avoids false positives)
    const found = WATERMARK_SIGNATURES.filter(sig => text.includes(sig));
    const isWatermarked = found.length >= 2;

    return {
      passed: !isWatermarked,
      isWatermarked,
      foundSignatures: found,
      message: isWatermarked
        ? 'This PDF contains a NotesMitra watermark. Re-uploading purchased notes is not allowed.'
        : null,
    };
  } catch (error) {
    logger.error('Watermark check error:', error);
    return { passed: true, error: error.message }; // Don't block on parse error
  }
};

/**
 * Run all quality checks on a PDF buffer directly (used for Cloudinary files)
 */
export const runAllQualityChecksFromBuffer = async (pdfBuffer) => {
  try {
    // Run all checks in parallel
    const [copyrightResult, blankPagesResult, qualityResult, metadataResult, watermarkResult] = await Promise.all([
      checkCopyright(pdfBuffer),
      checkBlankPages(pdfBuffer),
      checkQuality(pdfBuffer),
      checkMetadata(pdfBuffer),
      checkNotesMitraWatermark(pdfBuffer),
    ]);
    
    // Aggregate results
    const allPassed = 
      copyrightResult.passed &&
      blankPagesResult.passed &&
      qualityResult.passed &&
      metadataResult.passed &&
      watermarkResult.passed;
    
    const warnings = [];
    if (!watermarkResult.passed) warnings.push(watermarkResult.message);
    if (!copyrightResult.passed) warnings.push('Copyright material detected');
    if (!blankPagesResult.passed) warnings.push('Contains blank or empty pages');
    if (!qualityResult.passed) warnings.push('Low quality scan or readability issues');
    if (!metadataResult.passed) warnings.push('Suspicious metadata detected');
    
    const result = {
      success: true,
      allChecksPassed: allPassed,
      warnings,
      checks: {
        watermark: watermarkResult,
        copyright: copyrightResult,
        blankPages: blankPagesResult,
        quality: qualityResult,
        metadata: metadataResult
      },
      summary: {
        copyrightRisk: copyrightResult.suspicionLevel || 'low',
        qualityScore: qualityResult.qualityScore || 0,
        contentDensity: blankPagesResult.contentDensity || 0,
        pageCount: blankPagesResult.pageCount || 0
      }
    };
    
    logger.info('PDF quality checks completed', {
      allPassed,
      warnings: warnings.length,
      copyrightRisk: result.summary.copyrightRisk
    });
    
    return result;
  } catch (error) {
    logger.error('PDF quality check failed', { error: error.message });
    return {
      success: false,
      error: error.message,
      allChecksPassed: false,
      warnings: ['Failed to analyze PDF quality']
    };
  }
};

/**
 * Run all quality checks on a PDF file (wrapper around runAllQualityChecksFromBuffer)
 */
export const runAllQualityChecks = async (filePath) => {
  logger.info('Running advanced PDF quality checks', { filePath });
  const pdfBuffer = await loadPDFBuffer(filePath);
  return runAllQualityChecksFromBuffer(pdfBuffer);
};

export default {
  checkCopyright,
  checkBlankPages,
  checkQuality,
  checkMetadata,
  checkNotesMitraWatermark,
  runAllQualityChecksFromBuffer,
  runAllQualityChecks
};
