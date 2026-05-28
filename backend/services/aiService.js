require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Fallback smart replies (no API key needed)
const FALLBACK_REPLIES = {
  'hello': ['Hi there! 👋', 'Hey! How are you?', 'Hello! What\'s up?'],
  'thanks': ['You\'re welcome! 😊', 'Anytime!', 'Happy to help!'],
  'ok': ['Sounds good! 👍', 'Perfect!', 'Got it!'],
  'sorry': ['No worries! 😊', 'It\'s all good!', 'Don\'t worry about it!'],
  'bye': ['See you later! 👋', 'Catch you soon!', 'Goodbye!'],
};

// Generate context-aware fallback suggestions
const generateFallbackReplies = (message) => {
  const lowercased = message.toLowerCase().trim();
  
  // Check for keyword matches
  for (const [key, replies] of Object.entries(FALLBACK_REPLIES)) {
    if (lowercased.includes(key)) {
      return replies;
    }
  }
  
  // Generic suggestions based on message characteristics
  if (lowercased.includes('?')) {
    return ['That\'s a great question! 🤔', 'Let me think about that...', 'Good point!'];
  }
  if (lowercased.includes('!')) {
    return ['That\'s awesome! 🎉', 'I totally agree!', 'Absolutely!'];
  }
  
  return ['Thanks for sharing! 😊', 'Interesting! 🤔', 'I understand!'];
};

// OpenAI implementation
const callOpenAI = async (messages, model = 'gpt-3.5-turbo') => {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'sk-your-openai-api-key-here') {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenAI error:', error.message);
    throw error;
  }
};

// Groq implementation (faster, free tier available)
const callGroq = async (messages, model = 'mixtral-8x7b-32768') => {
  if (!GROQ_API_KEY || GROQ_API_KEY === 'your-groq-api-key-here') {
    throw new Error('Groq API key not configured');
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Groq API error');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('Groq error:', error.message);
    throw error;
  }
};

// Public API
const AIService = {
  /**
   * Generate smart reply suggestions for a message
   * @param {string} message - User message to suggest replies for
   * @returns {Promise<string[]>} Array of suggested replies
   */
  generateSmartReplies: async (message) => {
    try {
      // Try OpenAI first
      if (OPENAI_API_KEY && OPENAI_API_KEY !== 'sk-your-openai-api-key-here') {
        const aiResponse = await callOpenAI([
          {
            role: 'system',
            content: 'Generate exactly 3 short (under 15 words each) natural reply suggestions for the given message. Return only the suggestions as a JSON array of strings, nothing else. Example: ["Great idea!", "I agree", "Tell me more"]'
          },
          {
            role: 'user',
            content: message
          }
        ]);

        try {
          const suggestions = JSON.parse(aiResponse);
          if (Array.isArray(suggestions) && suggestions.length > 0) {
            return suggestions.slice(0, 3);
          }
        } catch (e) {
          console.warn('Failed to parse AI response, using fallback');
        }
      }

      // Try Groq if OpenAI fails
      if (GROQ_API_KEY && GROQ_API_KEY !== 'your-groq-api-key-here') {
        const aiResponse = await callGroq([
          {
            role: 'system',
            content: 'Generate exactly 3 short (under 15 words each) natural reply suggestions for the given message. Return only the suggestions as a JSON array of strings, nothing else.'
          },
          {
            role: 'user',
            content: message
          }
        ]);

        try {
          const suggestions = JSON.parse(aiResponse);
          if (Array.isArray(suggestions) && suggestions.length > 0) {
            return suggestions.slice(0, 3);
          }
        } catch (e) {
          console.warn('Failed to parse Groq response, using fallback');
        }
      }
    } catch (error) {
      console.error('Error generating smart replies:', error.message);
    }

    // Fallback to offline suggestions
    return generateFallbackReplies(message);
  },

  /**
   * Summarize a conversation
   * @param {Array} messages - Array of messages with content and sender properties
   * @returns {Promise<string>} Summary of the conversation
   */
  summarizeChat: async (messages) => {
    if (!messages || messages.length === 0) {
      return 'No messages to summarize.';
    }

    const messageText = messages
      .slice(-50) // Use last 50 messages to stay within token limits
      .map((msg) => `${msg.sender || 'User'}: ${msg.content || msg.message || msg.text}`)
      .join('\n');

    try {
      // Try OpenAI first
      if (OPENAI_API_KEY && OPENAI_API_KEY !== 'sk-your-openai-api-key-here') {
        const summary = await callOpenAI([
          {
            role: 'system',
            content: 'Summarize the following conversation in 2-3 sentences. Be concise and capture the main points.'
          },
          {
            role: 'user',
            content: messageText
          }
        ]);

        if (summary && summary.trim()) {
          return summary.trim();
        }
      }

      // Try Groq
      if (GROQ_API_KEY && GROQ_API_KEY !== 'your-groq-api-key-here') {
        const summary = await callGroq([
          {
            role: 'system',
            content: 'Summarize the following conversation in 2-3 sentences. Be concise and capture the main points.'
          },
          {
            role: 'user',
            content: messageText
          }
        ]);

        if (summary && summary.trim()) {
          return summary.trim();
        }
      }
    } catch (error) {
      console.error('Error summarizing chat:', error.message);
    }

    // Fallback summary
    return `Chat with ${messages.length} messages. Last message: "${(messages[messages.length - 1].content || messages[messages.length - 1].message || 'N/A').substring(0, 50)}..."`;
  },

  /**
   * Get AI response to a message
   * @param {string} message - User message
   * @param {string} context - Optional conversation context
   * @returns {Promise<string>} AI response
   */
  getAIResponse: async (message, context = '') => {
    const systemMessage = {
      role: 'system',
      content: 'You are a helpful, friendly AI assistant. Keep responses concise (under 100 words). Be conversational and supportive.'
    };

    const messages = [systemMessage];

    if (context && context.trim()) {
      messages.push({
        role: 'user',
        content: `Context: ${context}`
      });
    }

    messages.push({
      role: 'user',
      content: message
    });

    try {
      // Try OpenAI first
      if (OPENAI_API_KEY && OPENAI_API_KEY !== 'sk-your-openai-api-key-here') {
        const response = await callOpenAI(messages);
        if (response && response.trim()) {
          return response.trim();
        }
      }

      // Try Groq
      if (GROQ_API_KEY && GROQ_API_KEY !== 'your-groq-api-key-here') {
        const response = await callGroq(messages);
        if (response && response.trim()) {
          return response.trim();
        }
      }
    } catch (error) {
      console.error('Error getting AI response:', error.message);
    }

    // Fallback responses
    const fallbacks = [
      'That\'s interesting! Tell me more about it.',
      'I understand. How can I help you with that?',
      'Thanks for sharing! What would you like to know?',
      'I\'m here to help! What\'s on your mind?',
    ];

    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  },

  /**
   * Check if AI services are configured
   * @returns {object} Configuration status
   */
  getStatus: () => {
    return {
      openai_configured: !!(OPENAI_API_KEY && OPENAI_API_KEY !== 'sk-your-openai-api-key-here'),
      groq_configured: !!(GROQ_API_KEY && GROQ_API_KEY !== 'your-groq-api-key-here'),
      fallback_enabled: true,
      message: 'AI features ready. Configure OPENAI_API_KEY or GROQ_API_KEY for enhanced features.'
    };
  }
};

module.exports = AIService;
