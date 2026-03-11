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
const MODEL_CHAIN = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
];

const generateWithFallback = async (apiKey, promptOrContents) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastErr;
  for (const modelName of MODEL_CHAIN) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(promptOrContents);
      return result.response.text().trim();
    } catch (err) {
      const isRetryable = err.message.includes('503') || err.message.includes('429') || err.message.includes('overloaded');
      logger.warn(`aiNotesAssistant: model ${modelName} failed (${isRetryable ? 'retryable' : 'fatal'})`, { error: err.message.slice(0, 120) });
      lastErr = err;
      if (!isRetryable) break; // don't retry on 404 / auth errors
    }
  }
  throw lastErr;
};

// ─── 1. Summary ──────────────────────────────────────────────────────────────

export const summariseNote = async (pdfBuffer, meta) => {
  const noteText = await extractText(pdfBuffer);

  if (!noteText || noteText.length < 50) {
    return {
      summary: 'Not enough text content could be extracted from this note.',
      keyTopics: [],
      quickRevision: [],
    };
  }

  const apiKey = config.geminiApiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

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
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary || '',
      keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : [],
      quickRevision: Array.isArray(parsed.quickRevision) ? parsed.quickRevision : [],
    };
  } catch (err) {
    logger.error('aiNotesAssistant: summariseNote failed', { error: err.message });
    throw new Error('AI summary generation failed. Please try again.');
  }
};

// ─── 2. Chat ─────────────────────────────────────────────────────────────────

export const chatAboutNote = async (pdfBuffer, meta, question, history = []) => {
  if (!question || question.trim().length < 2) {
    throw new Error('Please enter a valid question.');
  }

  const noteText = await extractText(pdfBuffer);

  const apiKey = config.geminiApiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

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
    return answer;
  } catch (err) {
    logger.error('aiNotesAssistant: chatAboutNote failed', { error: err.message });
    throw new Error('AI chat failed. Please try again.');
  }
};



