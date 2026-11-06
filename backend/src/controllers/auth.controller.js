const { User, Founder } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyGoogleIdToken } = require('../services/google.service');
const { signInWithGoogle, needsOnboarding } = require('../services/auth.service');
const otpService = require('../services/otp.service');
const {
  REFRESH_COOKIE, verifyRefreshToken, setAuthCookies, clearAuthCookies,
} = require('../services/token.service');

const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  phone: user.phone,
  isEmailVerified: user.isEmailVerified,
  isPhoneVerified: user.isPhoneVerified,
  incubator: user.incubator,
  incubatorRole: user.incubatorRole,
  startup: user.startup,
  status: user.status,
});

// POST /api/auth/google  { credential, intent?: 'login' | 'signup', role?, acquisition? }
// New email without role -> 200 { requiresRole: true } so the frontend shows the role picker,
// then calls again with the same credential + role.
const googleAuth = asyncHandler(async (req, res) => {
  const {
    credential, role, acquisition, intent,
  } = req.body;
  const profile = await verifyGoogleIdToken(credential);
  const result = await signInWithGoogle(profile, { role, acquisition, intent });

  if (result.requiresRole) {
    return res.json({ success: true, requiresRole: true, profile: result.profile });
  }

  setAuthCookies(res, result.user);
  res.status(result.isNewUser ? 201 : 200).json({
    success: true,
    isNewUser: result.isNewUser,
    needsOnboarding: await needsOnboarding(result.user),
    user: toPublicUser(result.user),
  });
});

// POST /api/auth/refresh  (uses refresh cookie, rotates both tokens)
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    clearAuthCookies(res);
    throw ApiError.unauthorized('Session expired, please sign in again');
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || user.status !== 'active' || user.tokenVersion !== payload.tv) {
    clearAuthCookies(res);
    throw ApiError.unauthorized('Session revoked, please sign in again');
  }

  setAuthCookies(res, user);
  res.json({ success: true, user: toPublicUser(user) });
});

// POST /api/auth/logout  (this device)
const logout = (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true, message: 'Logged out' });
};

// POST /api/auth/logout-all  (revokes refresh tokens on every device)
const logoutAll = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  clearAuthCookies(res);
  res.json({ success: true, message: 'Logged out from all devices' });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, needsOnboarding: await needsOnboarding(req.user), user: toPublicUser(req.user) });
});

// POST /api/auth/otp/send  { channel, target }
const sendOtp = asyncHandler(async (req, res) => {
  const { channel, target } = req.body;
  const result = await otpService.sendOtp({ userId: req.user._id, channel, target });
  res.json({ success: true, message: `OTP sent to ${target}`, ...result });
});

// POST /api/auth/otp/verify  { channel, target, code }
// Verifying a phone also saves it on the account. Verifying another email
// (e.g. startup email) just records proof for the profile step.
const verifyOtp = asyncHandler(async (req, res) => {
  const { channel, target, code } = req.body;
  await otpService.verifyOtp({ userId: req.user._id, channel, target, code });

  if (channel === 'phone') {
    req.user.phone = target;
    req.user.isPhoneVerified = true;
    await req.user.save();
    // Keep the primary founder profile in sync with the account's verified phone
    if (req.user.role === 'startup') {
      await Founder.updateOne({ user: req.user._id, isPrimary: true }, { phone: target, isPhoneVerified: true });
    }
  }

  res.json({ success: true, message: `${channel === 'phone' ? 'Phone' : 'Email'} verified`, user: toPublicUser(req.user) });
});

module.exports = {
  googleAuth, refresh, logout, logoutAll, me, sendOtp, verifyOtp,
};
