const {
  Incubator, Program, Grant, Enrollment,
} = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick, applyUpdates } = require('../utils/object');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { toPublicUrl, removeFile } = require('../services/storage.service');
const { track } = require('../services/funnel.service');
const { ACQUISITION_SOURCES } = require('../utils/constants');

const PROFILE_FIELDS = ['name', 'type', 'email', 'phone', 'about', 'hostInstitution', 'establishedYear', 'sectorsFocused', 'website', 'address'];
// What startups see in the directory / public profile (no members, seats or head)
const PUBLIC_FIELDS = 'name logo about type hostInstitution establishedYear sectorsFocused email phone website address services policies accessibilities isVerified';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// POST /api/incubators/me  (head registers the incubator; multipart, optional `logo`)
const registerIncubator = asyncHandler(async (req, res) => {
  if (req.user.incubatorRole !== 'head') throw ApiError.forbidden('Only an incubator head can register an incubator');
  if (req.user.incubator) throw ApiError.conflict('You have already registered an incubator. Use PATCH to update it.');

  const data = pick(req.body, PROFILE_FIELDS);
  const logo = req.files?.logo?.[0];
  if (logo) data.logo = toPublicUrl(logo);

  const incubator = await Incubator.create({ ...data, head: req.user._id, members: [req.user._id] });
  req.user.incubator = incubator._id;
  await req.user.save();

  res.status(201).json({ success: true, data: incubator });
});

// GET /api/incubators/me  (any seat holder)
const getMyIncubator = asyncHandler(async (req, res) => {
  await req.incubator.populate('members', 'name email avatar incubatorRole status lastLoginAt');
  res.json({ success: true, data: req.incubator });
});

// PATCH /api/incubators/me  (any seat holder; multipart, optional new `logo`)
const updateMyIncubator = asyncHandler(async (req, res) => {
  const { incubator } = req;
  const updates = pick(req.body, PROFILE_FIELDS);
  const logo = req.files?.logo?.[0];
  const oldLogo = incubator.logo;
  if (logo) updates.logo = toPublicUrl(logo);

  applyUpdates(incubator, updates, ['address']);
  await incubator.save();
  if (logo && oldLogo) await removeFile(oldLogo);

  res.json({ success: true, data: incubator });
});

// GET /api/incubators?sector=&type=&city=&state=&q=  (directory for startups)
const listIncubators = asyncHandler(async (req, res) => {
  const {
    sector, type, city, state, q,
  } = req.query;
  const pagination = getPagination(req.query);

  const filter = { status: { $ne: 'suspended' } };
  if (sector) filter.sectorsFocused = sector;
  if (type) filter.type = type;
  if (city) filter['address.city'] = { $regex: `^${escapeRegex(city)}$`, $options: 'i' };
  if (state) filter['address.state'] = { $regex: `^${escapeRegex(state)}$`, $options: 'i' };
  if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };

  const [items, total] = await Promise.all([
    Incubator.find(filter)
      .select('name logo about type hostInstitution sectorsFocused address isVerified')
      .sort({ isVerified: -1, name: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Incubator.countDocuments(filter),
  ]);

  res.json({ success: true, data: items, pagination: paginationMeta(pagination, total) });
});

// GET /api/incubators/:id?source=  (public profile; startup views feed the IC funnel)
const getIncubator = asyncHandler(async (req, res) => {
  const incubator = await Incubator.findOne({ _id: req.params.id, status: { $ne: 'suspended' } }).select(PUBLIC_FIELDS);
  if (!incubator) throw ApiError.notFound('Incubator not found');

  const [programs, grants, activeStartups] = await Promise.all([
    Program.find({ incubator: incubator._id, status: 'active' }).sort({ createdAt: -1 }),
    Grant.find({ incubator: incubator._id, status: { $in: ['open', 'upcoming'] } }).sort({ deadline: 1 }),
    Enrollment.countDocuments({ incubator: incubator._id, status: 'active' }),
  ]);

  if (req.user.role === 'startup') {
    const source = ACQUISITION_SOURCES.includes(req.query.source) ? req.query.source : 'platform_search';
    await track({
      incubator: incubator._id, stage: 'ic_profile_viewed', user: req.user._id, startup: req.user.startup, source,
    });
  }

  res.json({
    success: true,
    data: {
      ...incubator.toObject(), programs, grants, stats: { activeStartups },
    },
  });
});

module.exports = {
  registerIncubator, getMyIncubator, updateMyIncubator, listIncubators, getIncubator,
};
