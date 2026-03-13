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
    return res.json({
      status: 'debug',
      apiKey: config.groqApiKey ? 'SET' : 'NOT SET',
      configs: Object.keys(config).slice(0, 10),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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
