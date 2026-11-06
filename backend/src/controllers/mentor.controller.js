const { MentorProfile, User, Video } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick } = require('../utils/object');
const { getPagination, paginationMeta } = require('../utils/pagination');
const { toPublicUrl, removeFile } = require('../services/storage.service');

const PROFILE_FIELDS = ['designation', 'organization', 'bio', 'yearsOfExperience', 'expertise', 'sectors', 'linkedin', 'website', 'availability'];
const PUBLIC_USER_FIELDS = 'name avatar';

// GET /api/mentors/me/profile
const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await MentorProfile.findOne({ user: req.user._id }).populate('user', PUBLIC_USER_FIELDS);
  res.json({ success: true, data: profile }); // null until the mentor fills it in
});

// PUT /api/mentors/me/profile  (multipart, optional `photo` file) - create or update
const upsertMyProfile = asyncHandler(async (req, res) => {
  const update = pick(req.body, PROFILE_FIELDS);
  const photo = req.files?.photo?.[0];
  const existing = await MentorProfile.findOne({ user: req.user._id }).select('photo');
  if (photo) update.photo = toPublicUrl(photo);

  const profile = await MentorProfile.findOneAndUpdate(
    { user: req.user._id },
    { $set: update },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).populate('user', PUBLIC_USER_FIELDS);

  if (photo && existing?.photo) await removeFile(existing.photo);
  res.json({ success: true, data: profile });
});

// GET /api/mentors?expertise=&sector=&q=&page=&limit=
const listMentors = asyncHandler(async (req, res) => {
  const { expertise, sector, q } = req.query;
  const pagination = getPagination(req.query);

  const userFilter = { role: 'mentor', status: 'active' };
  if (q) userFilter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const userIds = await User.find(userFilter).distinct('_id');

  const filter = { user: { $in: userIds } };
  if (expertise) filter.expertise = expertise;
  if (sector) filter.sectors = sector;

  const [items, total] = await Promise.all([
    MentorProfile.find(filter)
      .populate('user', PUBLIC_USER_FIELDS)
      .sort({ isVerified: -1, yearsOfExperience: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    MentorProfile.countDocuments(filter),
  ]);

  res.json({ success: true, data: items, pagination: paginationMeta(pagination, total) });
});

// GET /api/mentors/:id  (id = mentor's user id)
const getMentor = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'mentor', status: 'active' }).select(PUBLIC_USER_FIELDS);
  if (!user) throw ApiError.notFound('Mentor not found');

  const [profile, publishedVideos] = await Promise.all([
    MentorProfile.findOne({ user: user._id }),
    Video.countDocuments({ mentor: user._id, status: 'published' }),
  ]);

  res.json({ success: true, data: { user, profile, stats: { publishedVideos } } });
});

module.exports = { getMyProfile, upsertMyProfile, listMentors, getMentor };
