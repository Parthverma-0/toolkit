const rateLimit = require('express-rate-limit');

const make = (windowMinutes, limit, message) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message },
});

const authLimiter = make(15, 50, 'Too many auth requests, try again later');
const otpSendLimiter = make(15, 5, 'Too many OTP requests, try again in 15 minutes');

module.exports = { authLimiter, otpSendLimiter };
