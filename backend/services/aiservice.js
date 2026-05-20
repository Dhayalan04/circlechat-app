const OpenAI = require('openai');

let openai = null;

// Initialize OpenAI if API key is available
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log('✅ OpenAI initialized with real API');
} else {
  console.log('⚠️ OpenAI API key not found. AI features will use mock mode.');
  console.log('   Get your API key from: https://platform.openai.com/api-keys');
}

class AIService {
  // Generate smart reply suggestions
  static async generateSmartReplies(message) {
    // If OpenAI is not configured, use mock responses
    if (!openai) {
      return this.mockSmartReplies(message);
    }

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant. Generate 3-4 short, natural reply suggestions for this message. 
                      Each reply should be under 30 characters. Return as a JSON array of strings.
                      Example: ["👍", "Thanks!", "I agree", "Tell me more"]`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      const content = response.choices[0].message.content;
      
      // Parse the JSON response
      try {
        const suggestions = JSON.parse(content);
        return Array.isArray(suggestions) ? suggestions.slice(0, 4) : this.mockSmartReplies(message);
      } catch {
        // If parsing fails, extract from text or use mock
        return this.mockSmartReplies(message);
      }
    } catch (error) {
      console.error('OpenAI suggestion error:', error.message);
      return this.mockSmartReplies(message);
    }
  }

  // Fallback mock replies
  static mockSmartReplies(message) {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('?')) {
      return ['Yes', 'No', 'Maybe', 'Tell me more'];
    }
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
      return ['Hello! 👋', 'Hi there!', 'Hey! 👋', 'How are you?'];
    }
    if (lowerMsg.includes('thanks') || lowerMsg.includes('thank')) {
      return ['You\'re welcome!', 'Anytime!', 'My pleasure', '🙌'];
    }
    if (lowerMsg.includes('love') || lowerMsg.includes('❤️')) {
      return ['❤️', '💕', 'Same here!', '🥰'];
    }
    
    return ['👍', 'Interesting', 'I see', 'Got it', 'Thanks for sharing'];
  }

  // Summarize chat conversation
  static async summarizeChat(messages) {
    if (!messages || messages.length === 0) {
      return 'No messages to summarize yet.';
    }

    // If OpenAI is not configured, use mock summary
    if (!openai) {
      const participants = [...new Set(messages.map(m => m.username || 'Unknown'))];
      return `📊 Summary: ${messages.length} messages from ${participants.length} participants. ${participants.join(', ')} are in this chat.`;
    }

    try {
      const conversation = messages.slice(-50).map(m => `${m.username}: ${m.content}`).join('\n');
      
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant. Summarize this conversation in 2-3 sentences. 
                      Focus on key topics, decisions, and important points. 
                      Keep it concise and informative.`
          },
          { role: 'user', content: conversation }
        ],
        temperature: 0.5,
        max_tokens: 200,
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI summary error:', error.message);
      return `📝 Summary: ${messages.length} messages in this conversation. Ask me to summarize again when there are more messages.`;
    }
  }

  // AI Chat Assistant
  static async getAIResponse(message, context = '') {
    // If OpenAI is not configured, use mock responses
    if (!openai) {
      return this.mockAssistantResponse(message);
    }

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are CircleAI, a friendly, helpful assistant in a group chat app. 
                      Be concise, warm, and helpful. Keep responses under 150 characters when possible.
                      Use emojis occasionally to seem friendly.
                      If asked about yourself, say you're CircleAI, an AI assistant built to help with conversations.`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.8,
        max_tokens: 200,
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI assistant error:', error.message);
      return this.mockAssistantResponse(message);
    }
  }

  // Fallback mock assistant
  static mockAssistantResponse(message) {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
      return '👋 Hello! I\'m CircleAI, your chat assistant. How can I help you today?';
    }
    if (lowerMsg.includes('how are you')) {
      return 'I\'m doing great! Ready to help you with your conversations. 😊';
    }
    if (lowerMsg.includes('help')) {
      return 'I can help you with:\n• Getting smart reply suggestions\n• Summarizing conversations\n• Answering questions\n• And more! Just ask.';
    }
    if (lowerMsg.includes('what can you do')) {
      return 'I can generate reply suggestions, summarize chats, answer questions, and help you communicate better! ✨';
    }
    if (lowerMsg.includes('bye')) {
      return 'Goodbye! Feel free to ask me anything anytime. 👋';
    }
    
    return `🤖 I'm CircleAI! I can help summarize this chat, suggest replies, or answer questions. What would you like to know?`;
  }
}

module.exports = AIService;