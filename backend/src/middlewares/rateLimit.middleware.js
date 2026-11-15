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

// AI reports cost money and quota: per logged-in user, not per IP
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?._id),
  message: { success: false, message: 'You have generated many reports in the last hour. Please try again later.' },
});

module.exports = { authLimiter, otpSendLimiter, reportLimiter };
