const OpenAI = require('openai');

let openai = null;

try {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
} catch (error) {
  console.log('OpenAI not configured - AI features disabled');
}

class AIService {
  static async generateSmartReplies(message) {
    if (!openai) return null;
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Generate 3 short reply suggestions for this message. Each under 30 characters. Return as JSON array.'
          },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 100,
      });
      
      try {
        return JSON.parse(response.choices[0].message.content);
      } catch {
        return ['👍', 'Thanks!', 'Got it'];
      }
    } catch (error) {
      console.error('AI suggestion error:', error);
      return null;
    }
  }

  static async summarizeChat(messages) {
    if (!openai) return 'AI features are not configured. Add OpenAI API key to enable.';
    
    const conversation = messages.slice(-30).map(m => `${m.username}: ${m.content}`).join('\n');
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Summarize this conversation in 2-3 sentences. Focus on key points.'
          },
          { role: 'user', content: conversation }
        ],
        temperature: 0.5,
        max_tokens: 150,
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Summarization error:', error);
      return 'Unable to summarize at this moment.';
    }
  }

  static async getAIResponse(message, context = '') {
    if (!openai) return '🤖 AI assistant is not configured. Add OpenAI API key to enable smart replies!';
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are CircleAI, a friendly assistant in a group chat. Be concise and helpful. Keep responses under 100 characters.`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.8,
        max_tokens: 150,
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error('AI response error:', error);
      return "I'm having trouble responding right now. Please try again!";
    }
  }
}

module.exports = AIService;