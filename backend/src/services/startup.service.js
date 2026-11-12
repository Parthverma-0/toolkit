const { Founder } = require('../models');
const ApiError = require('../utils/ApiError');
const { isTargetVerified } = require('./otp.service');
const { trackForUser } = require('./funnel.service');

// Startup email must be the Google login email or one verified via OTP
const assertStartupEmailVerified = async (user, startupEmail) => {
  if (startupEmail === user.email) return;
  const verified = await isTargetVerified({ userId: user._id, channel: 'email', target: startupEmail });
  if (!verified) {
    throw ApiError.badRequest('Verify the startup email with OTP first (POST /api/auth/otp/send with channel "email")');
  }
};

// Total founder equity across the startup can't exceed 100%
const assertEquityWithinLimit = async (startupId, equityPercent, excludeFounderId) => {
  if (equityPercent === undefined || equityPercent === null) return;
  const others = await Founder.find({ startup: startupId, _id: { $ne: excludeFounderId } }).select('equityPercent');
  const total = others.reduce((sum, f) => sum + (f.equityPercent || 0), 0) + equityPercent;
  if (total > 100) throw ApiError.badRequest(`Total founder equity would be ${total}%, max is 100%`);
};

const getOnboardingStatus = async (user, startup) => {
  const hasPrimaryFounder = startup ? Boolean(await Founder.exists({ startup: startup._id, isPrimary: true })) : false;
  return {
    startupProfile: Boolean(startup),
    founderProfile: hasPrimaryFounder,
    isProfileComplete: Boolean(startup?.isProfileComplete),
  };
};

// Dashboard unlocks once: startup profile + primary founder profile.
// Call after any change that could affect completion.
const refreshProfileCompletion = async (startup, user) => {
  const status = await getOnboardingStatus(user, startup);
  const complete = status.startupProfile && status.founderProfile;

  if (complete !== startup.isProfileComplete) {
    startup.isProfileComplete = complete;
    await startup.save();
    if (complete) await trackForUser(user, 'startup_profile_completed', { startup: startup._id });
  }
  return { ...status, isProfileComplete: complete };
};

module.exports = {
  assertStartupEmailVerified, assertEquityWithinLimit, getOnboardingStatus, refreshProfileCompletion,
};
