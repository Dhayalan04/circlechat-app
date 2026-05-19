import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
// Remove this line if present:
// import toast from 'react-hot-toast';  // DELETE THIS LINE

import API_URL from '../config';

function CircleChat({ token, circleId, onBack }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [circle, setCircle] = useState(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  
  const currentUser = JSON.parse(atob(token.split('.')[1]));
  
  useEffect(() => {
    const fetchCircleDetails = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/circles`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const found = res.data.find(c => c.id === parseInt(circleId));
        setCircle(found);
      } catch (err) {
        console.error('Failed to load circle');
      }
    };
    
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/messages/${circleId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(res.data);
        setLoading(false);
        scrollToBottom();
      } catch (err) {
        console.error('Failed to load messages');
        setLoading(false);
      }
    };
    
    fetchCircleDetails();
    fetchMessages();
    
    const newSocket = io(API_URL, {
      auth: { token }
    });
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      console.log('Connected to chat');
      newSocket.emit('join-circle', circleId);
    });
    
    newSocket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    });
    
    return () => newSocket.close();
  }, [circleId, token]);
  
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    
    if (socket) {
      socket.emit('send-message', {
        circleId: parseInt(circleId),
        content: inputMessage
      });
      setInputMessage('');
    }
  };
  
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Loading chat...</div>;
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f3f4f6' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>←</button>
        <div>
          <h1 style={{ fontSize: '20px', margin: 0 }}>{circle?.name || 'Circle Chat'}</h1>
          <p style={{ fontSize: '12px', margin: '4px 0 0', color: '#6b7280' }}>Chat with your circle</p>
        </div>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#9ca3af' }}>
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.user_id === currentUser.id ? 'flex-end' : 'flex-start', marginBottom: '16px' }}>
              <div style={{ maxWidth: '70%' }}>
                {msg.user_id !== currentUser.id && (
                  <p style={{ fontSize: '12px', margin: '0 0 4px 12px', color: '#6b7280' }}>{msg.username}</p>
                )}
                <div style={{ background: msg.user_id === currentUser.id ? '#3B82F6' : 'white', color: msg.user_id === currentUser.id ? 'white' : '#1f2937', padding: '10px 16px', borderRadius: msg.user_id === currentUser.id ? '18px 18px 4px 18px' : '18px 18px 18px 4px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                  {msg.content}
                </div>
                <p style={{ fontSize: '10px', margin: '4px 12px 0', color: '#9ca3af', textAlign: msg.user_id === currentUser.id ? 'right' : 'left' }}>
                  {formatTime(msg.sent_at)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={sendMessage} style={{ background: 'white', borderTop: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', gap: '12px' }}>
        <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: '12px', border: '1px solid #e5e7eb', borderRadius: '24px', outline: 'none' }} />
        <button type="submit" disabled={!inputMessage.trim()} style={{ padding: '8px 24px', background: inputMessage.trim() ? '#3B82F6' : '#9ca3af', color: 'white', border: 'none', borderRadius: '24px', cursor: inputMessage.trim() ? 'pointer' : 'not-allowed' }}>
          Send
        </button>
      </form>
    </div>
  );
}

export default CircleChat;