
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

const analyseWithGroq = async (extractedText, pageCount, totalChars) => {
  const apiKey = config.groqApiKey;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  let Groq;

  try {
    const groqModule = await import('groq-sdk');
    Groq = groqModule.default;
  } catch (err) {
    logger.error('geminiQualityChecker: Failed to import Groq SDK', {
      error: err.message,
    });
    throw new Error(`Groq SDK import failed: ${err.message}`);
  }

  const groq = new Groq({ apiKey });

  // Existing model names retained; invalid models now trigger a retry.
  const MODEL_CHAIN = [
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
  ];

  const avgCharsPerPage =
    pageCount > 0 ? Math.round(totalChars / pageCount) : 0;

  const prompt = `You are a PDF content quality reviewer for an academic notes marketplace called NotesMitra.

Analyse the following extracted PDF text and respond with ONLY a raw JSON object — no markdown, no code fences, no extra text.

Context:
- Page count: ${pageCount}
- Average non-whitespace characters per page: ${avgCharsPerPage}
- Text sample (first ${MAX_CHARS} chars):
"""
${extractedText}
"""

Evaluate ALL FIVE checks and return exactly this JSON structure:
{
  "blankPage": { "passed": true, "failReason": null },
  "quality": { "passed": true, "failReason": null },
  "copyright": { "passed": true, "failReason": null },
  "watermark": { "passed": true, "failReason": null },
  "metadata": { "passed": true, "failReason": null }
}

Rules:
1. blankPage: Fail if average text is under 80 non-whitespace characters per page or content is mostly empty.
2. quality: Fail if text is garbled, unreadable, or mostly gibberish.
3. copyright: Fail for evidence of copied commercial publisher material, institution-owned lecture material, named professor/instructor ownership, textbook extraction, education platform watermarks, or official exam/board material. Under the strict policy, any institution or instructor name, book ownership marker, or institution logo/seal marker fails.
4. watermark: Fail if NotesMitra purchased-copy markers appear, such as "notesmitra", "licensed copy", "redistribution prohibited", "licensed to", "purchased by", or "this document is licensed".
5. metadata: Fail for suspicious piracy indicators such as "pirated", "cracked", "libgen", "z-lib", "torrent", "illegal copy", or "warez".

For each check, return a concise failReason when passed=false. Respond with JSON only.`;

  let raw;
  let lastErr;

  for (const modelName of MODEL_CHAIN) {
    try {
      logger.debug(`geminiQualityChecker: trying model ${modelName}`);

      const result = await groq.chat.completions.create({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
        top_p: 1,
      });

      let responseText = result?.choices?.[0]?.message?.content;
      responseText =
        typeof responseText === 'string' ? responseText.trim() : null;

      if (!responseText) {
        throw new Error(`Empty response from ${modelName}`);
      }

      raw = responseText;
      logger.info(`geminiQualityChecker: ${modelName} succeeded`, {
        responseLength: responseText.length,
      });
      break;
    } catch (err) {
      const errStr = String(err.message || err).toLowerCase();
      const statusCode = err.status || null;

      const isAuthError =
        errStr.includes('api key') ||
        errStr.includes('unauthorized') ||
        errStr.includes('403') ||
        errStr.includes('401');

      const isRateLimited =
        errStr.includes('429') ||
        errStr.includes('overloaded') ||
        statusCode === 429;

      const isTimeout =
        errStr.includes('timeout') || errStr.includes('econnrefused');

      const isInvalidModel =
        (errStr.includes('404') && errStr.includes('model')) ||
        errStr.includes('does not exist');

      const isDecommissioned =
        errStr.includes('decommissioned') ||
        errStr.includes('no longer supported');

      const isRetryable =
        isRateLimited || isTimeout || isDecommissioned || isInvalidModel;

      const isFatal = isAuthError;

      logger.warn(
        `geminiQualityChecker: ${modelName} failed (${
          isRetryable ? 'retryable' : isFatal ? 'fatal-auth' : 'non-fatal'
        })`,
        {
          error: err.message?.slice?.(0, 200) || String(err),
          status: statusCode,
          errorType: {
            isAuthError,
            isRateLimited,
            isTimeout,
            isInvalidModel,
            isDecommissioned,
          },
        }
      );

      lastErr = err;

      // Stop for authentication errors; otherwise try the next model.
      if (isFatal) {
        logger.error(
          'geminiQualityChecker: authentication failed, stopping retry chain',
          {
            status: statusCode,
            modelName,
            reason: 'auth-error',
          }
        );
        break;
      }
    }
  }

  if (!raw) {
    throw lastErr || new Error('All Groq models failed or API key is invalid');
  }

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } else {
      throw new Error(`Groq returned non-JSON response: ${raw.slice(0, 200)}`);
    }
  }

  for (const key of [
    'blankPage',
    'quality',
    'copyright',
    'watermark',
    'metadata',
  ]) {
    if (typeof parsed[key]?.passed !== 'boolean') {
      throw new Error(`Groq response missing or invalid field: ${key}`);
    }
  }

  return parsed;
};

const safeRuleCheck = async (label, checker, fallbackValue) => {
  try {
    const result = await checker();

    if (!result || typeof result !== 'object') {
      return {
        ...fallbackValue,
        warning: `${label} check returned invalid output`,
      };
    }

    return result;
  } catch (error) {
    logger.error(`geminiQualityChecker: ${label} fallback failed`, {
      error: error.message,
    });

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

export const runGeminiChecks = async (pdfBuffer) => {
  let extracted;

  try {
    extracted = await extractText(pdfBuffer);
  } catch (err) {
    logger.error('geminiQualityChecker: text extraction failed', {
      error: err.message,
    });

    return runRuleBasedFallback(
      pdfBuffer,
      `text extraction failed: ${err.message}`
    );
  }

  try {
    const ai = await analyseWithGroq(
      extracted.text,
      extracted.pageCount,
      extracted.totalChars
    );

    const strictCopyright = await ruleBasedCopyright(pdfBuffer);

    const copyrightPassed = Boolean(
      ai.copyright.passed && strictCopyright.passed
    );

    const copyrightFailReason = !ai.copyright.passed
      ? ai.copyright.failReason || 'Copyrighted or institutional material detected'
      : !strictCopyright.passed
        ? strictCopyright.failReason ||
          'Detected university/college/professor/book ownership markers'
        : null;

    logger.info('geminiQualityChecker: All 5 AI checks completed', {
      blankPage: ai.blankPage.passed,
      quality: ai.quality.passed,
      copyright: copyrightPassed,
      watermark: ai.watermark.passed,
      metadata: ai.metadata.passed,
    });

    if (!ai.copyright.passed && strictCopyright.passed) {
      logger.warn('geminiQualityChecker: copyright failed by Groq AI');
    }

    if (ai.copyright.passed && !strictCopyright.passed) {
      logger.warn(
        'geminiQualityChecker: strict copyright override applied from rule-based detector',
        {
          failReason: strictCopyright.failReason || null,
        }
      );
    }

    return {
      blankPages: {
        passed: ai.blankPage.passed,
        pageCount: extracted.pageCount,
        failReason: ai.blankPage.failReason || null,
        warning: ai.blankPage.passed
          ? null
          : ai.blankPage.failReason || 'Document contains blank or empty pages',
        aiAnalysis: true,
      },
      quality: {
        passed: ai.quality.passed,
        failReason: ai.quality.failReason || null,
        warning: ai.quality.passed
          ? null
          : ai.quality.failReason || 'Low quality scan or readability issues',
        aiAnalysis: true,
      },
      copyright: {
        passed: copyrightPassed,
        failReason: copyrightFailReason,
        warning: copyrightPassed
          ? null
          : copyrightFailReason || 'Copyrighted or institutional material detected',
        aiAnalysis: true,
      },
      watermark: {
        passed: ai.watermark.passed,
        failReason: ai.watermark.failReason || null,
        message: ai.watermark.passed
          ? null
          : ai.watermark.failReason ||
            'This PDF contains a NotesMitra watermark. Re-uploading purchased notes is not allowed.',
        aiAnalysis: true,
      },
      metadata: {
        passed: ai.metadata.passed,
        failReason: ai.metadata.failReason || null,
        warning: ai.metadata.passed
          ? null
          : ai.metadata.failReason || 'Suspicious or pirated content markers detected',
        aiAnalysis: true,
      },
      usedAI: true,
    };
  } catch (err) {
    return runRuleBasedFallback(pdfBuffer, `Groq analysis failed: ${err.message}`);
  }
};

export default { runGeminiChecks };
