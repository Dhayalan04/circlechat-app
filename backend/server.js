const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
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

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    avatar_url TEXT
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS circles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    invite_code TEXT UNIQUE,
    created_by INTEGER
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS circle_members (
    user_id INTEGER,
    circle_id INTEGER
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    circle_id INTEGER,
    user_id INTEGER,
    content TEXT,
    type TEXT DEFAULT 'text',
    image_url TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  console.log('✅ Database ready');
});

// Helper functions
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// Signup
app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await runQuery(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hashedPassword]
    );
    const token = jwt.sign({ id: result.lastID, username }, JWT_SECRET);
    res.json({ token, user: { id: result.lastID, username } });
  } catch (err) {
    res.status(400).json({ error: 'Username exists' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = await getQuery('SELECT * FROM users WHERE username = ?', [username]);
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
app.get('/api/circles', authenticateToken, async (req, res) => {
  const circles = await allQuery(`
    SELECT c.*, (SELECT COUNT(*) FROM circle_members WHERE circle_id = c.id) as member_count
    FROM circles c
    JOIN circle_members cm ON c.id = cm.circle_id
    WHERE cm.user_id = ?
  `, [req.user.id]);
  res.json(circles);
});

// Get single circle details
app.get('/api/circles/:circleId', authenticateToken, async (req, res) => {
  const { circleId } = req.params;
  const circle = await getQuery('SELECT * FROM circles WHERE id = ?', [circleId]);
  res.json(circle);
});

// Get circle members
app.get('/api/circles/:circleId/members', authenticateToken, async (req, res) => {
  const { circleId } = req.params;
  const members = await allQuery(`
    SELECT u.id, u.username, u.avatar_url as avatar 
    FROM circle_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.circle_id = ?
  `, [circleId]);
  res.json(members);
});

// Create circle
app.post('/api/circles', authenticateToken, async (req, res) => {
  const { name } = req.body;
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  const result = await runQuery(
    'INSERT INTO circles (name, invite_code, created_by) VALUES (?, ?, ?)',
    [name, inviteCode, req.user.id]
  );
  
  await runQuery('INSERT INTO circle_members (user_id, circle_id) VALUES (?, ?)', 
    [req.user.id, result.lastID]);
  
  const newCircle = await getQuery('SELECT * FROM circles WHERE id = ?', [result.lastID]);
  res.json(newCircle);
});

// Join circle
app.post('/api/circles/join', authenticateToken, async (req, res) => {
  const { inviteCode } = req.body;
  const circle = await getQuery('SELECT * FROM circles WHERE invite_code = ?', [inviteCode]);
  
  if (!circle) return res.status(404).json({ error: 'Circle not found' });
  
  await runQuery('INSERT OR IGNORE INTO circle_members (user_id, circle_id) VALUES (?, ?)',
    [req.user.id, circle.id]);
  res.json(circle);
});

// Leave circle
app.delete('/api/circles/:circleId/leave', authenticateToken, async (req, res) => {
  const { circleId } = req.params;
  
  await runQuery(
    'DELETE FROM circle_members WHERE user_id = ? AND circle_id = ?',
    [req.user.id, circleId]
  );
  res.json({ message: 'Left circle successfully' });
});

// Delete circle (only creator)
app.delete('/api/circles/:circleId', authenticateToken, async (req, res) => {
  const { circleId } = req.params;
  
  const circle = await getQuery('SELECT * FROM circles WHERE id = ?', [circleId]);
  if (!circle) return res.status(404).json({ error: 'Circle not found' });
  if (circle.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Only circle creator can delete' });
  }
  
  await runQuery('DELETE FROM circles WHERE id = ?', [circleId]);
  res.json({ message: 'Circle deleted successfully' });
});

// Get messages
app.get('/api/messages/:circleId', authenticateToken, async (req, res) => {
  const messages = await allQuery(`
    SELECT m.*, u.username FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.circle_id = ?
    ORDER BY m.sent_at ASC
    LIMIT 100
  `, [req.params.circleId]);
  res.json(messages);
});

// Update username
app.put('/api/user/username', authenticateToken, async (req, res) => {
  const { username } = req.body;
  
  try {
    await runQuery('UPDATE users SET username = ? WHERE id = ?', [username, req.user.id]);
    res.json({ message: 'Username updated successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Username already taken' });
  }
});

// Update password
app.put('/api/user/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  const user = await getQuery('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await runQuery('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, req.user.id]);
  res.json({ message: 'Password updated successfully' });
});

// Upload avatar
app.post('/api/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  const avatarUrl = `https://ui-avatars.com/api/?name=${req.user.username}&background=667eea&color=fff`;
  await runQuery('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, req.user.id]);
  res.json({ url: avatarUrl });
});

// Image upload for chat
app.post('/api/upload', authenticateToken, upload.single('image'), async (req, res) => {
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
  
  socket.on('user-online', ({ circleId, userId, username }) => {
    onlineUsers.set(socket.user.id, { username, circleId });
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
  
  socket.on('send-message', async (data) => {
    const { circleId, content, type = 'text', imageUrl = null } = data;
    
    const result = await runQuery(
      'INSERT INTO messages (circle_id, user_id, content, type, image_url) VALUES (?, ?, ?, ?, ?)',
      [circleId, socket.user.id, content, type, imageUrl]
    );
    
    const message = {
      id: result.lastID,
      circle_id: circleId,
      user_id: socket.user.id,
      content,
      type,
      image_url: imageUrl,
      username: socket.user.username,
      sent_at: new Date().toISOString()
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
    onlineUsers.delete(socket.user.id);
    console.log(`❌ ${socket.user.username} disconnected`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
});