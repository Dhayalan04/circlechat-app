const express = require('express');
const router = express.Router();
const AIService = require('../services/aiService');
const { authenticateToken } = require('../middleware/auth');
const { messageLimiter } = require('../middleware/rateLimiter');

// Get smart reply suggestions
router.post('/suggestions', authenticateToken, messageLimiter, async (req, res) => {
  const { message } = req.body;
  
  try {
    const suggestions = await AIService.generateSmartReplies(message);
    res.json({ suggestions: suggestions || ['👍', 'Thanks!', 'Interesting'] });
  } catch (error) {
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Summarize chat
router.post('/summarize', authenticateToken, async (req, res) => {
  const { messages } = req.body;
  
  try {
    const summary = await AIService.summarizeChat(messages);
    res.json({ summary: summary || 'Chat summary unavailable.' });
  } catch (error) {
    res.status(500).json({ error: 'Summarization failed' });
  }
});

// Chat with AI assistant
router.post('/assistant', authenticateToken, messageLimiter, async (req, res) => {
  const { message, context } = req.body;
  
  try {
    const response = await AIService.getAIResponse(message, context);
    res.json({ response: response || "I'm here to help! What would you like to know?" });
  } catch (error) {
    res.status(500).json({ error: 'AI assistant unavailable' });
  }
});

module.exports = router;