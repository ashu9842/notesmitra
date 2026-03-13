import express from 'express';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Health check for Groq AI configuration and connectivity
 * GET /diagnostic/groq-health
 */
router.get('/groq-health', async (req, res) => {
  try {
    const apiKey = config.groqApiKey;
    
    if (!apiKey) {
      return res.status(500).json({
        status: 'error',
        message: 'GROQ_API_KEY is not configured',
        apiKeySet: false,
        models: []
      });
    }

    // Lazy load Groq to avoid crashes if SDK not available
    let Groq;
    try {
      const groqModule = await import('groq-sdk');
      Groq = groqModule.default;
    } catch (err) {
      logger.error('groq-health: Failed to import Groq SDK', { error: err.message });
      return res.status(500).json({
        status: 'error',
        message: 'Groq SDK failed to load',
        error: err.message || 'Import failed'
      });
    }

    const groq = new Groq({ apiKey });
    
    // Groq models to test
    const modelsToTest = [
      'mixtral-8x7b-32768',
      'llama2-70b-4096',
    ];

    const results = [];

    for (const modelName of modelsToTest) {
      try {
        const result = await groq.chat.completions.create({
          model: modelName,
          messages: [
            {
              role: 'user',
              content: 'Say "OK" if you can hear me.'
            }
          ],
          temperature: 0.5,
          max_tokens: 50
        });
        const text = result?.choices?.[0]?.message?.content;
        
        results.push({
          model: modelName,
          status: 'working',
          response: text?.slice?.(0, 100) || 'no response',
          error: null
        });
        logger.info(`groq-health: ${modelName} is working`);
      } catch (err) {
        results.push({
          model: modelName,
          status: 'error',
          response: null,
          error: err.message?.slice?.(0, 200) || String(err)
        });
        logger.error(`groq-health: ${modelName} failed`, { error: err.message });
      }
    }


    return res.status(allWorking ? 200 : 206).json({
      status: allWorking ? 'healthy' : 'degraded',
      message: `${workingModels}/${modelsToTest.length} models responding`,
      apiKeySet: true,
      models: results,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('groq-health: diagnostic failed', { error: err.message });
    return res.status(500).json({
      status: 'error',
      message: 'Diagnostic test failed',
      error: err.message?.slice?.(0, 200) || String(err)
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
