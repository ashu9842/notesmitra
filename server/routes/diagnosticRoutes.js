import express from 'express';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Comprehensive test of the full summary pipeline with detailed diagnostics
 * POST /diagnostic/test-summary-pipeline
 * Body: { text: "sample text", title: "...", subject: "..." }
 */
router.post('/test-summary-pipeline', async (req, res) => {
  try {
    const { text = 'Photosynthesis is the process by which plants convert light energy into chemical energy...',  title = 'Biology Notes',  subject = 'Biology' } = req.body;

    const diagnostics = {
      timestamp: new Date().toISOString(),
      input: { textLength: text.length, title, subject },
      steps: []
    };

    logger.info('test-summary-pipeline: starting', diagnostics.input);

    // Step 1: Verify Groq API key
    const apiKey = config.groqApiKey;
    diagnostics.steps.push({
      step: '1. API Key Check',
      status: apiKey ? 'OK' : 'FAIL',
      apiKeyLength: apiKey?.length || 0,
      apiKeyExists: !!apiKey
    });

    if (!apiKey) {
      return res.status(500).json({ ...diagnostics, error: 'GROQ_API_KEY not configured' });
    }

    // Step 2: Test Groq SDK import
    let Groq;
    try {
      const mod = await import('groq-sdk');
      Groq = mod.default || mod;
      diagnostics.steps.push({ step: '2. Groq SDK Import', status: 'OK' });
    } catch (err) {
      diagnostics.steps.push({ step: '2. Groq SDK Import', status: 'FAIL', error: err.message });
      return res.status(500).json({ ...diagnostics, error: 'Failed to import Groq SDK' });
    }

    // Step 3: Create Groq client
    const groq = new Groq({ apiKey });
    diagnostics.steps.push({ step: '3. Groq Client Creation', status: 'OK' });

    // Step 4: Call Groq API with actual content
    const modelName = 'llama-3.1-8b-instant';
    
    let groqResponse;
    try {
      groqResponse = await groq.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: 'You are a JSON response generator. IMPORTANT: Respond with ONLY valid JSON object. NO markdown. NO code fences. NO explanations. NO text before or after. Return raw valid JSON only.'
          },
          {
            role: 'user',
            content: `CONTENT: ${text}

CREATE THIS EXACT JSON WITH NO OTHER TEXT:
{
  "summary": "Write 2-3 sentences summarizing the main content concepts.",
  "keyTopics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5", "Topic 6", "Topic 7", "Topic 8"],
  "quickRevision": ["Fact 1", "Fact 2", "Fact 3", "Fact 4", "Fact 5", "Fact 6", "Fact 7", "Fact 8", "Fact 9", "Fact 10"]
}

NEVER ADD MARKDOWN, CODE FENCES, OR ANY TEXT OUTSIDE THE JSON.`
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
        top_p: 1
      });
      diagnostics.steps.push({
        step: `4. Groq API Call (${modelName})`,
        status: 'OK',
        responseLength: groqResponse?.choices?.[0]?.message?.content?.length || 0
      });
    } catch (err) {
      diagnostics.steps.push({
        step: `4. Groq API Call (${modelName})`,
        status: 'FAIL',
        error: err.message
      });
      return res.status(500).json({ ...diagnostics, error: `Groq API failed: ${err.message}` });
    }

    const rawResponse = groqResponse?.choices?.[0]?.message?.content || '';
    diagnostics.steps.push({
      step: '5. Response Extraction',
      status: rawResponse ? 'OK' : 'FAIL',
      responseLength: rawResponse.length,
      responsePreview: rawResponse.substring(0, 100)
    });

    if (!rawResponse) {
      return res.status(500).json({ ...diagnostics, error: 'Empty response from Groq' });
    }

    // Step 6: Parse JSON
    let parsed;
    try {
      const firstBrace = rawResponse.indexOf('{');
      const lastBrace = rawResponse.lastIndexOf('}');
      const jsonStr = firstBrace >= 0 && lastBrace > firstBrace ? rawResponse.slice(firstBrace, lastBrace + 1) : rawResponse;
      parsed = JSON.parse(jsonStr);
      diagnostics.steps.push({
        step: '6. JSON Parsing',
        status: 'OK',
        keys: Object.keys(parsed)
      });
    } catch (err) {
      diagnostics.steps.push({
        step: '6. JSON Parsing',
        status: 'FAIL',
        error: err.message,
        rawResponsePreview: rawResponse.substring(0, 200)
      });
      return res.status(500).json({ ...diagnostics, error: `JSON parse failed: ${err.message}` });
    }

    diagnostics.result = {
      status: 'SUCCESS',
      summary: parsed.summary?.substring(0, 100),
      keyTopicsCount: Array.isArray(parsed.keyTopics) ? parsed.keyTopics.length : 0,
      quickRevisionCount: Array.isArray(parsed.quickRevision) ? parsed.quickRevision.length : 0
    };

    return res.json(diagnostics);
  } catch (err) {
    logger.error('test-summary-pipeline error:', err.message);
    return res.status(500).json({
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 3)
    });
  }
});

/**
 * Test raw Groq response (no JSON parsing)
 * POST /diagnostic/test-raw-groq
 */
router.post('/test-raw-groq', async (req, res) => {
  try {
    const apiKey = config.groqApiKey;
    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY not set' });
    }

    let Groq;
    try {
      const mod = await import('groq-sdk');
      Groq = mod.default || mod;
    } catch (err) {
      return res.status(500).json({ error: 'Failed to import Groq SDK: ' + err.message });
    }

    const groq = new Groq({ apiKey });
    const modelName = 'llama-3.1-8b-instant';
    const result = await groq.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: 'You are a JSON generator. Respond with ONLY a JSON object. No markdown. No explanations. No code fences. No extra text. Return this exact format:'
        },
        {
          role: 'user',
          content: '{"summary": "Brief overview", "keyTopics": ["topic1", "topic2"], "quickRevision": ["point1", "point2"]}'
        }
      ],
      temperature: 0.3,
      max_tokens: 300,
      top_p: 1
    });

    const text = result?.choices?.[0]?.message?.content || '';
    
    return res.json({
      status: 'success',
      model: modelName,
      rawResponse: text,
      length: text.length,
      firstChars: text.substring(0, 200),
      isJson: text.trim().startsWith('{'),
      canParse: (() => {
        try {
          JSON.parse(text);
          return true;
        } catch {
          return false;
        }
      })()
    });
  } catch (err) {
    logger.error('test-raw-groq error:', err.message);
    return res.status(500).json({ 
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 3)
    });
  }
});

/**
 * Health check for Groq AI configuration and connectivity
 * GET /diagnostic/groq-health
 */
router.get('/config-check', (req, res) => {
  try {
    return res.json({
      status: 'ok',
      environment: process.env.NODE_ENV || 'development',
      groqApiKeyExists: !!config.groqApiKey,
      groqApiKeyLength: config.groqApiKey ? config.groqApiKey.length : 0,
      groqApiKeyPreview: config.groqApiKey ? `${config.groqApiKey.slice(0, 10)}...${config.groqApiKey.slice(-5)}` : 'NOT SET',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/groq-health', async (req, res) => {
  try {
    const apiKey = config.groqApiKey;
    
    if (!apiKey) {
      return res.status(500).json({
        status: 'error',
        message: 'GROQ_API_KEY is not configured',
        apiKeySet: false
      });
    }

    // Lazy load Groq SDK
    let Groq;
    try {
      const mod = await import('groq-sdk');
      Groq = mod.default || mod;
    } catch (err) {
      logger.error('groq-health: Failed to import Groq SDK', { error: err.message });
      return res.status(500).json({
        status: 'error',
        message: 'Groq SDK import failed',
        error: err.message
      });
    }

    const groq = new Groq({ apiKey });
    const modelsToTest = ['llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
    const results = [];

    for (const modelName of modelsToTest) {
      try {
        const result = await groq.chat.completions.create({
          model: modelName,
          messages: [{ role: 'user', content: 'Hi, test message' }],
          max_tokens: 50
        });
        const text = result?.choices?.[0]?.message?.content;
        results.push({
          model: modelName,
          status: 'working',
          response: text?.slice?.(0, 50),
          error: null
        });
        logger.info(`groq-health: ${modelName} is working`);
      } catch (err) {
        results.push({
          model: modelName,
          status: 'error',
          response: null,
          error: err.message?.slice?.(0, 200)
        });
        logger.error(`groq-health: ${modelName} failed`, { error: err.message });
      }
    }

    const working = results.filter(r => r.status === 'working').length;
    return res.json({
      status: working > 0 ? 'healthy' : 'degraded',
      message: `${working}/${modelsToTest.length} models responding`,
      models: results,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('groq-health error:', err.message);
    return res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

/**
 * Test the full summariseNote flow
 * POST /diagnostic/test-summary
 * Body: { text: "sample text to summarize" }
 */
router.post('/test-summary', async (req, res) => {
  try {
    const { text = 'Photosynthesis is the process by which plants convert light energy into chemical energy. It occurs in the chloroplasts of plant cells. The process involves two main stages: the light-dependent reactions and the light-independent reactions (Calvin cycle).' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text parameter required' });
    }

    const { summariseNote } = await import('../services/aiNotesAssistant.js');

    // Mock PDF buffer (we'll just use the text directly for testing)
    // In real scenario, this would come from a PDF
    const mockBuffer = Buffer.from(text);

    const result = await summariseNote(mockBuffer, {
      title: 'Diagnostic Test Note',
      subject: 'Science'
    });

    return res.status(200).json({
      status: 'success',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('test-summary: failed', { error: err.message });
    return res.status(500).json({
      status: 'error',
      message: 'Summary generation failed',
      error: err.message?.slice?.(0, 300) || String(err)
    });
  }
});

/**
 * Test Cloudinary file download
 * GET /diagnostic/test-cloudinary-download/:publicId
 */
router.get('/test-cloudinary-download/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    logger.info('test-cloudinary-download: starting', { publicId });

    // Import the download function
    const { downloadCloudinaryFile } = await import('../config/cloudinary.js');

    const diagnostics = {
      publicId,
      timestamp: new Date().toISOString(),
      steps: []
    };

    // Step 1: Check if downloadCloudinaryFile exists
    if (!downloadCloudinaryFile || typeof downloadCloudinaryFile !== 'function') {
      diagnostics.steps.push({ step: '1. Download Function Check', status: 'FAIL', error: 'Function not found' });
      return res.status(500).json({ ...diagnostics, error: 'downloadCloudinaryFile not available' });
    }
    diagnostics.steps.push({ step: '1. Download Function Check', status: 'OK' });

    // Step 2: Attempt download
    let response;
    try {
      response = await downloadCloudinaryFile(publicId);
      diagnostics.steps.push({
        step: '2. Cloudinary Fetch',
        status: response?.ok ? 'OK' : 'FAIL',
        httpStatus: response?.status,
        statusText: response?.statusText,
        headers: {
          contentType: response?.headers?.get?.('content-type'),
          contentLength: response?.headers?.get?.('content-length')
        }
      });
    } catch (err) {
      diagnostics.steps.push({
        step: '2. Cloudinary Fetch',
        status: 'ERROR',
        error: err.message,
        errorType: err.constructor.name
      });
      return res.status(500).json({ ...diagnostics, error: `Fetch failed: ${err.message}` });
    }

    if (!response?.ok) {
      diagnostics.steps.push({
        step: '3. Response Validation',
        status: 'FAIL',
        error: `HTTP ${response.status}: ${response.statusText}`
      });
      return res.status(response.status || 400).json({ ...diagnostics, error: `Download failed with status ${response.status}` });
    }

    // Step 3: Read response body
    let buffer;
    try {
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      diagnostics.steps.push({
        step: '3. Buffer Extraction',
        status: 'OK',
        bufferSize: buffer.length,
        bufferType: buffer.constructor.name
      });
    } catch (err) {
      diagnostics.steps.push({
        step: '3. Buffer Extraction',
        status: 'ERROR',
        error: err.message
      });
      return res.status(500).json({ ...diagnostics, error: `Buffer extraction failed: ${err.message}` });
    }

    diagnostics.result = {
      status: 'SUCCESS',
      bufferSize: buffer.length,
      isBuffer: Buffer.isBuffer(buffer),
      firstBytes: buffer.slice(0, 20).toString('hex')
    };

    return res.json(diagnostics);
  } catch (err) {
    logger.error('test-cloudinary-download error:', err.message);
    return res.status(500).json({
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 3)
    });
  }
});

/**
 * Test PDF text extraction for a specific note (requires purchase)
 * POST /diagnostic/test-pdf-extraction/:noteId
 * Tests: fetch PDF → parse → extract text
 */
router.post('/test-pdf-extraction/:noteId', async (req, res) => {
  try {
    const { Note, Purchase } = await import('../models/index.js');
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const note = await Note.findById(req.params.noteId).lean();
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const purchase = await Purchase.findOne({
      buyerId: userId,
      noteId: note._id,
      status: 'completed'
    });

    if (!purchase) {
      return res.status(403).json({ error: 'You must purchase this note' });
    }

    const diagnostics = {
      noteId: note._id,
      noteTitle: note.title,
      storageType: note.storageType,
      timestamp: new Date().toISOString(),
      steps: []
    };

    // Step 1: Fetch PDF buffer
    const fs = (await import('fs')).default;
    const { downloadCloudinaryFile } = await import('../config/cloudinary.js');
    const { extractText } = await import('../services/aiNotesAssistant.js');
    
    let pdfBuffer;
    try {
      if (note.storageType === 'cloudinary' && note.cloudinaryPublicId) {
        const response = await downloadCloudinaryFile(note.cloudinaryPublicId);
        if (!response?.ok) {
          diagnostics.steps.push({
            step: '1. Cloudinary Download',
            status: 'FAILED',
            httpStatus: response?.status,
            reason: `HTTP ${response?.status}: ${response?.statusText}`
          });
          return res.status(400).json({ ...diagnostics, error: 'Cloudinary download failed' });
        }
        pdfBuffer = Buffer.from(await response.arrayBuffer());
        diagnostics.steps.push({
          step: '1. Cloudinary Download',
          status: 'OK',
          bufferSize: pdfBuffer.length
        });
      } else if (note.filePath && fs.existsSync(note.filePath)) {
        pdfBuffer = fs.readFileSync(note.filePath);
        diagnostics.steps.push({
          step: '1. Local File Read',
          status: 'OK',
          bufferSize: pdfBuffer.length,
          filePath: note.filePath
        });
      } else {
        diagnostics.steps.push({
          step: '1. PDF Fetch',
          status: 'FAILED',
          reason: 'No valid storage location (not Cloudinary, file not found locally)'
        });
        return res.status(400).json({ ...diagnostics, error: 'Could not locate PDF file' });
      }
    } catch (err) {
      diagnostics.steps.push({
        step: '1. PDF Fetch',
        status: 'ERROR',
        error: err.message,
        errorType: err.constructor.name
      });
      return res.status(500).json({ ...diagnostics, error: err.message });
    }

    // Step 2: Extract text from PDF
    let extractedText = '';
    try {
      extractedText = await extractText(pdfBuffer);

      diagnostics.steps.push({
        step: '2. PDF Text Extraction',
        status: extractedText && extractedText.length > 0 ? 'OK' : 'EMPTY',
        textLength: extractedText ? extractedText.length : 0,
        textPreview: extractedText ? extractedText.substring(0, 150) : '(empty)',
        isEmpty: !extractedText || extractedText.length === 0
      });
    } catch (err) {
      diagnostics.steps.push({
        step: '2. PDF Text Extraction',
        status: 'ERROR',
        error: err.message,
        errorType: err.constructor.name
      });
      return res.status(500).json({ ...diagnostics, error: err.message });
    }

    // Step 3: Evaluate text quality
    const textLen = extractedText ? extractedText.length : 0;
    diagnostics.evaluation = {
      canGenerateSummary: textLen > 0,
      textQuality: textLen > 500 ? 'GOOD' : textLen > 100 ? 'MINIMAL' : textLen > 0 ? 'VERY_SHORT' : 'EMPTY',
      recommendation: textLen < 50 ? 'PDF may be corrupted, empty, or too short to summarize' : 'Ready for AI processing'
    };

    return res.json(diagnostics);
  } catch (err) {
    logger.error('test-pdf-extraction error:', err.message);
    return res.status(500).json({
      error: err.message,
      errorType: err.constructor.name
    });
  }
});

/**
 * Full debug trace of summariseNote process
 * POST /diagnostic/trace-summary/:noteId
 * Shows: fetch → extract → groq → parse with EVERY detail
 */
router.post('/diagnostic/trace-summary/:noteId', async (req, res) => {
  const trace = [];
  const log = (step, status, details) => {
    trace.push({ step, status, details, timestamp: new Date().toISOString() });
    console.log(`[${step}] ${status}:`, details);
  };

  try {
    const { Note } = await import('../models/index.js');

    log('DB', 'FETCH', 'Loading note from database (diagnostic mode - no auth check)');
    const note = await Note.findById(req.params.noteId).lean();
    if (!note) return res.status(404).json({ error: 'Note not found', trace });
    log('DB', 'OK', { title: note.title, storageType: note.storageType, hasCloudinary: !!note.cloudinaryPublicId, hasPath: !!note.filePath });

    // STEP 1: Fetch PDF
    log('PDF Fetch', 'START', { storageType: note.storageType });
    const fs = (await import('fs')).default;
    const { downloadCloudinaryFile } = await import('../config/cloudinary.js');
    const { extractText } = await import('../services/aiNotesAssistant.js');
    
    let pdfBuffer = null;
    if (note.storageType === 'cloudinary' && note.cloudinaryPublicId) {
      try {
        const resp = await downloadCloudinaryFile(note.cloudinaryPublicId);
        if (!resp?.ok) {
          log('PDF Fetch', 'FAILED', { status: resp?.status, reason: 'HTTP not OK' });
          return res.status(400).json({ error: 'Cloudinary download failed', trace });
        }
        pdfBuffer = Buffer.from(await resp.arrayBuffer());
        log('PDF Fetch', 'OK', { source: 'Cloudinary', bufferSize: pdfBuffer.length });
      } catch (e) {
        log('PDF Fetch', 'ERROR', e.message);
        return res.status(500).json({ error: e.message, trace });
      }
    } else if (note.filePath && fs.existsSync(note.filePath)) {
      try {
        pdfBuffer = fs.readFileSync(note.filePath);
        log('PDF Fetch', 'OK', { source: 'LocalFile', bufferSize: pdfBuffer.length });
      } catch (e) {
        log('PDF Fetch', 'ERROR', e.message);
        return res.status(500).json({ error: e.message, trace });
      }
    } else {
      log('PDF Fetch', 'FAILED', 'No Cloudinary ID or local file path');
      return res.status(400).json({ error: 'No PDF found', trace });
    }

    if (!pdfBuffer) {
      log('PDF Fetch', 'FAILED', 'Buffer is null');
      return res.status(400).json({ error: 'Buffer is null', trace });
    }

    // STEP 2: Extract Text
    log('Extract Text', 'START', { bufferSize: pdfBuffer.length });
    let extractedText = '';
    try {
      extractedText = await extractText(pdfBuffer);
      log('Extract Text', 'OK', { length: extractedText.length, isEmpty: extractedText.length === 0, preview: extractedText.substring(0, 100) });
    } catch (e) {
      log('Extract Text', 'ERROR', e.message);
      return res.status(500).json({ error: 'Extract failed: ' + e.message, trace });
    }

    if (!extractedText || extractedText.length === 0) {
      log('Extract Text', 'RESULT', '❌ NO TEXT EXTRACTED - PDF is empty, image-based, or corrupted');
      return res.json({ error: 'Empty PDF - no text extracted', trace, recommendation: 'PDF may be a scanned image or corrupted file' });
    }

    // STEP 3: Check Groq API Key
    const { default: config } = await import('../config/env.js');
    log('Groq API', 'CHECK', 'Verifying API key');
    if (!config.groqApiKey) {
      log('Groq API', 'FAILED', 'API key not set');
      return res.status(500).json({ error: 'No Groq API key', trace });
    }
    log('Groq API', 'OK', { keyLength: config.groqApiKey.length });

    // STEP 4: Call Groq
    log('Groq Call', 'START', 'Sending text to Groq');
    const { default: Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey: config.groqApiKey });
    
    const prompt = `CONTENT: ${extractedText}

CREATE THIS EXACT JSON WITH NO OTHER TEXT:
{
  "summary": "Write 2-3 sentences summarizing.",
  "keyTopics": ["T1", "T2", "T3"],
  "quickRevision": ["F1", "F2", "F3"]
}

NEVER ADD MARKDOWN OR TEXT OUTSIDE JSON.`;

    let groqResponse = '';
    try {
      const result = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Respond with ONLY valid JSON. NO markdown. NO explanations.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      });
      groqResponse = result?.choices?.[0]?.message?.content || '';
      log('Groq Call', 'OK', { responseLength: groqResponse.length, preview: groqResponse.substring(0, 100) });
    } catch (e) {
      log('Groq Call', 'ERROR', e.message);
      return res.status(500).json({ error: 'Groq API call failed: ' + e.message, trace });
    }

    if (!groqResponse) {
      log('Groq Call', 'RESULT', '❌ EMPTY RESPONSE from Groq');
      return res.json({ error: 'Groq returned empty response', trace });
    }

    // STEP 5: Parse JSON
    log('Parse JSON', 'START', '');
    let parsed = null;
    try {
      const firstBrace = groqResponse.indexOf('{');
      const lastBrace = groqResponse.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = groqResponse.substring(firstBrace, lastBrace + 1);
        parsed = JSON.parse(jsonStr);
        log('Parse JSON', 'OK', { keys: Object.keys(parsed) });
      } else {
        throw new Error('No JSON braces found');
      }
    } catch (e) {
      log('Parse JSON', 'ERROR', e.message);
      return res.json({ 
        error: 'Failed to parse Groq response as JSON',
        groqRawResponse: groqResponse.substring(0, 200),
        trace 
      });
    }

    log('SUCCESS', '✅', { topicsCount: parsed.keyTopics?.length, pointsCount: parsed.quickRevision?.length });
    return res.json({
      success: true,
      result: parsed,
      trace,
      diagnostics: {
        textExtracted: extractedText.length,
        groqResponseLength: groqResponse.length,
        topicsGenerated: parsed.keyTopics?.length || 0,
        pointsGenerated: parsed.quickRevision?.length || 0
      }
    });
  } catch (err) {
    log('CRASH', '❌', err.message);
    return res.status(500).json({ error: err.message, trace });
  }
});

export default router;
