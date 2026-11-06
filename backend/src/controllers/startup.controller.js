const { Startup } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick, applyUpdates } = require('../utils/object');
const { toPublicUrl, removeFile } = require('../services/storage.service');
const {
  assertStartupEmailVerified, getOnboardingStatus, refreshProfileCompletion,
} = require('../services/startup.service');

const STARTUP_FIELDS = [
  'name', 'startupEmail', 'cin', 'dpiitNumber', 'sector', 'stage', 'problemStatement', 'solution',
  'tagline', 'website', 'foundedOn', 'teamSize', 'address', 'socialLinks',
];
// Locked once the platform has verified the startup
const LEGAL_FIELDS = ['cin', 'dpiitNumber'];

// GET /api/startups/me  -> startup (or null) + onboarding checklist for the frontend
const getMyStartup = asyncHandler(async (req, res) => {
  const startup = await Startup.findOne({ owner: req.user._id }).populate({ path: 'founders', options: { sort: { isPrimary: -1 } } });
  const onboarding = await getOnboardingStatus(req.user, startup);
  res.json({ success: true, data: startup, onboarding });
});

// POST /api/startups/me  (multipart, `logo` file required)
const createMyStartup = asyncHandler(async (req, res) => {
  if (await Startup.exists({ owner: req.user._id })) {
    throw ApiError.conflict('You have already created a startup profile. Use PATCH to update it.');
  }
  const logo = req.files?.logo?.[0];
  if (!logo) throw ApiError.badRequest('Startup logo is required');

  const data = pick(req.body, STARTUP_FIELDS);
  await assertStartupEmailVerified(req.user, data.startupEmail);

  const startup = await Startup.create({ ...data, logo: toPublicUrl(logo), owner: req.user._id });
  req.user.startup = startup._id;
  await req.user.save();

  const onboarding = await refreshProfileCompletion(startup, req.user);
  res.status(201).json({ success: true, data: startup, onboarding });
});

// PATCH /api/startups/me  (multipart, optional new `logo`)
const updateMyStartup = asyncHandler(async (req, res) => {
  const startup = await Startup.findOne({ owner: req.user._id });
  if (!startup) throw ApiError.notFound('Create your startup profile first');

  const updates = pick(req.body, STARTUP_FIELDS);
  if (startup.isVerified) {
    const changed = LEGAL_FIELDS.filter((f) => updates[f] !== undefined && updates[f] !== startup[f]);
    if (changed.length) throw ApiError.badRequest(`${changed.join(', ')} cannot be changed after verification`);
  }
  if (updates.startupEmail && updates.startupEmail !== startup.startupEmail) {
    await assertStartupEmailVerified(req.user, updates.startupEmail);
  }

  const logo = req.files?.logo?.[0];
  const oldLogo = startup.logo;
  if (logo) updates.logo = toPublicUrl(logo);

  applyUpdates(startup, updates, ['address', 'socialLinks']);
  await startup.save();
  if (logo) await removeFile(oldLogo);

  const onboarding = await refreshProfileCompletion(startup, req.user);
  res.json({ success: true, data: startup, onboarding });
});

module.exports = { getMyStartup, createMyStartup, updateMyStartup };
