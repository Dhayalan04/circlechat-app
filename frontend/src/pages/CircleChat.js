import React, { useState, useEffect, useRef, useContext } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiSend, FiVideo } from 'react-icons/fi';
import { AuthContext, DarkModeContext } from '../App';
import AIAssistant from '../components/AIAssistant';
import TypingIndicator from '../components/TypingIndicator';

const API_URL = 'https://circlechat-backend.onrender.com';

function CircleChat({ circleId, onBack }) {
  const { token, user } = useContext(AuthContext);
  const { darkMode } = useContext(DarkModeContext);
  const params = useParams();
  const navigate = useNavigate();
  const actualCircleId = circleId || params.circleId;
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [circle, setCircle] = useState(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!actualCircleId) return;

    fetchCircleDetails();
    fetchMessages();

    const newSocket = io(API_URL, { auth: { token } });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-circle', actualCircleId);
    });

    newSocket.on('circle-participants', (data) => {
      setParticipants(data.participants || []);
    });

    newSocket.on('user-typing', ({ userId, username }) => {
      if (userId === user?.id) return;
      setTypingUsers((prev) => {
        const next = [...prev];
        if (!next.includes(username)) next.push(username);
        return next;
      });
    });

    newSocket.on('user-stop-typing', ({ userId, username }) => {
      if (userId === user?.id) return;
      setTypingUsers((prev) => prev.filter((name) => name !== username));
    });

    newSocket.on('new-message', (message) => {
      setMessages((prev) => [...prev, message]);
      scrollToBottom();
    });

    return () => {
      newSocket.emit('leave-circle', actualCircleId);
      newSocket.close();
    };
  }, [actualCircleId, token, user?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const fetchCircleDetails = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/circles/${actualCircleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCircle(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/messages/${actualCircleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(res.data);
      setLoading(false);
      scrollToBottom();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const stopTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (socket && isTyping) {
      socket.emit('stop-typing', {
        circleId: parseInt(actualCircleId, 10),
      });
    }
    setIsTyping(false);
  };

  const startTyping = () => {
    if (!socket) return;

    if (!isTyping) {
      socket.emit('typing', {
        circleId: parseInt(actualCircleId, 10),
      });
      setIsTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1500);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    if (socket) {
      socket.emit('send-message', {
        circleId: parseInt(actualCircleId, 10),
        content: inputMessage,
      });
      setInputMessage('');
      stopTyping();
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!actualCircleId) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Circle not found.</div>;
  }

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: darkMode ? '#1a1a2e' : '#f0f2f5' }}>
      <div style={{ padding: '16px', background: darkMode ? '#16213e' : 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={handleBack} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>←</button>
          <h3>{circle?.name}</h3>
        </div>
        <button onClick={() => navigate(`/circle/${actualCircleId}/meeting`)} style={{ padding: '10px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiVideo /> Start Meeting
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <strong>Participants:</strong> {participants.length}
            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {participants.map((participant) => (
                <span key={participant.id} style={{ padding: '6px 10px', background: darkMode ? '#243b55' : '#f3f4f6', borderRadius: '999px', fontSize: '12px' }}>
                  {participant.username}
                </span>
              ))}
            </div>
          </div>
          <div style={{ minWidth: '160px', textAlign: 'right' }}>
            <TypingIndicator users={typingUsers} />
          </div>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.user_id === user?.id ? 'flex-end' : 'flex-start', marginBottom: '16px' }}>
            <div style={{ maxWidth: '70%', background: msg.user_id === user?.id ? '#667eea' : 'white', color: msg.user_id === user?.id ? 'white' : 'black', padding: '10px 16px', borderRadius: '18px' }}>
              {msg.user_id !== user?.id && <small style={{ display: 'block', marginBottom: '4px' }}>{msg.username}</small>}
              <p style={{ margin: 0 }}>{msg.content}</p>
              <small style={{ fontSize: '10px', opacity: 0.7 }}>{formatTime(msg.sent_at)}</small>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} style={{ padding: '16px', background: darkMode ? '#16213e' : 'white', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px' }}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => {
            setInputMessage(e.target.value);
            startTyping();
          }}
          onBlur={stopTyping}
          placeholder="Type a message..."
          style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '24px', outline: 'none' }}
        />
        <button type="submit" style={{ padding: '8px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '24px', cursor: 'pointer' }}>
          <FiSend />
        </button>
      </form>

      <AIAssistant currentMessage={inputMessage} onSuggestionClick={setInputMessage} messages={messages} />
    </div>
  );
}

export default CircleChat;
