const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { admin, auth, firestore, initialized } = require('./firebaseAdmin');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const useFirebase = Boolean(initialized && auth && firestore);
const JWT_SECRET = process.env.JWT_SECRET || 'circlechat_secret_key_2026';

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CIRCLES_FILE = path.join(DATA_DIR, 'circles.json');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

const initFile = (f, d) => { if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(d, null, 2)); };
if (!useFirebase) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  initFile(USERS_FILE, []);
  initFile(CIRCLES_FILE, []);
  initFile(MEMBERS_FILE, []);
  initFile(MESSAGES_FILE, []);
}

const read = (f) => JSON.parse(fs.readFileSync(f));
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

const getUserProfile = async (uid) => {
  if (useFirebase) {
    const userDoc = await firestore.collection('users').doc(uid).get();
    if (userDoc.exists) {
      return { id: uid, ...userDoc.data() };
    }
    const userRecord = await auth.getUser(uid);
    return { id: uid, username: userRecord.displayName || userRecord.email || 'User' };
  }
  const users = read(USERS_FILE);
  const user = users.find((u) => u.id === uid);
  return user ? { id: user.id, username: user.username } : { id: uid, username: 'User' };
};

const verifyTokenMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  if (useFirebase) {
    try {
      const decoded = await auth.verifyIdToken(token);
      req.user = decoded;
      return next();
    } catch (err) {
      console.error('Firebase token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid token' });
    }
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
};

const normalizeTimestamp = (value) => {
  if (!value) return new Date().toISOString();
  if (value.toDate) return value.toDate().toISOString();
  return new Date(value).toISOString();
};

app.get('/api/test', (req, res) => {
  res.json({ message: 'Firebase backend is running!' });
});

app.post('/api/auth/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

  if (useFirebase) {
    const email = `${username}@circlechat-app04.firebaseapp.com`;
    try {
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: username,
      });
      await firestore.collection('users').doc(userRecord.uid).set({
        username,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const customToken = await auth.createCustomToken(userRecord.uid);
      return res.json({ token: customToken, user: { id: userRecord.uid, username } });
    } catch (error) {
      console.error('Firebase signup failed:', error.message);
      return res.status(400).json({ error: error.message });
    }
  }

  const users = read(USERS_FILE);
  if (users.find((u) => u.username === username)) return res.status(400).json({ error: 'Username exists' });
  const hashed = await bcrypt.hash(password, 10);
  const newUser = { id: users.length + 1, username, password_hash: hashed };
  users.push(newUser);
  write(USERS_FILE, users);
  const token = jwt.sign({ id: newUser.id, username }, JWT_SECRET);
  res.json({ token, user: { id: newUser.id, username } });
});

app.post('/api/auth/login', async (req, res) => {
  if (useFirebase) {
    return res.status(400).json({ error: 'Please sign in through Firebase Authentication in the client.' });
  }

  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  const users = read(USERS_FILE);
  const user = users.find((u) => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username }, JWT_SECRET);
  res.json({ token, user: { id: user.id, username } });
});

app.get('/api/user/profile', verifyTokenMiddleware, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.uid || req.user.id);
    res.json({ user: profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.post('/api/user/username', verifyTokenMiddleware, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  if (useFirebase) {
    try {
      await auth.updateUser(req.user.uid, { displayName: username });
      await firestore.collection('users').doc(req.user.uid).set({ username }, { merge: true });
      return res.json({ success: true });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
  const users = read(USERS_FILE);
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.username = username;
  write(USERS_FILE, users);
  res.json({ success: true });
});

app.put('/api/user/password', verifyTokenMiddleware, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'New password is required' });
  if (useFirebase) {
    try {
      await auth.updateUser(req.user.uid, { password: newPassword });
      return res.json({ success: true });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
  const { currentPassword } = req.body;
  const users = read(USERS_FILE);
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
  user.password_hash = await bcrypt.hash(newPassword, 10);
  write(USERS_FILE, users);
  res.json({ success: true });
});

app.delete('/api/user/account', verifyTokenMiddleware, async (req, res) => {
  if (useFirebase) {
    try {
      await auth.deleteUser(req.user.uid);
      await firestore.collection('users').doc(req.user.uid).delete();
      return res.json({ success: true });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
  const users = read(USERS_FILE).filter((u) => u.id !== req.user.id);
  write(USERS_FILE, users);
  res.json({ success: true });
});

app.get('/api/circles', verifyTokenMiddleware, async (req, res) => {
  if (useFirebase) {
    const uid = req.user.uid;
    const circleSnapshot = await firestore.collection('circles').where('members', 'array-contains', uid).get();
    const circles = circleSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        invite_code: data.invite_code,
        member_count: data.members?.length || 0,
      };
    });
    return res.json(circles);
  }
  const members = read(MEMBERS_FILE);
  const circles = read(CIRCLES_FILE);
  const userCircles = members
    .filter((m) => m.user_id === req.user.id)
    .map((m) => {
      const circle = circles.find((c) => c.id === m.circle_id);
      if (!circle) return null;
      const count = members.filter((mem) => mem.circle_id === circle.id).length;
      return { ...circle, member_count: count };
    })
    .filter(Boolean);
  res.json(userCircles);
});

app.post('/api/circles', verifyTokenMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Circle name is required' });
  if (useFirebase) {
    const uid = req.user.uid;
    const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const circleRef = await firestore.collection('circles').add({
      name,
      invite_code,
      members: [uid],
      created_by: uid,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    const circle = await circleRef.get();
    return res.json({ id: circle.id, ...circle.data() });
  }
  const circles = read(CIRCLES_FILE);
  const members = read(MEMBERS_FILE);
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const newCircle = { id: circles.length + 1, name, invite_code: code, created_by: req.user.id };
  circles.push(newCircle);
  members.push({ user_id: req.user.id, circle_id: newCircle.id });
  write(CIRCLES_FILE, circles);
  write(MEMBERS_FILE, members);
  res.json(newCircle);
});

app.post('/api/circles/join', verifyTokenMiddleware, async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'Invite code is required' });
  if (useFirebase) {
    const uid = req.user.uid;
    const circleSnapshot = await firestore.collection('circles').where('invite_code', '==', inviteCode).limit(1).get();
    if (circleSnapshot.empty) return res.status(404).json({ error: 'Circle not found' });
    const circleRef = circleSnapshot.docs[0].ref;
    await circleRef.update({ members: admin.firestore.FieldValue.arrayUnion(uid) });
    const circle = await circleRef.get();
    return res.json({ id: circle.id, ...circle.data() });
  }
  const circles = read(CIRCLES_FILE);
  const members = read(MEMBERS_FILE);
  const circle = circles.find((c) => c.invite_code === inviteCode);
  if (!circle) return res.status(404).json({ error: 'Circle not found' });
  if (!members.some((m) => m.user_id === req.user.id && m.circle_id === circle.id)) {
    members.push({ user_id: req.user.id, circle_id: circle.id });
    write(MEMBERS_FILE, members);
  }
  res.json(circle);
});

app.get('/api/circles/:circleId/members', verifyTokenMiddleware, async (req, res) => {
  const circleId = req.params.circleId;
  if (useFirebase) {
    const circleDoc = await firestore.collection('circles').doc(circleId).get();
    if (!circleDoc.exists) return res.status(404).json({ error: 'Circle not found' });
    const members = circleDoc.data().members || [];
    const users = await Promise.all(members.map(async (uid) => await getUserProfile(uid)));
    return res.json(users);
  }
  const members = read(MEMBERS_FILE).filter((m) => m.circle_id === parseInt(circleId, 10));
  const users = read(USERS_FILE);
  const circleMembers = members.map((m) => {
    const user = users.find((u) => u.id === m.user_id);
    return { id: user?.id, username: user?.username };
  });
  res.json(circleMembers);
});

app.get('/api/messages/:circleId', verifyTokenMiddleware, async (req, res) => {
  const circleId = req.params.circleId;
  if (useFirebase) {
    const messageSnapshot = await firestore.collection('messages')
      .where('circleId', '==', circleId)
      .orderBy('createdAt', 'asc')
      .get();
    const messages = await Promise.all(messageSnapshot.docs.map(async (doc) => {
      const data = doc.data();
      const user = await getUserProfile(data.userId);
      return {
        id: doc.id,
        circle_id: data.circleId,
        user_id: data.userId,
        content: data.content,
        type: data.type,
        image_url: data.imageUrl || null,
        sent_at: normalizeTimestamp(data.createdAt),
        username: user.username,
      };
    }));
    return res.json(messages);
  }
  const messages = read(MESSAGES_FILE);
  const users = read(USERS_FILE);
  const circleMessages = messages
    .filter((m) => m.circle_id === parseInt(circleId, 10))
    .map((message) => {
      const user = users.find((u) => u.id === message.user_id);
      return { ...message, username: user?.username };
    });
  res.json(circleMessages);
});

app.post('/api/upload', verifyTokenMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  res.json({ url: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` });
});

const io = socketio(server, { cors: { origin: '*' } });
const online = new Map();

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Auth error'));
  try {
    const decoded = useFirebase ? await auth.verifyIdToken(token) : jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    return next();
  } catch (err) {
    console.error('Socket auth failed:', err.message);
    return next(new Error('Auth error'));
  }
});

io.on('connection', (socket) => {
  console.log(`✅ ${socket.user.name || socket.user.username || socket.user.email} connected`);

  socket.on('join-circle', (circleId) => {
    socket.join(`circle:${circleId}`);
    online.set(socket.user.uid || socket.user.id, { username: socket.user.name || socket.user.username || socket.user.email, circleId });
    const list = Array.from(online.values()).filter((u) => u.circleId === circleId).map((u) => u.username);
    io.to(`circle:${circleId}`).emit('online-users', list);
  });

  socket.on('send-message', async (data) => {
    const { circleId, content, type = 'text', imageUrl = null } = data;
    if (useFirebase) {
      const messageRef = await firestore.collection('messages').add({
        circleId,
        userId: socket.user.uid,
        content,
        type,
        imageUrl,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const messageDoc = await messageRef.get();
      const username = socket.user.name || socket.user.username || socket.user.email || 'Unknown';
      const payload = {
        id: messageRef.id,
        circle_id: circleId,
        user_id: socket.user.uid,
        content,
        type,
        image_url: imageUrl,
        sent_at: normalizeTimestamp(messageDoc.data().createdAt),
        username,
      };
      io.to(`circle:${circleId}`).emit('new-message', payload);
      return;
    }

    const messages = read(MESSAGES_FILE);
    const newMsg = {
      id: messages.length + 1,
      circle_id: circleId,
      user_id: socket.user.id,
      content,
      type,
      image_url: imageUrl,
      sent_at: new Date().toISOString(),
    };
    messages.push(newMsg);
    write(MESSAGES_FILE, messages);
    io.to(`circle:${circleId}`).emit('new-message', { ...newMsg, username: socket.user.username || socket.user.name || 'Unknown' });
  });

  socket.on('typing', ({ circleId, isTyping }) => {
    socket.to(`circle:${circleId}`).emit('user-typing', { userId: socket.user.uid || socket.user.id, username: socket.user.name || socket.user.username || socket.user.email, isTyping });
  });

  socket.on('delete-message', ({ messageId, circleId }) => {
    if (useFirebase) {
      firestore.collection('messages').doc(messageId).delete().then(() => {
        io.to(`circle:${circleId}`).emit('message-deleted', { messageId });
      });
      return;
    }
    const messages = read(MESSAGES_FILE);
    write(MESSAGES_FILE, messages.filter((m) => m.id !== messageId));
    io.to(`circle:${circleId}`).emit('message-deleted', { messageId });
  });

  socket.on('edit-message', ({ messageId, circleId, newContent }) => {
    if (useFirebase) {
      firestore.collection('messages').doc(messageId).update({ content: newContent }).then(() => {
        io.to(`circle:${circleId}`).emit('message-edited', { messageId, newContent });
      });
      return;
    }
    const messages = read(MESSAGES_FILE);
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx !== -1) {
      messages[idx].content = newContent;
      write(MESSAGES_FILE, messages);
    }
    io.to(`circle:${circleId}`).emit('message-edited', { messageId, newContent });
  });

  socket.on('add-reaction', ({ messageId, circleId, emoji, username }) => {
    io.to(`circle:${circleId}`).emit('reaction-added', { messageId, emoji, username });
  });

  socket.on('disconnect', () => {
    online.delete(socket.user.uid || socket.user.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
