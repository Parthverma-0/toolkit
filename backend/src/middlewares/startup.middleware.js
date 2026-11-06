const { Startup } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Attaches the logged-in startup user's startup as req.startup (use after protect + authorize('startup'))
const requireStartup = asyncHandler(async (req, res, next) => {
  const startup = await Startup.findOne({ owner: req.user._id });
  if (!startup) throw ApiError.notFound('Create your startup profile first');
  req.startup = startup;
  next();
});

// Like requireStartup but doesn't fail when the profile doesn't exist yet
const loadStartup = asyncHandler(async (req, res, next) => {
  req.startup = await Startup.findOne({ owner: req.user._id });
  next();
});

// Gate for dashboard features: tools, mentoring, investors, grants, ...
const requireCompleteProfile = [
  requireStartup,
  (req, res, next) => {
    if (!req.startup.isProfileComplete) {
      const err = ApiError.forbidden('Complete your startup and founder profile to access the dashboard');
      err.details = { code: 'PROFILE_INCOMPLETE' };
      return next(err);
    }
    next();
  },
];

// For routes shared with other roles (e.g. mentoring): only startups go through the gate
const requireCompleteProfileIfStartup = (req, res, next) => {
  if (req.user.role !== 'startup') return next();
  const [loadIt, check] = requireCompleteProfile;
  loadIt(req, res, (err) => (err ? next(err) : check(req, res, next)));
};

module.exports = {
  requireStartup, loadStartup, requireCompleteProfile, requireCompleteProfileIfStartup,
};
