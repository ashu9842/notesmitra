/**
 * Groq AI-Powered PDF Quality Checker
 *
 * Uses Groq Mixtral to analyse extracted PDF text and evaluate ALL 5 checks:
 *   1. Blank Page Check       – content is too sparse / near-empty
 *   2. Low Quality Scan       – garbled OCR, unreadable text
 *   3. Copyright Check        – contains copyrighted / pirated material
 *   4. Watermark Check        – NotesMitra purchased-copy watermark detected
 *   5. Suspicious Content     – pirated/torrent metadata or suspicious markers
 *
 * Duplicate detection (MongoDB) and page-count validation remain rule-based
 * because they require DB access / simple arithmetic, not content analysis.
 *
 * Falls back to rule-based checkers when:
 *   - GROQ_API_KEY is not set
 *   - Groq returns an unexpected / invalid response
 *   - Any network / API error occurs
 */

import { createRequire } from 'module';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import {
  checkCopyright as ruleBasedCopyright,
  checkBlankPages as ruleBasedBlankPages,
  checkQuality as ruleBasedQuality,
  checkNotesMitraWatermark as ruleBasedWatermark,
  checkMetadata as ruleBasedMetadata,
} from './pdfQualityChecker.js';

const require = createRequire(import.meta.url);
const pdfParseLib = require('pdf-parse');
const resolvePdfParser = () => {
  if (typeof pdfParseLib === 'function') return pdfParseLib;
  if (typeof pdfParseLib?.default === 'function') return pdfParseLib.default;
  throw new Error('pdf-parse parser function is unavailable');
};
const parsePDF = async (buf) => {
  const parser = resolvePdfParser();
  return parser(buf);
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract text from a PDF buffer using pdf-parse.
 * Returns up to `MAX_CHARS` characters to keep the Gemini prompt manageable.
 */
const MAX_CHARS = 12_000;

const extractText = async (pdfBuffer) => {
  const data = await parsePDF(pdfBuffer);
  const text = data.text || '';
  return {
    text: text.slice(0, MAX_CHARS),
    pageCount: data.numpages || 0,
    totalChars: text.replace(/\s/g, '').length,
  };
};

// ─── Gemini AI analysis ──────────────────────────────────────────────────────

/**
 * Build and send the Gemini prompt; parse the structured JSON response.
 *
 * @param {string} extractedText   – Page text from pdf-parse
 * @param {number} pageCount       – Number of pages in the PDF
 * @param {number} totalChars      – Non-whitespace character count
 * @returns {{ blankPage, quality, copyright }}
 */
const analyseWithGroq = async (extractedText, pageCount, totalChars) => {
  const apiKey = config.groqApiKey;
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured');

  // Lazy load Groq SDK to avoid crashes if not available
  let Groq;
  try {
    const groqModule = await import('groq-sdk');
    Groq = groqModule.default;
  } catch (err) {
    logger.error('geminiQualityChecker: Failed to import Groq SDK', { error: err.message });
    throw new Error(`Groq SDK import failed: ${err.message}`);
  }

  const groq = new Groq({ apiKey });
  // Model fallback chain — skip overloaded/rate-limited models automatically
  // Using Groq's current available models
  const MODEL_CHAIN = [
    'llama-3.1-70b-versatile',  // Primary: powerful & fast
    'llama-3.1-8b-instant',     // Fallback: lightweight & quick
  ];

  const avgCharsPerPage = pageCount > 0 ? Math.round(totalChars / pageCount) : 0;

  const prompt = `You are a PDF content quality reviewer for an academic notes marketplace called NotesMitra.

Analyse the following extracted PDF text and respond with ONLY a raw JSON object — no markdown, no code fences, no extra text.

Context:
- Page count: ${pageCount}
- Average non-whitespace characters per page: ${avgCharsPerPage}
- Text sample (first ${MAX_CHARS} chars):
"""
${extractedText}
"""

Evaluate ALL FIVE checks below and return exactly this JSON structure:

{
  "blankPage": {
    "passed": true,
    "failReason": null
  },
  "quality": {
    "passed": true,
    "failReason": null
  },
  "copyright": {
    "passed": true,
    "failReason": null
  },
  "watermark": {
    "passed": true,
    "failReason": null
  },
  "metadata": {
    "passed": true,
    "failReason": null
  }
}

Rules for each check:

1. blankPage — set passed=false when:
   - The document has fewer than 80 non-whitespace characters on average per page, OR
   - The text is mostly whitespace / line-breaks with very little readable content.
   failReason should be a concise explanation (≤ 15 words).

2. quality — set passed=false when:
   - The text contains many garbled characters, OCR artifacts, or junk symbols, OR
   - Words are fused together without spaces making the text unreadable, OR
   - More than 25% of the text is non-readable gibberish.
   failReason should be a concise explanation (≤ 15 words).

3. copyright — set passed=false when ANY of the following are detected:

   A. Commercial publisher material:
      - Publisher names as document source (Pearson, McGraw-Hill, Wiley, Elsevier, Springer, Oxford University Press, Cambridge University Press, Cengage, Routledge, Taylor & Francis, Sage, MIT Press, Packt, O'Reilly, Apress)
      - Phrases: "all rights reserved", "© copyright", "no part of this publication may be reproduced", "unauthorized copying", "ISBN" combined with publisher name

   B. University / institution branding:
      - A university or college name appearing as a document header/footer/watermark (e.g. "MIT OpenCourseWare", "Stanford University", "IIT", "NPTEL", "Harvard University", "NIT", "VTU", "Anna University", or any "University of ..." / "...Institute of Technology" pattern)
      - Official lecture slide branding: "Department of ...", "School of ...", "Faculty of ...", "Course material © ..."
      - Professor/instructor credits: "Prepared by Prof.", "Lecture notes by Dr.", "© [Name], [University]"
      - Autonomous institution stamps: "(AUTONOMOUS)", "Affiliated to ...", "Accredited by NAAC/NBA/AICTE"

   C. Education platform / website watermarks:
      - Coursera, Udemy, edX, Khan Academy, BYJU'S, Unacademy, PW / Physics Wallah, Vedantu, Toppr, Testbook, Gradeup, NPTEL, MIT OCW branding anywhere in the text
      - Watermark phrases: "downloaded from", repeatedly appearing URLs (www., .com, .edu), "visit [site]", "courtesy of"

   D. Official exam / board material:
      - CBSE, ICSE, JEE, NEET, GATE, UPSC official question papers or mark schemes
      - "Board of ...", "Examination board", "Question paper"

   NOTE: Do NOT reject student-created notes that merely reference a textbook in a bibliography or citation, or mention a professor name only in a reference list.
   ALWAYS reject when the document header/footer/cover shows college/university/platform branding.
   failReason should be a concise explanation (≤ 20 words) naming what was detected.

4. watermark — set passed=false when the document contains a NotesMitra purchased-copy watermark:
   - Any phrase such as "notesmitra", "licensed copy", "redistribution prohibited", "licensed to", "purchased by",
     "this document is licensed", or any combination of at least two of these markers appearing in the text.
   - This indicates the seller is re-uploading a paid copy they downloaded from NotesMitra, which is strictly prohibited.
   failReason should be a concise explanation (≤ 15 words) confirming the watermark was found.

5. metadata — set passed=false when the text or document properties reveal suspicious/pirated origin:
   - Words like "pirate", "pirated", "cracked", "libgen", "library genesis", "z-lib", "torrent", "illegal copy",
     "do not distribute", "for personal use only", "warez" appearing in the body text.
   - If the document appears to be a mass-distributed pirated academic resource.
   failReason should be a concise explanation (≤ 15 words).

Respond with the JSON object only.`;


  let raw;
  let lastErr;
  for (const modelName of MODEL_CHAIN) {
    try {
      logger.debug(`geminiQualityChecker: trying model ${modelName}`);
      const result = await groq.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        top_p: 1
      });
      
      // Extract text from Groq response
      let text = result?.choices?.[0]?.message?.content;
      text = typeof text === 'string' ? text.trim() : null;
      
      if (!text) {
        logger.warn(`geminiQualityChecker: ${modelName} returned empty response`);
        throw new Error(`Empty response from ${modelName}`);
      }
      
      raw = text;
      logger.info(`geminiQualityChecker: ${modelName} succeeded`, { responseLength: text.length });
      break; // success
    } catch (err) {
      const errStr = String(err.message || err).toLowerCase();
      const statusCode = err.status || null;
      
      // Check for specific error types
      const isAuthError = errStr.includes('api key') || errStr.includes('unauthorized') || errStr.includes('403') || errStr.includes('401');
      const isRateLimited = errStr.includes('429') || errStr.includes('overloaded') || statusCode === 429;
      const isTimeout = errStr.includes('timeout') || errStr.includes('econnrefused');
      const isInvalidModel = (errStr.includes('404') && errStr.includes('model')) || errStr.includes('not found');
      
      const isRetryable = isRateLimited || isTimeout;
      const isFatal = isAuthError || isInvalidModel;
      
      logger.warn(`geminiQualityChecker: ${modelName} failed (${isRetryable ? 'retryable' : isFatal ? 'fatal-auth' : 'fatal'})`, { 
        error: err.message?.slice?.(0, 200) || String(err),
        status: statusCode,
        errorType: { isAuthError, isRateLimited, isTimeout, isInvalidModel }
      });
      
      lastErr = err;
      if (isFatal) {
        logger.error(`geminiQualityChecker: fatal error, stopping retry chain`, {
          status: statusCode,
          modelName,
          reason: isAuthError ? 'auth-error' : 'invalid-model'
        });
        break;
      }
    }
  }
  if (!raw) throw lastErr || new Error('All Gemini models failed or API key is invalid');

  // Strip optional markdown code fences if the model includes them
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        parsed = JSON.parse(candidate);
      } catch {
        throw new Error(`Gemini returned non-JSON response: ${raw.slice(0, 200)}`);
      }
    } else {
      throw new Error(`Gemini returned non-JSON response: ${raw.slice(0, 200)}`);
    }
  }

  // Validate shape — all 5 checks must be present
  for (const key of ['blankPage', 'quality', 'copyright', 'watermark', 'metadata']) {
    if (typeof parsed[key]?.passed !== 'boolean') {
      throw new Error(`Gemini response missing or invalid field: ${key}`);
    }
  }

  return parsed;
};

const safeRuleCheck = async (label, checker, fallbackValue) => {
  try {
    const result = await checker();
    if (!result || typeof result !== 'object') {
      return { ...fallbackValue, warning: `${label} check returned invalid output` };
    }
    return result;
  } catch (error) {
    logger.error(`geminiQualityChecker: ${label} fallback failed`, { error: error.message });
    return { ...fallbackValue, error: error.message };
  }
};

const runRuleBasedFallback = async (pdfBuffer, reason = 'unknown') => {
  logger.warn('geminiQualityChecker: using rule-based fallback', { reason });

  const [bp, q, c, wm, md] = await Promise.all([
    safeRuleCheck('blank page', () => ruleBasedBlankPages(pdfBuffer), {
      passed: true,
      pageCount: 0,
      warning: 'Blank-page check unavailable',
    }),
    safeRuleCheck('quality', () => ruleBasedQuality(pdfBuffer), {
      passed: true,
      qualityScore: 0,
      warning: 'Scan-quality check unavailable',
    }),
    safeRuleCheck('copyright', () => ruleBasedCopyright(pdfBuffer), {
      passed: true,
      suspicionLevel: 'unknown',
      warning: 'Copyright check unavailable',
    }),
    safeRuleCheck('watermark', () => ruleBasedWatermark(pdfBuffer), {
      passed: true,
      message: null,
    }),
    safeRuleCheck('metadata', () => ruleBasedMetadata(pdfBuffer), {
      passed: true,
      warning: 'Metadata check unavailable',
    }),
  ]);

  return {
    blankPages: bp,
    quality: q,
    copyright: c,
    watermark: wm,
    metadata: md,
    usedAI: false,
  };
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run the three AI quality checks (blank page, scan quality, copyright) on
 * a PDF buffer.  Falls back to rule-based checks on any failure.
 *
 * @param {Buffer} pdfBuffer
 * @returns {{ blankPages, quality, copyright, usedAI: boolean }}
 */
export const runGeminiChecks = async (pdfBuffer) => {
  // ── Text extraction ──────────────────────────────────────────────────────
  let extracted;
  try {
    extracted = await extractText(pdfBuffer);
  } catch (err) {
    logger.error('geminiQualityChecker: text extraction failed', { error: err.message });
    return runRuleBasedFallback(pdfBuffer, `text extraction failed: ${err.message}`);
  }

  // ── Groq analysis ──────────────────────────────────────────────────────
  try {
    // Single Groq call covers all 5 checks
    const ai = await analyseWithGroq(extracted.text, extracted.pageCount, extracted.totalChars);

    logger.info('geminiQualityChecker: All 5 AI checks completed', {
      blankPage:  ai.blankPage.passed,
      quality:    ai.quality.passed,
      copyright:  ai.copyright.passed,
      watermark:  ai.watermark.passed,
      metadata:   ai.metadata.passed,
    });

    return {
      blankPages: {
        passed: ai.blankPage.passed,
        pageCount: extracted.pageCount,
        failReason: ai.blankPage.failReason || null,
        warning: ai.blankPage.passed ? null : (ai.blankPage.failReason || 'Document contains blank or empty pages'),
        aiAnalysis: true,
      },
      quality: {
        passed: ai.quality.passed,
        failReason: ai.quality.failReason || null,
        warning: ai.quality.passed ? null : (ai.quality.failReason || 'Low quality scan or readability issues'),
        aiAnalysis: true,
      },
      copyright: {
        passed: ai.copyright.passed,
        failReason: ai.copyright.failReason || null,
        warning: ai.copyright.passed ? null : (ai.copyright.failReason || 'Copyrighted or institutional material detected'),
        aiAnalysis: true,
      },
      watermark: {
        passed: ai.watermark.passed,
        failReason: ai.watermark.failReason || null,
        message: ai.watermark.passed ? null : (ai.watermark.failReason || 'This PDF contains a NotesMitra watermark. Re-uploading purchased notes is not allowed.'),
        aiAnalysis: true,
      },
      metadata: {
        passed: ai.metadata.passed,
        failReason: ai.metadata.failReason || null,
        warning: ai.metadata.passed ? null : (ai.metadata.failReason || 'Suspicious or pirated content markers detected'),
        aiAnalysis: true,
      },
      usedAI: true,
    };
  } catch (err) {
    return runRuleBasedFallback(pdfBuffer, `Gemini analysis failed: ${err.message}`);
  }
};

export default { runGeminiChecks };
