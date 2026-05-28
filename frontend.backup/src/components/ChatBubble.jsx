import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiCheckCircle, FiClock } from 'react-icons/fi';

const ChatBubble = ({ message, isOwn, onReaction, onEdit, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  
  const getStatusIcon = () => {
    if (message.status === 'sent') return <FiCheck size={12} />;
    if (message.status === 'delivered') return <FiCheckCircle size={12} />;
    if (message.status === 'read') return <FiCheckCircle size={12} style={{ color: '#34c759' }} />;
    return <FiClock size={12} />;
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`chat-bubble ${isOwn ? 'own' : 'other'}`}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      {!isOwn && (
        <div className="chat-bubble-avatar">
          <div className="avatar-circle">
            {message.sender?.avatar ? (
              <img src={message.sender.avatar} alt="" />
            ) : (
              <span>{message.sender?.name?.[0]?.toUpperCase()}</span>
            )}
          </div>
        </div>
      )}
      
      <div className="chat-bubble-content">
        {!isOwn && <div className="chat-bubble-name">{message.sender?.name}</div>}
        
        <div className="bubble-wrapper">
          <div className="bubble">
            {message.type === 'image' ? (
              <img 
                src={message.content} 
                alt="Shared" 
                className="bubble-image"
                onClick={() => window.open(message.content)}
              />
            ) : (
              <p>{message.content}</p>
            )}
            
            {/* Message Reactions */}
            {message.reactions?.length > 0 && (
              <div className="bubble-reactions">
                {message.reactions.map((r, i) => (
                  <span key={i} className="reaction">{r.emoji}</span>
                ))}
              </div>
            )}
            
            {/* Message Actions Menu */}
            {showMenu && isOwn && (
              <div className="bubble-menu">
                <button onClick={() => setShowReactions(!showReactions)}>😊</button>
                <button onClick={onEdit}>✏️</button>
                <button onClick={onDelete}>🗑️</button>
              </div>
            )}
          </div>
          
          <div className="bubble-footer">
            <span className="timestamp">{message.timestamp}</span>
            {isOwn && <span className="status">{getStatusIcon()}</span>}
          </div>
        </div>
      </div>
      
      {/* Reactions Picker */}
      {showReactions && (
        <div className="reactions-picker">
          <button onClick={() => onReaction('👍')}>👍</button>
          <button onClick={() => onReaction('❤️')}>❤️</button>
          <button onClick={() => onReaction('😂')}>😂</button>
          <button onClick={() => onReaction('😮')}>😮</button>
          <button onClick={() => onReaction('😢')}>😢</button>
          <button onClick={() => setShowReactions(false)}>✖️</button>
        </div>
      )}
    </motion.div>
  );
};

export default ChatBubble;