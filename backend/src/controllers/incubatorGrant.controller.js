const { Grant, GrantApplication } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick, applyUpdates } = require('../utils/object');

// Grants offered by the incubator itself (shown on its profile and in the startup grants list).
// All routes run after requireIncubator.
const FIELDS = ['title', 'description', 'amount', 'eligibility', 'sectors', 'stages', 'applicationUrl', 'opensAt', 'deadline', 'status'];

const findGrant = async (req) => {
  const grant = await Grant.findOne({ _id: req.params.id, incubator: req.incubator._id });
  if (!grant) throw ApiError.notFound('Grant not found');
  return grant;
};

// GET /api/incubators/me/grants?status=
const listGrants = asyncHandler(async (req, res) => {
  const filter = { incubator: req.incubator._id };
  if (req.query.status) filter.status = req.query.status;
  const grants = await Grant.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: grants });
});

// GET /api/incubators/me/grants/:id
const getGrant = asyncHandler(async (req, res) => {
  const grant = await findGrant(req);
  const applications = await GrantApplication.countDocuments({ grant: grant._id });
  res.json({ success: true, data: { ...grant.toObject(), stats: { applications } } });
});

// POST /api/incubators/me/grants
const createGrant = asyncHandler(async (req, res) => {
  const grant = await Grant.create({
    ...pick(req.body, FIELDS),
    provider: req.incubator.name,
    providerType: 'incubator',
    incubator: req.incubator._id,
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, data: grant });
});

// PATCH /api/incubators/me/grants/:id
const updateGrant = asyncHandler(async (req, res) => {
  const grant = await findGrant(req);
  applyUpdates(grant, pick(req.body, FIELDS), ['amount']);
  if (grant.amount?.min > grant.amount?.max) throw ApiError.badRequest('amount.min cannot be greater than amount.max');
  if (grant.opensAt && grant.deadline && grant.deadline <= grant.opensAt) throw ApiError.badRequest('deadline must be after opensAt');
  await grant.save();
  res.json({ success: true, data: grant });
});

// DELETE /api/incubators/me/grants/:id  (blocked once startups have applied; close it instead)
const deleteGrant = asyncHandler(async (req, res) => {
  const grant = await findGrant(req);
  if (await GrantApplication.exists({ grant: grant._id })) {
    throw ApiError.conflict('Startups have applied to this grant. Set status to closed instead of deleting.');
  }
  await grant.deleteOne();
  res.json({ success: true, message: 'Grant deleted' });
});

module.exports = {
  listGrants, getGrant, createGrant, updateGrant, deleteGrant,
};
