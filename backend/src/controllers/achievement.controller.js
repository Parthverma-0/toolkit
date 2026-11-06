const { Achievement, Enrollment } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick } = require('../utils/object');

const FIELDS = ['type', 'title', 'description', 'date', 'proofUrl'];

// =============== Incubator side (after requireIncubator) ===============
// Achievements the incubator records are verified by default; ones a startup
// self-reports show up here unverified until the incubator verifies them.

const incubatorStartupIds = (req) => Enrollment.distinct('startup', { incubator: req.incubator._id });

const findForIncubator = async (req) => {
  const achievement = await Achievement.findById(req.params.id);
  const ids = (await incubatorStartupIds(req)).map(String);
  if (!achievement || !ids.includes(String(achievement.startup))) throw ApiError.notFound('Achievement not found');
  return achievement;
};

// GET /api/incubators/me/achievements?startup=&type=&verified=
const listAchievements = asyncHandler(async (req, res) => {
  const ids = await incubatorStartupIds(req);
  // ?startup= must still be one of this incubator's startups
  const startupFilter = req.query.startup
    ? ids.find((sid) => sid.equals(req.query.startup)) || null
    : { $in: ids };
  if (!startupFilter) return res.json({ success: true, data: [] });

  const filter = { startup: startupFilter };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.verified !== undefined) filter.isVerified = req.query.verified;

  const items = await Achievement.find(filter).populate('startup', 'name logo').sort({ date: -1 });
  res.json({ success: true, data: items });
});

// POST /api/incubators/me/achievements  { startup, type, title, date, ... }
const createAchievement = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findOne({ incubator: req.incubator._id, startup: req.body.startup }).sort({ onboardedAt: -1 });
  if (!enrollment) throw ApiError.badRequest('startup is not part of your incubator');

  const achievement = await Achievement.create({
    ...pick(req.body, FIELDS),
    startup: enrollment.startup,
    incubator: req.incubator._id,
    cohort: enrollment.cohort,
    isVerified: true,
    verifiedBy: req.user._id,
  });
  res.status(201).json({ success: true, data: achievement });
});

// PATCH /api/incubators/me/achievements/:id  (edit, or { isVerified: true } to verify)
const updateAchievement = asyncHandler(async (req, res) => {
  const achievement = await findForIncubator(req);
  achievement.set(pick(req.body, FIELDS));
  if (req.body.isVerified !== undefined) {
    achievement.isVerified = req.body.isVerified;
    achievement.verifiedBy = req.body.isVerified ? req.user._id : undefined;
  }
  await achievement.save();
  res.json({ success: true, data: achievement });
});

// DELETE /api/incubators/me/achievements/:id
const deleteAchievement = asyncHandler(async (req, res) => {
  const achievement = await findForIncubator(req);
  await achievement.deleteOne();
  res.json({ success: true, message: 'Achievement deleted' });
});

// =============== Startup side (after requireStartup) ===============

// GET /api/startups/me/achievements
const listMyAchievements = asyncHandler(async (req, res) => {
  const items = await Achievement.find({ startup: req.startup._id }).sort({ date: -1 });
  res.json({ success: true, data: items });
});

// POST /api/startups/me/achievements  (unverified until the incubator confirms)
const createMyAchievement = asyncHandler(async (req, res) => {
  const achievement = await Achievement.create({
    ...pick(req.body, FIELDS),
    startup: req.startup._id,
    incubator: req.startup.incubator,
    cohort: req.startup.currentCohort,
    isVerified: false,
  });
  res.status(201).json({ success: true, data: achievement });
});

// DELETE /api/startups/me/achievements/:id  (only unverified ones)
const deleteMyAchievement = asyncHandler(async (req, res) => {
  const achievement = await Achievement.findOne({ _id: req.params.id, startup: req.startup._id });
  if (!achievement) throw ApiError.notFound('Achievement not found');
  if (achievement.isVerified) throw ApiError.badRequest('Verified achievements can only be removed by your incubator');
  await achievement.deleteOne();
  res.json({ success: true, message: 'Achievement deleted' });
});

module.exports = {
  listAchievements,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  listMyAchievements,
  createMyAchievement,
  deleteMyAchievement,
};
