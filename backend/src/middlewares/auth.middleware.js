const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ACCESS_COOKIE, verifyAccessToken } = require('../services/token.service');

// Requires a valid access token (httpOnly cookie, or Bearer header for API clients)
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies?.[ACCESS_COOKIE] || (header?.startsWith('Bearer ') && header.slice(7));
  if (!token) throw ApiError.unauthorized();
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Session expired');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (user.status !== 'active') throw ApiError.forbidden('Account is not active');
  req.user = user;
  next();
});

// Usage: router.post('/videos', protect, authorize('mentor'), createVideo)
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

module.exports = { protect, authorize };
