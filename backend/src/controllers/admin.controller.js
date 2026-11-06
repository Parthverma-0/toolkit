const {
  User, Incubator, MentorProfile, Startup, Grant, GrantApplication, Investor, Enrollment, Cohort,
} = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick, applyUpdates } = require('../utils/object');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { SEATS_PER_UNIT } = require('../utils/constants');

// Platform admin: incubator verification + seat units, mentor verification, user suspension,
// external (government / corporate) grants and investor moderation.

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const textMatch = (qs, fields) => (qs ? { $or: fields.map((f) => ({ [f]: new RegExp(escapeRegex(qs), 'i') })) } : {});

const paged = async (req, model, filter, build) => {
  const pagination = getPagination(req.query, { defaultLimit: 25, maxLimit: 100 });
  const [items, total] = await Promise.all([
    build(model.find(filter)).skip(pagination.skip).limit(pagination.limit),
    model.countDocuments(filter),
  ]);
  return { success: true, data: items, pagination: paginationMeta(pagination, total) };
};

// GET /api/admin/stats
const getStats = asyncHandler(async (req, res) => {
  const [users, incubators, mentorsUnverified, startups, openGrants, activeEnrollments, cohorts] = await Promise.all([
    User.aggregate([{ $group: { _id: { role: '$role', status: '$status' }, count: { $sum: 1 } } }]),
    Incubator.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, verified: { $sum: { $cond: ['$isVerified', 1, 0] } } } }]),
    MentorProfile.countDocuments({ isVerified: false }),
    Startup.countDocuments(),
    Grant.countDocuments({ status: 'open' }),
    Enrollment.countDocuments({ status: 'active' }),
    Cohort.countDocuments(),
  ]);
  const usersByRole = {};
  users.forEach(({ _id, count }) => {
    usersByRole[_id.role] ||= { total: 0 };
    usersByRole[_id.role].total += count;
    usersByRole[_id.role][_id.status] = count;
  });
  const incubatorsByStatus = Object.fromEntries(incubators.map((i) => [i._id, i.count]));
  res.json({
    success: true,
    data: {
      users: usersByRole,
      incubators: { ...incubatorsByStatus, verified: incubators.reduce((s, i) => s + i.verified, 0) },
      pendingReview: { incubators: incubatorsByStatus.pending || 0, mentors: mentorsUnverified },
      startups,
      openGrants,
      activeEnrollments,
      cohorts,
    },
  });
});

// ---------- Incubators ----------

// GET /api/admin/incubators?status=&verified=&q=
const listIncubators = asyncHandler(async (req, res) => {
  const filter = { ...pick(req.query, ['status']), ...textMatch(req.query.q, ['name', 'email', 'address.city']) };
  if (req.query.verified !== undefined) filter.isVerified = req.query.verified;
  res.json(await paged(req, Incubator, filter, (qy) => qy
    .select('name logo type email phone address.city address.state isVerified status units members createdAt')
    .populate('head', 'name email')
    .sort({ status: 1, createdAt: -1 })));
});

// GET /api/admin/incubators/:id
const getIncubator = asyncHandler(async (req, res) => {
  const incubator = await Incubator.findById(req.params.id).populate('members', 'name email incubatorRole status lastLoginAt');
  if (!incubator) throw ApiError.notFound('Incubator not found');
  const [cohorts, activeStartups] = await Promise.all([
    Cohort.countDocuments({ incubator: incubator._id }),
    Enrollment.countDocuments({ incubator: incubator._id, status: 'active' }),
  ]);
  res.json({ success: true, data: { ...incubator.toObject(), stats: { cohorts, activeStartups } } });
});

// PATCH /api/admin/incubators/:id  { isVerified?, status?, units? }
// Verifying a pending incubator also activates it.
const updateIncubator = asyncHandler(async (req, res) => {
  const incubator = await Incubator.findById(req.params.id);
  if (!incubator) throw ApiError.notFound('Incubator not found');
  const { isVerified, status, units } = req.body;

  if (units !== undefined && units * SEATS_PER_UNIT < incubator.members.length) {
    const minUnits = Math.ceil(incubator.members.length / SEATS_PER_UNIT);
    throw ApiError.badRequest(`${incubator.members.length} seats are in use, so units cannot go below ${minUnits}`);
  }
  incubator.set(pick(req.body, ['isVerified', 'status', 'units']));
  if (isVerified === true && !status && incubator.status === 'pending') incubator.status = 'active';
  await incubator.save();
  res.json({ success: true, data: incubator });
});

// ---------- Mentors ----------

// GET /api/admin/mentors?verified=&q=
const listMentors = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.verified !== undefined) filter.isVerified = req.query.verified;
  if (req.query.q) {
    const users = await User.find({ role: 'mentor', ...textMatch(req.query.q, ['name', 'email']) }).distinct('_id');
    filter.user = { $in: users };
  }
  res.json(await paged(req, MentorProfile, filter, (qy) => qy
    .select('user photo designation organization yearsOfExperience expertise linkedin isVerified createdAt')
    .populate('user', 'name email status')
    .sort({ isVerified: 1, createdAt: -1 })));
});

// PATCH /api/admin/mentors/:id/verify  { isVerified }   (:id = MentorProfile id)
const verifyMentor = asyncHandler(async (req, res) => {
  const profile = await MentorProfile.findByIdAndUpdate(req.params.id, { isVerified: req.body.isVerified }, { new: true });
  if (!profile) throw ApiError.notFound('Mentor profile not found');
  res.json({ success: true, data: profile });
});

// ---------- Users ----------

// GET /api/admin/users?role=&status=&q=
const listUsers = asyncHandler(async (req, res) => {
  const filter = { ...pick(req.query, ['role', 'status']), ...textMatch(req.query.q, ['name', 'email']) };
  res.json(await paged(req, User, filter, (qy) => qy
    .select('name email role status incubator incubatorRole startup lastLoginAt createdAt')
    .sort({ createdAt: -1 })));
});

// PATCH /api/admin/users/:id/status  { status: active | suspended }
// Suspending also revokes every refresh token; protect() rejects the user immediately.
const setUserStatus = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.user._id)) throw ApiError.badRequest("You can't change your own status");
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === 'admin') throw ApiError.forbidden('Admins are managed with scripts/createAdmin.js');
  if (user.status === 'invited') throw ApiError.badRequest('Invited seats are managed by the incubator head');

  const update = { status: req.body.status };
  if (req.body.status === 'suspended') update.$inc = { tokenVersion: 1 };
  const updated = await User.findByIdAndUpdate(user._id, update, { new: true });
  res.json({ success: true, data: updated });
});

// ---------- Startups ----------

// GET /api/admin/startups?q=
const listStartups = asyncHandler(async (req, res) => {
  const filter = textMatch(req.query.q, ['name', 'cin', 'dpiitNumber']);
  res.json(await paged(req, Startup, filter, (qy) => qy
    .select('name logo sector stage cin dpiitNumber owner createdAt')
    .populate('owner', 'name email status')
    .sort({ createdAt: -1 })));
});

// ---------- External grants ----------
const GRANT_FIELDS = ['title', 'provider', 'providerType', 'description', 'amount', 'eligibility', 'sectors', 'stages',
  'applicationUrl', 'opensAt', 'deadline', 'status'];

const findExternalGrant = async (id) => {
  const grant = await Grant.findOne({ _id: id, providerType: { $ne: 'incubator' } });
  if (!grant) throw ApiError.notFound('Grant not found (incubator grants are managed by their incubator)');
  return grant;
};

// GET /api/admin/grants?status=&providerType=
const listGrants = asyncHandler(async (req, res) => {
  const filter = pick(req.query, ['status', 'providerType']);
  res.json(await paged(req, Grant, filter, (qy) => qy.populate('incubator', 'name').sort({ createdAt: -1 })));
});

// POST /api/admin/grants
const createGrant = asyncHandler(async (req, res) => {
  const grant = await Grant.create({ ...pick(req.body, GRANT_FIELDS), createdBy: req.user._id });
  res.status(201).json({ success: true, data: grant });
});

// PATCH /api/admin/grants/:id
const updateGrant = asyncHandler(async (req, res) => {
  const grant = await findExternalGrant(req.params.id);
  applyUpdates(grant, pick(req.body, GRANT_FIELDS), ['amount']);
  if (grant.amount?.min > grant.amount?.max) throw ApiError.badRequest('amount.min cannot be greater than amount.max');
  if (grant.opensAt && grant.deadline && grant.deadline <= grant.opensAt) throw ApiError.badRequest('deadline must be after opensAt');
  await grant.save();
  res.json({ success: true, data: grant });
});

// DELETE /api/admin/grants/:id  (blocked once startups have applied; close it instead)
const deleteGrant = asyncHandler(async (req, res) => {
  const grant = await findExternalGrant(req.params.id);
  if (await GrantApplication.exists({ grant: grant._id })) {
    throw ApiError.conflict('Startups have applied to this grant. Set status to closed instead of deleting.');
  }
  await grant.deleteOne();
  res.json({ success: true, message: 'Grant deleted' });
});

// ---------- Investors ----------

// PATCH /api/admin/investors/:id  { isActive }  (hide / restore a directory entry)
const setInvestorActive = asyncHandler(async (req, res) => {
  const investor = await Investor.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true });
  if (!investor) throw ApiError.notFound('Investor not found');
  res.json({ success: true, data: investor });
});

module.exports = {
  getStats,
  listIncubators,
  getIncubator,
  updateIncubator,
  listMentors,
  verifyMentor,
  listUsers,
  setUserStatus,
  listStartups,
  listGrants,
  createGrant,
  updateGrant,
  deleteGrant,
  setInvestorActive,
};
