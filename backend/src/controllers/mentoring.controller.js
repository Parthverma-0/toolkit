const { MentoringSession } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, paginationMeta } = require('../utils/pagination');
const mentoring = require('../services/mentoring.service');

// Shared by mentors and startups; each only sees sessions they are part of.

const loadSession = async (req) => {
  const session = await MentoringSession.findById(req.params.id);
  if (!session) throw ApiError.notFound('Session not found');
  if (!mentoring.isMentorOf(session, req.user) && !mentoring.isStartupOf(session, req.user)) {
    throw ApiError.notFound('Session not found');
  }
  return session;
};

const populated = (session) => session.populate([
  { path: 'mentor', select: 'name avatar' },
  { path: 'startup', select: 'name logo sector stage' },
]);

// POST /api/mentoring/sessions  (startup)
const requestSession = asyncHandler(async (req, res) => {
  const session = await mentoring.requestSession({ user: req.user, startup: req.startup, body: req.body });
  res.status(201).json({ success: true, data: await populated(session) });
});

// GET /api/mentoring/sessions?status=&upcoming=true
const listSessions = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query, { defaultLimit: 20 });
  const filter = req.user.role === 'mentor' ? { mentor: req.user._id } : { startup: req.startup._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.upcoming) {
    filter.scheduledAt = { $gte: new Date() };
    filter.status = filter.status || { $in: ['requested', 'confirmed'] };
  }

  const [items, total] = await Promise.all([
    MentoringSession.find(filter)
      .populate('mentor', 'name avatar')
      .populate('startup', 'name logo')
      .sort({ scheduledAt: req.query.upcoming ? 1 : -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    MentoringSession.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, pagination: paginationMeta(pagination, total) });
});

// GET /api/mentoring/sessions/:id
const getSession = asyncHandler(async (req, res) => {
  const session = await loadSession(req);
  res.json({ success: true, data: await populated(session) });
});

const action = (fn) => asyncHandler(async (req, res) => {
  const session = await loadSession(req);
  await fn(session, req);
  res.json({ success: true, data: await populated(session) });
});

module.exports = {
  requestSession,
  listSessions,
  getSession,
  // PATCH /api/mentoring/sessions/:id/confirm  { meetingLink?, location? }  (mentor)
  confirmSession: action((s, req) => mentoring.confirm(s, req.user, req.body)),
  // PATCH /api/mentoring/sessions/:id/reject  { reason? }  (mentor)
  rejectSession: action((s, req) => mentoring.reject(s, req.user, req.body.reason)),
  // PATCH /api/mentoring/sessions/:id/cancel  { reason? }  (either side)
  cancelSession: action((s, req) => mentoring.cancel(s, req.user, req.body.reason)),
  // PATCH /api/mentoring/sessions/:id/complete  { mentorNotes? }  (mentor)
  completeSession: action((s, req) => mentoring.complete(s, req.user, req.body.mentorNotes)),
  // POST /api/mentoring/sessions/:id/feedback  { rating, comment? }  (startup)
  sessionFeedback: action((s, req) => mentoring.giveFeedback(s, req.user, req.body)),
};
