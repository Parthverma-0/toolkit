const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const incubatorService = require('../services/incubator.service');

const MEMBER_FIELDS = 'name email avatar incubatorRole status lastLoginAt createdAt';

const seatSummary = (incubator) => ({
  limit: incubator.seatLimit,
  used: incubator.members.length,
  available: incubator.seatsAvailable,
});

// GET /api/incubators/me/members
const listMembers = asyncHandler(async (req, res) => {
  const members = await User.find({ _id: { $in: req.incubator.members } })
    .select(MEMBER_FIELDS)
    .sort({ incubatorRole: 1, createdAt: 1 }); // head first
  res.json({ success: true, data: members, seats: seatSummary(req.incubator) });
});

// POST /api/incubators/me/members  { name, email }  (head only)
const inviteMember = asyncHandler(async (req, res) => {
  const user = await incubatorService.inviteMember(req.incubator, req.user, req.body);
  req.incubator.members.push(user._id); // mirror the atomic update for the response
  res.status(201).json({
    success: true,
    message: `Invite sent to ${user.email}`,
    data: await User.findById(user._id).select(MEMBER_FIELDS),
    seats: seatSummary(req.incubator),
  });
});

// POST /api/incubators/me/members/:memberId/resend-invite  (head only)
const resendInvite = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.memberId, incubator: req.incubator._id, status: 'invited' });
  if (!user) throw ApiError.notFound('No pending invite for this member');
  await incubatorService.sendInviteEmail(req.incubator, user, req.user);
  res.json({ success: true, message: `Invite re-sent to ${user.email}` });
});

// DELETE /api/incubators/me/members/:memberId  (head only)
const removeMember = asyncHandler(async (req, res) => {
  await incubatorService.removeMember(req.incubator, req.params.memberId);
  req.incubator.members.pull(req.params.memberId);
  res.json({ success: true, message: 'Member removed, seat freed', seats: seatSummary(req.incubator) });
});

module.exports = {
  listMembers, inviteMember, resendInvite, removeMember,
};
