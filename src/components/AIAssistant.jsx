import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiCpu, FiSend, FiX, FiZap, FiMessageSquare, FiSummarize } from 'react-icons/fi';

const AIAssistant = ({ currentMessage, onSuggestionClick, messages, token }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aiChat, setAiChat] = useState([]);
  const [aiInput, setAiInput] = useState('');

  const getSuggestions = async () => {
    if (!currentMessage) {
      toast.error('Type a message first');
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await axios.post('/api/ai/suggestions', 
        { message: currentMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuggestions(res.data.suggestions || []);
    } catch (err) {
      toast.error('Failed to get suggestions');
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
      const res = await axios.post('/api/ai/summarize',
        { messages: messages.slice(-50) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSummary(res.data.summary);
    } catch (err) {
      toast.error('Failed to summarize');
    } finally {
      setIsLoading(false);
    }
  };
  
  const sendAIMessage = async () => {
    if (!aiInput.trim()) return;
    
    const userMessage = { role: 'user', content: aiInput };
    setAiChat(prev => [...prev, userMessage]);
    setAiInput('');
    
    try {
      const res = await axios.post('/api/ai/assistant',
        { message: aiInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const aiMessage = { role: 'assistant', content: res.data.response };
      setAiChat(prev => [...prev, aiMessage]);
    } catch (err) {
      toast.error('AI assistant error');
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
          zIndex: 1000
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
            zIndex: 1001
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '28px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '20px', borderBottom: '1px solid #e9ecef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>CircleAI Assistant</h3>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: '20px', display: 'flex', gap: '12px', flexDirection: 'column' }}>
              <button onClick={getSuggestions} style={{ padding: '12px', background: '#007aff', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>
                {isLoading ? 'Generating...' : '✨ Generate Smart Replies'}
              </button>
              
              {suggestions.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => { onSuggestionClick(s); setIsOpen(false); }} style={{ padding: '8px 16px', background: '#f0f2f5', border: 'none', borderRadius: '20px', cursor: 'pointer' }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <button onClick={getSummary} style={{ padding: '12px', background: '#f0f2f5', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>
                📝 Summarize Conversation
              </button>
              
              {summary && (
                <div style={{ padding: '12px', background: '#f8f9fa', borderRadius: '12px' }}>
                  <p style={{ margin: 0 }}>{summary}</p>
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