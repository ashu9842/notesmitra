import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/env.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Health check for Gemini AI configuration and connectivity
 * GET /diagnostic/gemini-health
 */
router.get('/gemini-health', async (req, res) => {
  try {
    const apiKey = config.geminiApiKey;
    
    if (!apiKey) {
      return res.status(500).json({
        status: 'error',
        message: 'GEMINI_API_KEY is not configured',
        apiKeySet: false,
        models: []
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Try to list available models first
    let availableModels = [];
    try {
      const modelsList = await genAI.listModels();
      availableModels = modelsList.map(m => m.name.replace('models/', ''));
      logger.info('Available Gemini models:', availableModels);
    } catch (err) {
      logger.warn('Could not list models:', err.message);
    }

    const modelsToTest = availableModels.length > 0 
      ? availableModels.slice(0, 3)  // Use first 3 available
      : ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-pro'];  // Fallback

    const results = [];

    for (const modelName of modelsToTest) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(
          'Say "OK" if you can hear me.'
        );
        const text = result.response?.text?.();
        
        results.push({
          model: modelName,
          status: 'working',
          response: text?.slice?.(0, 100) || 'no response',
          error: null
        });
        logger.info(`gemini-health: ${modelName} is working`);
      } catch (err) {
        results.push({
          model: modelName,
          status: 'error',
          response: null,
          error: err.message?.slice?.(0, 200) || String(err)
        });
        logger.error(`gemini-health: ${modelName} failed`, { error: err.message });
      }
    }

    const workingModels = results.filter(r => r.status === 'working').length;
    const allWorking = workingModels > 0;

    return res.status(allWorking ? 200 : 206).json({
      status: allWorking ? 'healthy' : 'degraded',
      message: `${workingModels}/${modelsToTest.length} models responding`,
      apiKeySet: true,
      availableModels: availableModels.length > 0 ? availableModels : 'could not list',
      models: results,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('gemini-health: diagnostic failed', { error: err.message });
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
