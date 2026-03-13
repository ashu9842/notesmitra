import express from 'express';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const router = express.Router();

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
    const prompt = `You are a study assistant. Create a structured summary with JSON format.
    
Provide response as:
{
  "summary": "Brief overview",
  "keyTopics": ["topic1", "topic2"],
  "quickRevision": ["point1", "point2"]
}`;

    const modelName = 'llama-3.1-8b-instant';
    const result = await groq.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
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

export default router;
