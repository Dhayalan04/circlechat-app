import React, { useState, useEffect, useRef, useContext } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';
import toast from 'react-hot-toast';
import API_URL from '../config';
import { DarkModeContext } from '../App';

function CircleChat({ token, circleId, onBack }) {
  const { darkMode } = useContext(DarkModeContext);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [circle, setCircle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const currentUser = JSON.parse(atob(token.split('.')[1]));
  
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };
  
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
      auth: { token },
      transports: ['websocket']
    });
    setSocket(newSocket);
    
    newSocket.on('connect', () => {
      console.log('Connected to chat');
      newSocket.emit('join-circle', circleId);
      newSocket.emit('user-online', circleId);
    });
    
    newSocket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    });
    
    newSocket.on('user-typing', ({ userId, username, isTyping }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (isTyping && userId !== currentUser.id) {
          newSet.add(username);
        } else {
          newSet.delete(username);
        }
        return newSet;
      });
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
    });
    
    newSocket.on('message-edited', ({ messageId, newContent }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, content: newContent, isEdited: true } : msg
      ));
    });
    
    return () => {
      newSocket.close();
    };
  }, [circleId, token, currentUser.id]);
  
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    
    if (socket) {
      socket.emit('send-message', {
        circleId: parseInt(circleId),
        content: inputMessage
      });
      setInputMessage('');
      setShowEmojiPicker(false);
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.emit('typing', { circleId, isTyping: false });
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
          imageUrl: res.data.url
        });
      }
    } catch (err) {
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };
  
  const deleteMessage = async (messageId) => {
    if (socket) {
      socket.emit('delete-message', { messageId, circleId });
      toast.success('Message deleted');
    }
  };
  
  const editMessage = async (messageId) => {
    if (!editContent.trim()) return;
    
    if (socket) {
      socket.emit('edit-message', { 
        messageId, 
        circleId, 
        newContent: editContent 
      });
      setEditingMessage(null);
      setEditContent('');
      toast.success('Message edited');
    }
  };
  
  const addReaction = async (messageId, emoji) => {
    if (socket) {
      socket.emit('add-reaction', { messageId, circleId, emoji, userId: currentUser.id });
      setSelectedMessageForReaction(null);
    }
  };
  
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const onEmojiClick = (emojiData) => {
    setInputMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', background: darkMode ? '#1a1a2e' : '#f3f4f6', minHeight: '100vh' }}>
        <div className="skeleton" style={{ width: '300px', height: '20px', margin: '10px auto' }}></div>
        <div className="skeleton" style={{ width: '200px', height: '20px', margin: '10px auto' }}></div>
      </div>
    );
  }
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      background: darkMode ? '#1a1a2e' : '#f3f4f6',
      color: darkMode ? 'white' : 'black'
    }}>
      {/* Header */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        style={{ 
          background: darkMode ? '#16213e' : 'white', 
          borderBottom: `1px solid ${darkMode ? '#0f3460' : '#e5e7eb'}`,
          padding: '16px 24px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: darkMode ? 'white' : 'black' }}
          >
            ←
          </motion.button>
          <div>
            <h1 style={{ fontSize: '20px', margin: 0 }}>{circle?.name || 'Circle Chat'}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                background: onlineUsers.size > 0 ? '#4ade80' : '#9ca3af',
                display: 'inline-block'
              }}></span>
              <p style={{ fontSize: '12px', margin: 0, color: darkMode ? '#aaa' : '#6b7280' }}>
                {onlineUsers.size > 0 ? `${onlineUsers.size} online` : 'No one online'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Typing Indicator */}
      <AnimatePresence>
        {typingUsers.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ 
              padding: '8px 24px', 
              background: darkMode ? '#16213e' : '#f9fafb',
              borderBottom: `1px solid ${darkMode ? '#0f3460' : '#e5e7eb'}`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="typing-dot" style={{ width: '6px', height: '6px', background: darkMode ? '#9ca3af' : '#6b7280', borderRadius: '50%' }}></div>
              <div className="typing-dot" style={{ width: '6px', height: '6px', background: darkMode ? '#9ca3af' : '#6b7280', borderRadius: '50%' }}></div>
              <div className="typing-dot" style={{ width: '6px', height: '6px', background: darkMode ? '#9ca3af' : '#6b7280', borderRadius: '50%' }}></div>
              <span style={{ fontSize: '12px', color: darkMode ? '#aaa' : '#6b7280' }}>
                {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <AnimatePresence>
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '50px', color: '#9ca3af' }}
            >
              No messages yet. Start the conversation!
            </motion.div>
          ) : (
            messages.map((msg, index) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: msg.user_id === currentUser.id ? 50 : -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                style={{
                  display: 'flex',
                  justifyContent: msg.user_id === currentUser.id ? 'flex-end' : 'flex-start',
                  marginBottom: '16px'
                }}
              >
                <div style={{ maxWidth: '70%' }}>
                  {msg.user_id !== currentUser.id && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}>
                        {msg.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span style={{ fontSize: '12px', color: darkMode ? '#aaa' : '#6b7280' }}>
                        {msg.username}
                      </span>
                    </div>
                  )}
                  
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="message-bubble"
                    style={{
                      background: msg.user_id === currentUser.id 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                        : darkMode ? '#16213e' : 'white',
                      padding: '10px 16px',
                      borderRadius: msg.user_id === currentUser.id 
                        ? '20px 20px 4px 20px' 
                        : '20px 20px 20px 4px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      position: 'relative'
                    }}
                  >
                    {msg.type === 'image' ? (
                      <img 
                        src={msg.image_url} 
                        alt="Shared" 
                        style={{ maxWidth: '200px', borderRadius: '12px', cursor: 'pointer' }}
                        onClick={() => window.open(msg.image_url)}
                      />
                    ) : (
                      <p style={{ margin: 0, color: msg.user_id === currentUser.id ? 'white' : (darkMode ? 'white' : 'black') }}>
                        {msg.content}
                        {msg.isEdited && <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '8px' }}>(edited)</span>}
                      </p>
                    )}
                    
                    {/* Message Actions */}
                    {msg.user_id === currentUser.id && (
                      <div style={{ 
                        position: 'absolute', 
                        right: '8px', 
                        bottom: '-20px', 
                        display: 'flex', 
                        gap: '8px',
                        opacity: 0,
                        transition: 'opacity 0.2s'
                      }}
                      className="message-actions"
                      >
                        <button
                          onClick={() => {
                            setEditingMessage(msg.id);
                            setEditContent(msg.content);
                          }}
                          style={{ background: darkMode ? '#0f3460' : '#f3f4f6', border: 'none', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '10px' }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          style={{ background: darkMode ? '#0f3460' : '#f3f4f6', border: 'none', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '10px' }}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                    
                    {/* Add Reaction Button */}
                    <button
                      onClick={() => setSelectedMessageForReaction(selectedMessageForReaction === msg.id ? null : msg.id)}
                      style={{ 
                        position: 'absolute', 
                        left: msg.user_id === currentUser.id ? 'auto' : '8px', 
                        right: msg.user_id === currentUser.id ? '8px' : 'auto',
                        bottom: '-20px',
                        background: darkMode ? '#0f3460' : '#f3f4f6',
                        border: 'none',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      😊
                    </button>
                  </motion.div>
                  
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', marginLeft: '12px' }}>
                      {Object.entries(msg.reactions).map(([emoji, users]) => (
                        <span key={emoji} style={{ fontSize: '12px', background: darkMode ? '#16213e' : '#f3f4f6', padding: '2px 6px', borderRadius: '12px' }}>
                          {emoji} {users.length}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <p style={{
                    fontSize: '10px',
                    margin: '4px 12px 0',
                    color: darkMode ? '#aaa' : '#9ca3af',
                    textAlign: msg.user_id === currentUser.id ? 'right' : 'left'
                  }}>
                    {formatTime(msg.sent_at)}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>
      
      {/* Emoji Picker Modal */}
      <AnimatePresence>
        {selectedMessageForReaction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
              zIndex: 1000 
            }}
            onClick={() => setSelectedMessageForReaction(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              style={{ background: darkMode ? '#16213e' : 'white', borderRadius: '16px', padding: '20px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <EmojiPicker onEmojiClick={(emoji) => addReaction(selectedMessageForReaction, emoji.emoji)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Edit Message Modal */}
      <AnimatePresence>
        {editingMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
              zIndex: 1000 
            }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              style={{ background: darkMode ? '#16213e' : 'white', borderRadius: '16px', padding: '24px', width: '400px', color: darkMode ? 'white' : 'black' }}
            >
              <h3>Edit Message</h3>
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                style={{ width: '100%', padding: '8px', margin: '16px 0', borderRadius: '8px', border: `1px solid ${darkMode ? '#0f3460' : '#ddd'}`, background: darkMode ? '#0f3460' : 'white', color: darkMode ? 'white' : 'black' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingMessage(null)} style={{ padding: '8px 16px', background: '#9ca3af', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}>Cancel</button>
                <button onClick={() => editMessage(editingMessage)} style={{ padding: '8px 16px', background: '#3B82F6', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}>Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Input Area */}
      <form onSubmit={sendMessage} style={{ 
        background: darkMode ? '#16213e' : 'white', 
        borderTop: `1px solid ${darkMode ? '#0f3460' : '#e5e7eb'}`, 
        padding: '16px 24px'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '24px', 
              cursor: 'pointer',
              padding: '8px'
            }}
          >
            📷
          </motion.button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '24px', 
              cursor: 'pointer',
              padding: '8px'
            }}
          >
            😊
          </motion.button>
          
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              handleTyping();
            }}
            placeholder="Type a message..."
            style={{ 
              flex: 1, 
              padding: '12px', 
              border: `1px solid ${darkMode ? '#0f3460' : '#e5e7eb'}`, 
              borderRadius: '24px', 
              outline: 'none',
              background: darkMode ? '#0f3460' : '#f9fafb',
              color: darkMode ? 'white' : 'black'
            }}
          />
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={!inputMessage.trim() && !uploadingImage}
            style={{
              padding: '10px 24px',
              background: (!inputMessage.trim() && !uploadingImage) ? '#9ca3af' : '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '24px',
              cursor: (!inputMessage.trim() && !uploadingImage) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {uploadingImage ? (
              <div className="animate-spin" style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
            ) : (
              'Send'
            )}
          </motion.button>
        </div>
        
        {/* Emoji Picker */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              style={{ position: 'absolute', bottom: '80px', right: '20px', zIndex: 100 }}
            >
              <EmojiPicker onEmojiClick={onEmojiClick} />
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}

export default CircleChat;