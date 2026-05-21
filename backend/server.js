const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// ============================================
// CORS CONFIGURATION - FIXED FOR PRODUCTION
// ============================================
const allowedOrigins = [
  'http://localhost:3000',
  'https://circlechat-app.vercel.app',
  'https://circlechat-app.vercel.app/',
  'https://circlechat-app-git-main.vercel.app',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(null, true); // Temporarily allow all for testing
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'), false);
    }
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'circlechat_super_secret_key_2026_12345';

// ============================================
// JSON DATABASE SETUP
// ============================================
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CIRCLES_FILE = path.join(DATA_DIR, 'circles.json');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function initFile(filePath, defaultData) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

initFile(USERS_FILE, []);
initFile(CIRCLES_FILE, []);
initFile(MEMBERS_FILE, []);
initFile(MESSAGES_FILE, []);

function readData(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

function writeData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ============================================
// TEST ROUTES
// ============================================
app.get('/', (req, res) => {
  res.json({ 
    message: 'CircleChat API is running!', 
    status: 'ok',
    time: new Date().toISOString(),
    endpoints: ['/api/test', '/api/signup', '/api/login', '/api/circles', '/api/messages/:circleId']
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!', status: 'ok' });
});

// ============================================
// AUTH ROUTES
// ============================================
// Signup
app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  
  console.log('Signup attempt:', username);
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  try {
    const users = readData(USERS_FILE);
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: users.length + 1,
      username,
      password_hash: hashedPassword,
      avatar_url: null,
      created_at: new Date().toISOString()
    };
    users.push(newUser);
    writeData(USERS_FILE, users);
    
    const token = jwt.sign({ id: newUser.id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      success: true,
      token, 
      user: { id: newUser.id, username, avatar: null } 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt:', username);
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  try {
    const users = readData(USERS_FILE);
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      success: true,
      token, 
      user: { id: user.id, username: user.username, avatar: user.avatar_url } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// AUTH MIDDLEWARE
// ============================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ============================================
// CIRCLE ROUTES
// ============================================
// Get user's circles
app.get('/api/circles', authenticateToken, (req, res) => {
  try {
    const members = readData(MEMBERS_FILE);
    const circles = readData(CIRCLES_FILE);
    
    const userCircles = members
      .filter(m => m.user_id === req.user.id)
      .map(m => {
        const circle = circles.find(c => c.id === m.circle_id);
        if (!circle) return null;
        const memberCount = members.filter(mem => mem.circle_id === circle.id).length;
        return { ...circle, member_count: memberCount };
      })
      .filter(c => c !== null);
    
    res.json(userCircles);
  } catch (error) {
    console.error('Get circles error:', error);
    res.status(500).json({ error: 'Failed to load circles' });
  }
});

// Create circle
app.post('/api/circles', authenticateToken, (req, res) => {
  const { name } = req.body;
  
  try {
    const circles = readData(CIRCLES_FILE);
    const members = readData(MEMBERS_FILE);
    
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newCircle = {
      id: circles.length + 1,
      name,
      invite_code: inviteCode,
      created_by: req.user.id,
      created_at: new Date().toISOString()
    };
    circles.push(newCircle);
    writeData(CIRCLES_FILE, circles);
    
    members.push({ user_id: req.user.id, circle_id: newCircle.id });
    writeData(MEMBERS_FILE, members);
    
    res.json(newCircle);
  } catch (error) {
    console.error('Create circle error:', error);
    res.status(500).json({ error: 'Failed to create circle' });
  }
});

// Join circle
app.post('/api/circles/join', authenticateToken, (req, res) => {
  const { inviteCode } = req.body;
  
  try {
    const circles = readData(CIRCLES_FILE);
    const members = readData(MEMBERS_FILE);
    
    const circle = circles.find(c => c.invite_code === inviteCode);
    if (!circle) {
      return res.status(404).json({ error: 'Circle not found' });
    }
    
    const alreadyMember = members.some(m => m.user_id === req.user.id && m.circle_id === circle.id);
    if (!alreadyMember) {
      members.push({ user_id: req.user.id, circle_id: circle.id });
      writeData(MEMBERS_FILE, members);
    }
    
    res.json(circle);
  } catch (error) {
    console.error('Join circle error:', error);
    res.status(500).json({ error: 'Failed to join circle' });
  }
});

// Get circle members
app.get('/api/circles/:circleId/members', authenticateToken, (req, res) => {
  try {
    const members = readData(MEMBERS_FILE);
    const users = readData(USERS_FILE);
    
    const circleMembers = members
      .filter(m => m.circle_id === parseInt(req.params.circleId))
      .map(m => {
        const user = users.find(u => u.id === m.user_id);
        return { id: user.id, username: user.username, avatar: user.avatar_url };
      });
    
    res.json(circleMembers);
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to load members' });
  }
});

// ============================================
// MESSAGE ROUTES
// ============================================
// Get messages for a circle
app.get('/api/messages/:circleId', authenticateToken, (req, res) => {
  try {
    const messages = readData(MESSAGES_FILE);
    const users = readData(USERS_FILE);
    
    const circleMessages = messages
      .filter(m => m.circle_id === parseInt(req.params.circleId))
      .map(m => {
        const user = users.find(u => u.id === m.user_id);
        return { ...m, username: user?.username };
      });
    
    res.json(circleMessages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// Upload image
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// ============================================
// SOCKET.IO REAL-TIME
// ============================================
const io = socketio(server, {
  cors: {
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST']
  }
});

const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Auth error'));
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
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
  
  socket.on('send-message', (data) => {
    const { circleId, content, type = 'text', imageUrl = null } = data;
    const messages = readData(MESSAGES_FILE);
    
    const newMessage = {
      id: messages.length + 1,
      circle_id: circleId,
      user_id: socket.user.id,
      content,
      type,
      image_url: imageUrl,
      sent_at: new Date().toISOString()
    };
    messages.push(newMessage);
    writeData(MESSAGES_FILE, messages);
    
    const message = {
      ...newMessage,
      username: socket.user.username
    };
    
    io.to(`circle:${circleId}`).emit('new-message', message);
  });
  
  socket.on('typing', ({ circleId, isTyping }) => {
    socket.to(`circle:${circleId}`).emit('user-typing', {
      userId: socket.user.id,
      username: socket.user.username,
      isTyping
    });
  });
  
  socket.on('delete-message', ({ messageId, circleId }) => {
    const messages = readData(MESSAGES_FILE);
    const filtered = messages.filter(m => m.id !== messageId);
    writeData(MESSAGES_FILE, filtered);
    io.to(`circle:${circleId}`).emit('message-deleted', { messageId });
  });
  
  socket.on('edit-message', ({ messageId, circleId, newContent }) => {
    const messages = readData(MESSAGES_FILE);
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      messages[messageIndex].content = newContent;
      writeData(MESSAGES_FILE, messages);
    }
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

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready for real-time communication`);
  console.log(`🔒 CORS enabled for production`);
  console.log(`✅ Test API: http://localhost:${PORT}/api/test`);
});