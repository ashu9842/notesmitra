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
    // Step 1: Check API key
    const apiKey = config.groqApiKey;
    logger.info('DEBUG: groq-health baseline check', { hasApiKey: !!apiKey });
    
    if (!apiKey) {
      return res.json({
        step: 1,
        status: 'error',
        message: 'GROQ_API_KEY not found in config'
      });
    }

    // Step 2: Try to import Groq
    logger.info('DEBUG: attempting to import groq-sdk...');
    let Groq;
    try {
      const mod = await import('groq-sdk');
      logger.info('DEBUG: import succeeded, checking exports...', { keys: Object.keys(mod) });
      Groq = mod.default || mod.Groq || mod;
    } catch (importErr) {
      logger.error('DEBUG: import failed', { error: importErr.message, stack: importErr.stack });
      return res.json({
        step: 2,
        status: 'error',
        message: 'Groq SDK import failed',
        error: importErr.message
      });
    }

    logger.info('DEBUG: Groq object status', { isNull: !Groq, isFunc: typeof Groq === 'function' });

    if (!Groq || typeof Groq !== 'function') {
      return res.json({
        step: 3,
        status: 'error',
        message: 'Groq is not a function',
        groqType: typeof Groq
      });
    }

    // Step 3: Try to instantiate
    logger.info('DEBUG: creating Groq instance...');
    const groq = new Groq({ apiKey });
    logger.info('DEBUG: Groq instance created successfully');

    return res.json({
      step: 4,
      status: 'success',
      message: 'Groq ready for testing',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('groq-health error:', { message: err.message, stack: err.stack });
    return res.status(500).json({
      status: 'error',
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5)
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
