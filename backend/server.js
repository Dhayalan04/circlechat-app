const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Allow all origins for production
const io = socketio(server, {
  cors: { 
    origin: "*",
    credentials: true 
  }
});

app.use(cors({ origin: "*" }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'my_secret_key';

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT
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
    res.json({ token, user: { id: user.id, username: user.username } });
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
    SELECT c.* FROM circles c
    JOIN circle_members cm ON c.id = cm.circle_id
    WHERE cm.user_id = ?
  `, [req.user.id]);
  res.json(circles);
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

// Socket.io
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
  
  socket.on('send-message', async (data) => {
    const { circleId, content } = data;
    const result = await runQuery(
      'INSERT INTO messages (circle_id, user_id, content) VALUES (?, ?, ?)',
      [circleId, socket.user.id, content]
    );
    
    const message = {
      id: result.lastID,
      circle_id: circleId,
      user_id: socket.user.id,
      content,
      username: socket.user.username,
      sent_at: new Date().toISOString()
    };
    
    io.to(`circle:${circleId}`).emit('new-message', message);
  });
  
  socket.on('disconnect', () => {
    console.log(`❌ ${socket.user.username} disconnected`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`✅ API: /api/test`);
});