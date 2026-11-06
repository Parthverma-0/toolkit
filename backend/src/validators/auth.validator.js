const { body } = require('express-validator');
const { SELF_SIGNUP_ROLES, ACQUISITION_SOURCES } = require('../utils/constants');
const { normalizePhone } = require('../utils/phone');

const googleAuth = [
  body('credential').isString().withMessage('Google credential is required').bail()
    .notEmpty().withMessage('Google credential is required'),
  body('role').optional().isIn(SELF_SIGNUP_ROLES).withMessage(`role must be one of: ${SELF_SIGNUP_ROLES.join(', ')}`),
  body('intent').optional().isIn(['login', 'signup']).withMessage('intent must be login or signup'),
  body('acquisition.source').optional().isIn(ACQUISITION_SOURCES),
  body(['acquisition.incubator', 'acquisition.campaign', 'acquisition.event']).optional().isMongoId(),
];

// Normalizes `target` in place so the controller gets a canonical email / phone
const otpTarget = [
  body('channel').isIn(['email', 'phone']).withMessage('channel must be email or phone'),
  body('target')
    .isString().withMessage('target is required').bail().trim().notEmpty().withMessage('target is required')
    .bail()
    .custom((value, { req }) => {
      if (req.body.channel === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Invalid email address');
        return true;
      }
      if (!normalizePhone(value)) throw new Error('Invalid phone number');
      return true;
    })
    .customSanitizer((value, { req }) => (req.body.channel === 'phone' ? normalizePhone(value) : value.toLowerCase())),
];

const sendOtp = [...otpTarget];

const verifyOtp = [
  ...otpTarget,
  body('code').isString().trim().matches(/^\d{6}$/).withMessage('code must be 6 digits'),
];

module.exports = { googleAuth, sendOtp, verifyOtp };
