const rateLimit = require('express-rate-limit');

// General API rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoints rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 failed attempts
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Message sending rate limiter
const messageLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 20, // 20 messages per 10 seconds
  message: { error: 'Slow down! Too many messages.' },
});

module.exports = { limiter, authLimiter, messageLimiter };