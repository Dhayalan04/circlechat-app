const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { readData, writeData, CIRCLES_FILE, MEMBERS_FILE, USERS_FILE, MESSAGES_FILE } = require('../config/database');
const { validate, circleValidation } = require('../middleware/validation');

// Get user's circles
router.get('/', authenticateToken, async (req, res) => {
  try {
    const members = readData(MEMBERS_FILE);
    const circles = readData(CIRCLES_FILE);
    const users = readData(USERS_FILE);

    const userCircles = members
      .filter(m => m.user_id === req.user.id)
      .map(m => {
        const circle = circles.find(c => c.id === m.circle_id);
        if (!circle) return null;
        
        const memberCount = members.filter(mem => mem.circle_id === circle.id).length;
        const recentMessages = readData(MESSAGES_FILE)
          .filter(msg => msg.circle_id === circle.id)
          .slice(-1)[0];
        
        return {
          ...circle,
          member_count: memberCount,
          last_message: recentMessages?.content || null,
          last_message_time: recentMessages?.sent_at || null
        };
      })
      .filter(c => c !== null);

    res.json(userCircles);
  } catch (error) {
    console.error('Get circles error:', error);
    res.status(500).json({ error: 'Failed to load circles' });
  }
});

// Get single circle
router.get('/:circleId', authenticateToken, async (req, res) => {
  try {
    const circles = readData(CIRCLES_FILE);
    const circle = circles.find(c => c.id === parseInt(req.params.circleId));
    
    if (!circle) {
      return res.status(404).json({ error: 'Circle not found' });
    }
    
    res.json(circle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load circle' });
  }
});

// Get circle members
router.get('/:circleId/members', authenticateToken, async (req, res) => {
  try {
    const members = readData(MEMBERS_FILE);
    const users = readData(USERS_FILE);
    
    const circleMembers = members
      .filter(m => m.circle_id === parseInt(req.params.circleId))
      .map(m => {
        const user = users.find(u => u.id === m.user_id);
        return {
          id: user.id,
          username: user.username,
          avatar: user.avatar_url
        };
      });
    
    res.json(circleMembers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load members' });
  }
});

// Create circle
router.post('/', authenticateToken, validate(circleValidation.create), async (req, res) => {
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
    
    // Add creator as member
    members.push({
      user_id: req.user.id,
      circle_id: newCircle.id,
      joined_at: new Date().toISOString()
    });
    writeData(MEMBERS_FILE, members);
    
    res.status(201).json(newCircle);
  } catch (error) {
    console.error('Create circle error:', error);
    res.status(500).json({ error: 'Failed to create circle' });
  }
});

// Join circle
router.post('/join', authenticateToken, validate(circleValidation.join), async (req, res) => {
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
      members.push({
        user_id: req.user.id,
        circle_id: circle.id,
        joined_at: new Date().toISOString()
      });
      writeData(MEMBERS_FILE, members);
    }
    
    res.json(circle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to join circle' });
  }
});

// Leave circle
router.delete('/:circleId/leave', authenticateToken, async (req, res) => {
  try {
    const members = readData(MEMBERS_FILE);
    const filtered = members.filter(m => !(m.user_id === req.user.id && m.circle_id === parseInt(req.params.circleId)));
    writeData(MEMBERS_FILE, filtered);
    res.json({ message: 'Left circle successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to leave circle' });
  }
});

// Delete circle (only creator)
router.delete('/:circleId', authenticateToken, async (req, res) => {
  try {
    const circles = readData(CIRCLES_FILE);
    const members = readData(MEMBERS_FILE);
    const messages = readData(MESSAGES_FILE);
    
    const circle = circles.find(c => c.id === parseInt(req.params.circleId));
    if (!circle) {
      return res.status(404).json({ error: 'Circle not found' });
    }
    
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete circle' });
  }
});

module.exports = router;