const asyncHandler = require('../utils/asyncHandler');
const { upsertMonthlyMetric, listMetrics } = require('../services/metric.service');

// Startup self-reported monthly numbers (after requireStartup)

// POST /api/startups/me/metrics  { month, year, revenue?, expenses?, customers?, employees?, custom? }
const recordMyMetric = asyncHandler(async (req, res) => {
  const metric = await upsertMonthlyMetric({
    startupId: req.startup._id,
    cohortId: req.startup.currentCohort,
    month: req.body.month,
    year: req.body.year,
    values: req.body,
    custom: req.body.custom,
    userId: req.user._id,
  });
  res.json({ success: true, data: metric });
});

// GET /api/startups/me/metrics?fromMonth=&fromYear=&toMonth=&toYear=
const listMyMetrics = asyncHandler(async (req, res) => {
  const { fromMonth, fromYear, toMonth, toYear } = req.query;
  const metrics = await listMetrics(req.startup._id, {
    from: fromYear && { year: fromYear, month: fromMonth || 1 },
    to: toYear && { year: toYear, month: toMonth || 12 },
  });
  res.json({ success: true, data: metrics });
});

module.exports = { recordMyMetric, listMyMetrics };
