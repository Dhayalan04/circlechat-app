import React from 'react';
import { motion } from 'framer-motion';

const TypingIndicator = ({ users }) => {
  if (users.length === 0) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="typing-indicator-modern"
    >
      <div className="typing-dots-modern">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span className="typing-text">
        {users.join(', ')} {users.length === 1 ? 'is' : 'are'} typing...
      </span>
    </motion.div>
  );
};

export default TypingIndicator;