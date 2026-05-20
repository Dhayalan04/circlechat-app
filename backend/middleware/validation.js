const { body, param, validationResult } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  };
};

const userValidation = {
  signup: [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be 3-30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  login: [
    body('username').trim().notEmpty().withMessage('Username required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
};

const circleValidation = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Circle name must be 1-50 characters'),
  ],
  join: [
    body('inviteCode')
      .trim()
      .isLength({ min: 6, max: 6 })
      .withMessage('Invalid invite code format'),
  ],
};

const messageValidation = {
  send: [
    body('content')
      .trim()
      .notEmpty()
      .withMessage('Message cannot be empty')
      .isLength({ max: 2000 })
      .withMessage('Message too long (max 2000 characters)'),
  ],
};

module.exports = { validate, userValidation, circleValidation, messageValidation };