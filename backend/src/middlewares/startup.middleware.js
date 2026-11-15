const { Startup } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Startups reach the dashboard right after signing up, without a profile. Browsing works;
// actions (tools, applying, booking, connecting, ...) need the profile. Those routes answer
// 403 with code PROFILE_INCOMPLETE and the frontend shows the "complete your profile" popup.

const profileIncomplete = () => ApiError.forbidden('Complete your startup profile to continue').withCode('PROFILE_INCOMPLETE');

// Sets req.startup to the logged-in startup user's startup, or null when there is none yet
const loadStartup = asyncHandler(async (req, res, next) => {
  req.startup = await Startup.findOne({ owner: req.user._id });
  next();
});

// Gate for actions: the startup must exist and have its required fields (name, email, sector, stage)
const requireCompleteProfile = [
  loadStartup,
  (req, res, next) => (req.startup?.isProfileComplete ? next() : next(profileIncomplete())),
];

// Same gate; kept as a separate name for routes that only need the startup to exist
const requireStartup = requireCompleteProfile;

// For routes shared with other roles (mentoring, events): only startups go through the gate
const requireCompleteProfileIfStartup = (req, res, next) => {
  if (req.user.role !== 'startup') return next();
  const [loadIt, check] = requireCompleteProfile;
  loadIt(req, res, (err) => (err ? next(err) : check(req, res, next)));
};

// "My ..." lists: a startup without a profile simply has nothing yet
const listOrEmpty = (req, res, next) => {
  if (req.user.role !== 'startup') return next();
  loadStartup(req, res, (err) => {
    if (err) return next(err);
    if (!req.startup) return res.json({ success: true, data: [] });
    next();
  });
};

module.exports = {
  requireStartup, loadStartup, requireCompleteProfile, requireCompleteProfileIfStartup, listOrEmpty,
};
