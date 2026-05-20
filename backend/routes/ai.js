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
    console.error('AI suggestions error:', error);
    res.status(500).json({ error: 'AI service temporarily unavailable' });
  }
});

// Summarize chat
router.post('/summarize', authenticateToken, async (req, res) => {
  const { messages } = req.body;
  
  if (!messages || messages.length === 0) {
    return res.json({ summary: 'No messages to summarize yet. Start a conversation!' });
  }
  
  try {
    const summary = await AIService.summarizeChat(messages);
    res.json({ summary });
  } catch (error) {
    console.error('Summarization error:', error);
    res.json({ summary: 'Unable to summarize at this moment. Please try again.' });
  }
});

// Chat with AI assistant
router.post('/assistant', authenticateToken, messageLimiter, async (req, res) => {
  const { message, context } = req.body;
  
  if (!message || !message.trim()) {
    return res.json({ response: 'Hi! What would you like to talk about?' });
  }
  
  try {
    const response = await AIService.getAIResponse(message, context);
    res.json({ response });
  } catch (error) {
    console.error('AI assistant error:', error);
    res.json({ response: "I'm having trouble responding right now. Please try again in a moment!" });
  }
});

// Health check for AI
router.get('/health', authenticateToken, (req, res) => {
  const hasOpenAI = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here';
  res.json({ 
    status: 'ok',
    openai_configured: hasOpenAI,
    message: hasOpenAI ? 'AI features are ready!' : 'Add OPENAI_API_KEY to enable AI features'
  });
});

module.exports = router;