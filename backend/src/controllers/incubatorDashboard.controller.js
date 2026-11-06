const {
  Startup, Founder, Enrollment, FundingTransaction, Achievement, StartupMetric,
} = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, paginationMeta } = require('../utils/pagination');
const dashboard = require('../services/incubatorDashboard.service');
const { searchStartups } = require('../services/startupDatabase.service');

// All routes run after requireIncubator

// GET /api/incubators/me/dashboard?scope=active|all&from=&to=
// cohorts, startups, external funding, sector bifurcation, revenue per startup, IC fund raised / distributed
const getDashboard = asyncHandler(async (req, res) => {
  const { scope = 'active', from, to } = req.query;
  const [summary, funnel] = await Promise.all([
    dashboard.getSummary(req.incubator._id, { scope, from, to }),
    dashboard.funnel(req.incubator._id, { from, to }),
  ]);
  res.json({
    success: true,
    data: { ...summary, funnel: funnel.stages, seats: { limit: req.incubator.seatLimit, used: req.incubator.members.length } },
    filters: { scope, from: from || null, to: to || null },
  });
});

// GET /api/incubators/me/dashboard/funnel?from=&to=&cohort=&source=
// Founder -> Startup -> IC marketing funnel, with conversion rates and per-channel breakdown
const getFunnel = asyncHandler(async (req, res) => {
  const data = await dashboard.funnel(req.incubator._id, req.query);
  res.json({ success: true, data });
});

// GET /api/incubators/me/dashboard/revenue?scope=&cohort=&from=&to=
const getRevenue = asyncHandler(async (req, res) => {
  const ids = await dashboard.incubatedStartupIds(req.incubator._id, { scope: req.query.scope, cohort: req.query.cohort });
  const byStartup = await dashboard.revenueByStartup(ids, req.query);
  res.json({ success: true, data: { total: byStartup.reduce((s, r) => s + r.totalRevenue, 0), byStartup } });
});

// GET /api/incubators/me/startups?cohort=&program=&status=&onboardedFrom=&onboardedTo=&fundingType=&achievementType=&sector=&stage=&q=
const listStartups = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const { items, total } = await searchStartups(req.incubator._id, req.query, pagination);
  res.json({ success: true, data: items, pagination: paginationMeta(pagination, total) });
});

// GET /api/incubators/me/startups/:startupId  (only startups this incubator has onboarded)
const getStartup = asyncHandler(async (req, res) => {
  const { startupId } = req.params;
  const enrollments = await Enrollment.find({ incubator: req.incubator._id, startup: startupId })
    .populate('cohort', 'name status startDate endDate')
    .populate('program', 'name')
    .sort({ onboardedAt: -1 });
  if (!enrollments.length) throw ApiError.notFound('This startup is not part of your incubator');

  const [startup, founders, funding, achievements, metrics] = await Promise.all([
    Startup.findById(startupId),
    Founder.find({ startup: startupId }).sort({ isPrimary: -1 }),
    FundingTransaction.find({ incubator: req.incubator._id, startup: startupId }).sort({ date: -1 }),
    Achievement.find({ startup: startupId }).sort({ date: -1 }),
    StartupMetric.find({ startup: startupId }).sort({ 'period.year': -1, 'period.month': -1 }).limit(12),
  ]);

  res.json({
    success: true,
    data: {
      startup, founders, enrollments, funding, achievements, metrics,
    },
  });
});

module.exports = {
  getDashboard, getFunnel, getRevenue, listStartups, getStartup,
};
