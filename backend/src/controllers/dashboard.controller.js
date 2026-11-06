const {
  Enrollment, MentoringSession, Grant, GrantApplication, InvestorConnection, EventRegistration, Video, ToolSubmission,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const TOOLS = require('../config/tools');

const countBy = async (Model, match, field = 'status') => {
  const rows = await Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
};

// GET /api/startups/me/dashboard  (after requireCompleteProfile)
// One call that powers the startup home screen: a card per dashboard section.
const getStartupDashboard = asyncHandler(async (req, res) => {
  const { startup } = req;
  const now = new Date();
  const sectorMatch = { $or: [{ sectors: startup.sector }, { sectors: { $size: 0 } }] };
  const stageMatch = { $or: [{ stages: startup.stage }, { stages: { $size: 0 } }] };

  const [
    enrollment, nextSession, upcomingSessions, matchingGrants, grantApplications,
    investorPipeline, eventRegistrations, latestVideos, toolRuns,
  ] = await Promise.all([
    Enrollment.findOne({ startup: startup._id, status: 'active' })
      .select('cohort milestones marketingChecklist agreement.isSigned')
      .populate({ path: 'cohort', select: 'name endDate incubator', populate: { path: 'incubator', select: 'name logo' } }),
    MentoringSession.findOne({ startup: startup._id, status: 'confirmed', scheduledAt: { $gte: now } })
      .sort({ scheduledAt: 1 })
      .populate('mentor', 'name avatar'),
    MentoringSession.countDocuments({ startup: startup._id, status: { $in: ['requested', 'confirmed'] }, scheduledAt: { $gte: now } }),
    Grant.countDocuments({ status: 'open', $and: [sectorMatch, stageMatch] }),
    countBy(GrantApplication, { startup: startup._id }),
    countBy(InvestorConnection, { startup: startup._id }),
    EventRegistration.find({ user: req.user._id, status: 'registered' })
      .populate({ path: 'event', match: { startsAt: { $gte: now }, status: 'published' }, select: 'title startsAt mode' }),
    Video.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(4)
      .select('title thumbnailUrl category durationSeconds mentor')
      .populate('mentor', 'name'),
    ToolSubmission.aggregate([
      { $match: { startup: startup._id } },
      { $group: { _id: '$toolType', runs: { $sum: 1 }, lastRunAt: { $max: '$createdAt' } } },
    ]),
  ]);

  const upcomingEvents = eventRegistrations.filter((r) => r.event).map((r) => r.event)
    .sort((a, b) => a.startsAt - b.startsAt);
  const toolsByType = Object.fromEntries(toolRuns.map((t) => [t._id, t]));

  res.json({
    success: true,
    data: {
      startup: {
        id: startup._id, name: startup.name, logo: startup.logo, sector: startup.sector, stage: startup.stage,
      },
      incubation: enrollment && {
        enrollmentId: enrollment._id,
        cohort: enrollment.cohort,
        milestones: {
          done: enrollment.milestones.filter((m) => m.status === 'completed').length,
          total: enrollment.milestones.length,
        },
        agreementSigned: enrollment.agreement.isSigned,
      },
      tools: TOOLS.map(({ type, name, status }) => ({
        type, name, status, runs: toolsByType[type]?.runs || 0, lastRunAt: toolsByType[type]?.lastRunAt || null,
      })),
      mentoring: { upcoming: upcomingSessions, next: nextSession },
      videos: { latest: latestVideos },
      investors: { pipeline: investorPipeline },
      grants: { openForYou: matchingGrants, myApplications: grantApplications },
      events: { upcomingRegistered: upcomingEvents.length, next: upcomingEvents[0] || null },
    },
  });
});

module.exports = { getStartupDashboard };
