const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import modules
const authRoutes = require('./routes/auth');
const circleRoutes = require('./routes/circles');
const messageRoutes = require('./routes/messages');
const aiRoutes = require('./routes/ai');
const { limiter } = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// Socket.io with CORS
const io = socketio(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Apply rate limiting to all routes
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Auth error'));

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Auth error'));
    socket.user = user;
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`✅ ${socket.user.username} connected`);

  socket.on('join-circle', (circleId) => {
    socket.join(`circle:${circleId}`);
    socket.circleId = circleId;

    onlineUsers.set(socket.user.id, {
      socketId: socket.id,
      username: socket.user.username,
      circleId: circleId
    });

    const onlineUsersList = Array.from(onlineUsers.values())
      .filter(u => u.circleId === circleId)
      .map(u => u.username);

    io.to(`circle:${circleId}`).emit('online-users', onlineUsersList);
  });

  socket.on('typing', ({ circleId, isTyping }) => {
    socket.to(`circle:${circleId}`).emit('user-typing', {
      userId: socket.user.id,
      username: socket.user.username,
      isTyping
    });
  });

  socket.on('send-message', async (data) => {
    const { circleId, content, type = 'text', imageUrl = null } = data;
    
    const message = {
      id: Date.now(),
      circle_id: circleId,
      user_id: socket.user.id,
      content,
      type,
      image_url: imageUrl,
      username: socket.user.username,
      sent_at: new Date().toISOString(),
      status: 'sent'
    };

    io.to(`circle:${circleId}`).emit('new-message', message);
  });

  socket.on('delete-message', ({ messageId, circleId }) => {
    io.to(`circle:${circleId}`).emit('message-deleted', { messageId });
  });

  socket.on('edit-message', ({ messageId, circleId, newContent }) => {
    io.to(`circle:${circleId}`).emit('message-edited', { messageId, newContent });
  });

  socket.on('add-reaction', ({ messageId, circleId, emoji, username }) => {
    io.to(`circle:${circleId}`).emit('reaction-added', { messageId, emoji, username });
  });

  socket.on('disconnect', () => {
    const userInfo = onlineUsers.get(socket.user.id);
    if (userInfo) {
      onlineUsers.delete(socket.user.id);
      if (userInfo.circleId) {
        const onlineUsersList = Array.from(onlineUsers.values())
          .filter(u => u.circleId === userInfo.circleId)
          .map(u => u.username);
        io.to(`circle:${userInfo.circleId}`).emit('online-users', onlineUsersList);
      }
    }
    console.log(`❌ ${socket.user.username} disconnected`);
  });
});

// Error handling (must be last)
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready`);
  console.log(`🔒 Security middleware enabled`);
});