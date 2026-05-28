import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiCpu } from 'react-icons/fi';

const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

const openAIRequest = async (messages) => {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Set REACT_APP_OPENAI_API_KEY in your .env file.');
  }

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 250,
      temperature: 0.8,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    }
  );

  return response.data?.choices?.[0]?.message?.content?.trim() ?? '';
};

const parseSuggestions = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[\).\s]*/, '').trim())
    .filter(Boolean)
    .slice(0, 3);

const AIAssistant = ({ currentMessage, onSuggestionClick, messages }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aiChat, setAiChat] = useState([]);
  const [aiInput, setAiInput] = useState('');

  const getSuggestions = async () => {
    if (!currentMessage?.trim()) {
      toast.error('Type a message first');
      return;
    }

    setIsLoading(true);
    try {
      const prompt = [
        {
          role: 'system',
          content: 'You are an AI assistant for CircleChat. Generate up to 3 short, friendly reply suggestions for a chat message.',
        },
        {
          role: 'user',
          content: `Message: "${currentMessage.trim()}"\n\nProvide 3 short reply suggestions, one per line.`,
        },
      ];

      const result = await openAIRequest(prompt);
      setSuggestions(parseSuggestions(result));
    } catch (err) {
      toast.error(err.message || 'Failed to get suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const getSummary = async () => {
    if (!messages || messages.length === 0) {
      toast.error('No messages to summarize');
      return;
    }

    setIsLoading(true);
    try {
      const conversation = messages
        .slice(-50)
        .map((msg) => `${msg.username || 'Member'}: ${msg.content}`)
        .join('\n');

      const prompt = [
        {
          role: 'system',
          content: 'You are an AI assistant for CircleChat. Summarize the conversation briefly and clearly.',
        },
        {
          role: 'user',
          content: `Summarize the following conversation in 2-3 sentences:\n\n${conversation}`,
        },
      ];

      const result = await openAIRequest(prompt);
      setSummary(result);
    } catch (err) {
      toast.error(err.message || 'Failed to summarize');
    } finally {
      setIsLoading(false);
    }
  };

  const sendAIMessage = async () => {
    if (!aiInput.trim()) return;

    const userMessage = { role: 'user', content: aiInput };
    setAiChat((prev) => [...prev, userMessage]);
    setAiInput('');

    setIsLoading(true);
    try {
      const recentMessages = messages
        ? messages.slice(-20).map((msg) => ({
            role: 'user',
            content: `${msg.username || 'Member'}: ${msg.content}`,
          }))
        : [];

      const prompt = [
        {
          role: 'system',
          content: 'You are CircleChat AI. Answer questions and help users compose messages based on the latest chat context.',
        },
        ...recentMessages,
        { role: 'user', content: aiInput.trim() },
      ];

      const result = await openAIRequest(prompt);
      const aiMessage = { role: 'assistant', content: result };
      setAiChat((prev) => [...prev, aiMessage]);
    } catch (err) {
      toast.error(err.message || 'AI assistant error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#007aff',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
        }}
      >
        <FiCpu size={24} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '28px',
              width: '90%',
              maxWidth: '560px',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid #e9ecef',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0 }}>CircleAI Assistant</h3>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', gap: '12px', flexDirection: 'column' }}>
              <button
                onClick={getSuggestions}
                style={{ padding: '12px', background: '#007aff', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer' }}
              >
                {isLoading ? 'Generating...' : '✨ Generate Smart Replies'}
              </button>

              {suggestions.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        onSuggestionClick(s);
                        setIsOpen(false);
                      }}
                      style={{ padding: '8px 16px', background: '#f0f2f5', border: 'none', borderRadius: '20px', cursor: 'pointer' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={getSummary}
                style={{ padding: '12px', background: '#f0f2f5', border: 'none', borderRadius: '12px', cursor: 'pointer' }}
              >
                📝 Summarize Conversation
              </button>

              {summary && (
                <div style={{ padding: '12px', background: '#f8f9fa', borderRadius: '12px' }}>
                  <p style={{ margin: 0 }}>{summary}</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="ai-input" style={{ fontWeight: 600 }}>
                  Ask CircleAI anything or craft a message
                </label>
                <textarea
                  id="ai-input"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  rows={3}
                  placeholder="Write a prompt for the assistant..."
                  style={{ width: '100%', padding: '12px', border: '1px solid #dde2ea', borderRadius: '12px', resize: 'vertical' }}
                />
                <button
                  onClick={sendAIMessage}
                  style={{ padding: '12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer' }}
                >
                  {isLoading ? 'Thinking…' : 'Send to CircleAI'}
                </button>
              </div>

              {aiChat.length > 0 && (
                <div style={{ padding: '12px', background: '#f8f9fa', borderRadius: '12px', maxHeight: '240px', overflow: 'auto' }}>
                  {aiChat.map((msg, index) => (
                    <div key={index} style={{ marginBottom: '12px' }}>
                      <strong style={{ textTransform: 'capitalize' }}>{msg.role}</strong>
                      <p style={{ margin: '8px 0 0' }}>{msg.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
