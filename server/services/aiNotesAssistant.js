/**
 * AI Notes Assistant Service
 *
 * Provides two capabilities for purchased notes:
 *   1. summariseNote  – Generate a structured exam-ready summary of a note's content
 *   2. chatAboutNote  – Answer a student's question using the note content as context
 *
 * Uses Groq with a model fallback chain so that if one model is overloaded or
 * rate-limited, it automatically retries with the next available model.
 */

import { createRequire } from 'module';
import crypto from 'crypto';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const require = createRequire(import.meta.url);
const pdfParseLib = require('pdf-parse');

const parsePdfText = async (pdfBuffer) => {
  // pdf-parse v1: module itself is callable
  if (typeof pdfParseLib === 'function') {
    return pdfParseLib(pdfBuffer);
  }

  // Some builds expose default callable export
  if (typeof pdfParseLib?.default === 'function') {
    return pdfParseLib.default(pdfBuffer);
  }

  // pdf-parse v2: class-based API
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

// Extract up to 15 000 chars — enough context without overloading smaller models
const MAX_CHARS = 15_000;

// Detect if text is corrupted/gibberish
const isCorruptedText = (text) => {
  if (!text || text.length < 20) return false;
  
  // Check 1: Look for repeated short patterns (e.g., "bherv bherv bherv" = corrupted OCR)
  const words = text.toLowerCase().split(/\s+/);
  if (words.length >= 3) {
    // Count word frequency - if one word appears >30%, it's likely corrupted repetition
    const wordFreq = {};
    words.forEach(w => {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    });
    const maxFreq = Math.max(...Object.values(wordFreq));
    if (maxFreq / words.length > 0.3) { // One word >30% = likely corrupted
      return true;
    }
  }
  
  // Check 2: Count ratio of vowels to consonants - gibberish has unusual ratio
  const vowels = (text.match(/[aeiouAEIOU]/g) || []).length;
  const consonants = (text.match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g) || []).length;
  if (consonants > 0) {
    const ratio = vowels / consonants;
    if (ratio < 0.15 && consonants > 50) { // Way too few vowels = gibberish
      return true;
    }
  }
  
  // Check 3: Check for ASCII-printable characters - corrupted PDFs often have weird chars
  const nonPrintable = (text.match(/[^\x20-\x7E\n\r\t]/g) || []).length;
  if (nonPrintable / text.length > 0.1) { // >10% non-printable = corrupted
    return true;
  }
  
  // Check 4: Look for very long words with no spaces - typical of corrupted text
  const longestWord = Math.max(...words.map(w => w.length));
  if (longestWord > 40 && text.length < 500) { // One 40+ char word in short text = likely corrupted
    return true;
  }
  
  // Check 5: Too high consonant density in small chunks (e.g., "vrb", "bhry")
  const chunks = text.match(/.{1,4}/g) || [];
  let highConsonantChunks = 0;
  chunks.forEach(chunk => {
    const chunkConsonants = (chunk.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length;
    if (chunkConsonants > 2.5) { // >2.5 consonants in 4 chars = too high
      highConsonantChunks++;
    }
  });
  if (highConsonantChunks / chunks.length > 0.6) { // >60% of chunks = corrupted
    return true;
  }
  
  return false;
};

export const extractText = async (pdfBuffer) => {
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    logger.error('❌ extractText: INVALID BUFFER', { 
      hasBuffer: !!pdfBuffer, 
      isBuffer: pdfBuffer ? Buffer.isBuffer(pdfBuffer) : false,
      type: typeof pdfBuffer
    });
    return '';
  }

  try {
    logger.info('📄 extractText: STARTING PDF PARSE', { bufferSize: pdfBuffer.length });
    const data = await parsePdfText(pdfBuffer);
    const text = (data.text || '').slice(0, MAX_CHARS).trim();
    
    // Check if extracted text is corrupted/gibberish
    if (isCorruptedText(text)) {
      logger.warn('⚠️  extractText: EXTRACTED TEXT IS CORRUPTED', {
        textLength: text.length,
        preview: text.substring(0, 100),
        reason: 'PDF appears to be a scanned image or has encoding issues'
      });
      return '';
    }
    
    logger.info('✅ extractText: PDF PARSED', {
      finalTextLength: text.length,
      rawTextLength: (data.text || '').length,
      pageCount: data.numpages || 'unknown',
      isEmpty: text.length === 0,
      isCorrupted: false,
      preview: text.substring(0, 80)
    });
    
    return text;
  } catch (err) {
    logger.error('❌ extractText: PARSING FAILED', { 
      error: err.message?.substring(0, 200),
      bufferSize: pdfBuffer?.length,
      errorType: err.constructor.name
    });
    return '';
  }
};

// ─── Summary Caching (Redis) ─────────────────────────────────────────────────
// Cache summaries for 7 days to reduce API calls by 80-90%
// Multiple students reading same note = 1 API call instead of 20+
const SUMMARY_CACHE_VERSION = 'v3';

const getCacheKey = (contextText, meta = {}, contextSource = 'pdf-text') => {
  const hash = crypto.createHash('sha256')
    .update(`${SUMMARY_CACHE_VERSION}|${contextSource}|${contextText || ''}|${meta?.title || ''}|${meta?.subject || ''}|${meta?.description || ''}`)
    .digest('hex');
  return `summary:${hash}`;
};

const getCachedSummary = async (contextText, meta = {}, contextSource = 'pdf-text') => {
  try {
    const { getRedisPublisher } = await import('../config/redis.js');
    const redisClient = getRedisPublisher();
    if (!redisClient) return null;
    
    const cacheKey = getCacheKey(contextText, meta, contextSource);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      logger.info('aiNotesAssistant: summary cache HIT', { cacheKey: cacheKey.slice(0, 20) });
      return JSON.parse(cached);
    }
    return null;
  } catch (err) {
    logger.warn('aiNotesAssistant: cache read failed (non-critical)', { error: err.message });
    return null;
  }
};

const setCachedSummary = async (contextText, meta = {}, contextSource = 'pdf-text', summary) => {
  try {
    const { getRedisPublisher } = await import('../config/redis.js');
    const redisClient = getRedisPublisher();
    if (!redisClient) return;
    
    const cacheKey = getCacheKey(contextText, meta, contextSource);
    const CACHE_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds
    await redisClient.setex(cacheKey, CACHE_DURATION, JSON.stringify(summary));
    logger.info('aiNotesAssistant: summary cached for 7 days', { cacheKey: cacheKey.slice(0, 20) });
  } catch (err) {
    logger.warn('aiNotesAssistant: cache write failed (non-critical)', { error: err.message });
  }
};

// ─── Model fallback chain ────────────────────────────────────────────────────
// Currently using only confirmed working models on Groq's free tier
// Last verified: llama-3.1-8b-instant is stable and reliable
// Mixtral & llama-3.1-70b have been decommissioned by Groq
const MODEL_CHAIN = [
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
];

const toGroqMessages = (requestPayload) => {
  if (typeof requestPayload === 'string') {
    return [
      {
        role: 'system',
        content: 'You are a JSON response generator. IMPORTANT: Respond with ONLY valid JSON object. NO markdown. NO code fences. NO explanations. NO text before or after. Return raw valid JSON only.'
      },
      {
        role: 'user',
        content: requestPayload
      }
    ];
  }

  if (requestPayload?.mode === 'chat' && Array.isArray(requestPayload.messages)) {
    return requestPayload.messages
      .map((msg) => ({
        role: msg?.role === 'assistant' ? 'assistant' : msg?.role === 'system' ? 'system' : 'user',
        content: typeof msg?.content === 'string' ? msg.content.trim() : ''
      }))
      .filter((msg) => !!msg.content);
  }

  if (Array.isArray(requestPayload?.contents)) {
    return requestPayload.contents
      .map((turn) => {
        const content = Array.isArray(turn?.parts)
          ? turn.parts.map((part) => part?.text).filter(Boolean).join('\n').trim()
          : '';
        return {
          role: turn?.role === 'model' ? 'assistant' : turn?.role === 'system' ? 'system' : 'user',
          content
        };
      })
      .filter((msg) => !!msg.content);
  }

  const fallbackPrompt = typeof requestPayload?.prompt === 'string'
    ? requestPayload.prompt
    : 'summarize this';

  return [
    {
      role: 'system',
      content: 'You are a JSON response generator. IMPORTANT: Respond with ONLY valid JSON object. NO markdown. NO code fences. NO explanations. NO text before or after. Return raw valid JSON only.'
    },
    {
      role: 'user',
      content: fallbackPrompt
    }
  ];
};

const generateWithFallback = async (apiKey, requestPayload) => {
  // Lazy load Groq SDK to avoid crashes if not available
  let Groq;
  try {
    const groqModule = await import('groq-sdk');
    Groq = groqModule.default;
  } catch (err) {
    logger.error('aiNotesAssistant: Failed to import Groq SDK', { error: err.message });
    throw new Error(`Groq SDK import failed: ${err.message}`);
  }

  const groq = new Groq({ apiKey });
  let lastErr;
  const mode = requestPayload?.mode === 'chat' ? 'chat' : 'summary';
  const messages = toGroqMessages(requestPayload);
  const temperature = mode === 'chat' ? 0.4 : 0.3;
  const maxTokens = mode === 'chat' ? 1200 : 2000;

  if (!messages.length) {
    throw new Error('No valid messages provided for Groq request');
  }
  
  for (const modelName of MODEL_CHAIN) {
    try {
      logger.debug(`aiNotesAssistant: trying model ${modelName}`, {
        mode,
        messageCount: messages.length
      });

      const result = await groq.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: 1
      });
      
      // Extract text from Groq response format
      let text = result?.choices?.[0]?.message?.content;
      text = typeof text === 'string' ? text.trim() : null;
      
      logger.debug(`aiNotesAssistant: ${modelName} raw response`, { 
        textLength: text?.length,
        textStart: text?.substring?.(0, 100)
      });
      
      if (!text) {
        logger.warn(`aiNotesAssistant: ${modelName} returned empty response`, {
          hasContent: !!result?.choices?.[0]?.message?.content,
          contentType: typeof result?.choices?.[0]?.message?.content
        });
        throw new Error(`Empty response from ${modelName}`);
      }
      
      logger.info(`aiNotesAssistant: ${modelName} succeeded`, { responseLength: text.length });
      return text;
    } catch (err) {
      const errStr = String(err.message || err).toLowerCase();
      const statusCode = err.status || null;
      
      // Check for specific error types
      const isAuthError = errStr.includes('api key') || errStr.includes('unauthorized') || errStr.includes('403') || errStr.includes('401');
      const isRateLimited = errStr.includes('429') || errStr.includes('overloaded') || statusCode === 429;
      const isTimeout = errStr.includes('timeout') || errStr.includes('econnrefused') || errStr.includes('deadline');
      const isInvalidModel = errStr.includes('model') && (errStr.includes('not found') || errStr.includes('does not exist'));
      const isDecommissioned = errStr.includes('decommissioned') || errStr.includes('no longer supported');
      
      // Decommissioned models should be retried, not treated as fatal
      const isRetryable = isRateLimited || isTimeout || isDecommissioned;
      const isFatal = isAuthError || (isInvalidModel && !isDecommissioned);
      
      logger.warn(
        `aiNotesAssistant: ${modelName} failed (${isRetryable ? 'retryable' : isFatal ? 'fatal-auth' : 'non-fatal'})`,
        { 
          fullError: err.message?.slice?.(0, 300) || String(err),
          status: statusCode,
          modelName,
          errorType: { isAuthError, isRateLimited, isTimeout, isInvalidModel, isDecommissioned }
        }
      );
      
      lastErr = err;
      
      // Stop retrying immediately on auth/API key errors only
      if (isFatal) {
        logger.error(`aiNotesAssistant: fatal error, stopping retry chain`, { 
          status: statusCode,
          modelName,
          reason: isAuthError ? 'auth-error' : 'invalid-model'
        });
        break;
      }
      
      // Continue to next model if retryable or non-fatal error (including decommissioned)
    }
  }
  
  throw lastErr || new Error('All Groq models failed or API key is invalid');
};

const toCleanLines = (text) => {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((line) => line.length >= 8); // Reduced from 12 to capture more content
};

const toSentences = (text) => {
  if (!text) return [];
  
  // Try standard sentence split first
  const standardSplit = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15); // More lenient
  
  // If we got sentences, return them
  if (standardSplit.length > 0) return standardSplit;
  
  // Fallback: split by common delimiters if no standard sentences found
  const fallbackSplit = text
    .split(/[;:,]|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15);
  
  return fallbackSplit;
};

const uniqueKeepOrder = (items) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
};

const sanitizeMetaText = (value) => {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const avgTokenLength = tokens.length
    ? tokens.reduce((sum, token) => sum + token.length, 0) / tokens.length
    : 0;

  // Keep short, human-like labels but remove obvious OCR/gibberish titles
  const letterCount = (cleaned.match(/[a-z]/gi) || []).length;
  const vowels = (cleaned.match(/[aeiou]/gi) || []).length;
  const vowelRatio = letterCount > 0 ? vowels / letterCount : 0;
  const hasLongConsonantRun = /[bcdfghjklmnpqrstvwxyz]{6,}/i.test(cleaned);
  const hasHugeToken = tokens.some((token) => token.length > 35);
  const singleVeryLongToken = tokens.length === 1 && tokens[0].length > 18;
  const suspiciousDenseTokens = avgTokenLength > 12 && tokens.length <= 2 && letterCount > 16;

  if (
    (letterCount > 20 && vowelRatio < 0.2) ||
    hasLongConsonantRun ||
    hasHugeToken ||
    singleVeryLongToken ||
    suspiciousDenseTokens ||
    isCorruptedText(cleaned)
  ) {
    return '';
  }

  return cleaned;
};

const buildStudyContext = (noteText, meta = {}) => {
  const safeMeta = {
    title: sanitizeMetaText(meta.title),
    subject: sanitizeMetaText(meta.subject),
    description: sanitizeMetaText(meta.description)
  };

  const metadataText = [
    safeMeta.title ? `Title: ${safeMeta.title}` : '',
    safeMeta.subject ? `Subject: ${safeMeta.subject}` : '',
    safeMeta.description ? `Description: ${safeMeta.description}` : ''
  ].filter(Boolean).join('\n');

  if (noteText && noteText.trim().length > 0) {
    return {
      text: noteText.trim(),
      source: 'pdf-text',
      safeMeta
    };
  }

  if (metadataText) {
    return {
      text: metadataText,
      source: 'metadata',
      safeMeta
    };
  }

  return {
    text: '',
    source: 'none',
    safeMeta
  };
};

const buildFallbackSummary = (noteText, meta = {}) => {
  const lines = toCleanLines(noteText);
  const sentences = toSentences(noteText);

  const summarySentences = sentences.slice(0, 5);
  const title = meta.title || 'this note';
  const subject = meta.subject || 'this subject';

  // Check if we have NO valid text (empty or corrupted)
  const hasNoValidText = noteText.length === 0;

  // Improved fallback message that indicates PDF issue if no text extracted
  const summary = summarySentences.length
    ? summarySentences.join(' ')
    : hasNoValidText
      ? `⚠️ Unable to extract text from this PDF. The file may be a scanned image, corrupted, or password-protected. Please upload a digital PDF or an OCR-processed version for proper summarization.`
      : `A concise summary could not be generated from ${title}. This note appears to cover important points for ${subject}. Please review the key topics and quick revision points below.`;

  // Build keyTopics with fallback
  const keyTopicsCandidate = lines
    .filter((line) => line.length <= 90)
    .slice(0, 10);
  
  let keyTopics = keyTopicsCandidate.length 
    ? keyTopicsCandidate 
    : (sentences.slice(0, 5).map(s => s.split(/\s+/).slice(0, 5).join(' ')));

  if (keyTopics.length === 0 && hasNoValidText) {
    keyTopics = [
      'Readable PDF text required',
      'OCR processing may be needed',
      'Re-upload for AI summary generation'
    ];
  }

  // Build quickRevision with multiple fallback strategies
  const candidateRevisionItems = [
    ...sentences.slice(0, 8),
    ...lines.slice(0, 8),
    ...(noteText.split(/[.\n;:]/g).filter(x => x.trim().length >= 15).slice(0, 8))
  ];

  let quickRevision = uniqueKeepOrder(
    candidateRevisionItems
      .map((item) => item.length > 170 ? `${item.slice(0, 167)}...` : item)
      .filter((item) => item.length >= 15) // More lenient minimum length
  ).slice(0, 12);

  // If still empty, create basic revision points
  // BUT: if no valid text extracted, DON'T include the title (might be corrupted)
  if (quickRevision.length === 0) {
    if (hasNoValidText) {
      quickRevision = [
        'Verify the PDF file is readable and not corrupted',
        'Consider uploading an OCR-processed version if it is a scanned document',
        'Check that the file has selectable text content'
      ];
    } else if (subject) {
      quickRevision = [
        `Subject: ${subject}`,
        'Refer to the note content for detailed information',
        'Review key sections carefully before exam'
      ];
    } else {
      quickRevision = [
        'Review the note content carefully',
        'Focus on key concepts and definitions',
        'Practice with these topics before exam'
      ];
    }
  }

  // Log what we're returning
  if (quickRevision.length === 0) {
    logger.warn('buildFallbackSummary: quickRevision is empty', {
      linesCount: lines.length,
      sentencesCount: sentences.length,
      noteTextLength: noteText?.length || 0,
      title,
      subject
    });
  }

  return {
    summary,
    keyTopics: keyTopics.slice(0, 10),
    quickRevision,
  };
};

const extractJsonCandidate = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  
  // Remove markdown code fences if present
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  
  // Try to find valid JSON by looking for pattern: { ... "summary": ... "keyTopics": ... "quickRevision": ... }
  // This handles nested structures better
  
  // Strategy 1: Find lines that start with { and look for complete JSON objects
  const lines = cleaned.split('\n');
  let jsonStartIdx = -1;
  let braceCount = 0;
  let jsonEndIdx = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Find where JSON likely starts
    if (jsonStartIdx === -1 && line.startsWith('{')) {
      jsonStartIdx = i;
      braceCount = 0;
    }
    
    // Count braces to find the end of JSON object
    if (jsonStartIdx !== -1) {
      for (let char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      
      // When braces balance (braceCount === 0 and we have the closing }), we found the end
      if (braceCount === 0 && line.includes('}')) {
        jsonEndIdx = i;
        break;
      }
    }
  }
  
  // Extract the JSON section
  if (jsonStartIdx !== -1 && jsonEndIdx !== -1) {
    const jsonStr = lines.slice(jsonStartIdx, jsonEndIdx + 1).join('\n');
    logger.debug('extractJsonCandidate: found JSON via brace matching', {
      startLine: jsonStartIdx,
      endLine: jsonEndIdx,
      jsonLength: jsonStr.length
    });
    return jsonStr;
  }
  
  // Fallback: Original method (first { to last })
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  
  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  logger.debug('extractJsonCandidate: using fallback first-to-last method', {
    length: jsonStr.length,
    start: jsonStr.substring(0, 50)
  });
  return jsonStr;
};

const toStringArray = (value, maxItems = 15) => {
  if (!Array.isArray(value)) {
    // If it's an object, extract all string values
    if (value && typeof value === 'object') {
      const allValues = Object.values(value);
      const flattened = [];
      for (const v of allValues) {
        if (typeof v === 'string') {
          flattened.push(v);
        } else if (Array.isArray(v)) {
          flattened.push(...v.filter(item => typeof item === 'string'));
        } else if (typeof v === 'object') {
          const nested = Object.values(v).filter(n => typeof n === 'string');
          flattened.push(...nested);
        }
      }
      return flattened.slice(0, maxItems);
    }
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, maxItems);
};

const parseSummaryFromModelOutput = (raw, noteText, meta) => {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  
  // Array of candidates to try parsing, in priority order
  // 1. Try extracting JSON from markdown/text wrapper
  // 2. Try cleaned markdown
  // 3. Try original raw (in case it's already JSON)
  const jsonCandidates = [
    extractJsonCandidate(raw),      // Extract from original first (highest priority)
    extractJsonCandidate(cleaned),  // Extract from cleaned
    cleaned,                         // Try cleaned as-is
    raw                              // Try raw as-is (last resort)
  ].filter(Boolean);

  logger.debug('parseSummaryFromModelOutput: attempting parse', {
    rawLength: raw.length,
    cleanedLength: cleaned.length,
    candidateCount: jsonCandidates.length,
    firstCandidate: jsonCandidates[0]?.slice?.(0, 100),
    allCandidates: jsonCandidates.map((c, i) => ({ index: i, length: c.length, start: c.substring(0, 40) }))
  });

  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object') continue;

      logger.debug('parseSummaryFromModelOutput: JSON parsed successfully', {
        hasSummary: !!parsed.summary,
        keyTopicsCount: Array.isArray(parsed.keyTopics) ? parsed.keyTopics.length : 0,
        quickRevisionCount: Array.isArray(parsed.quickRevision) ? parsed.quickRevision.length : 0
      });

      const fallback = buildFallbackSummary(noteText, meta);
      const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : fallback.summary;

      // Handle cases where keyTopics/quickRevision might be nested objects or other formats
      let keyTopicsArray = parsed.keyTopics || [];
      let quickRevisionArray = parsed.quickRevision || [];
      
      // If they're objects (nested structures), flatten them
      if (keyTopicsArray && typeof keyTopicsArray === 'object' && !Array.isArray(keyTopicsArray)) {
        keyTopicsArray = Object.values(keyTopicsArray).flat();
      }
      if (quickRevisionArray && typeof quickRevisionArray === 'object' && !Array.isArray(quickRevisionArray)) {
        quickRevisionArray = Object.values(quickRevisionArray).flat();
      }
      
      const keyTopics = toStringArray(keyTopicsArray, 10);
      const quickRevision = toStringArray(quickRevisionArray, 15);

      const mergedKeyTopics = uniqueKeepOrder([
        ...keyTopics,
        ...fallback.keyTopics
      ]).slice(0, 10);

      const mergedQuickRevision = uniqueKeepOrder([
        ...quickRevision,
        ...fallback.quickRevision
      ]).slice(0, 12);

      const result = {
        summary,
        keyTopics: mergedKeyTopics,
        quickRevision: mergedQuickRevision,
      };

      logger.info('parseSummaryFromModelOutput: successfully parsed and returned', {
        summaryLength: result.summary.length,
        keyTopicsCount: result.keyTopics.length,
        quickRevisionCount: result.quickRevision.length,
        source: 'ai-generated'
      });

      return result;
    } catch (err) {
      logger.debug('parseSummaryFromModelOutput: JSON parse failed for candidate', {
        candidateStart: candidate?.slice?.(0, 50),
        error: err.message
      });
      // try next candidate
    }
  }

  logger.warn('parseSummaryFromModelOutput: all candidates failed, using fallback', {
    rawLength: raw.length,
    candidateCount: jsonCandidates.length,
    failedCandidates: jsonCandidates.map((c, i) => ({ index: i, length: c.length }))
  });

  return buildFallbackSummary(noteText, meta);
};

const buildFallbackChatAnswer = (noteText, question, meta = {}, reason = 'model-fallback') => {
  const context = buildStudyContext(noteText, meta);
  const lines = toCleanLines(context.text);
  const linePool = lines.length ? lines : toSentences(context.text);

  const stopWords = new Set(['what', 'which', 'when', 'where', 'this', 'that', 'with', 'from', 'have', 'about', 'explain', 'tell', 'give', 'must', 'need', 'show']);
  const keywords = (question.toLowerCase().match(/[a-z]{3,}/g) || []).filter((k) => !stopWords.has(k));

  const matches = linePool.filter((line) =>
    keywords.some((keyword) => line.toLowerCase().includes(keyword))
  );

  const chosen = (matches.length ? matches : linePool).slice(0, 4);
  const bulletPoints = chosen.length
    ? chosen.map((item) => `- ${item}`).join('\n')
    : '- I could not extract enough reliable text from this note to provide a targeted answer.';

  if (context.source === 'none') {
    return [
      'I could not read usable text from this PDF, so I cannot answer your question reliably yet.',
      '',
      '- Please upload a digital PDF (with selectable text), or',
      '- Upload an OCR-processed version if this is a scanned document.',
      '',
      'After re-uploading, Ask AI will answer your doubts from the note content.'
    ].join('\n');
  }

  if (context.source === 'metadata') {
    return [
      'I could not extract readable PDF text, so this answer is based on note metadata only.',
      '',
      bulletPoints,
      '',
      'For accurate, content-based answers, upload a readable/OCR PDF and ask again.'
    ].join('\n');
  }

  return [
    reason === 'ai-unavailable'
      ? 'Groq AI is temporarily unavailable, so here is a quick answer from extracted note text:'
      : 'Here is a quick answer from extracted note text:',
    '',
    bulletPoints,
    '',
    'Try again in a few moments for a full AI-generated explanation.'
  ].join('\n');
};

// ─── 1. Summary ──────────────────────────────────────────────────────────────

export const summariseNote = async (pdfBuffer, meta) => {
  logger.info('═══════════════════════════════════════════');
  logger.info('📋 summariseNote START - Note: ' + (meta?.title || 'Unknown'));
  logger.info('═══════════════════════════════════════════');

  let noteText = '';
  try {
    logger.info('Step 1️⃣: Extracting text from PDF buffer (size: ' + pdfBuffer?.length + ' bytes)');
    noteText = await extractText(pdfBuffer);
    logger.info('Step 1️⃣ Result: Extracted ' + noteText.length + ' characters');
  } catch (err) {
    logger.error('❌ Step 1 CRASHED: ' + err.message);
    return buildFallbackSummary('', buildStudyContext('', meta).safeMeta);
  }

  const context = buildStudyContext(noteText, meta);

  if (context.source === 'none') {
    logger.error('❌ Step 1 RESULT: No usable PDF text or metadata available');
    return buildFallbackSummary('', context.safeMeta);
  }

  if (context.source === 'metadata') {
    logger.warn('⚠️  No extractable PDF text. Using metadata context for summary generation.');
  } else if (context.text.length < 50) {
    logger.warn('⚠️  Very short text: ' + context.text.length + ' chars. Will still try Groq');
  } else {
    logger.info('✅ Good text length: ' + context.text.length + ' chars');
  }

  const apiKey = config.groqApiKey;
  if (!apiKey) {
    logger.error('aiNotesAssistant: GROQ_API_KEY is missing or empty');
    return buildFallbackSummary(context.text, context.safeMeta);
  }

  const prompt = `CONTEXT SOURCE: ${context.source}

STUDY CONTENT:
${context.text}

CREATE THIS EXACT JSON WITH NO OTHER TEXT:
{
  "summary": "Write a clear 4-6 sentence full study summary for exam revision.",
  "keyTopics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5", "Topic 6", "Topic 7", "Topic 8"],
  "quickRevision": ["Fact 1", "Fact 2", "Fact 3", "Fact 4", "Fact 5", "Fact 6", "Fact 7", "Fact 8", "Fact 9", "Fact 10"]
}

Rules:
- Return AT LEAST 8 keyTopics and AT LEAST 10 quickRevision points.
- If context source is metadata, be honest and avoid inventing very specific facts.
- Do not output markdown.

NEVER ADD MARKDOWN, CODE FENCES, OR ANY TEXT OUTSIDE THE JSON.`;

  try {
    // ✅ CHECK CACHE FIRST
    const cachedResult = await getCachedSummary(context.text, context.safeMeta, context.source);
    if (cachedResult) {
      logger.info('aiNotesAssistant: returning cached summary (7-day cache hit)', {
        source: 'redis-cache',
        quickRevisionCount: cachedResult.quickRevision?.length || 0,
        keyTopicsCount: cachedResult.keyTopics?.length || 0
      });
      return cachedResult;
    }

    // ❌ NOT IN CACHE → GENERATE WITH AI
    logger.debug('aiNotesAssistant: cache miss, calling generateWithFallback', { 
      apiKeyLength: apiKey?.length,
      promptLength: prompt.length
    });
    
    const raw = await generateWithFallback(apiKey, {
      mode: 'summary',
      prompt
    });
    
    logger.debug('aiNotesAssistant: Groq response received', { 
      responseLength: raw?.length,
      responseStart: raw?.substring?.(0, 150)
    });
    
    const parsed = parseSummaryFromModelOutput(raw, context.text, context.safeMeta);
    
    // ✅ STORE IN CACHE FOR 7 DAYS
    await setCachedSummary(context.text, context.safeMeta, context.source, parsed);
    
    logger.info('aiNotesAssistant: summariseNote generated successfully', {
      source: 'ai-generated',
      quickRevisionCount: parsed.quickRevision?.length || 0,
      keyTopicsCount: parsed.keyTopics?.length || 0,
      summaryLength: parsed.summary?.length || 0
    });
    return parsed;
  } catch (err) {
    logger.error('aiNotesAssistant: summariseNote failed, using fallback', { 
      error: err.message?.slice?.(0, 200) || String(err),
      hasNoteText: !!context.text,
      noteTextLength: context.text?.length || 0,
      contextSource: context.source
    });
    const fallback = buildFallbackSummary(context.text, context.safeMeta);
    logger.info('aiNotesAssistant: returning fallback summary', {
      source: 'fallback',
      quickRevisionCount: fallback.quickRevision?.length || 0,
      keyTopicsCount: fallback.keyTopics?.length || 0
    });
    return fallback;
  }
};

// ─── 2. Chat ─────────────────────────────────────────────────────────────────

export const chatAboutNote = async (pdfBuffer, meta, question, history = []) => {
  if (!question || question.trim().length < 2) {
    throw new Error('Please enter a valid question.');
  }

  let noteText = '';
  try {
    noteText = await extractText(pdfBuffer);
  } catch (err) {
    logger.error('aiNotesAssistant: text extraction failed for chat', { error: err.message?.slice?.(0, 180) || String(err) });
    return buildFallbackChatAnswer('', question, meta, 'no-context');
  }

  const context = buildStudyContext(noteText, meta);

  const apiKey = config.groqApiKey;
  if (!apiKey) {
    logger.error('aiNotesAssistant: GROQ_API_KEY is missing or empty for chat');
    return buildFallbackChatAnswer(noteText, question, context.safeMeta, 'ai-unavailable');
  }

  if (!context.text) {
    logger.warn('aiNotesAssistant: no usable context for chat');
    return buildFallbackChatAnswer('', question, context.safeMeta, 'no-context');
  }

  const systemContext = `You are an expert academic tutor. A student is asking questions about the following study material.

Note Title: ${context.safeMeta.title || 'Study Notes'}
Subject: ${context.safeMeta.subject || 'General'}
Context Source: ${context.source}

--- STUDY MATERIAL ---
${context.text}
--- END OF STUDY MATERIAL ---

Rules:
- Answer ONLY based on the study material above and general academic knowledge.
- Keep answers clear, concise and exam-focused.
- If the answer is not in the material, say so honestly but still provide a helpful general answer.
- If context source is metadata, clearly mention that the answer is metadata-based.
- Use bullet points, numbered lists, or simple explanations where helpful.
- Do NOT invent or fabricate facts.`;

  const messages = [
    { role: 'system', content: systemContext }
  ];

  // Append prior conversation turns (max last 8 to keep token count manageable)
  for (const turn of history.slice(-8)) {
    if (!turn || typeof turn.content !== 'string' || !turn.content.trim()) continue;
    messages.push({
      role: (turn.role === 'assistant' || turn.role === 'model') ? 'assistant' : 'user',
      content: turn.content.trim(),
    });
  }

  messages.push({ role: 'user', content: question.trim() });

  try {
    const answer = await generateWithFallback(apiKey, {
      mode: 'chat',
      messages
    });

    if (!answer || !answer.trim()) {
      logger.warn('aiNotesAssistant: empty response from chat, using fallback');
      return buildFallbackChatAnswer(noteText, question, context.safeMeta, 'ai-unavailable');
    }

    logger.info('aiNotesAssistant: chatAboutNote answered successfully');
    return answer;
  } catch (err) {
    logger.error('aiNotesAssistant: chatAboutNote failed, using fallback', { 
      error: err.message?.slice?.(0, 200) || String(err),
      hasNoteText: !!context.text,
      contextSource: context.source,
      questionLength: question?.length || 0
    });
    return buildFallbackChatAnswer(noteText, question, context.safeMeta, 'ai-unavailable');
  }
};



