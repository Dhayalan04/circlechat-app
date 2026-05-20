const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { readData, writeData, MESSAGES_FILE, MEMBERS_FILE, USERS_FILE } = require('../config/database');
const { validate, messageValidation } = require('../middleware/validation');
const { messageLimiter } = require('../middleware/rateLimiter');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
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

// Get messages for a circle
router.get('/:circleId', authenticateToken, async (req, res) => {
  try {
    const messages = readData(MESSAGES_FILE);
    const users = readData(USERS_FILE);
    
    // Verify user is member
    const members = readData(MEMBERS_FILE);
    const isMember = members.some(m => m.user_id === req.user.id && m.circle_id === parseInt(req.params.circleId));
    
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this circle' });
    }
    
    const circleMessages = messages
      .filter(m => m.circle_id === parseInt(req.params.circleId))
      .map(m => {
        const user = users.find(u => u.id === m.user_id);
        return {
          ...m,
          username: user?.username || 'Unknown'
        };
      });
    
    res.json(circleMessages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// Upload image
router.post('/upload', authenticateToken, upload.single('image'), (req, res) => {
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

module.exports = router;