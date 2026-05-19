import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';
import toast from 'react-hot-toast';
import { 
  FiArrowLeft, FiSend, FiImage, FiSmile, 
  FiEdit2, FiTrash2, FiCheck, FiInfo, FiX, FiUsers
} from 'react-icons/fi';
import API_URL from '../config';
import { DarkModeContext, AuthContext } from '../App';

function CircleChat({ circleId, onBack }) {
  const { darkMode } = useContext(DarkModeContext);
  const { token, user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [circle, setCircle] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const currentUser = user;
  
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);
  
  const fetchCircleDetails = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/circles/${circleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCircle(res.data);
    } catch (err) {
      console.error('Failed to load circle');
    }
  }, [circleId, token]);
  
  const fetchMembers = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/circles/${circleId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMembers(res.data);
    } catch (err) {
      console.error('Failed to load members');
    }
  }, [circleId, token]);
  
  const fetchMessages = useCallback(async () => {
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
  }, [circleId, token, scrollToBottom]);
  
  useEffect(() => {
    fetchCircleDetails();
    fetchMembers();
    fetchMessages();
    
    const newSocket = io(API_URL, {
      auth: { token },
      transports: ['websocket']
    });
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      console.log('Connected to chat');
      newSocket.emit('join-circle', circleId);
      newSocket.emit('user-online', { circleId, userId: currentUser?.id, username: currentUser?.username });
    });
    
    newSocket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    });
    
    newSocket.on('user-typing', ({ userId, username, isTyping }) => {
      if (userId !== currentUser?.id) {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          if (isTyping) {
            newSet.add(username);
          } else {
            newSet.delete(username);
          }
          return newSet;
        });
      }
    });
    
    newSocket.on('user-status', ({ userId, username, status }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        if (status === 'online') {
          newSet.add(username);
        } else {
          newSet.delete(username);
        }
        return newSet;
      });
    });
    
    newSocket.on('message-deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast.success('Message deleted');
    });
    
    newSocket.on('message-edited', ({ messageId, newContent }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, content: newContent, isEdited: true } : msg
      ));
      toast.success('Message edited');
    });
    
    newSocket.on('reaction-added', ({ messageId, emoji, username }) => {
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || {};
          if (!reactions[emoji]) {
            reactions[emoji] = [];
          }
          if (!reactions[emoji].includes(username)) {
            reactions[emoji].push(username);
          }
          return { ...msg, reactions };
        }
        return msg;
      }));
    });
    
    return () => {
      newSocket.close();
    };
  }, [circleId, token, currentUser?.id, currentUser?.username, fetchCircleDetails, fetchMembers, fetchMessages, scrollToBottom]);
  
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    
    if (socket) {
      socket.emit('send-message', {
        circleId: parseInt(circleId),
        content: inputMessage,
        userId: currentUser?.id,
        username: currentUser?.username
      });
      setInputMessage('');
      setShowEmojiPicker(false);
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.emit('typing', { circleId, isTyping: false });
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  };
  
  const handleTyping = () => {
    if (!socket) return;
    
    socket.emit('typing', { circleId, isTyping: true });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { circleId, isTyping: false });
    }, 1000);
  };
  
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    
    setUploadingImage(true);
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const res = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      
      if (socket) {
        socket.emit('send-message', {
          circleId: parseInt(circleId),
          content: '📷 Image',
          type: 'image',
          imageUrl: res.data.url,
          userId: currentUser?.id,
          username: currentUser?.username
        });
      }
      toast.success('Image sent!');
    } catch (err) {
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };
  
  const deleteMessage = (messageId) => {
    if (socket && window.confirm('Delete this message?')) {
      socket.emit('delete-message', { messageId, circleId });
    }
  };
  
  const editMessage = (messageId) => {
    const message = messages.find(m => m.id === messageId);
    setEditingMessage(messageId);
    setEditContent(message.content);
  };
  
  const saveEdit = () => {
    if (!editContent.trim()) return;
    
    if (socket) {
      socket.emit('edit-message', { 
        messageId: editingMessage, 
        circleId, 
        newContent: editContent 
      });
      setEditingMessage(null);
      setEditContent('');
    }
  };
  
  const addReaction = (messageId, emoji) => {
    if (socket) {
      socket.emit('add-reaction', { 
        messageId, 
        circleId, 
        emoji, 
        userId: currentUser?.id,
        username: currentUser?.username
      });
    }
  };
  
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) {
      return `${days}d ago`;
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const onEmojiClick = (emojiData) => {
    setInputMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };
  
  const getOnlineCount = () => {
    return members.filter(m => onlineUsers.has(m.username)).length;
  };
  
  if (loading) {
    return (
      <div className={`chat-loading ${darkMode ? 'dark' : ''}`}>
        <div className="skeleton"></div>
        <div className="skeleton"></div>
        <div className="skeleton"></div>
      </div>
    );
  }
  
  return (
    <div className={`chat-container ${darkMode ? 'dark' : ''}`}>
      {/* Chat Header */}
      <div className="chat-header">
        <button className="back-btn" onClick={onBack}>
          <FiArrowLeft />
        </button>
        <div className="chat-info" onClick={() => setShowInfo(!showInfo)}>
          <div className="chat-avatar">
            <FiUsers />
          </div>
          <div>
            <h3>{circle?.name}</h3>
            <div className="member-status">
              <span className="online-dot"></span>
              <span>{getOnlineCount()} online • {members.length} members</span>
            </div>
          </div>
        </div>
        <button className="info-btn" onClick={() => setShowInfo(!showInfo)}>
          <FiInfo />
        </button>
      </div>
      
      {/* Typing Indicator */}
      <AnimatePresence>
        {typingUsers.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="typing-indicator"
          >
            <div className="typing-dots">
              <span></span><span></span><span></span>
            </div>
            <span>{Array.from(typingUsers).join(', ')} is typing...</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Messages */}
      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-icon">💬</div>
            <h3>No messages yet</h3>
            <p>Start the conversation with your circle!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwn = msg.user_id === currentUser?.id;
            const showAvatar = !isOwn && (index === 0 || messages[index - 1]?.user_id !== msg.user_id);
            
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`message-row ${isOwn ? 'own' : 'other'}`}
              >
                {!isOwn && showAvatar && (
                  <div className="message-avatar">
                    {msg.avatar ? (
                      <img src={msg.avatar} alt={msg.username} />
                    ) : (
                      <span>{msg.username?.[0]?.toUpperCase()}</span>
                    )}
                  </div>
                )}
                <div className="message-wrapper">
                  {!isOwn && showAvatar && (
                    <div className="message-name">{msg.username}</div>
                  )}
                  <div className="message-bubble-wrapper">
                    <div className={`message-bubble ${msg.type === 'image' ? 'image-message' : ''}`}>
                      {msg.type === 'image' ? (
                        <img 
                          src={msg.image_url} 
                          alt="Shared" 
                          onClick={() => window.open(msg.image_url)}
                        />
                      ) : editingMessage === msg.id ? (
                        <div className="edit-input">
                          <input
                            type="text"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                            autoFocus
                          />
                          <button onClick={saveEdit}>Save</button>
                          <button onClick={() => setEditingMessage(null)}>Cancel</button>
                        </div>
                      ) : (
                        <>
                          <p>{msg.content}</p>
                          {msg.isEdited && <span className="edited-badge">edited</span>}
                        </>
                      )}
                      
                      {/* Reactions */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="reactions">
                          {Object.entries(msg.reactions).map(([emoji, users]) => (
                            <span key={emoji} className="reaction">
                              {emoji} {users.length}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Message Menu */}
                    {isOwn && !editingMessage && (
                      <div className="message-menu">
                        <button onClick={() => addReaction(msg.id, '👍')}>👍</button>
                        <button onClick={() => addReaction(msg.id, '❤️')}>❤️</button>
                        <button onClick={() => addReaction(msg.id, '😂')}>😂</button>
                        <button onClick={() => editMessage(msg.id)}><FiEdit2 /></button>
                        <button onClick={() => deleteMessage(msg.id)}><FiTrash2 /></button>
                      </div>
                    )}
                  </div>
                  <div className="message-time">
                    {formatTime(msg.sent_at)}
                    {isOwn && (
                      <span className="message-status">
                        <FiCheck />
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <form className="chat-input-area" onSubmit={sendMessage}>
        <div className="input-tools">
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <FiImage />
          </button>
          <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
            <FiSmile />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>
        
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => {
            setInputMessage(e.target.value);
            handleTyping();
          }}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="message-input"
        />
        
        <button 
          type="submit" 
          disabled={!inputMessage.trim() && !uploadingImage}
          className="send-btn"
        >
          {uploadingImage ? <div className="spinner small"></div> : <FiSend />}
        </button>
        
        {/* Emoji Picker */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="emoji-picker-container"
            >
              <EmojiPicker onEmojiClick={onEmojiClick} />
            </motion.div>
          )}
        </AnimatePresence>
      </form>
      
      {/* Info Sidebar */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="info-sidebar"
          >
            <div className="info-header">
              <h3>Circle Info</h3>
              <button onClick={() => setShowInfo(false)}><FiX /></button>
            </div>
            <div className="info-content">
              <div className="info-section">
                <h4>Members ({members.length})</h4>
                {members.map(member => (
                  <div key={member.id} className="member-item">
                    <div className="member-avatar">
                      {member.avatar ? (
                        <img src={member.avatar} alt={member.username} />
                      ) : (
                        <span>{member.username?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="member-info">
                      <span className="member-name">{member.username}</span>
                      <span className={`member-status ${onlineUsers.has(member.username) ? 'online' : ''}`}>
                        {onlineUsers.has(member.username) ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CircleChat;