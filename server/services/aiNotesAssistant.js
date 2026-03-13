/**
 * AI Notes Assistant Service
 *
 * Provides two capabilities for purchased notes:
 *   1. summariseNote  – Generate a structured exam-ready summary of a note's content
 *   2. chatAboutNote  – Answer a student's question using the note content as context
 *
 * Uses Gemini with a model fallback chain so that if one model is overloaded or
 * rate-limited, it automatically retries with the next available model.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createRequire } from 'module';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const require = createRequire(import.meta.url);
const pdfParseLib = require('pdf-parse');

// Extract up to 15 000 chars — enough context without overloading smaller models
const MAX_CHARS = 15_000;

const extractText = async (pdfBuffer) => {
  const data = await pdfParseLib(pdfBuffer);
  const text = (data.text || '').slice(0, MAX_CHARS).trim();
  return text;
};

// ─── Model fallback chain ────────────────────────────────────────────────────
// Tries models in order; skips any that return 503 (overloaded) or 429 (quota).
// Updated to use only validated, currently-available Gemini models.
const MODEL_CHAIN = [
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-pro',
];

const generateWithFallback = async (apiKey, promptOrContents) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastErr;
  
  for (const modelName of MODEL_CHAIN) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(promptOrContents);
      const text = result.response?.text?.();
      if (!text) {
        throw new Error(`Empty response from ${modelName}`);
      }
      logger.info(`aiNotesAssistant: ${modelName} succeeded`);
      return text.trim();
    } catch (err) {
      const errStr = String(err.message || err).toLowerCase();
      const statusMatch = err.status || parseInt(err.message?.match(/\b(4\d{2}|5\d{2})\b/)?.[0], 10);
      const statusCode = typeof statusMatch === 'number' ? statusMatch : null;
      
      // Check for specific error types
      const isAuthError = errStr.includes('api key') || errStr.includes('unauthorized') || errStr.includes('403') || errStr.includes('401');
      const isRateLimited = errStr.includes('503') || errStr.includes('429') || errStr.includes('overloaded') || statusCode === 503 || statusCode === 429;
      const isTimeout = errStr.includes('timeout') || errStr.includes('econnrefused');
      const isInvalidModel = errStr.includes('model') && errStr.includes('not found');
      
      const isRetryable = isRateLimited || isTimeout;
      const isFatal = isAuthError || isInvalidModel;
      
      logger.warn(
        `aiNotesAssistant: ${modelName} failed (${isRetryable ? 'retryable' : isFatal ? 'fatal-auth' : 'fatal'})`,
        { 
          error: err.message?.slice?.(0, 200) || String(err),
          status: statusCode,
          errorType: { isAuthError, isRateLimited, isTimeout, isInvalidModel }
        }
      );
      
      lastErr = err;
      
      // Stop retrying immediately on auth/API key/model errors
      if (isFatal) {
        logger.error(`aiNotesAssistant: fatal error, stopping retry chain`, { 
          status: statusCode,
          modelName,
          reason: isAuthError ? 'auth-error' : 'invalid-model'
        });
        break;
      }
      
      // Continue to next model if retryable or unknown error
    }
  }
  
  throw lastErr || new Error('All Gemini models failed or API key is invalid');
};

const toCleanLines = (text) => {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((line) => line.length >= 12);
};

const toSentences = (text) => {
  if (!text) return [];
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25);
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

const buildFallbackSummary = (noteText, meta = {}) => {
  const lines = toCleanLines(noteText);
  const sentences = toSentences(noteText);

  const summarySentences = sentences.slice(0, 5);
  const title = meta.title || 'this note';
  const subject = meta.subject || 'this subject';

  const summary = summarySentences.length
    ? summarySentences.join(' ')
    : `A concise summary could not be generated from ${title}. This note appears to cover important points for ${subject}. Please review the key topics and quick revision points below.`;

  const keyTopics = uniqueKeepOrder(
    lines
      .filter((line) => line.length <= 90)
      .slice(0, 10)
  );

  const quickRevision = uniqueKeepOrder(
    [...sentences.slice(0, 8), ...lines.slice(0, 8)]
      .map((item) => item.length > 170 ? `${item.slice(0, 167)}...` : item)
      .filter((item) => item.length >= 20)
  ).slice(0, 12);

  return {
    summary,
    keyTopics,
    quickRevision,
  };
};

const extractJsonCandidate = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  return raw.slice(firstBrace, lastBrace + 1);
};

const toStringArray = (value, maxItems = 15) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, maxItems);
};

const parseSummaryFromModelOutput = (raw, noteText, meta) => {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const candidates = [
    cleaned,
    extractJsonCandidate(cleaned),
    extractJsonCandidate(raw),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object') continue;

      const fallback = buildFallbackSummary(noteText, meta);
      const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : fallback.summary;

      const keyTopics = toStringArray(parsed.keyTopics, 10);
      const quickRevision = toStringArray(parsed.quickRevision, 15);

      return {
        summary,
        keyTopics: keyTopics.length ? keyTopics : fallback.keyTopics,
        quickRevision: quickRevision.length ? quickRevision : fallback.quickRevision,
      };
    } catch {
      // try next candidate
    }
  }

  return buildFallbackSummary(noteText, meta);
};

const buildFallbackChatAnswer = (noteText, question, meta = {}) => {
  const lines = toCleanLines(noteText);
  const linePool = lines.length ? lines : toSentences(noteText);

  const stopWords = new Set(['what', 'which', 'when', 'where', 'this', 'that', 'with', 'from', 'have', 'about', 'explain', 'tell', 'give', 'must', 'need', 'show']);
  const keywords = (question.toLowerCase().match(/[a-z]{3,}/g) || []).filter((k) => !stopWords.has(k));

  const matches = linePool.filter((line) =>
    keywords.some((keyword) => line.toLowerCase().includes(keyword))
  );

  const chosen = (matches.length ? matches : linePool).slice(0, 4);
  const bulletPoints = chosen.length
    ? chosen.map((item) => `- ${item}`).join('\n')
    : '- I could not extract enough text from this note to provide a targeted answer.';

  return [
    `Gemini is temporarily unavailable, so here is a quick answer from the note text (${meta.title || 'this note'}):`,
    '',
    bulletPoints,
    '',
    'Try again in a few moments for a full AI-generated explanation.'
  ].join('\n');
};

// ─── 1. Summary ──────────────────────────────────────────────────────────────

export const summariseNote = async (pdfBuffer, meta) => {
  let noteText = '';
  try {
    noteText = await extractText(pdfBuffer);
  } catch (err) {
    logger.error('aiNotesAssistant: text extraction failed', { error: err.message?.slice?.(0, 180) || String(err) });
    return buildFallbackSummary('', meta);
  }

  if (!noteText || noteText.length < 50) {
    logger.warn('aiNotesAssistant: insufficient text content extracted');
    return {
      summary: 'Not enough text content could be extracted from this note.',
      keyTopics: [],
      quickRevision: [],
    };
  }

  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    logger.error('aiNotesAssistant: GEMINI_API_KEY is missing or empty');
    return buildFallbackSummary(noteText, meta);
  }

  const prompt = `You are an expert academic tutor helping students prepare for exams.
Analyse the following study notes and create a comprehensive exam-ready summary.

Note Title: ${meta.title || 'Study Notes'}
Subject: ${meta.subject || 'General'}

--- NOTE CONTENT START ---
${noteText}
--- NOTE CONTENT END ---

Respond with ONLY a raw JSON object (no markdown, no code fences). The JSON must have exactly these fields:

{
  "summary": "A clear 3-5 paragraph overview of the entire content, written in simple language easy to understand just before an exam.",
  "keyTopics": ["topic 1", "topic 2", "topic 3", ...],
  "quickRevision": [
    "One-line key fact or formula that must be remembered",
    ...
  ]
}

Rules:
- keyTopics: list the 5-10 most important topics/concepts covered
- quickRevision: 8-15 bite-sized memory points — definitions, formulas, important dates, laws, theorems, etc.
- Write everything from the student's perspective (exam-focused)
- Do NOT include any key not listed above`;

  try {
    const raw = await generateWithFallback(apiKey, prompt);
    const parsed = parseSummaryFromModelOutput(raw, noteText, meta);
    logger.info('aiNotesAssistant: summariseNote generated successfully');
    return parsed;
  } catch (err) {
    logger.error('aiNotesAssistant: summariseNote failed, using fallback', { 
      error: err.message?.slice?.(0, 200) || String(err),
      hasNoteText: !!noteText,
      noteTextLength: noteText?.length || 0
    });
    return buildFallbackSummary(noteText, meta);
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
    return buildFallbackChatAnswer('', question, meta);
  }

  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    logger.error('aiNotesAssistant: GEMINI_API_KEY is missing or empty for chat');
    return buildFallbackChatAnswer(noteText, question, meta);
  }

  const systemContext = `You are an expert academic tutor. A student is asking questions about the following study material.

Note Title: ${meta.title || 'Study Notes'}
Subject: ${meta.subject || 'General'}

--- STUDY MATERIAL ---
${noteText || '(No extractable text in this note)'}
--- END OF STUDY MATERIAL ---

Rules:
- Answer ONLY based on the study material above and general academic knowledge.
- Keep answers clear, concise and exam-focused.
- If the answer is not in the material, say so honestly but still provide a helpful general answer.
- Use bullet points, numbered lists, or simple explanations where helpful.
- Do NOT invent or fabricate facts.`;

  // Build the full conversation as a single generateContent call (avoids startChat 503 issues)
  const contents = [
    { role: 'user', parts: [{ text: systemContext + '\n\nPlease confirm you understand and are ready to help.' }] },
    { role: 'model', parts: [{ text: 'Understood! I have read the study material and I am ready to help you with exam preparation. Ask me anything about it.' }] },
  ];

  // Append prior conversation turns (max last 8 to keep token count manageable)
  for (const turn of history.slice(-8)) {
    contents.push({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    });
  }

  contents.push({ role: 'user', parts: [{ text: question.trim() }] });

  try {
    const answer = await generateWithFallback(apiKey, { contents });
    if (!answer || !answer.trim()) {
      logger.warn('aiNotesAssistant: empty response from chat, using fallback');
      return buildFallbackChatAnswer(noteText, question, meta);
    }
    logger.info('aiNotesAssistant: chatAboutNote answered successfully');
    return answer;
  } catch (err) {
    logger.error('aiNotesAssistant: chatAboutNote failed, using fallback', { 
      error: err.message?.slice?.(0, 200) || String(err),
      hasNoteText: !!noteText,
      questionLength: question?.length || 0
    });
    return buildFallbackChatAnswer(noteText, question, meta);
  }
};



