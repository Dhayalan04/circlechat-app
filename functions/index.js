const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage });

const normalizeTimestamp = (value) => {
  if (!value) return new Date().toISOString();
  if (value.toDate) return value.toDate().toISOString();
  return new Date(value).toISOString();
};

const getUserProfile = async (uid) => {
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists) {
    return { id: uid, ...userDoc.data() };
  }
  const userRecord = await admin.auth().getUser(uid);
  return { id: uid, username: userRecord.displayName || userRecord.email || 'User' };
};

const verifyTokenMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return res.status(401).json({ error: 'Missing Authorization token' });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

app.get('/api/test', (req, res) => {
  res.json({ message: 'Firebase Functions backend is running!' });
});

app.post('/api/auth/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

  const email = `${username}@circlechat-app04.firebaseapp.com`;

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: username,
    });

    await db.collection('users').doc(userRecord.uid).set({
      username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const customToken = await admin.auth().createCustomToken(userRecord.uid);
    return res.json({ token: customToken, user: { id: userRecord.uid, username } });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  return res.status(400).json({ error: 'Login should be performed using Firebase Authentication on the client.' });
});

app.get('/api/user/profile', verifyTokenMiddleware, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.uid);
    res.json({ user: profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.post('/api/user/username', verifyTokenMiddleware, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  try {
    await admin.auth().updateUser(req.user.uid, { displayName: username });
    await db.collection('users').doc(req.user.uid).set({ username }, { merge: true });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/user/password', verifyTokenMiddleware, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'New password is required' });

  try {
    await admin.auth().updateUser(req.user.uid, { password: newPassword });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/user/account', verifyTokenMiddleware, async (req, res) => {
  try {
    await admin.auth().deleteUser(req.user.uid);
    await db.collection('users').doc(req.user.uid).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/circles', verifyTokenMiddleware, async (req, res) => {
  try {
    const snapshot = await db.collection('circles').where('members', 'array-contains', req.user.uid).get();
    const circles = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(circles);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load circles' });
  }
});

app.post('/api/circles', verifyTokenMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Circle name is required' });

  try {
    const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const circleRef = await db.collection('circles').add({
      name,
      invite_code,
      members: [req.user.uid],
      created_by: req.user.uid,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    const circle = await circleRef.get();
    res.json({ id: circle.id, ...circle.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create circle' });
  }
});

app.post('/api/circles/join', verifyTokenMiddleware, async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'Invite code is required' });

  try {
    const query = await db.collection('circles').where('invite_code', '==', inviteCode).limit(1).get();
    if (query.empty) return res.status(404).json({ error: 'Circle not found' });
    const circleRef = query.docs[0].ref;
    await circleRef.update({ members: admin.firestore.FieldValue.arrayUnion(req.user.uid) });
    const circle = await circleRef.get();
    res.json({ id: circle.id, ...circle.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join circle' });
  }
});

app.get('/api/circles/:circleId/members', verifyTokenMiddleware, async (req, res) => {
  try {
    const circleDoc = await db.collection('circles').doc(req.params.circleId).get();
    if (!circleDoc.exists) return res.status(404).json({ error: 'Circle not found' });
    const members = circleDoc.data().members || [];
    const users = await Promise.all(members.map(async (uid) => await getUserProfile(uid)));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load circle members' });
  }
});

app.get('/api/messages/:circleId', verifyTokenMiddleware, async (req, res) => {
  try {
    const snapshot = await db.collection('messages')
      .where('circleId', '==', req.params.circleId)
      .orderBy('createdAt', 'asc')
      .get();

    const messages = await Promise.all(snapshot.docs.map(async (doc) => {
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

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.post('/api/upload', verifyTokenMiddleware, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  try {
    const filename = `uploads/${uuidv4()}-${req.file.originalname}`;
    const file = bucket.file(filename);

    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    res.json({ url: publicUrl });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

exports.api = functions.https.onRequest(app);
