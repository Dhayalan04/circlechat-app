const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = socketio(server, {
  cors: { 
    origin: "*",
    credentials: true 
  }
});

app.use(cors({ origin: "*" }));
app.use(express.json());

const upload = multer({ dest: 'uploads/' });
const JWT_SECRET = process.env.JWT_SECRET || 'my_secret_key';

// JSON file paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CIRCLES_FILE = path.join(DATA_DIR, 'circles.json');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize JSON files if they don't exist
function initFile(filePath, defaultData) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

initFile(USERS_FILE, []);
initFile(CIRCLES_FILE, []);
initFile(MEMBERS_FILE, []);
initFile(MESSAGES_FILE, []);

// Helper functions
function readData(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

function writeData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working with JSON storage!' });
});

// Signup
app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const users = readData(USERS_FILE);
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: users.length + 1,
      username,
      password_hash: hashedPassword,
      avatar_url: null
    };
    users.push(newUser);
    writeData(USERS_FILE, users);
    
    const token = jwt.sign({ id: newUser.id, username }, JWT_SECRET);
    res.json({ token, user: { id: newUser.id, username } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const users = readData(USERS_FILE);
    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, avatar: user.avatar_url } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'No token' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Get user's circles
app.get('/api/circles', authenticateToken, (req, res) => {
  const members = readData(MEMBERS_FILE);
  const circles = readData(CIRCLES_FILE);
  
  const userCircles = members
    .filter(m => m.user_id === req.user.id)
    .map(m => {
      const circle = circles.find(c => c.id === m.circle_id);
      const memberCount = members.filter(mem => mem.circle_id === circle.id).length;
      return { ...circle, member_count: memberCount };
    });
  
  res.json(userCircles);
});

// Get single circle details
app.get('/api/circles/:circleId', authenticateToken, (req, res) => {
  const circles = readData(CIRCLES_FILE);
  const circle = circles.find(c => c.id === parseInt(req.params.circleId));
  res.json(circle);
});

// Get circle members
app.get('/api/circles/:circleId/members', authenticateToken, (req, res) => {
  const members = readData(MEMBERS_FILE);
  const users = readData(USERS_FILE);
  
  const circleMembers = members
    .filter(m => m.circle_id === parseInt(req.params.circleId))
    .map(m => {
      const user = users.find(u => u.id === m.user_id);
      return { id: user.id, username: user.username, avatar: user.avatar_url };
    });
  
  res.json(circleMembers);
});

// Create circle
app.post('/api/circles', authenticateToken, (req, res) => {
  const { name } = req.body;
  const circles = readData(CIRCLES_FILE);
  const members = readData(MEMBERS_FILE);
  
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const newCircle = {
    id: circles.length + 1,
    name,
    invite_code: inviteCode,
    created_by: req.user.id
  };
  circles.push(newCircle);
  writeData(CIRCLES_FILE, circles);
  
  // Add creator as member
  members.push({ user_id: req.user.id, circle_id: newCircle.id });
  writeData(MEMBERS_FILE, members);
  
  res.json(newCircle);
});

// Join circle
app.post('/api/circles/join', authenticateToken, (req, res) => {
  const { inviteCode } = req.body;
  const circles = readData(CIRCLES_FILE);
  const members = readData(MEMBERS_FILE);
  
  const circle = circles.find(c => c.invite_code === inviteCode);
  if (!circle) return res.status(404).json({ error: 'Circle not found' });
  
  const alreadyMember = members.some(m => m.user_id === req.user.id && m.circle_id === circle.id);
  if (!alreadyMember) {
    members.push({ user_id: req.user.id, circle_id: circle.id });
    writeData(MEMBERS_FILE, members);
  }
  
  res.json(circle);
});

// Leave circle
app.delete('/api/circles/:circleId/leave', authenticateToken, (req, res) => {
  const members = readData(MEMBERS_FILE);
  const filtered = members.filter(m => !(m.user_id === req.user.id && m.circle_id === parseInt(req.params.circleId)));
  writeData(MEMBERS_FILE, filtered);
  res.json({ message: 'Left circle successfully' });
});

// Delete circle
app.delete('/api/circles/:circleId', authenticateToken, (req, res) => {
  const circles = readData(CIRCLES_FILE);
  const members = readData(MEMBERS_FILE);
  const messages = readData(MESSAGES_FILE);
  
  const circle = circles.find(c => c.id === parseInt(req.params.circleId));
  if (!circle) return res.status(404).json({ error: 'Circle not found' });
  if (circle.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Only circle creator can delete' });
  }
  
  // Delete circle
  const filteredCircles = circles.filter(c => c.id !== parseInt(req.params.circleId));
  writeData(CIRCLES_FILE, filteredCircles);
  
  // Delete members
  const filteredMembers = members.filter(m => m.circle_id !== parseInt(req.params.circleId));
  writeData(MEMBERS_FILE, filteredMembers);
  
  // Delete messages
  const filteredMessages = messages.filter(m => m.circle_id !== parseInt(req.params.circleId));
  writeData(MESSAGES_FILE, filteredMessages);
  
  res.json({ message: 'Circle deleted successfully' });
});

// Get messages
app.get('/api/messages/:circleId', authenticateToken, (req, res) => {
  const messages = readData(MESSAGES_FILE);
  const users = readData(USERS_FILE);
  
  const circleMessages = messages
    .filter(m => m.circle_id === parseInt(req.params.circleId))
    .map(m => {
      const user = users.find(u => u.id === m.user_id);
      return { ...m, username: user?.username };
    });
  
  res.json(circleMessages);
});

// Update username
app.put('/api/user/username', authenticateToken, (req, res) => {
  const { username } = req.body;
  const users = readData(USERS_FILE);
  
  const existingUser = users.find(u => u.username === username && u.id !== req.user.id);
  if (existingUser) {
    return res.status(400).json({ error: 'Username already taken' });
  }
  
  const userIndex = users.findIndex(u => u.id === req.user.id);
  users[userIndex].username = username;
  writeData(USERS_FILE, users);
  
  res.json({ message: 'Username updated successfully' });
});

// Update password
app.put('/api/user/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const users = readData(USERS_FILE);
  const user = users.find(u => u.id === req.user.id);
  
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password_hash = hashedPassword;
  writeData(USERS_FILE, users);
  
  res.json({ message: 'Password updated successfully' });
});

// Upload avatar
app.post('/api/upload-avatar', authenticateToken, upload.single('avatar'), (req, res) => {
  const users = readData(USERS_FILE);
  const userIndex = users.findIndex(u => u.id === req.user.id);
  const avatarUrl = `https://ui-avatars.com/api/?name=${req.user.username}&background=667eea&color=fff`;
  users[userIndex].avatar_url = avatarUrl;
  writeData(USERS_FILE, users);
  res.json({ url: avatarUrl });
});

// Image upload for chat
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
  const imageUrl = `https://picsum.photos/300/200?random=${Date.now()}`;
  res.json({ url: imageUrl });
});

// Socket.io
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
    console.log(`${socket.user.username} joined circle ${circleId}`);
  });
  
  socket.on('user-online', ({ circleId }) => {
    onlineUsers.set(socket.user.id, { username: socket.user.username, circleId });
    io.to(`circle:${circleId}`).emit('user-status', { 
      userId: socket.user.id, 
      username: socket.user.username, 
      status: 'online' 
    });
  });
  
  socket.on('typing', ({ circleId, isTyping }) => {
    socket.to(`circle:${circleId}`).emit('user-typing', {
      userId: socket.user.id,
      username: socket.user.username,
      isTyping
    });
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
    onlineUsers.delete(socket.user.id);
    console.log(`❌ ${socket.user.username} disconnected`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`✅ Using JSON file storage - no database needed!`);
});